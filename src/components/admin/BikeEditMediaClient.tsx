'use client'

/*
 * BikeEditMediaClient — Media management UI for a single bike.
 *
 * MPD Task A-07.5:
 *   "Connect upload components to admin pages — final integration."
 *
 * Rendered by the edit page Server Component. Receives serialized bike
 * data as props and manages the full media upload lifecycle client-side.
 *
 * THREE SECTIONS:
 *   1. Hero Image     — MediaUploader (intent='bike_hero')
 *   2. Gallery Images — GalleryUploader (up to 10 images)
 *   3. 360° Video     — MediaUploader (intent='bike_360')
 *
 * SAVE FLOW:
 *   1. Admin uploads assets via the upload components.
 *   2. Each component fires its callback, updating local state.
 *   3. hasChanges becomes true (any field differs from initial).
 *   4. Admin clicks "Save Media" → PUT /api/bikes/[bikeId].
 *   5. Success: green confirmation. Error: inline error below save bar.
 *
 * GALLERY FIELD MAPPING:
 *   The Bike MongoDB document stores gallery items as:
 *     { url: string, blurDataUrl?: string, publicId?: string }
 *   GalleryUploader internally uses GalleryChangeItem:
 *     { secureUrl: string, blurDataUrl?: string, publicId?: string }
 *   This component converts between the two formats on load and save.
 *
 * CHANGE DETECTION:
 *   hasChanges compares current state to the initial bike prop values.
 *   The Save button is disabled when hasChanges is false.
 *   After a successful save, hasChanges remains true (state reflects
 *   the saved values, but we do not update the initial comparison baseline
 *   — a page reload will reflect the saved state correctly).
 *
 * WHY 'use client':
 *   useState (heroImageUrl, heroBlurUrl, galleryItems, video360Url, isSaving…)
 *   useCallback (upload handlers, save handler)
 *   fetch() for PUT /api/bikes/[bikeId]
 *   setTimeout (auto-dismiss success message)
 */

import { useState, useCallback } from 'react'
import MediaUploader from '@/components/admin/MediaUploader'
import GalleryUploader, {
  type GalleryChangeItem,
  type GalleryInitialItem,
} from '@/components/admin/GalleryUploader'
import Icon from '@/components/ui/Icon'
import type { CloudinaryUploadResult } from '@/types/cloudinary'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * BikeGalleryItemSaved — shape of a gallery item as stored in MongoDB.
 * Uses `url` to match the Bike Mongoose schema field name.
 */
export interface BikeGalleryItemSaved {
  url: string
  blurDataUrl?: string
  publicId?: string
}

/*
 * SerializedBikeForEdit — bike data from the Server Component.
 * All ObjectIds are stringified. Dates are ISO strings.
 * Only the fields relevant to media management are included.
 */
export interface SerializedBikeForEdit {
  _id: string
  slug: string
  brandSlug: string
  name: string
  heroImageUrl: string
  blurDataUrl?: string
  gallery: BikeGalleryItemSaved[]
  video360Url?: string
  status: 'draft' | 'published'
}

interface BikeEditMediaClientProps {
  bike: SerializedBikeForEdit
}

/*
 * SavePayload — body sent to PUT /api/bikes/[id].
 * The route merges this into the existing document via $set.
 */
interface SavePayload {
  heroImageUrl: string
  blurDataUrl?: string
  gallery: BikeGalleryItemSaved[]
  video360Url?: string
}

// ---------------------------------------------------------------------------
// BikeEditMediaClient
// ---------------------------------------------------------------------------

