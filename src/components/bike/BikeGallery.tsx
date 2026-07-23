'use client'

/*
 * BikeGallery — Image gallery for the bike detail page.
 *
 * MPD Task B-02:
 *   "Image gallery strip below the fold. Clicking a thumbnail
 *   updates the large view. Keyboard navigable. Horizontal
 *   scroll on mobile."
 *
 * MPD Section 5.3, Bike Detail Page — Below the fold:
 *   "Image gallery strip — thumbnails of all available gallery
 *   images. Tapping a thumbnail updates the main image display
 *   above the thumbnails. The active thumbnail is indicated by
 *   the brand's accent color border."
 *
 * LAYOUT:
 *   ┌─────────────────────────────────────────────┐
 *   │          LARGE ACTIVE IMAGE                  │  ← 16/10 aspect ratio
 *   │          (fills the container width)         │
 *   └─────────────────────────────────────────────┘
 *   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  ← thumbnail strip, horizontal scroll
 *   │  │ │  │ │  │ │  │ │  │
 *   └──┘ └──┘ └──┘ └──┘ └──┘
 *   1 / 5  (image counter)
 *
 * DATA:
 *   heroImageUrl — always included as the FIRST gallery image.
 *   bike.gallery — additional images from DB-02 IBikeGalleryImage[].
 *   Combined into a single `allImages` array:
 *     [{ url: heroImageUrl, alt: bikeName }, ...bike.gallery]
 *   Maximum 11 images (1 hero + 10 gallery per DB-02 schema max).
 *
 * ACTIVE IMAGE:
 *   selectedIndex state tracks which image is active.
 *   Defaults to 0 (the hero image).
 *   Updated by:
 *     - Thumbnail click
 *     - Arrow button click
 *     - ArrowLeft / ArrowRight keyboard keys
 *     - Touch swipe (left/right)
 *
 * KEYBOARD NAVIGATION:
 *   The gallery container has tabIndex={0} and onKeyDown.
 *   ArrowLeft:  go to previous image (wraps from 0 to last)
 *   ArrowRight: go to next image (wraps from last to 0)
 *   Home:       go to first image
 *   End:        go to last image
 *   Focus visible: shadow-focus ring on the gallery container
 *
 * TOUCH SWIPE:
 *   onTouchStart / onTouchEnd on the large image tracks swipe delta.
 *   Horizontal swipe > 50px threshold triggers prev/next navigation.
 *   Prevents accidental swipes from short taps.
 *
 * THUMBNAIL STRIP:
 *   Horizontal scroll container (overflow-x: auto, scrollbar hidden).
 *   Fixed 80×60px thumbnail size (4:3 aspect) on desktop.
 *   56×42px on mobile (narrower viewports).
 *   Active thumbnail: 2px accent-color border.
 *   Inactive: 1px hairline border, grayscale filter (slight muted look).
 *   Clicking a thumbnail: scrolls the strip to keep the active thumb visible
 *   via scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }).
 *
 * LARGE IMAGE TRANSITIONS:
 *   Opacity 0 → 1 on image change (160ms ease) prevents hard cuts.
 *   The key prop on the Image triggers React to re-render the element,
 *   allowing the CSS animation to replay on each image change.
 *
 * IMAGE COUNT BADGE:
 *   "3 / 8" counter in the bottom-right of the large image area.
 *   Shown only when there are 2+ images (no counter for single image).
 *   aria-live="polite" announces the current position to screen readers.
 *
 * EMPTY STATE:
 *   If bike.gallery is empty AND heroImageUrl is missing, renders nothing.
 *   In practice this cannot happen (heroImageUrl is required in DB-02).
 *   The guard prevents a runtime crash on malformed data.
 *
 * PERFORMANCE:
 *   Large active image: priority={selectedIndex === 0} — hero image (index 0)
 *   is above the fold equivalent; others are lazy-loaded.
 *   Thumbnails: all lazy-loaded (below fold, small images).
 *
 * WHY 'use client':
 *   useState (selectedIndex, touchStartX)
 *   useRef (thumbnail strip ref for scrollIntoView, thumbnail item refs)
 *   onKeyDown, onClick, onTouchStart, onTouchEnd event handlers
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'
import type { IBikeGalleryImage } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * SWIPE_THRESHOLD — minimum horizontal swipe distance (px) to trigger
 * image navigation. Prevents accidental swipes from vertical scrolls.
 */
