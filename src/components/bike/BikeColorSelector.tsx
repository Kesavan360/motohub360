'use client'

/*
 * BikeColorSelector — Interactive color variant picker.
 *
 * MPD Task B-03:
 *   "Color selector — swatch circles showing available color variants.
 *   Active swatch highlighted with brand accent border. Clicking updates
 *   the displayed color image. Keyboard navigable with arrow keys."
 *
 * MPD Section 5.3, Bike Detail Page — Above the fold:
 *   "Color selector: swatch circles for each available colour.
 *   Active swatch: 2px solid accent border + subtle scale lift.
 *   Selecting a colour updates the displayed image to the
 *   colour variant's heroImageUrl (IBikeColor.imageUrl).
 *   Colour name shown below the swatches."
 *
 * LAYOUT:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  COLOUR                                    3 colour options  │  ← header row
 *   │  Ventura Blue                                                │  ← selected name
 *   │                                                              │
 *   │  ●  ○  ○                                                    │  ← swatch row
 *   │  (active) (inactive) (inactive)                              │
 *   │                                                              │
 *   │  ┌──────────────────────────────────────────────────────┐   │
 *   │  │           COLOR PREVIEW IMAGE                         │   │  ← only when color.imageUrl exists
 *   │  │           16:9, r-lg, fade-in transition              │   │
 *   │  └──────────────────────────────────────────────────────┘   │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * DATA:
 *   colors — the bike's IBikeColor[] array from DB-02.
 *   Each color has: name (string), hex (string), imageUrl? (string).
 *
 *   imageUrl is optional per IBikeColor. When all colors share one image
 *   (common for entry-level bikes), no color preview image is shown.
 *   When at least one color has an imageUrl, the preview panel is shown
 *   and falls back to heroImageUrl for colors without their own image.
 *
 * STATE:
 *   selectedIndex — which color is active (0 = first color, default).
 *   imageKey — incremented on color change to trigger fade-in animation.
 *
 * KEYBOARD NAVIGATION:
 *   The swatch group has role="radiogroup". Each swatch is role="radio".
 *   The group is keyboard navigable with the standard radio group pattern:
 *     ArrowRight / ArrowDown: next swatch (wraps)
 *     ArrowLeft  / ArrowUp:   prev swatch (wraps)
 *     Home: first swatch
 *     End:  last swatch
 *     Space / Enter: select the focused swatch (already handled via focus)
 *   Tab: moves focus into the group on first Tab, then out on next Tab.
 *   Only one swatch has tabIndex={0} at a time (roving tabindex pattern).
 *
 * SWATCH SIZES:
 *   Desktop: 36×36px circles — large enough for precision clicking.
 *   Mobile:  40×40px circles — minimum 44px tap target met by the
 *            8px gap between swatches on mobile (container expands).
 *
 * COLOR PREVIEW IMAGE:
 *   Shown only when `hasColorImages` is true (any color has an imageUrl).
 *   16:10 aspect ratio — taller than the gallery (16:10 vs 16:10) to show
 *   bike detail rather than landscape context.
 *   Fade-in animation on color change via imageKey + @keyframes.
 *   Falls back to heroImageUrl for colors without their own imageUrl.
 *
 * SINGLE COLOR CASE:
 *   When bike.colors has only one entry, the swatch row is hidden.
 *   Only the color name is shown (no interactive element needed for one option).
 *
 * WHY 'use client':
 *   useState (selectedIndex, imageKey, focusedIndex)
 *   useRef (swatch button refs for roving tabindex)
 *   onKeyDown event handler on the radiogroup
 *   onClick handlers on swatch buttons
 */

