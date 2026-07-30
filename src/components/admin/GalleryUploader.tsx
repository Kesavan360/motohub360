'use client'

/*
 * GalleryUploader — Multi-image gallery management for the admin panel.
 *
 * MPD Task A-07 (A-07.4):
 *   Multiple image upload, gallery preview, remove, reorder, validation.
 *
 * FEATURES:
 *   Multiple images — uploaded one at a time via MediaUploader (A-07.3)
 *   Gallery preview — 3-col (desktop) / 2-col (mobile) thumbnail grid
 *   Remove          — × button on each thumbnail (local state only)
 *   Reorder         — HTML5 drag-and-drop, insertion-based, per card
 *   Validation      — minImages / maxImages with inline status display
 *
 * RELATIONSHIP TO MediaUploader (A-07.3):
 *   GalleryUploader renders a MediaUploader below the gallery grid for
 *   adding new images. After each successful upload, MediaUploader is
 *   remounted via `key` prop — resetting it to idle so the admin can
 *   immediately upload the next image without any manual interaction.
 *
 *   MediaUploader handles: file selection, client validation, the POST to
 *   /api/admin/upload (A-07.2), loading state, and error display.
 *   GalleryUploader handles: the gallery item list, ordering, removal.
 *
 * TWO DRAG SYSTEMS — NO CONFLICT:
 *   MediaUploader: accepts FILES dragged from the OS filesystem.
 *   GalleryUploader: drags EXISTING CARDS to reorder them.
 *   These target entirely different DOM elements and event sources.
 *   The file-drop zone is inside MediaUploader. Card drag is on the
 *   gallery item cards. They do not overlap or conflict.
 *
 * DRAG-AND-DROP REORDER — INSERTION-BASED:
 *   Dragging card A over card B inserts A before B in the array.
 *   Steps:
 *     onDragStart → draggedIdRef.current = id; setDraggingId(id)
 *     onDragOver  → setDragOverId(id) [visual indicator]
 *     onDrop      → reorder via splice; clear all drag state
 *     onDragEnd   → clear all drag state (fires even if drop was elsewhere)
 *
 *   draggedIdRef (ref, not state) is used inside the onDrop handler to
 *   avoid stale closures from async state updates. draggingId (state)
 *   drives the visual opacity of the dragged card.
 *
 * REMOVE BEHAVIOUR:
 *   Removes the item from local state only. Does NOT call Cloudinary's
 *   destroy API — the orphaned asset is cleaned up via a separate future
 *   admin maintenance task. The parent form saves the new gallery array
 *   (without the removed item) to MongoDB on submission.
 *
 * INITIAL ITEMS (edit mode):
 *   Pass `initialItems` with the existing gallery URLs from MongoDB.
 *   Converted to internal GalleryItem[] on mount via useState initializer.
 *   Not reactive after mount — use a `key` prop on GalleryUploader itself
 *   to fully reset it when the bike changes.
 *
 * onChange:
 *   Fires after every mutation (add, remove, reorder) with the current
 *   ordered GalleryChangeItem[]. Does NOT fire on initial mount.
 *   Uses a ref-based pattern (onChangeRef + isFirstRenderRef) to avoid
 *   onChange in the useEffect dependency array, preventing stale closure
 *   issues when the parent re-renders.
 *
 * WHY 'use client':
 *   useState (items, draggingId, dragOverId, uploaderKey)
 *   useRef (draggedIdRef, onChangeRef, isFirstRenderRef)
 *   useEffect (onChange notification, onChangeRef sync)
 *   Event handlers: onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
 *   MediaUploader (itself 'use client')
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import MediaUploader from '@/components/admin/MediaUploader'
import Icon from '@/components/ui/Icon'
import type { CloudinaryUploadResult } from '@/types/cloudinary'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_IMAGES = 12
const DEFAULT_MIN_IMAGES = 0

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * GalleryItem — internal representation of one gallery image.
 * Items from initialItems may only have secureUrl populated.
 * Newly uploaded items have all optional fields populated from
 * the CloudinaryUploadResult returned by the upload API.
 */