const SWIPE_THRESHOLD = 50

/*
 * DEFAULT_BLUR — base64 placeholder while gallery images load.
 * Same value used in BikeCard and BikeHero for consistency.
 */
const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * GalleryImage — the unified image shape used internally.
 * Merges the hero image and IBikeGalleryImage[] into one array.
 */
interface GalleryImage {
  url: string
  alt: string
  blurDataUrl?: string
}

export interface BikeGalleryProps {
  /*
   * heroImageUrl — the primary bike image (always first in the gallery).
   * Required — DB-02 enforces heroImageUrl is non-empty on all bikes.
   */
  heroImageUrl: string

  /*
   * blurDataUrl — blur-up placeholder for the hero image.
   * Optional — falls back to DEFAULT_BLUR if absent.
   */
  blurDataUrl?: string

  /*
   * images — additional gallery images from DB-02 IBikeGalleryImage[].
   * May be empty (bike with only a hero image).
   * Maximum 10 per DB-02 schema validation.
   */
  images: IBikeGalleryImage[]

  /*
   * bikeName — display name of the bike.
   * Used as alt text for the hero image and aria-label on the region.
   */
  bikeName: string

  /*
   * accentColor — brand accent hex for the active thumbnail border.
   * Example: '#7A2E2E' for Royal Enfield, '#FF6A00' for KTM.
   */
  accentColor: string
}

// ---------------------------------------------------------------------------
// BikeGallery Component
// ---------------------------------------------------------------------------

export default function BikeGallery({
  heroImageUrl,
  blurDataUrl,
  images,
  bikeName,
  accentColor,
}: BikeGalleryProps) {
  /*
   * Build allImages — hero first, then gallery images.
   * The hero is always included, even if bike.gallery is empty.
   */
  const allImages: GalleryImage[] = [
    {
      url: heroImageUrl,
      alt: `${bikeName} — hero image`,
      blurDataUrl: blurDataUrl,
    },
    ...images.map((img) => ({
      url: img.url,
      alt: img.alt,
      blurDataUrl: img.blurDataUrl,
    })),
  ]

  /*
   * Guard: if allImages somehow has no entries, render nothing.
   * In production this should never happen (heroImageUrl is required).
   */
  if (allImages.length === 0) {
    return null
  }

  /*
   * If only one image (no gallery), render without thumbnail strip.
   * The hero image is already shown on the page; a single-image gallery
   * would be redundant.
   */
  if (allImages.length === 1) {
    return null
  }

  return <BikeGalleryInner allImages={allImages} bikeName={bikeName} accentColor={accentColor} />
}

// ---------------------------------------------------------------------------
// BikeGalleryInner — the actual interactive gallery
// ---------------------------------------------------------------------------

/*
 * Separated into a child component so the hooks (useState, useRef) are
 * not called conditionally (which would violate Rules of Hooks).
 * The parent BikeGallery handles the early-return guard above.
 */
