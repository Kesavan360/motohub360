'use client'

/*
 * Skeleton — Shimmer loading placeholder primitive.
 *
 * MPD Section 6, Animations:
 *   "Loading state — skeleton shimmer (subtle, low-contrast sweep)
 *   — never a spinner on content areas. 1.2s loop."
 *
 * MPD Task D-06:
 *   "A component that renders a grey shimmer block (any width/height
 *   via props) using the shimmer keyframe. Used as loading placeholder
 *   everywhere images or content loads asynchronously."
 *
 * MPD Component Library:
 *   Skeleton | Width/height via props, shimmer animation
 *
 * USAGE — single block:
 *   <Skeleton width="100%" height={200} />
 *
 * USAGE — text line:
 *   <Skeleton width="60%" height={16} rounded="r-sm" />
 *
 * USAGE — card placeholder (composed):
 *   <SkeletonCard />   ← see compound export below
 *
 * USAGE — BikeGrid loading state (LP-02):
 *   {loading && Array.from({ length: 6 }).map((_, i) => (
 *     <SkeletonBikeCard key={i} />
 *   ))}
 *
 * HOW IT WORKS:
 *   The shimmer effect uses a linear-gradient background that animates
 *   its background-position left-to-right via the `shimmer` @keyframes
 *   defined in D-04. The gradient uses surface-sunken and border-hairline
 *   tokens from D-01 for a low-contrast, premium feel.
 *
 * ACCESSIBILITY:
 *   - role="status" signals to screen readers that content is loading.
 *   - aria-label="Loading..." provides a human-readable description.
 *   - aria-busy="true" indicates the region is in a loading state.
 *   - Respects prefers-reduced-motion — shimmer animation is disabled
 *     globally in D-03. The block still renders as a static grey shape.
 */

import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * SkeletonRounded — border radius token names from the Design System.
 * Maps to the borderRadius tokens defined in S-09 (tailwind.config.ts).
 * Uses the r-* prefix convention from MPD Section 6, Border Radius.
 */
export type SkeletonRounded =
  | 'none'
  | 'r-sm'
  | 'r-md'
  | 'r-lg'
  | 'r-xl'
  | 'r-full'

/*
 * SkeletonProps — props for the base Skeleton component.
 */
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /*
   * width — CSS width value.
   * Accepts any valid CSS width: '100%', '200px', '12rem', etc.
   * Default: '100%'
   */
  width?: string | number

  /*
   * height — CSS height value.
   * Accepts number (treated as px) or string CSS value.
   * Default: 16 (16px — matches body-sm line height)
   */
  height?: string | number

  /*
   * rounded — border radius token from the Design System.
   * Default: 'r-sm' — matches input and tag radius.
   */
  rounded?: SkeletonRounded

  /*
   * className — additional Tailwind classes for layout positioning.
   * Use for margin, flex, grid placement — not for width/height
   * (use the width/height props for those).
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Border radius map — token name → CSS value
// Mirrors the borderRadius config in tailwind.config.ts (S-09).
// Used inline because Tailwind classes are purged from dynamic strings.
// ---------------------------------------------------------------------------

const RADIUS_MAP: Record<SkeletonRounded, string> = {
  none: '0px',
  'r-sm': '6px',
  'r-md': '10px',
  'r-lg': '16px',
  'r-xl': '24px',
  'r-full': '999px',
}

// ---------------------------------------------------------------------------
// Base Skeleton Component
// ---------------------------------------------------------------------------

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton(
    {
      width = '100%',
      height = 16,
      rounded = 'r-sm',
      className = '',
      style,
      ...rest
    },
    ref,
  ) {
    /*
     * Normalise numeric values to pixel strings.
     * Allows <Skeleton height={200} /> instead of height="200px".
     */
    const cssWidth =
      typeof width === 'number' ? `${width}px` : width
    const cssHeight =
      typeof height === 'number' ? `${height}px` : height

    /*
     * Shimmer gradient — low-contrast left-to-right sweep.
     * Uses Design System surface tokens from D-01:
     *   surface-sunken (#F2F1EF) — base colour
     *   border-hairline (#E4E3E0) — highlight sweep colour
     *
     * background-size: 200% 100% allows the gradient to travel
     * the full width of the element when background-position
     * animates from -200% to 200% (defined in D-04 shimmer keyframe).
     *
     * The gradient is intentionally subtle — three-stop with the
     * highlight centred at 50% for a clean, professional sweep.
     */
    const shimmerStyle: CSSProperties = {
      width: cssWidth,
      height: cssHeight,
      borderRadius: RADIUS_MAP[rounded],
      background: `linear-gradient(
        90deg,
        var(--color-surface-sunken) 0%,
        var(--color-border-hairline) 50%,
        var(--color-surface-sunken) 100%
      )`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.2s ease-in-out infinite',
      display: 'block',
      flexShrink: 0,
      ...style,
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading..."
        aria-busy="true"
        className={className}
        style={shimmerStyle}
        {...rest}
      />
    )
  },
)