interface GalleryItem {
  id: string            // local ephemeral ID (React key + drag tracking)
  secureUrl: string
  blurDataUrl?: string
  publicId?: string     // Cloudinary public_id; available for uploaded items
  width?: number
  height?: number
  bytes?: number
  format?: string
}

/*
 * GalleryInitialItem — shape of items passed via initialItems prop.
 * Mirrors the subset of IBike.gallery stored in MongoDB.
 */
export interface GalleryInitialItem {
  secureUrl: string
  blurDataUrl?: string
  publicId?: string
}

/*
 * GalleryChangeItem — shape returned via the onChange callback.
 * Contains only the fields the parent needs to persist to MongoDB.
 */
export interface GalleryChangeItem {
  secureUrl: string
  blurDataUrl?: string
  publicId?: string
}

export interface GalleryUploaderProps {
  /*
   * brandSlug + slug — passed through to MediaUploader and then to the
   * upload API route to construct each image's Cloudinary public_id.
   */
  brandSlug: string
  slug: string

  /*
   * initialItems — existing gallery items when editing a bike.
   * Converted to GalleryItem[] in the useState initializer.
   * Changes to this prop after mount are ignored.
   */
  initialItems?: GalleryInitialItem[]

  /*
   * maxImages — maximum gallery images allowed.
   * Default: 12. When reached, the MediaUploader zone is hidden.
   */
  maxImages?: number

  /*
   * minImages — minimum required gallery images.
   * Default: 0 (no minimum). When set and not met, an inline
   * validation message is shown. The parent form is responsible
   * for enforcing this on submission — GalleryUploader is informational.
   */
  minImages?: number

  /*
   * onChange — fires after every gallery mutation (add, remove, reorder).
   * Does NOT fire on initial mount.
   * Receives the current ordered GalleryChangeItem[].
   */
  onChange: (items: GalleryChangeItem[]) => void

  /*
   * label — heading rendered above the gallery grid.
   */
  label?: string

  /*
   * hint — guidance below the label.
   */
  hint?: string

  /*
   * disabled — disables all interaction (drag, remove, add).
   */
  disabled?: boolean