import {
  useCallback,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import type { IBikeColor } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * DEFAULT_BLUR — base64 placeholder for color preview images.
 * Consistent with BikeGallery.tsx and BikeCard.tsx.
 */
const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeColorSelectorProps {
  /*
   * colors — the bike's color variants from DB-02 IBikeColor[].
   * Minimum 1 (schema enforces at least one color per bike).
   * Maximum 8 (schema enforces at most 8 color variants).
   */
  colors: IBikeColor[]

  /*
   * accentColor — brand accent hex for the active swatch border.
   * Example: '#7A2E2E' for Royal Enfield.
   */
  accentColor: string

  /*
   * heroImageUrl — fallback image when a color has no imageUrl.
   * Also shown as the preview when no color has per-color images.
   */
  heroImageUrl: string

  /*
   * blurDataUrl — blur-up placeholder for the hero image fallback.
   */
  blurDataUrl?: string

  /*
   * bikeName — used in alt text for the color preview image.
   */
  bikeName: string
}

// ---------------------------------------------------------------------------
// BikeColorSelector Component
// ---------------------------------------------------------------------------

export default function BikeColorSelector({
  colors,
  accentColor,
  heroImageUrl,
  blurDataUrl,
  bikeName,
}: BikeColorSelectorProps) {
  /*
   * Guard: no colors — render nothing.
   * In production this cannot happen (DB-02 requires at least 1 color)
   * but the guard prevents a crash on malformed data.
   */
  if (!colors || colors.length === 0) {
    return null
  }

  return (
    <BikeColorSelectorInner
      colors={colors}
      accentColor={accentColor}
      heroImageUrl={heroImageUrl}
      blurDataUrl={blurDataUrl}
      bikeName={bikeName}
    />
  )
}

// ---------------------------------------------------------------------------
// BikeColorSelectorInner — the stateful interactive component
// ---------------------------------------------------------------------------

function BikeColorSelectorInner({
  colors,
  accentColor,
  heroImageUrl,
  blurDataUrl,
  bikeName,
}: Required<Omit<BikeColorSelectorProps, 'blurDataUrl'>> & {
  blurDataUrl?: string
}) {
  const totalColors = colors.length

  // ── State ─────────────────────────────────────────────────────────────

  /*
   * selectedIndex — the index of the active color (0 = first, default).
   */
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  /*
   * focusedIndex — the index of the keyboard-focused swatch.
   * Starts at -1 (nothing focused). Used for roving tabindex.
   * When the user Tabs into the group, focusedIndex becomes selectedIndex.
   */
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  /*
   * imageKey — incremented on color change to trigger the fade-in
   * animation on the color preview image. Same pattern as BikeGallery.
   */
  const [imageKey, setImageKey] = useState<number>(0)

  // ── Refs ──────────────────────────────────────────────────────────────

  /*
   * swatchRefs — refs to individual swatch button elements.
   * Used to programmatically focus swatches during keyboard navigation
   * (roving tabindex pattern requires imperative focus calls).
   */
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>(
    Array(totalColors).fill(null),
  )

  // ── Derived values ────────────────────────────────────────────────────

  const selectedColor = colors[selectedIndex]

  /*
   * hasColorImages — true when at least one color has a per-color imageUrl.
   * Controls whether the color preview image panel is shown.
   * If no colors have imageUrl, we don't show a duplicate of the hero.
   */
  const hasColorImages = colors.some(
    (c) => typeof c.imageUrl === 'string' && c.imageUrl.length > 0,
  )

  /*
   * currentImageUrl — the URL to display in the color preview panel.
   * Priority: selected color's imageUrl → heroImageUrl fallback.
   */
  const currentImageUrl =
    (selectedColor?.imageUrl ?? '').length > 0
      ? (selectedColor!.imageUrl as string)
      : heroImageUrl

  /*
   * currentBlurUrl — blur placeholder for the current image.
   */
  const currentBlurUrl =
    (selectedColor?.imageUrl ?? '').length > 0
      ? undefined          // per-color images don't have blur placeholders
      : blurDataUrl

  // ── Handlers ─────────────────────────────────────────────────────────

  /*
   * selectColor — sets the active color and increments imageKey
   * to trigger the fade-in animation on the preview image.
   */
  const selectColor = useCallback((index: number) => {
    setSelectedIndex(index)
    setImageKey((prev) => prev + 1)
  }, [])

  /*
   * handleKeyDown — keyboard navigation for the radiogroup.
   *
   * Implements the ARIA radio group keyboard pattern:
   *   ArrowRight/Down: next swatch (wraps at end)
   *   ArrowLeft/Up:   prev swatch (wraps at start)
   *   Home:           first swatch
   *   End:            last swatch
   *
   * Each key press:
   *   1. Calculates the new index
   *   2. Sets focusedIndex to the new index
   *   3. Selects the new color (radio groups auto-select on focus)
   *   4. Imperatively focuses the swatch button element
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const current =
        focusedIndex >= 0 ? focusedIndex : selectedIndex

      let next = current

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          next = current >= totalColors - 1 ? 0 : current + 1
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          next = current <= 0 ? totalColors - 1 : current - 1
          break
        case 'Home':
          e.preventDefault()
          next = 0
          break
        case 'End':
          e.preventDefault()
          next = totalColors - 1
          break
        default:
          return
      }

      setFocusedIndex(next)
      selectColor(next)
      swatchRefs.current[next]?.focus()
    },
    [focusedIndex, selectedIndex, totalColors, selectColor],
  )

  /*
   * handleSwatchFocus — when a swatch receives focus (Tab into group),
   * set focusedIndex so keyboard navigation knows where to start.
   */
  function handleSwatchFocus(index: number): void {
    setFocusedIndex(index)
  }

  /*
   * handleSwatchBlur — when focus leaves a swatch (Tab out of group),
   * reset focusedIndex.
   */
  function handleGroupBlur(e: React.FocusEvent<HTMLDivElement>): void {
    /*
     * Check if focus moved outside the radiogroup entirely.
     * e.relatedTarget is the element receiving focus next.
     * If it's still inside the group, don't reset.
     */
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFocusedIndex(-1)
    }
  }

  if (!selectedColor) return null

  return (
    <>
      <style>{`
        /*
         * Swatch button base + hover/focus states.
         */
        .bike-swatch-btn {
          transition:
            transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 200ms cubic-bezier(0.4,0,0.2,1),
            opacity 200ms cubic-bezier(0.4,0,0.2,1);
        }

        .bike-swatch-btn:hover {
          transform: scale(1.1);
        }

        .bike-swatch-btn:focus-visible {
          outline: none;
        }

        /*
         * Color preview image fade-in — same as BikeGallery.
         */
        @keyframes color-preview-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .bike-color-preview-image {
          animation: color-preview-fade 200ms cubic-bezier(0.4,0,0.2,1) forwards;
        }

        /*
         * Hex indicator dot inside the swatch tooltip area.
         */
        .bike-swatch-btn:active {
          transform: scale(0.95);
        }

        @media (max-width: 480px) {
          .bike-swatch-btn {
            width: 40px !important;
            height: 40px !important;
          }
        }
      `}</style>

      {/* ── Colour label row ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/*
         * Left: "COLOUR" label + selected color name.
         * The label is uppercase ink-tertiary; the name is ink-primary.
         */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '10px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              flexShrink: 0,
            }}
          >
            Colour
          </span>

          {/*
           * Selected color name — transitions smoothly via the key trick.
           * The span rerenders with the new name; no animation needed
           * since the text change is instantaneous and clear.
           */}
          <span
            key={`color-name-${selectedIndex}`}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-ink-primary)',
            }}
          >
            {selectedColor.name}
          </span>
        </div>

        {/*
         * Right: Color count label.
         * Hidden when there's only one color (no choice to display).
         */}
        {totalColors > 1 && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              flexShrink: 0,
            }}
          >
            {totalColors} colour{totalColors !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Swatch row ────────────────────────────────────────────── */}
      {/*
       * Only render swatches when there are multiple colors.
       * Single-color bikes just show the name.
       */}
      {totalColors > 1 && (
        <div
          role="radiogroup"
          aria-label={`Available colour variants for ${bikeName}`}
          onKeyDown={handleKeyDown}
          onBlur={handleGroupBlur}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            marginBottom: hasColorImages ? '20px' : '0',
          }}
        >
          {colors.map((color, index) => {
            const isSelected = index === selectedIndex
            const isFocused = focusedIndex === index
            const isTabStop = focusedIndex >= 0 ? isFocused : isSelected

            /*
             * Determine the swatch border style.
             * Active: 2.5px solid accent color + box shadow halo.
             * Inactive: 1.5px solid hairline.
             * The outer ring creates separation between swatch and border
             * for dark-colored swatches (e.g. black swatch on white bg).
             */
            const swatchBorder = isSelected
              ? `2.5px solid ${accentColor}`
              : '1.5px solid var(--color-border-hairline)'

            const swatchShadow = isSelected
              ? `0 0 0 3px ${accentColor}28, var(--shadow-sm)`
              : 'var(--shadow-sm)'

            return (
              <button
                key={`swatch-${index}-${color.hex}`}
                ref={(el) => {
                  swatchRefs.current[index] = el
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${color.name}${isSelected ? ' — selected' : ''}`}
                tabIndex={isTabStop ? 0 : -1}
                onClick={() => {
                  selectColor(index)
                  setFocusedIndex(index)
                }}
                onFocus={() => handleSwatchFocus(index)}
                className="bike-swatch-btn"
                title={color.name}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '999px',
                  backgroundColor: color.hex,
                  border: swatchBorder,
                  boxShadow: swatchShadow,
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                  transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                  position: 'relative',
                }}
              >
                {/*
                 * Accessibility: screen reader already gets the aria-label.
                 * The swatch is purely visual — no inner text needed.
                 */}
                <span className="sr-only">{color.name}</span>

                {/*
                 * Selected checkmark overlay.
                 * A small white circle in the center of the active swatch.
                 * Provides a clear visual "selected" indicator that works
                 * on any background color (white on any hue).
                 * Hidden when not selected.
                 */}
                {isSelected && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                      display: 'block',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Color preview image ───────────────────────────────────── */}
      {/*
       * Shown only when at least one color has a per-color imageUrl.
       * Each color change fades in the new image via the key trick.
       *
       * Falls back to heroImageUrl for colors without their own image.
       * This prevents a blank panel when switching to a color without
       * a dedicated product image.
       *
       * Aspect ratio: 16/10 — slightly taller than widescreen to
       * show more detail of the motorcycle profile.
       *
       * Border radius: r-lg (10px) — matches the BikeGallery style.
       * border: 1px hairline — subtle container edge.
       */}
      {hasColorImages && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid var(--color-border-hairline)',
            backgroundColor: 'var(--color-surface-inverse)',
          }}
        >
          <div
            key={`color-preview-${imageKey}`}
            className="bike-color-preview-image"
            style={{ position: 'absolute', inset: 0 }}
          >
            <Image
              src={currentImageUrl}
              alt={`${bikeName} in ${selectedColor.name}`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1440px) 65vw, 900px"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              placeholder={currentBlurUrl ? 'blur' : 'empty'}
              blurDataURL={currentBlurUrl ?? DEFAULT_BLUR}
            />
          </div>

          {/*
           * Color name badge — bottom-left of the preview image.
           * Provides context for which color is currently shown.
           * Dark semi-transparent background ensures legibility on any image.
           */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              zIndex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '28px',
              padding: '0 10px 0 8px',
              backgroundColor: 'rgba(14,15,18,0.62)',
              borderRadius: '999px',
            }}
          >
            {/*
             * Color dot — the swatch hex color in a small circle.
             * Provides a quick visual match between the badge and the swatch.
             */}
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                backgroundColor: selectedColor.hex,
                border: '1px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedColor.name}
            </span>
          </div>
        </div>
      )}

      {/*
       * Swatch description for screen readers.
       * Announces the selected color after selection.
       * aria-live="polite" reads on color change without interrupting
       * any current screen reader output.
       */}
      <p
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {selectedColor.name} selected
      </p>
    </>
  )
}