function BikeGalleryInner({
  allImages,
  bikeName,
  accentColor,
}: {
  allImages: GalleryImage[]
  bikeName: string
  accentColor: string
}) {
  const totalImages = allImages.length

  // ── State ─────────────────────────────────────────────────────────────

  /*
   * selectedIndex — index of the currently displayed large image.
   * 0 = hero image (always the first in allImages).
   */
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  /*
   * imageKey — used as React key on the large Image component.
   * Incrementing on image change forces React to remount the Image,
   * allowing the fade-in animation to replay on each transition.
   */
  const [imageKey, setImageKey] = useState<number>(0)

  /*
   * touchStartX — records the X position of the touch start.
   * Used to calculate swipe direction/distance.
   * null when no touch is in progress.
   */
  const touchStartXRef = useRef<number | null>(null)

  // ── Refs ──────────────────────────────────────────────────────────────

  /*
   * stripRef — ref to the thumbnail strip container.
   * Used to scroll the active thumbnail into view.
   */
  const stripRef = useRef<HTMLDivElement>(null)

  /*
   * thumbRefs — refs to individual thumbnail button elements.
   * Used for scrollIntoView on the active thumbnail.
   */
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>(
    Array(totalImages).fill(null),
  )

  // ── Navigation handlers ───────────────────────────────────────────────

  /*
   * goToImage — sets the active image index and increments imageKey
   * to trigger the fade-in animation on the large image.
   */
  const goToImage = useCallback((index: number) => {
    setSelectedIndex(index)
    setImageKey((prev) => prev + 1)
  }, [])

  const goToPrev = useCallback(() => {
    goToImage(selectedIndex === 0 ? totalImages - 1 : selectedIndex - 1)
  }, [selectedIndex, totalImages, goToImage])

  const goToNext = useCallback(() => {
    goToImage(selectedIndex === totalImages - 1 ? 0 : selectedIndex + 1)
  }, [selectedIndex, totalImages, goToImage])

  // ── Scroll active thumbnail into view ─────────────────────────────────

  useEffect(() => {
    const thumb = thumbRefs.current[selectedIndex]
    if (thumb) {
      thumb.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [selectedIndex])

  // ── Keyboard navigation ───────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        goToPrev()
        break
      case 'ArrowRight':
        e.preventDefault()
        goToNext()
        break
      case 'Home':
        e.preventDefault()
        goToImage(0)
        break
      case 'End':
        e.preventDefault()
        goToImage(totalImages - 1)
        break
      default:
        break
    }
  }

  // ── Touch swipe ───────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    const touch = e.touches[0]
    if (touch) {
      touchStartXRef.current = touch.clientX
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    if (touchStartXRef.current === null) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const delta = touch.clientX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(delta) < SWIPE_THRESHOLD) return

    if (delta > 0) {
      goToPrev()
    } else {
      goToNext()
    }
  }

  // ── Active image ──────────────────────────────────────────────────────

  const activeImage = allImages[selectedIndex]

  if (!activeImage) return null

  return (
    <>
      <style>{`
        /*
         * Gallery container — keyboard focusable for arrow navigation.
         * Focus ring: shadow-focus on the whole gallery region.
         */
        .bike-gallery:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 12px;
        }

        /*
         * Large image fade-in animation.
         * Triggered on every image change via the key prop on the Image wrapper.
         */
        @keyframes gallery-image-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .bike-gallery-large-image {
          animation: gallery-image-fade 160ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        /*
         * Prev/Next arrow buttons.
         */
        .bike-gallery-arrow {
          transition:
            background-color 200ms cubic-bezier(0.4,0,0.2,1),
            opacity 200ms cubic-bezier(0.4,0,0.2,1);
        }

        .bike-gallery-arrow:hover {
          background-color: rgba(14,15,18,0.72) !important;
        }

        .bike-gallery-arrow:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.8);
        }

        /*
         * Thumbnail button hover — lifts opacity and removes grayscale.
         */
        .bike-gallery-thumb {
          transition:
            border-color 200ms cubic-bezier(0.4,0,0.2,1),
            opacity 200ms cubic-bezier(0.4,0,0.2,1);
        }

        .bike-gallery-thumb:hover {
          opacity: 1 !important;
        }

        .bike-gallery-thumb:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 8px;
        }

        /*
         * Thumbnail strip — horizontal scroll, hide scrollbar.
         */
        .bike-gallery-strip {
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .bike-gallery-strip::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/*
       * Gallery region — keyboard navigable.
       * tabIndex={0} allows the gallery to receive keyboard focus.
       * role="region" + aria-label makes it a named landmark.
       * onKeyDown handles ArrowLeft/Right/Home/End.
       */}
      <div
        className="bike-gallery"
        role="region"
        aria-label={`${bikeName} image gallery — ${totalImages} images`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--color-border-hairline)',
          backgroundColor: 'var(--color-surface-inverse)',
        }}
      >
        {/* ── Large image area ───────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            overflow: 'hidden',
            cursor: 'grab',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/*
           * Large active image.
           * key={imageKey} forces React to remount the Image on change,
           * triggering the gallery-image-fade animation.
           */}
          <div
            key={imageKey}
            className="bike-gallery-large-image"
            style={{
              position: 'absolute',
              inset: 0,
            }}
          >
            <Image
              src={activeImage.url}
              alt={activeImage.alt}
              fill
              priority={selectedIndex === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1440px) 65vw, 900px"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              placeholder={activeImage.blurDataUrl ? 'blur' : 'empty'}
              blurDataURL={activeImage.blurDataUrl ?? DEFAULT_BLUR}
            />
          </div>

          {/* ── Prev arrow ─────────────────────────────────────── */}
          {totalImages > 1 && (
            <button
              type="button"
              onClick={goToPrev}
              aria-label={`Previous image (${selectedIndex === 0 ? totalImages : selectedIndex} of ${totalImages})`}
              className="bike-gallery-arrow"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: 'rgba(14,15,18,0.52)',
                border: 'none',
                cursor: 'pointer',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              <Icon name="chevron-left" size={18} strokeWidth={2} />
            </button>
          )}

          {/* ── Next arrow ─────────────────────────────────────── */}
          {totalImages > 1 && (
            <button
              type="button"
              onClick={goToNext}
              aria-label={`Next image (${selectedIndex === totalImages - 1 ? 1 : selectedIndex + 2} of ${totalImages})`}
              className="bike-gallery-arrow"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: 'rgba(14,15,18,0.52)',
                border: 'none',
                cursor: 'pointer',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              <Icon name="chevron-right" size={18} strokeWidth={2} />
            </button>
          )}

          {/* ── Image counter ──────────────────────────────────── */}
          {totalImages > 1 && (
            <div
              aria-live="polite"
              aria-label={`Image ${selectedIndex + 1} of ${totalImages}`}
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                zIndex: 2,
                display: 'inline-flex',
                alignItems: 'center',
                height: '26px',
                padding: '0 10px',
                backgroundColor: 'rgba(14,15,18,0.6)',
                borderRadius: '999px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.02em',
                userSelect: 'none',
              }}
            >
              {selectedIndex + 1} / {totalImages}
            </div>
          )}
        </div>

        {/* ── Thumbnail strip ────────────────────────────────────── */}
        {totalImages > 1 && (
          <div
            ref={stripRef}
            className="bike-gallery-strip"
            role="tablist"
            aria-label="Gallery image thumbnails"
            style={{
              display: 'flex',
              gap: '6px',
              padding: '10px 12px',
              backgroundColor: 'var(--color-surface-raised)',
              borderTop: '1px solid var(--color-border-hairline)',
            }}
          >
            {allImages.map((image, index) => {
              const isActive = index === selectedIndex

              return (
                <button
                  key={`thumb-${index}-${image.url}`}
                  ref={(el) => {
                    thumbRefs.current[index] = el
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`View image ${index + 1}: ${image.alt}`}
                  className="bike-gallery-thumb"
                  onClick={() => goToImage(index)}
                  style={{
                    position: 'relative',
                    width: '80px',
                    height: '60px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    padding: 0,
                    border: isActive
                      ? `2px solid ${accentColor}`
                      : '1.5px solid var(--color-border-hairline)',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-surface-sunken)',
                    opacity: isActive ? 1 : 0.65,
                    /*
                     * Grayscale filter on inactive thumbnails.
                     * Removed on active — reinforces which image is shown.
                     * Removed on hover via CSS class.
                     */
                    filter: isActive ? 'none' : 'grayscale(30%)',
                    transition:
                      'border-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
                      'opacity 200ms cubic-bezier(0.4,0,0.2,1), ' +
                      'filter 200ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="80px"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center',
                    }}
                    placeholder={image.blurDataUrl ? 'blur' : 'empty'}
                    blurDataURL={image.blurDataUrl ?? DEFAULT_BLUR}
                  />

                  {/*
                   * Active indicator — thin accent-colored underline bar
                   * at the bottom of the active thumbnail.
                   * aria-hidden: the aria-selected on the button is sufficient.
                   */}
                  {isActive && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: accentColor,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}