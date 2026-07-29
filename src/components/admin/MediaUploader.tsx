'use client'

/*
 * MediaUploader — Drag-and-drop media upload component for the admin panel.
 *
 * MPD Task A-07:
 *   "Media upload (Cloudinary) — upload endpoint + UI component."
 *
 * A-07.3 scope:
 *   A single-file, self-contained upload component. One instance per field:
 *     A-08 BikeFormBasic   → heroImageUrl (intent='bike_hero')
 *     A-10 BikeFormGallery → one instance per gallery slot (intent='bike_gallery')
 *     Brand admin form     → logo (intent='brand_logo')
 *     A-08 BikeFormBasic   → 360° video (intent='bike_360')
 *
 * FEATURES:
 *   Drag-and-drop  — full drop zone with drag-over, rejection, and counter
 *   Browse button  — hidden <input type="file"> triggered imperatively
 *   Preview        — <img> object URL for images; filename + size for video
 *   Client validation — MIME type + file size against UPLOAD_CONSTRAINTS
 *   Loading state  — spinner overlay; all controls disabled
 *   Error display  — inline below the zone; clears on next file selection
 *   Success state  — shows Cloudinary URL preview + metadata + blur indicator
 *   currentUrl     — shows existing asset above the zone when editing a bike
 *
 * DRAG COUNTER PATTERN:
 *   dragCounterRef increments on onDragEnter, decrements on onDragLeave,
 *   resets to 0 on onDrop. Visual state only clears when counter = 0.
 *   This prevents the drop-zone highlight from flickering when the cursor
 *   moves between child elements inside the zone.
 *
 * OBJECT URL LIFECYCLE:
 *   URL.createObjectURL() is called once per image file selection.
 *   The URL is stored in previewUrl state.
 *   useEffect captures the URL at effect time and revokes it on cleanup,
 *   preventing memory leaks across re-renders and on unmount.
 *
 * UPLOAD FLOW:
 *   1. User selects file via drag or browse.
 *   2. validateFile() checks MIME type and size → error or previewing phase.
 *   3. User clicks "Upload to Cloudinary".
 *   4. FormData: file + intent + brandSlug + slug [+ index for gallery].
 *   5. POST /api/admin/upload (A-07.2) — no explicit Content-Type header
 *      (browser sets multipart/form-data boundary automatically).
 *   6. 200: onUploadComplete(result, blurDataUrl). Phase → success.
 *   7. Error: setErrorMessage. Phase → previewing (retry without re-selecting).
 *
 * WHY NOT Next.js Image FOR PREVIEWS:
 *   Object URLs (blob:// scheme) cannot be configured in next.config.ts
 *   remotePatterns — they are local, ephemeral, and not served over HTTP.
 *   A regular <img> tag is correct for object URL previews and for the
 *   admin success preview of the Cloudinary URL (admin-only, not LCP).
 *
 * WHY 'use client':
 *   useState (phase, drag state, file, previewUrl, error, result)
 *   useRef (inputRef, dragCounterRef)
 *   useEffect (object URL revocation)
 *   Event handlers: drag, click, keyboard, file input change
 *   fetch() for the upload POST
 *   URL.createObjectURL / URL.revokeObjectURL (browser API)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Icon from '@/components/ui/Icon'
import {
  UPLOAD_CONSTRAINTS,
  type CloudinaryUploadIntent,
  type CloudinaryUploadResult,
} from '@/types/cloudinary'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaUploaderProps {
  /*
   * intent — determines the Cloudinary folder, validation constraints,
   * and resource_type ('image' | 'video'). Passed to the upload API.
   */
  intent: CloudinaryUploadIntent

  /*
   * brandSlug — the brand's URL slug (e.g. 'royal-enfield').
   * Passed to the upload API to construct the Cloudinary public_id.
   */
  brandSlug: string

  /*
   * slug — the bike's URL slug (e.g. 'gt-650').
   * For brand_logo uploads, pass brandSlug for both brandSlug and slug.
   */
  slug: string

  /*
   * index — 1-based gallery position. Required when intent='bike_gallery'.
   * Ignored for all other intents.
   */
  index?: number

  /*
   * onUploadComplete — fires after a successful upload.
   * result.secure_url is the Cloudinary delivery URL to store in MongoDB.
   * blurDataUrl is the base64 JPEG placeholder for Next.js Image blur-up.
   * The parent form is responsible for persisting these via PUT /api/bikes/[id].
   */
  onUploadComplete: (
    result: CloudinaryUploadResult,
    blurDataUrl?: string,
  ) => void

  /*
   * onUploadError — fires after a failed upload with the error message string.
   * Optional — the component also displays the error inline.
   */
  onUploadError?: (message: string) => void

  /*
   * currentUrl — the currently stored Cloudinary URL for this field.
   * When provided in the idle phase, shows a small "Current" preview
   * above the drop zone so the admin can see what is already uploaded.
   */
  currentUrl?: string

  /*
   * label — rendered above the drop zone as a field label.
   * Optional — omit when the parent form already provides context.
   */
  label?: string

  /*
   * hint — additional guidance text below the MIME / size hint.
   * Optional. Example: 'Clean studio shot, full motorcycle visible.'
   */
  hint?: string

  /*
   * disabled — when true the drop zone and all controls are inert.
   */
  disabled?: boolean

  /*
   * className — additional classes on the outermost wrapper div.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type UploadPhase = 'idle' | 'previewing' | 'uploading' | 'success'

interface UploadAPISuccessResponse {
  ok: true
  result: CloudinaryUploadResult
  blurDataUrl?: string
}

interface UploadAPIErrorResponse {
  ok: false
  error: string
}

type UploadAPIResponse = UploadAPISuccessResponse | UploadAPIErrorResponse

// ---------------------------------------------------------------------------
// Pure helpers (no hooks — safe to define at module scope)
// ---------------------------------------------------------------------------

/*
 * formatBytes — human-readable file size string.
 * 512        → '512 B'
 * 204800     → '200 KB'
 * 2621440    → '2.5 MB'
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/*
 * formatMimeLabels — short uppercase labels from MIME type array.
 * ['image/jpeg','image/png','image/webp'] → 'JPG, PNG, WEBP'
 * 'image/svg+xml'   → 'SVG'
 * 'video/quicktime' → 'MOV'
 */