export default function BikeEditMediaClient({
  bike,
}: BikeEditMediaClientProps) {

  // ── State ──────────────────────────────────────────────────────────────

  const [heroImageUrl, setHeroImageUrl] = useState(bike.heroImageUrl)
  const [heroBlurUrl,  setHeroBlurUrl]  = useState<string | undefined>(bike.blurDataUrl)

  /*
   * Convert MongoDB gallery items { url } to GalleryChangeItem { secureUrl }
   * for internal state tracking. Converted back to { url } on save.
   */
  const [galleryItems, setGalleryItems] = useState<GalleryChangeItem[]>(() =>
    bike.gallery.map((g) => ({
      secureUrl:   g.url,
      blurDataUrl: g.blurDataUrl,
      publicId:    g.publicId,
    })),
  )

  const [video360Url, setVideo360Url]   = useState<string | undefined>(bike.video360Url)

  const [isSaving,     setIsSaving]     = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [saveSuccess,  setSaveSuccess]  = useState(false)

  // ── Change detection ───────────────────────────────────────────────────

  /*
   * Compares current gallery to initial bike.gallery.
   * Length check + URL order comparison (does not deep-compare blurDataUrl).
   */
  const galleryChanged =
    galleryItems.length !== bike.gallery.length ||
    galleryItems.some((item, i) => item.secureUrl !== bike.gallery[i]?.url)

  const hasChanges =
    heroImageUrl !== bike.heroImageUrl ||
    heroBlurUrl  !== bike.blurDataUrl  ||
    video360Url  !== bike.video360Url  ||
    galleryChanged

  // ── Upload handlers ────────────────────────────────────────────────────

  /*
   * handleHeroUpload — fires after MediaUploader succeeds for the hero image.
   * Updates local state; does not persist until "Save Media" is clicked.
   */
  const handleHeroUpload = useCallback(
    (result: CloudinaryUploadResult, blurDataUrl?: string): void => {
      setHeroImageUrl(result.secure_url)
      setHeroBlurUrl(blurDataUrl)
      setSaveSuccess(false)
      setSaveError(null)
    },
    [],
  )

  /*
   * handleGalleryChange — fires after every GalleryUploader mutation
   * (upload, remove, reorder). Receives the full ordered array.
   */
  const handleGalleryChange = useCallback(
    (items: GalleryChangeItem[]): void => {
      setGalleryItems(items)
      setSaveSuccess(false)
      setSaveError(null)
    },
    [],
  )

  /*
   * handleVideoUpload — fires after MediaUploader succeeds for the 360° video.
   * blurDataUrl is omitted (videos do not have blur placeholders).
   */
  const handleVideoUpload = useCallback(
    (result: CloudinaryUploadResult): void => {
      setVideo360Url(result.secure_url)
      setSaveSuccess(false)
      setSaveError(null)
    },
    [],
  )

  // ── Save ───────────────────────────────────────────────────────────────

  /*
   * handleSave — sends all current media fields to PUT /api/bikes/[_id].
   *
   * Always sends the complete media state (not just changed fields) so the
   * server always has the correct current state. The PUT route does a $set
   * merge — omitted non-media fields are not affected.
   *
   * Gallery items are converted from GalleryChangeItem (secureUrl) to
   * BikeGalleryItemSaved (url) before sending.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!hasChanges || isSaving) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const payload: SavePayload = {
      heroImageUrl,
      blurDataUrl: heroBlurUrl,
      gallery: galleryItems.map((g) => ({
        url:         g.secureUrl,
        blurDataUrl: g.blurDataUrl,
        publicId:    g.publicId,
      })),
      /*
       * Only include video360Url if it has a value.
       * Sending undefined would not remove the existing value (that is
       * the correct behaviour — the admin must not accidentally clear it).
       */
      ...(video360Url !== undefined && { video360Url }),
    }

    try {
      const response = await fetch(`/api/bikes/${bike._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(
          data.error ?? `Save failed — server returned ${response.status}.`,
        )
      }

      setSaveSuccess(true)

      /*
       * Auto-dismiss the success indicator after 4 seconds.
       * The admin can continue uploading without the success message
       * cluttering the UI.
       */
      const timer = setTimeout(() => { setSaveSuccess(false) } , 4000)
      
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Save failed. Please try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }, [
    hasChanges,
    isSaving,
    heroImageUrl,
    heroBlurUrl,
    galleryItems,
    video360Url,
    bike._id,
  ])

  // ── Gallery initial items ──────────────────────────────────────────────

  /*
   * Convert from MongoDB format { url } to GalleryInitialItem { secureUrl }.
   * This is a stable derivation — bike.gallery does not change after mount.
   */
  const initialGalleryItems: GalleryInitialItem[] = bike.gallery.map((g) => ({
    secureUrl:   g.url,
    blurDataUrl: g.blurDataUrl,
    publicId:    g.publicId,
  }))

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* ── Card sections ─────────────────────────────────────────── */

        .bem-card {
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .bem-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 16px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        .bem-card-accent {
          display: inline-block;
          width: 3px;
          height: 14px;
          border-radius: 999px;
          background-color: #7A2E2E;
          flex-shrink: 0;
        }

        .bem-card-title {
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-ink-primary);
          margin: 0;
        }

        .bem-card-badge {
          display: inline-flex;
          align-items: center;
          height: 18px;
          padding: 0 7px;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--color-ink-tertiary);
          background-color: var(--color-surface-sunken);
          border: 1px solid var(--color-border-hairline);
          border-radius: 999px;
          margin-left: 4px;
        }

        /* ── Save bar ──────────────────────────────────────────────── */

        /*
         * Sticky at the bottom so the admin can always reach Save
         * without scrolling back up after uploading files.
         */
        .bem-save-bar {
          position: sticky;
          bottom: 0;
          z-index: 10;
          background-color: var(--color-surface-raised);
          border-top: 1px solid var(--color-border-hairline);
          padding: 14px 0;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* ── Save button ───────────────────────────────────────────── */

        .bem-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 22px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: #FFFFFF;
          background-color: #7A2E2E;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
          transition: filter 150ms cubic-bezier(0.4,0,0.2,1);
        }

        .bem-save-btn:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .bem-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bem-save-btn:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 2px var(--color-surface-base),
            0 0 0 4px #7A2E2E;
          border-radius: 8px;
        }

        /* ── Spinner ───────────────────────────────────────────────── */

        @keyframes bem-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bem-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #FFFFFF;
          border-radius: 999px;
          animation: bem-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      {/* ── Section 1: Hero Image ──────────────────────────────────── */}
      <div className="bem-card">
        <div className="bem-card-header">
          <span className="bem-card-accent" aria-hidden="true" />
          <h2 className="bem-card-title">Hero Image</h2>
          <span className="bem-card-badge">REQUIRED</span>
        </div>

        <MediaUploader
          intent="bike_hero"
          brandSlug={bike.brandSlug}
          slug={bike.slug}
          currentUrl={heroImageUrl}
          hint="Primary motorcycle photograph. Minimum 1200 × 900px. JPG, PNG, or WEBP."
          onUploadComplete={handleHeroUpload}
          onUploadError={(msg) => setSaveError(msg)}
        />
      </div>

      {/* ── Section 2: Gallery Images ──────────────────────────────── */}
      <div className="bem-card">
        <div className="bem-card-header">
          <span className="bem-card-accent" aria-hidden="true" />
          <h2 className="bem-card-title">Gallery Images</h2>
          <span className="bem-card-badge">OPTIONAL</span>
        </div>

        <GalleryUploader
          brandSlug={bike.brandSlug}
          slug={bike.slug}
          initialItems={initialGalleryItems}
          maxImages={10}
          hint="Additional angles and detail shots. JPG, PNG, or WEBP · min 800 × 600px."
          onChange={handleGalleryChange}
        />
      </div>

      {/* ── Section 3: 360° Spin Video ─────────────────────────────── */}
      <div className="bem-card">
        <div className="bem-card-header">
          <span className="bem-card-accent" aria-hidden="true" />
          <h2 className="bem-card-title">360° Spin Video</h2>
          <span className="bem-card-badge">OPTIONAL</span>
        </div>

        <MediaUploader
          intent="bike_360"
          brandSlug={bike.brandSlug}
          slug={bike.slug}
          currentUrl={video360Url}
          hint="Continuous 360° rotation video. MP4, WEBM, or MOV · max 50MB."
          onUploadComplete={handleVideoUpload}
          onUploadError={(msg) => setSaveError(msg)}
        />
      </div>

      {/* ── Save bar ───────────────────────────────────────────────── */}
      <div className="bem-save-bar">

        {/* Status messages */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Unsaved changes */}
          {hasChanges && !isSaving && !saveSuccess && !saveError && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              You have unsaved changes.
            </p>
          )}

          {/* Success */}
          {saveSuccess && !saveError && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: '#166534',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Icon name="check" size={13} strokeWidth={2.5} />
              Media saved successfully.
            </p>
          )}

          {/* Error */}
          {saveError && (
            <p
              role="alert"
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: '#C8102E',
                margin: 0,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '5px',
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: '1px' }}
              >
                <Icon name="warning" size={13} strokeWidth={1.75} />
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {saveError}
              </span>
            </p>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          className="bem-save-btn"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          aria-label={isSaving ? 'Saving media…' : 'Save media changes to database'}
        >
          {isSaving ? (
            <>
              <span className="bem-spinner" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <Icon name="check" size={14} strokeWidth={2.5} />
              Save Media
            </>
          )}
        </button>
      </div>
    </>
  )
}