Skeleton.displayName = 'Skeleton'

// ---------------------------------------------------------------------------
// SkeletonText — convenience component for text line placeholders.
// Renders a series of shimmer lines mimicking body copy.
// ---------------------------------------------------------------------------

export interface SkeletonTextProps {
  /*
   * lines — number of text lines to render.
   * Default: 3
   */
  lines?: number

  /*
   * lastLineWidth — width of the final line to simulate natural
   * text ending (last line of a paragraph is rarely full-width).
   * Default: '60%'
   */
  lastLineWidth?: string

  /*
   * gap — vertical spacing between lines in px.
   * Default: 8 (space-2 from Design System)
   */
  gap?: number

  /*
   * lineHeight — height of each line in px.
   * Default: 13 (matches body-sm text size from MPD type scale)
   */
  lineHeight?: number

  className?: string
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  gap = 8,
  lineHeight = 13,
  className = '',
}: SkeletonTextProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap }}
      role="status"
      aria-label="Loading text..."
      aria-busy="true"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          rounded="r-sm"
          /*
           * Remove nested role/aria from individual lines —
           * the parent div already announces the loading state.
           */
          role="presentation"
          aria-label={undefined}
          aria-busy={undefined}
        />
      ))}
    </div>
  )
}

SkeletonText.displayName = 'SkeletonText'

// ---------------------------------------------------------------------------
// SkeletonBikeCard — compound placeholder for BikeCard component (LP-01).
//
// Matches the exact BikeCard layout:
//   - 4:3 image area (r-lg)
//   - Bike name line (display-md height ~32px)
//   - Tagline line (body-sm height ~13px)
//   - Price line (data-md height ~15px, 50% width)
//
// Used in BikeGrid (LP-02) loading state:
//   <BikeGrid loading={true} bikes={[]} />
// ---------------------------------------------------------------------------

export interface SkeletonBikeCardProps {
  className?: string
}

export function SkeletonBikeCard({ className = '' }: SkeletonBikeCardProps) {
  return (
    <div
      className={className}
      role="status"
      aria-label="Loading bike..."
      aria-busy="true"
      style={{
        borderRadius: RADIUS_MAP['r-lg'],
        overflow: 'hidden',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-hairline)',
      }}
    >
      {/*
       * Image area — 4:3 aspect ratio.
       * Uses padding-bottom trick for aspect ratio before CSS aspect-ratio
       * has universal support in older WebViews.
       * The shimmer fills the entire image container.
       */}
      <div style={{ position: 'relative', paddingBottom: '75%', width: '100%' }}>
        <Skeleton
          width="100%"
          height="100%"
          rounded="none"
          role="presentation"
          aria-label={undefined}
          aria-busy={undefined}
          style={{
            position: 'absolute',
            inset: 0,
            height: '100%',
          }}
        />
      </div>

      {/* Content area — matches BikeCard padding (space-4 = 24px) */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Bike name — matches display-md line height */}
        <Skeleton
          width="85%"
          height={24}
          rounded="r-sm"
          role="presentation"
          aria-label={undefined}
          aria-busy={undefined}
        />

        {/* Tagline — matches body-sm */}
        <Skeleton
          width="70%"
          height={13}
          rounded="r-sm"
          role="presentation"
          aria-label={undefined}
          aria-busy={undefined}
        />

        {/* Price — matches data-md, shorter width */}
        <Skeleton
          width="45%"
          height={15}
          rounded="r-sm"
          role="presentation"
          aria-label={undefined}
          aria-busy={undefined}
          style={{ marginTop: '4px' }}
        />
      </div>
    </div>
  )
}

SkeletonBikeCard.displayName = 'SkeletonBikeCard'

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default Skeleton