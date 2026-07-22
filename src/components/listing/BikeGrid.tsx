/*
 * BikeGrid — Responsive motorcycle listing grid.
 *
 * MPD Task LP-02:
 *   "3-column desktop / 2-column tablet / 1-column mobile responsive
 *   grid. Accepts array of bike data, renders BikeCard per item.
 *   Accepts loading prop — renders 6 Skeleton cards while data loads."
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Clean grid of bike cards: image, name, starting ex-showroom
 *   price, brand badge. Filter/sort controls kept minimal and
 *   unobtrusive — filtering should feel like refining a curated
 *   catalog, not a marketplace search."
 *
 * MPD High-Fidelity UI, Brand Listing Page:
 *   "Grid is 3-column desktop / 2-column tablet / 1-column mobile,
 *   with space-4 gaps throughout — consistent, calm, no visual noise
 *   between cards (no badges, no 'new' ribbons, no star ratings)."
 *
 * MPD Section 6 Spacing — space-4: 24px
 *   Grid gap is space-4 (24px) on desktop.
 *   Reduced to 16px on mobile for tighter proportions.
 *
 * LOADING STATE:
 *   When loading=true, renders count Skeleton placeholder cards
 *   (SkeletonBikeCard from D-06) instead of real BikeCard components.
 *   The grid layout is identical in loading and loaded states so
 *   there is no layout shift when real data arrives.
 *   Default skeleton count: 6 (fills a 3-column × 2-row grid).
 *
 * EMPTY STATE:
 *   When bikes=[] and loading=false, renders a clean empty state:
 *   no bikes illustration + message + suggestion to clear filters.
 *   The empty state uses the motorcycle Icon (D-08) at 32px.
 *
 * ACCENT COLORS:
 *   BikeGrid accepts a brandAccentMap prop (slug → hex) so each
 *   BikeCard can display the correct brand accent on its arrow icon.
 *   Falls back to the BRAND_ACCENT_MAP from constants/brands.ts (S-08)
 *   when no map is provided — correct for the initial curated brands.
 *   Brands added later via admin that are not in the constant map
 *   will use the DEFAULT_ACCENT_COLOR (#15161A) as fallback.
 *
 * SERVER COMPONENT:
 *   BikeGrid is a Server Component — no 'use client'.
 *   BikeCard is 'use client' (hover state) — Next.js handles the
 *   client boundary at the BikeCard level, not the grid level.
 *   SkeletonBikeCard is 'use client' — same pattern.
 *
 *   EXCEPTION: When loading=true, SkeletonBikeCard (client component)
 *   is rendered. This is valid — a Server Component can render
 *   Client Components as children.
 *
 * USAGE — Brand listing page (LP-04):
 *   <BikeGrid bikes={bikes} loading={false} />
 *
 * USAGE — Loading state (LP-04 data fetch):
 *   <BikeGrid bikes={[]} loading={true} skeletonCount={6} />
 *
 * USAGE — With brand accent map (LP-04):
 *   <BikeGrid
 *     bikes={bikes}
 *     loading={false}
 *     brandAccentMap={{ 'royal-enfield': '#7A2E2E', 'ktm': '#FF6A00' }}
 *   />
 *
 * USAGE — Related bikes compact (B-12 future):
 *   <BikeGrid
 *     bikes={relatedBikes}
 *     loading={false}
 *     variant="compact"
 *     columns={3}
 *   />
 */

import BikeCard from '@/components/listing/BikeCard'
import { SkeletonBikeCard } from '@/components/ui/Skeleton'
import Icon from '@/components/ui/Icon'
import {
  BRAND_ACCENT_MAP,
  DEFAULT_ACCENT_COLOR,
} from '@/constants/brands'
import type { BikeSummary } from '@/types/bike'
import type { BikeCardVariant } from '@/components/listing/BikeCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeGridProps {
  /*
   * bikes — array of BikeSummary objects to render as BikeCards.
   * Empty array + loading=false renders the empty state.
   * Empty array + loading=true renders skeleton placeholders.
   */
  bikes: BikeSummary[]

  /*
   * loading — when true, renders SkeletonBikeCard placeholders
   * instead of real BikeCard components.
   * Default: false
   */
  loading?: boolean

  /*
   * skeletonCount — number of skeleton cards to render when loading.
   * Default: 6 (fills one full 3-column × 2-row grid viewport)
   * Set to 9 for deeper loading states.
   */
  skeletonCount?: number

  /*
   * variant — passed to each BikeCard.
   * 'default': full card (listing pages)
   * 'compact': smaller card (related bikes)
   * Default: 'default'
   */
  variant?: BikeCardVariant

  /*
   * brandAccentMap — optional slug → hex map for arrow icon accent colors.
   * Falls back to BRAND_ACCENT_MAP from constants/brands.ts (S-08).
   * Pass a custom map when bikes include brands outside the initial 6.
   */
  brandAccentMap?: Record<string, string>

  /*
   * columns — override for the default 3-column desktop layout.
   * Default: 3
   * Use 4 for denser grids (future: search results page SR-06).
   * Use 3 for all listing pages per MPD spec.
   */
  columns?: 2 | 3 | 4

  /*
   * emptyMessage — custom message shown when bikes is empty and not loading.
   * Default: "No motorcycles found."
   */
  emptyMessage?: string

  /*
   * emptySubMessage — secondary text under the empty message.
   * Default: "Try adjusting your filters or browse all motorcycles."
   */
  emptySubMessage?: string

  /*
   * className — additional CSS classes for the outer grid container.
   */
  className?: string

  /*
   * firstCardPriority — whether to set priority={true} on the first
   * BikeCard (LCP candidate above the fold on listing pages).
   * Default: true
   */
  firstCardPriority?: boolean
}