function formatMimeLabels(mimes: string[]): string {
  const MAP: Record<string, string> = {
    'image/jpeg':      'JPG',
    'image/png':       'PNG',
    'image/webp':      'WEBP',
    'image/svg+xml':   'SVG',
    'video/mp4':       'MP4',
    'video/webm':      'WEBM',
    'video/quicktime': 'MOV',
  }
  return mimes
    .map((m) => MAP[m] ?? m.split('/')[1]?.toUpperCase() ?? m)
    .join(', ')
}

/*
 * truncateFilename — shortens a filename preserving the extension.
 * 'royal-enfield-gt-650-studio-photo-high-res.jpg' (max 36)
 * → 'royal-enfield-gt-650-studio-phot….jpg'
 */
function truncateFilename(name: string, max = 36): string {
  if (name.length <= max) return name
  const dot = name.lastIndexOf('.')
  const ext  = dot >= 0 ? name.slice(dot) : ''
  const base = name.slice(0, dot >= 0 ? dot : name.length)
  return `${base.slice(0, max - ext.length - 1)}…${ext}`
}

// ---------------------------------------------------------------------------
// MediaUploader
// ---------------------------------------------------------------------------

export default function MediaUploader({
  intent,
  brandSlug,
  slug,
  index,
  onUploadComplete,
  onUploadError,
  currentUrl,
  label,
  hint,
  disabled = false,
  className = '',
}: MediaUploaderProps) {

  // ── State ──────────────────────────────────────────────────────────────

  const [phase, setPhase]               = useState<UploadPhase>('idle')
  const [isDragOver, setIsDragOver]     = useState(false)
  const [isDragRejected, setIsDragRejected] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<CloudinaryUploadResult | null>(null)
  const [uploadedBlur, setUploadedBlur] = useState<string | undefined>(undefined)

  // ── Refs ───────────────────────────────────────────────────────────────

  const inputRef        = useRef<HTMLInputElement>(null)
  const dragCounterRef  = useRef(0)

  // ── Derived constants ──────────────────────────────────────────────────

  const constraints     = UPLOAD_CONSTRAINTS[intent]
  const isImage         = constraints.resourceType === 'image'
  const acceptAttr      = constraints.acceptedMimeTypes.join(',')
  const maxMBLabel      = `${(constraints.maxBytes / (1024 * 1024)).toFixed(0)}MB`
  const mimeLabel       = formatMimeLabels(constraints.acceptedMimeTypes)

  /*
   * isInteractive — false when disabled or during upload.
   * Gates all drag handlers, click handlers, and keyboard handler.
   */
  const isInteractive   = !disabled && phase !== 'uploading'

  // ── Object URL cleanup ─────────────────────────────────────────────────

  /*
   * Revoke the object URL when previewUrl changes or component unmounts.
   * Capture at effect time (not cleanup time) to always revoke the correct URL.
   */
  useEffect(() => {
    const url = previewUrl
    if (!url) return
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [previewUrl])

  // ── Client-side validation ─────────────────────────────────────────────

  /*
   * validateFile — checks MIME type and file size against UPLOAD_CONSTRAINTS.
   * Returns an error string on failure, null on pass.
   * The server (A-07.2) validates identically — this is a UX improvement only.
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      const mime = file.type.toLowerCase()

      if (!mime) {
        return `Could not detect file type. Accepted: ${mimeLabel}.`
      }

      if (!constraints.acceptedMimeTypes.includes(mime)) {
        return (
          `File type not accepted. ` +
          `Expected: ${mimeLabel}. Received: ${mime}.`
        )
      }

      if (file.size > constraints.maxBytes) {
        const maxMB  = (constraints.maxBytes / (1024 * 1024)).toFixed(0)
        const fileMB = (file.size  / (1024 * 1024)).toFixed(1)
        return (
          `File too large. ` +
          `Maximum: ${maxMB}MB. Selected: ${fileMB}MB.`
        )
      }

      return null
    },
    [constraints, mimeLabel],
  )

  // ── File selection ─────────────────────────────────────────────────────

  /*
   * selectFile — validates and transitions to previewing.
   * Called by both the drop handler and the file input onChange.
   */
  const selectFile = useCallback(
    (file: File) => {
      setErrorMessage(null)

      const err = validateFile(file)
      if (err) {
        setErrorMessage(err)
        return
      }

      /*
       * Create an object URL for image preview.
       * The previous URL (if any) is revoked by the useEffect above.
       */
      setPreviewUrl(isImage ? URL.createObjectURL(file) : null)
      setSelectedFile(file)
      setUploadResult(null)
      setUploadedBlur(undefined)
      setPhase('previewing')
    },
    [validateFile, isImage],
  )

  // ── Reset ──────────────────────────────────────────────────────────────

  /*
   * reset — returns to idle, clears all transient state.
   * The file input value is cleared so the same file can be re-selected
   * (browsers skip onChange when the value does not change).
   */
  const reset = useCallback(() => {
    setPhase('idle')
    setSelectedFile(null)
    setPreviewUrl(null)
    setErrorMessage(null)
    setUploadResult(null)
    setUploadedBlur(undefined)
    setIsDragOver(false)
    setIsDragRejected(false)
    dragCounterRef.current = 0

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [])

  // ── Upload ─────────────────────────────────────────────────────────────

  /*
   * handleUpload — POSTs the selected file to /api/admin/upload.
   *
   * On success: phase → success, fires onUploadComplete.
   * On failure: phase → previewing (retry without re-selecting), fires onUploadError?.
   *
   * Do NOT set a Content-Type header on the fetch — the browser sets
   * multipart/form-data with the correct boundary automatically.
   * Setting it manually would omit the boundary and break server parsing.
   */
  const handleUpload = useCallback(async (): Promise<void> => {
    if (!selectedFile || phase === 'uploading') return

    setPhase('uploading')
    setErrorMessage(null)

    const form = new FormData()
    form.append('file',      selectedFile)
    form.append('intent',    intent)
    form.append('brandSlug', brandSlug)
    form.append('slug',      slug)

    if (intent === 'bike_gallery' && index !== undefined) {
      form.append('index', String(index))
    }

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body:   form,
      })

      const data = await response.json() as UploadAPIResponse

      if (!response.ok || !data.ok) {
        throw new Error(
          (!data.ok && data.error)
            ? data.error
            : `Upload failed — server returned ${response.status}.`,
        )
      }

      setUploadResult(data.result)
      setUploadedBlur(data.blurDataUrl)
      setPhase('success')
      onUploadComplete(data.result, data.blurDataUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setErrorMessage(msg)
      setPhase('previewing')
      onUploadError?.(msg)
    }
  }, [selectedFile, phase, intent, brandSlug, slug, index, onUploadComplete, onUploadError])

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isInteractive) return

      dragCounterRef.current++

      /*
       * Check the MIME type of the dragged item.
       * dataTransfer.items[0].type is available during drag
       * (unlike .files which is only available on drop).
       * Some browsers return '' for security — treat as optimistic.
       */
      const item = e.dataTransfer.items[0]
      if (item) {
        const mime = item.type.toLowerCase()
        if (mime && !constraints.acceptedMimeTypes.includes(mime)) {
          setIsDragRejected(true)
          setIsDragOver(false)
        } else {
          setIsDragOver(true)
          setIsDragRejected(false)
        }
      } else {
        setIsDragOver(true)
        setIsDragRejected(false)
      }
    },
    [isInteractive, constraints.acceptedMimeTypes],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isInteractive) return
      e.dataTransfer.dropEffect = isDragRejected ? 'none' : 'copy'
    },
    [isInteractive, isDragRejected],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDragOver(false)
        setIsDragRejected(false)
      }
    },
    [],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragOver(false)
      setIsDragRejected(false)
      if (!isInteractive) return

      const file = e.dataTransfer.files[0]
      if (file) selectFile(file)
    },
    [isInteractive, selectFile],
  )

  // ── File input handler ─────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      selectFile(file)
      /*
       * Clear the input value immediately so the same file can be
       * re-selected without the onChange being skipped.
       */
      e.target.value = ''
    },
    [selectFile],
  )

  // ── Keyboard handler ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isInteractive) return
      if (phase !== 'idle' && phase !== 'success') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        inputRef.current?.click()
      }
    },
    [isInteractive, phase],
  )

  // ── Drop zone click ────────────────────────────────────────────────────

  const handleZoneClick = useCallback(() => {
    if (!isInteractive) return
    if (phase !== 'idle' && phase !== 'success') return
    inputRef.current?.click()
  }, [isInteractive, phase])

  // ── Drop zone class ────────────────────────────────────────────────────

  const zoneClass = [
    'mu-zone',
    isDragOver                                               && 'mu-zone--over',
    isDragRejected                                           && 'mu-zone--rejected',
    phase === 'uploading'                                    && 'mu-zone--loading',
    disabled                                                 && 'mu-zone--disabled',
    isInteractive && (phase === 'idle' || phase === 'success') && 'mu-zone--clickable',
  ]
    .filter(Boolean)
    .join(' ')

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* ── Drop zone base ─────────────────────────────────────────── */

        .mu-zone {
          position: relative;
          width: 100%;
          min-height: 164px;
          border: 2px dashed var(--color-border-hairline);
          border-radius: 10px;
          background-color: var(--color-surface-sunken);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          outline: none;
          transition:
            border-color     200ms cubic-bezier(0.4,0,0.2,1),
            background-color 200ms cubic-bezier(0.4,0,0.2,1);
        }

        /* Pointer cursor only when clickable */
        .mu-zone--clickable {
          cursor: pointer;
        }

        /* Valid drag-over — accent border + faint tint */
        .mu-zone--over {
          border-style: solid;
          border-color: #7A2E2E;
          background-color: rgba(122,46,46,0.04);
        }

        /* Rejected drag (wrong MIME) — error red + no-drop cursor */
        .mu-zone--rejected {
          border-style: solid;
          border-color: #C8102E;
          background-color: rgba(200,16,46,0.04);
          cursor: no-drop;
        }

        /* Uploading — pointer events off; slight fade */
        .mu-zone--loading {
          pointer-events: none;
          opacity: 0.85;
        }

        /* Disabled */
        .mu-zone--disabled {
          pointer-events: none;
          opacity: 0.5;
        }

        /* Keyboard focus ring */
        .mu-zone:focus-visible {
          box-shadow: var(--shadow-focus);
          border-color: var(--color-ink-secondary);
          border-style: solid;
        }

        /* ── Upload icon (changes colour with drag state) ────────────── */

        .mu-icon {
          color: var(--color-ink-tertiary);
          margin-bottom: 12px;
          transition: color 200ms cubic-bezier(0.4,0,0.2,1);
        }

        .mu-zone--over      .mu-icon { color: #7A2E2E; }
        .mu-zone--rejected  .mu-icon { color: #C8102E; }

        /* ── Browse button ──────────────────────────────────────────── */

        .mu-browse {
          display: inline-flex;
          align-items: center;
          height: 34px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-ink-secondary);
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 999px;
          cursor: pointer;
          user-select: none;
          transition:
            background-color 150ms cubic-bezier(0.4,0,0.2,1),
            color             150ms cubic-bezier(0.4,0,0.2,1);
        }

        .mu-browse:hover {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-primary);
        }

        .mu-browse:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /* ── Primary upload button ──────────────────────────────────── */

        .mu-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 20px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: #FFFFFF;
          background-color: #7A2E2E;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          user-select: none;
          flex-shrink: 0;
          transition:
            filter    150ms cubic-bezier(0.4,0,0.2,1),
            transform 100ms cubic-bezier(0.4,0,0.2,1);
        }

        .mu-upload-btn:hover  { filter: brightness(1.1); }
        .mu-upload-btn:active { transform: scale(0.98);  }

        .mu-upload-btn:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 2px var(--color-surface-base),
            0 0 0 4px #7A2E2E;
        }

        /* ── Clear / secondary button ─────────────────────────────── */

        .mu-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 40px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          background-color: transparent;
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          cursor: pointer;
          user-select: none;
          flex-shrink: 0;
          transition:
            color             150ms cubic-bezier(0.4,0,0.2,1),
            background-color  150ms cubic-bezier(0.4,0,0.2,1);
        }

        .mu-clear-btn:hover {
          color: var(--color-ink-primary);
          background-color: var(--color-surface-sunken);
        }

        .mu-clear-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /* ── Spinner ─────────────────────────────────────────────────── */

        @keyframes mu-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .mu-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(122,46,46,0.2);
          border-top-color: #7A2E2E;
          border-radius: 999px;
          animation: mu-spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        /* ── Image previews ─────────────────────────────────────────── */

        /*
         * Regular <img> is used for previews (not Next.js Image) because:
         *   - Object URLs (blob://) cannot be configured in next.config.ts
         *   - Admin context — performance is not the priority here
         * eslint-disable @next/next/no-img-element is added at each usage.
         */
        .mu-preview-img {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: 6px;
          display: block;
          background-color: var(--color-surface-inverse);
        }

        .mu-success-img {
          width: 100%;
          max-height: 220px;
          object-fit: contain;
          border-radius: 6px;
          display: block;
          background-color: var(--color-surface-inverse);
          margin-bottom: 4px;
        }

        .mu-current-img {
          width: 100%;
          max-height: 100px;
          object-fit: cover;
          border-radius: 0 0 6px 6px;
          display: block;
        }

        /* ── Video placeholder icon ────────────────────────────────── */

        .mu-video-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-ink-tertiary);
          flex-shrink: 0;
          margin-bottom: 10px;
        }

        /* ── Success check circle ──────────────────────────────────── */

        .mu-check-circle {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background-color: #166534;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          flex-shrink: 0;
        }
      `}</style>

      <div className={className}>

        {/* ── Label ─────────────────────────────────────────────────── */}
        {label && (
          <p
            className="admin-label"
            style={{ marginBottom: '8px' }}
          >
            {label}
          </p>
        )}

        {/* ── Current URL preview ────────────────────────────────────── */}
        {/*
         * Shown only in the idle phase when currentUrl is provided.
         * Lets the admin see the existing asset before deciding to replace it.
         * Hidden in all other phases — the zone content replaces it.
         */}
        {phase === 'idle' && currentUrl && (
          <div
            style={{
              marginBottom: '8px',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-surface-raised)',
            }}
          >
            <div
              style={{
                padding: '5px 10px',
                borderBottom: '1px solid var(--color-border-hairline)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-tertiary)',
                }}
              >
                Current
              </span>
            </div>

            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUrl}
                alt="Currently uploaded asset"
                className="mu-current-img"
              />
            ) : (
              <div style={{ padding: '8px 10px' }}>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-ink-secondary)',
                    textDecoration: 'none',
                    wordBreak: 'break-all',
                  }}
                >
                  {truncateFilename(currentUrl, 60)}
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Drop zone ──────────────────────────────────────────────── */}
        <div
          className={zoneClass}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleZoneClick}
          onKeyDown={handleKeyDown}
          tabIndex={
            isInteractive && (phase === 'idle' || phase === 'success') ? 0 : -1
          }
          role={
            phase === 'idle' || phase === 'success' ? 'button' : undefined
          }
          aria-label={
            phase === 'idle'
              ? `Upload ${label ?? 'file'}. Drag and drop or press Enter to browse.`
              : phase === 'success'
              ? 'Upload complete. Press Enter to replace.'
              : undefined
          }
          aria-busy={phase === 'uploading'}
        >

          {/* ── IDLE ──────────────────────────────────────────────── */}
          {phase === 'idle' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {/* Upload arrow icon */}
              <div className="mu-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              {/* Primary instruction */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDragRejected
                    ? '#C8102E'
                    : isDragOver
                    ? '#7A2E2E'
                    : 'var(--color-ink-primary)',
                  margin: '0 0 6px',
                  transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {isDragRejected
                  ? 'File type not accepted'
                  : isDragOver
                  ? 'Drop to upload'
                  : 'Drag and drop here'}
              </p>

              {/* "or" + browse button (hidden during drag) */}
              {!isDragOver && !isDragRejected && (
                <>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      color: 'var(--color-ink-tertiary)',
                      margin: '0 0 10px',
                    }}
                  >
                    or
                  </p>

                  <button
                    type="button"
                    className="mu-browse"
                    onClick={(e) => {
                      /*
                       * stopPropagation — prevents the zone's own
                       * onClick from firing a second time.
                       */
                      e.stopPropagation()
                      inputRef.current?.click()
                    }}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    Browse files
                  </button>
                </>
              )}

              {/* File type + size hint */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: isDragRejected
                    ? '#C8102E'
                    : 'var(--color-ink-tertiary)',
                  margin: isDragOver || isDragRejected ? '8px 0 0' : '12px 0 0',
                  lineHeight: 1.5,
                  transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {isDragRejected
                  ? `Accepted: ${mimeLabel}`
                  : `${mimeLabel} · Max ${maxMBLabel}`}
              </p>

              {/* Optional custom hint */}
              {hint && !isDragOver && !isDragRejected && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-ink-tertiary)',
                    margin: '4px 0 0',
                    maxWidth: '300px',
                    lineHeight: 1.5,
                  }}
                >
                  {hint}
                </p>
              )}
            </div>
          )}

          {/* ── PREVIEWING ────────────────────────────────────────── */}
          {phase === 'previewing' && selectedFile && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image preview OR video icon */}
              {isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview of selected file"
                  className="mu-preview-img"
                />
              ) : (
                <div className="mu-video-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
              )}

              {/* Filename + size */}
              <div style={{ textAlign: 'center', width: '100%', minWidth: 0 }}>
                <p
                  title={selectedFile.name}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                    margin: '0 0 2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {truncateFilename(selectedFile.name)}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-ink-tertiary)',
                    margin: 0,
                  }}
                >
                  {formatBytes(selectedFile.size)}
                </p>
              </div>

              {/* Clear + Upload buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
              >
                <button
                  type="button"
                  className="mu-clear-btn"
                  onClick={reset}
                  aria-label="Clear selected file"
                >
                  <Icon name="close" size={12} strokeWidth={2} />
                  Clear
                </button>

                <button
                  type="button"
                  className="mu-upload-btn"
                  onClick={handleUpload}
                  aria-label={`Upload ${selectedFile.name} to Cloudinary`}
                >
                  {/* Upload arrow icon (inline SVG — no dependency) */}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload to Cloudinary
                </button>
              </div>
            </div>
          )}

          {/* ── UPLOADING ─────────────────────────────────────────── */}
          {phase === 'uploading' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
              }}
              role="status"
              aria-label="Uploading file to Cloudinary"
            >
              <div className="mu-spinner" aria-hidden="true" />
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                    margin: '0 0 4px',
                  }}
                >
                  Uploading…
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-ink-tertiary)',
                    margin: 0,
                  }}
                >
                  This may take a moment for large files.
                </p>
              </div>
            </div>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────── */}
          {phase === 'success' && uploadResult && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Check icon + success label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div className="mu-check-circle" aria-hidden="true">
                  <Icon name="check" size={15} strokeWidth={2.5} />
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#166534',
                    margin: 0,
                  }}
                >
                  Uploaded successfully
                </p>
              </div>

              {/* Cloudinary image preview OR public_id for video */}
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={uploadResult.secure_url}
                  alt="Successfully uploaded image"
                  className="mu-success-img"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-hairline)',
                    borderRadius: '6px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-secondary)',
                      margin: 0,
                      wordBreak: 'break-all',
                    }}
                  >
                    {uploadResult.public_id}
                  </p>
                </div>
              )}

              {/* Asset metadata row */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {uploadResult.width !== undefined &&
                  uploadResult.height !== undefined && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-tertiary)',
                    }}
                  >
                    {uploadResult.width} × {uploadResult.height}px
                  </span>
                )}

                {uploadResult.duration !== undefined && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-ink-tertiary)',
                    }}
                  >
                    {uploadResult.duration.toFixed(1)}s
                  </span>
                )}

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-ink-tertiary)',
                  }}
                >
                  {formatBytes(uploadResult.bytes)}
                </span>

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-ink-tertiary)',
                    textTransform: 'uppercase',
                  }}
                >
                  {uploadResult.format}
                </span>

                {uploadedBlur && (
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Icon name="check" size={10} strokeWidth={2.5} />
                    blur ready
                  </span>
                )}
              </div>

              {/* Reset */}
              <button
                type="button"
                className="mu-clear-btn"
                onClick={reset}
                style={{ marginTop: '2px' }}
              >
                Upload another
              </button>
            </div>
          )}
        </div>

        {/* ── Error message ──────────────────────────────────────────── */}
        {/*
         * role="alert" + aria-live="polite" — announced by screen readers
         * without interrupting ongoing narration.
         * Clears automatically when selectFile() is called for a new file.
         */}
        {errorMessage && (
          <p
            role="alert"
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: '#C8102E',
              margin: '8px 0 0',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '5px',
            }}
          >
            <span aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
              <Icon name="warning" size={13} strokeWidth={1.75} />
            </span>
            {errorMessage}
          </p>
        )}

        {/* ── Hidden file input ──────────────────────────────────────── */}
        {/*
         * aria-hidden + tabIndex={-1} — keyboard users interact with the
         * zone's role="button", not this input.
         * Triggered only imperatively via inputRef.current.click().
         */}
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: 'none' }}
        />
      </div>
    </>
  )
}