  /*
   * className — additional CSS on the outermost wrapper.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * generateId — produces a locally unique ID for React keys and drag tracking.
 * Not cryptographically secure — only used as ephemeral client-side identity.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function initialToItem(initial: GalleryInitialItem): GalleryItem {
  return {
    id:          generateId(),
    secureUrl:   initial.secureUrl,
    blurDataUrl: initial.blurDataUrl,
    publicId:    initial.publicId,
  }
}

function itemToChange(item: GalleryItem): GalleryChangeItem {
  return {
    secureUrl:   item.secureUrl,
    blurDataUrl: item.blurDataUrl,
    publicId:    item.publicId,
  }
}

// ---------------------------------------------------------------------------
// GalleryItemCard — single thumbnail with drag + remove controls
// ---------------------------------------------------------------------------

interface GalleryItemCardProps {
  item: GalleryItem
  position: number        // 1-based display number
  isDragging: boolean     // this card is being dragged
  isDragOver: boolean     // a card is being dragged over this one
  disabled: boolean
  onRemove: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragOver:  (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop:      (e: DragEvent<HTMLDivElement>) => void
  onDragEnd:   (e: DragEvent<HTMLDivElement>) => void
}

function GalleryItemCard({
  item,
  position,
  isDragging,
  isDragOver,
  disabled,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: GalleryItemCardProps) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="gc-card"
      style={{
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        border: isDragOver
          ? '2px solid #7A2E2E'
          : '2px solid var(--color-border-hairline)',
        opacity: isDragging ? 0.35 : 1,
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
        boxShadow: isDragOver
          ? '0 0 0 3px rgba(122,46,46,0.18)'
          : 'none',
        transition:
          'border-color 150ms cubic-bezier(0.4,0,0.2,1), ' +
          'opacity 150ms cubic-bezier(0.4,0,0.2,1), ' +
          'box-shadow 150ms cubic-bezier(0.4,0,0.2,1)',
      }}
      role="listitem"
      aria-label={`Gallery image ${position}${!disabled ? '. Drag to reorder.' : ''}`}
    >
      {/* ── 4:3 Thumbnail ──────────────────────────────────────── */}
      <div
        style={{
          paddingBottom: '75%',
          position: 'relative',
          backgroundColor: 'var(--color-surface-inverse)',
        }}
      >
        {/*
         * Regular <img> — not Next.js Image — because:
         *   1. Dimensions unknown at render time (not required for <img>)
         *   2. Admin-only context: performance not the priority
         *   3. Some initialItems URLs may be external and not
         *      configured in next.config.ts remotePatterns
         * eslint-disable-next-line is required per Next.js ESLint rules.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.secureUrl}
          alt={`Gallery image ${position}`}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            /*
             * pointerEvents: none — prevents the <img> from being the
             * drag target instead of its parent card div. Without this,
             * browsers may try to drag the image itself (as an image drag)
             * rather than triggering the card's onDragStart handler.
             * draggable={false} provides additional suppression.
             */
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* ── Controls overlay — revealed on hover/focus-within ──── */}
      <div className="gc-overlay">

        {/* Drag handle — top-left */}
        {!disabled && (
          <div
            className="gc-handle"
            aria-hidden="true"
            title="Drag to reorder"
          >
            {/*
             * Inline SVG (≡) — avoids dependency on Icon component icon map.
             * The handle is aria-hidden; the card's aria-label carries context.
             */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="7"  x2="21" y2="7"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          </div>
        )}

        {/* Remove button — top-right */}
        {!disabled && (
          <button
            type="button"
            className="gc-remove"
            onClick={(e) => {
              /*
               * stopPropagation — prevents the click from being
               * misinterpreted as a drag start on touch devices.
               */
              e.stopPropagation()
              e.preventDefault()
              onRemove()
            }}
            onMouseDown={(e) => {
              /*
               * stopPropagation on mousedown — prevents the card's
               * onDragStart from firing when the user clicks the
               * remove button (mousedown precedes dragstart).
               */
              e.stopPropagation()
            }}
            aria-label={`Remove gallery image ${position}`}
          >
            <Icon name="close" size={11} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* ── Position badge — always visible, bottom-left ────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '6px',
          backgroundColor: 'rgba(14,15,18,0.6)',
          borderRadius: '4px',
          padding: '1px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1.5,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {position}
      </div>

      {/* ── Drag-over insertion indicator — left edge ──────────── */}
      {/*
       * Shown when another card is being dragged over this one.
       * A 4px accent-colored bar on the left edge signals
       * "the dragged card will be inserted before this card."
       * This is the standard insertion-based DnD visual pattern.
       */}
      {isDragOver && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '4px',
            backgroundColor: '#7A2E2E',
            borderRadius: '0 2px 2px 0',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GalleryUploader — main component
// ---------------------------------------------------------------------------

export default function GalleryUploader({
  brandSlug,
  slug,
  initialItems,
  maxImages = DEFAULT_MAX_IMAGES,
  minImages = DEFAULT_MIN_IMAGES,
  onChange,
  label,
  hint,
  disabled = false,
  className = '',
}: GalleryUploaderProps) {

  // ── State ──────────────────────────────────────────────────────────────

  const [items, setItems] = useState<GalleryItem[]>(() =>
    (initialItems ?? []).map(initialToItem),
  )

  /*
   * draggingId — ID of the item currently being dragged.
   * Used to set opacity on the dragging card (visual feedback).
   * State (not just ref) because it triggers a re-render.
   */
  const [draggingId, setDraggingId]   = useState<string | null>(null)

  /*
   * dragOverId — ID of the item currently being dragged over.
   * Used to show the insertion indicator on the target card.
   */
  const [dragOverId, setDragOverId]   = useState<string | null>(null)

  /*
   * uploaderKey — incrementing this causes React to unmount the current
   * MediaUploader and mount a fresh one (resetting it to idle phase).
   * Incremented after each successful upload so the admin can immediately
   * start uploading the next gallery image without any manual reset.
   */
  const [uploaderKey, setUploaderKey] = useState(0)

  // ── Refs ───────────────────────────────────────────────────────────────

  /*
   * draggedIdRef — ref mirror of draggingId.
   * Used inside onDrop to avoid stale closure over the state value.
   * React batches state updates: by the time onDrop fires, the
   * draggingId state from the closure may refer to the previous render.
   * The ref is always current.
   */
  const draggedIdRef = useRef<string | null>(null)

  /*
   * onChangeRef — stores the latest onChange prop.
   * The useEffect below reads from this ref rather than capturing onChange
   * in its closure, so it always calls the latest version of the function
   * without needing onChange in the dependency array.
   */
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  /*
   * isFirstRenderRef — prevents onChange from firing on initial mount.
   * The parent provided initialItems and already knows the initial state.
   */
  const isFirstRenderRef = useRef(true)

  // ── onChange notification ──────────────────────────────────────────────

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    onChangeRef.current(items.map(itemToChange))
  }, [items])

  // ── Derived values ─────────────────────────────────────────────────────

  const count       = items.length
  const isFull      = count >= maxImages
  const isUnderMin  = minImages > 0 && count < minImages
  const nextIndex   = count + 1     // 1-based index for the next upload
  const canAdd      = !isFull && !disabled
  const showDragHint = count > 1 && !disabled

  // ── Add item ───────────────────────────────────────────────────────────

  const handleUploadComplete = useCallback(
    (result: CloudinaryUploadResult, blurDataUrl?: string): void => {
      const newItem: GalleryItem = {
        id:          generateId(),
        secureUrl:   result.secure_url,
        blurDataUrl,
        publicId:    result.public_id,
        width:       result.width,
        height:      result.height,
        bytes:       result.bytes,
        format:      result.format,
      }

      setItems((prev) => [...prev, newItem])

      /*
       * Increment key → MediaUploader unmounts and remounts fresh.
       * The admin can immediately select the next image without any
       * "Upload another" click — the drop zone returns to idle automatically.
       */
      setUploaderKey((k) => k + 1)
    },
    [],
  )

  const handleUploadError = useCallback((message: string): void => {
    /*
     * MediaUploader already displays the error inline.
     * Log in development for debugging.
     */
    if (process.env.NODE_ENV === 'development') {
      console.warn('[GalleryUploader] Upload error:', message)
    }
  }, [])

  // ── Remove item ────────────────────────────────────────────────────────

  const handleRemove = useCallback((id: string): void => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleItemDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, id: string) => {
      console.log("Drag Start", id)
  
      draggedIdRef.current = id
      setDraggingId(id)
      if (disabled) {
        e.preventDefault()
        return
      }
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", id)
    },
    [disabled],
  )

  const handleItemDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, id: string): void => {
      e.preventDefault()
      e.stopPropagation()

      if (disabled) return

      e.dataTransfer.dropEffect = 'move'

      /*
       * Only update dragOverId if the target is a different card.
       * Setting dragOverId to the dragging card itself would show an
       * insertion indicator on the card being dragged, which is confusing.
       */
      if (id !== draggedIdRef.current) {
        setDragOverId(id)
      }
    },
    [disabled],
  )

  const handleItemDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      /*
       * stopPropagation — prevent the leave event from bubbling to a
       * parent element that might interfere with the drag state.
       */
      e.stopPropagation()
      setDragOverId(null)
    },
    [],
  )

  const handleItemDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetId: string): void => {
      e.preventDefault()
      e.stopPropagation()

      const draggedId = draggedIdRef.current

      /*
       * Clear all drag state before mutating items.
       * If we cleared after setItems, there would be a brief render
       * where items have changed but drag state is still set.
       */
      draggedIdRef.current = null
      setDraggingId(null)
      setDragOverId(null)

      if (!draggedId || draggedId === targetId) return

      /*
       * Insertion-based reorder algorithm:
       *   1. Find the dragged item.
       *   2. Build a new array without it.
       *   3. Find the target item's index in the new array.
       *   4. Splice the dragged item in at that index (before target).
       *
       * Example: items = [A, B, C, D], drag A over C:
       *   without = [B, C, D]
       *   targetIdx = 1 (C is at index 1)
       *   result = [B, A, C, D]  (A inserted before C)
       */
      setItems((prev) => {
        const dragged = prev.find((i) => i.id === draggedId)
        if (!dragged) return prev

        const without   = prev.filter((i) => i.id !== draggedId)
        const targetIdx = without.findIndex((i) => i.id === targetId)

        if (targetIdx === -1) return prev

        const reordered = [...without]
        reordered.splice(targetIdx, 0, dragged)
        return reordered
      })
    },
    [],
  )

  const handleItemDragEnd = useCallback(
    (_e: DragEvent<HTMLDivElement>): void => {
      /*
       * onDragEnd fires even when the drop was outside a valid target
       * (e.g. the user released the mouse outside the grid).
       * Always clear drag state here as a safety net.
       */
      draggedIdRef.current = null
      setDraggingId(null)
      setDragOverId(null)
    },
    [],
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* ── Gallery grid ──────────────────────────────────────── */

        .gc-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        @media (max-width: 640px) {
          .gc-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }

        /* ── Card controls overlay ─────────────────────────────── */

        /*
         * The overlay containing drag handle and remove button is
         * hidden (opacity: 0) by default and revealed on hover.
         * pointer-events: none when hidden so hidden buttons are
         * never accidentally activated.
         */
        .gc-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 150ms cubic-bezier(0.4,0,0.2,1);
        }

        .gc-card:hover .gc-overlay,
        .gc-card:focus-within .gc-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        /* ── Drag handle ────────────────────────────────────────── */

        .gc-handle {
          position: absolute;
          top: 6px;
          left: 6px;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background-color: rgba(14,15,18,0.62);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.9);
          cursor: grab;
          flex-shrink: 0;
        }

        .gc-handle:active {
          cursor: grabbing;
        }

        /* ── Remove button ──────────────────────────────────────── */

        .gc-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background-color: rgba(14,15,18,0.62);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.9);
          transition: background-color 150ms cubic-bezier(0.4,0,0.2,1);
          flex-shrink: 0;
        }

        .gc-remove:hover {
          background-color: #C8102E;
        }

        .gc-remove:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /* ── Status bar ─────────────────────────────────────────── */

        .gc-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        /* ── Add zone spacing ───────────────────────────────────── */

        .gc-add {
          margin-top: 12px;
        }

        /* ── Divider between grid and add zone ──────────────────── */

        .gc-divider {
          height: 1px;
          background-color: var(--color-border-hairline);
          margin: 16px 0;
        }
      `}</style>

      <div className={className}>

        {/* ── Label ─────────────────────────────────────────────── */}
        {label && (
          <div style={{ marginBottom: '12px' }}>
            <p
              className="admin-label"
              style={{ margin: 0 }}
            >
              {label}
            </p>
            {hint && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-ink-tertiary)',
                  margin: '4px 0 0',
                  lineHeight: 1.5,
                }}
              >
                {hint}
              </p>
            )}
          </div>
        )}

        {/* ── Gallery grid ─────────────────────────────────────── */}
        {/*
         * Shown whenever there is at least one gallery item.
         * Hidden (not rendered) when the gallery is empty — the
         * MediaUploader provides the initial empty state UX.
         */}
        {items.length > 0 && (
          <div
            className="gc-grid"
            role="list"
            aria-label="Gallery images"
          >
            {items.map((item, index) => (
              <GalleryItemCard
                key={item.id}
                item={item}
                position={index + 1}
                isDragging={draggingId === item.id}
                isDragOver={dragOverId === item.id}
                disabled={disabled}
                onRemove={() => handleRemove(item.id)}
                onDragStart={(e) => handleItemDragStart(e, item.id)}
                onDragOver={(e)  => handleItemDragOver(e, item.id)}
                onDragLeave={handleItemDragLeave}
                onDrop={(e)      => handleItemDrop(e, item.id)}
                onDragEnd={handleItemDragEnd}
              />
            ))}
          </div>
        )}

        {/* ── Divider between grid and add zone ────────────────── */}
        {items.length > 0 && canAdd && (
          <div className="gc-divider" aria-hidden="true" />
        )}

        {/* ── Add image — MediaUploader ─────────────────────────── */}
        {/*
         * Hidden when the gallery is full (isFull) or disabled.
         * The `key` prop causes MediaUploader to remount after each
         * successful upload — resetting it to idle without any user
         * action so the admin can immediately upload the next image.
         *
         * intent='bike_gallery' with the next available index ensures
         * each image gets a unique Cloudinary public_id.
         *
         * The label and hint are omitted when items already exist —
         * MediaUploader's own drop-zone content provides sufficient context.
         * When the gallery is empty, label/hint explain what's expected.
         */}
        {canAdd && (
          <div className={items.length > 0 ? undefined : undefined}>
            <MediaUploader
              key={uploaderKey}
              intent="bike_gallery"
              brandSlug={brandSlug}
              slug={slug}
              index={nextIndex}
              label={items.length === 0 ? 'Gallery Images' : undefined}
              hint={
                items.length === 0
                  ? `Add up to ${maxImages} images. JPG, PNG, or WEBP.`
                  : undefined
              }
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </div>
        )}

        {/* ── Gallery full message ─────────────────────────────── */}
        {isFull && !disabled && (
          <div
            style={{
              marginTop: items.length > 0 ? '12px' : '0',
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon
              name="check"
              size={14}
              strokeWidth={2}
              style={{ color: '#166534', flexShrink: 0 }}
            />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: '#166534',
                margin: 0,
              }}
            >
              Gallery full — {maxImages} of {maxImages} images uploaded.
              Remove an image to add a different one.
            </p>
          </div>
        )}

        {/* ── Status bar ───────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="gc-status">

            {/* Image count */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              {count} of {maxImages} image{maxImages !== 1 ? 's' : ''}
            </p>

            {/* Drag-to-reorder hint — only when multiple images exist */}
            {showDragHint && (
              <p
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--color-ink-tertiary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {/*
                 * Inline SVG drag handle icon — matches the icon
                 * used on the gallery cards themselves so the hint
                 * directly references the visible affordance.
                 */}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="7"  x2="21" y2="7"  />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </svg>
                Drag to reorder
              </p>
            )}
          </div>
        )}

        {/* ── Validation message ────────────────────────────────── */}
        {/*
         * Shown when the gallery has fewer than minImages items.
         * role="status" — announced by screen readers but does not
         * interrupt. Not role="alert" because this is informational
         * (the requirement), not an error that just occurred.
         *
         * The parent form is responsible for blocking submission when
         * this condition is true — GalleryUploader is informational only.
         */}
        {isUnderMin && (
          <p
            role="status"
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: '#C8102E',
              margin: '8px 0 0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '5px',
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: '1px' }}
            >
              <Icon name="warning" size={13} strokeWidth={1.75} />
            </span>
            At least {minImages} image{minImages !== 1 ? 's' : ''} required.
            {' '}
            {minImages - count} more {minImages - count === 1 ? 'image' : 'images'} needed.
          </p>
        )}
      </div>
    </>
  )
}