// ---------------------------------------------------------------------------
// BikeGrid Component
// ---------------------------------------------------------------------------

export default function BikeGrid({
  bikes,
  loading = false,
  skeletonCount = 6,
  variant = 'default',
  brandAccentMap,
  columns = 3,
  emptyMessage = 'No motorcycles found.',
  emptySubMessage = 'Try adjusting your filters or browse all motorcycles.',
  className = '',
  firstCardPriority = true,
}: BikeGridProps) {
  /*
   * Resolve the accent map — use the provided map if available,
   * otherwise fall back to the static BRAND_ACCENT_MAP (S-08).
   * The static map covers the initial 6 curated brands.
   */
  const accentMap = brandAccentMap ?? BRAND_ACCENT_MAP

  /*
   * getAccentColor — looks up the brand accent for a given brandSlug.
   * Falls back to DEFAULT_ACCENT_COLOR (#15161A) for unknown brands.
   */
  function getAccentColor(brandSlug: string): string {
    return accentMap[brandSlug] ?? DEFAULT_ACCENT_COLOR
  }

  /*
   * Grid column CSS value — maps the columns prop to a CSS string.
   * Used in the gridTemplateColumns inline style.
   */
  const desktopCols = `repeat(${columns}, 1fr)`

  return (
    <>
      {/*
       * Scoped responsive grid styles.
       *
       * Desktop (≥ 769px):  columns prop (default: 3) — 3-column grid
       * Tablet (481–768px): always 2 columns regardless of columns prop
       * Mobile (≤ 480px):   always 1 column
       *
       * Gap: space-4 (24px) desktop, 20px tablet, 16px mobile.
       * Per MPD: "space-4 gaps throughout."
       */}
      <style>{`
        .bike-grid {
          display: grid;
          grid-template-columns: ${desktopCols};
          gap: 24px;
          width: 100%;
        }

        @media (max-width: 768px) {
          .bike-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px;
          }
        }

        @media (max-width: 480px) {
          .bike-grid {
            grid-template-columns: 1fr !important;
            gap: 16px;
          }
        }

        /*
         * Empty state container — centered, generous vertical padding.
         */
        .bike-grid-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 32px;
          text-align: center;
          width: 100%;
        }
      `}</style>

      {/* ── Loading state ────────────────────────────────────────── */}
      {loading && (
        <div className={`bike-grid ${className}`}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            /*
             * SkeletonBikeCard — from D-06 Skeleton.tsx.
             * Matches the BikeCard layout exactly (4:3 image + content).
             * The grid renders identically in loading and loaded states —
             * no layout shift when real data replaces skeletons.
             */
            <SkeletonBikeCard key={`skeleton-${index}`} />
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!loading && bikes.length === 0 && (
        <div className="bike-grid-empty">
          {/*
           * Motorcycle icon — 32px, ink-tertiary per MPD Section 6 Icons
           * "32px — empty states."
           * aria-hidden: the heading carries the message.
           */}
          <div
            aria-hidden="true"
            style={{
              color: 'var(--color-ink-tertiary)',
              opacity: 0.4,
              marginBottom: '20px',
            }}
          >
            <Icon name="motorcycle" size={32} strokeWidth={1.5} />
          </div>

          {/*
           * Empty state heading — display-md equivalent size.
           * Clear, factual, non-alarming per MPD copy tone.
           */}
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--color-ink-primary)',
              margin: '0 0 8px',
            }}
          >
            {emptyMessage}
          </h3>

          {/*
           * Supporting message — body-md, ink-secondary.
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              fontWeight: 400,
              color: 'var(--color-ink-secondary)',
              margin: 0,
              maxWidth: '320px',
              lineHeight: 1.6,
            }}
          >
            {emptySubMessage}
          </p>
        </div>
      )}

    {/* ── Loaded state — real BikeCard grid ───────────────────── */}
{!loading && bikes.length > 0 && (
  <div className={`bike-grid ${className}`}>
    {bikes.map((bike, index) => {
      const bikeData = JSON.parse(JSON.stringify(bike))

      return (
        <BikeCard
          key={bikeData._id}
          bike={bikeData}
          variant={variant}
          accentColor={getAccentColor(bikeData.brandSlug)}
          priority={firstCardPriority && index === 0}
        />
      )
    })}
  </div>
)}
    </>
  )
}