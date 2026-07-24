/*
 * RelatedBikes — Related motorcycle suggestions for the bike detail page.
 *
 * MPD Task B-07:
 *   "Related bikes — horizontal scroll row of BikeCard (compact variant)
 *   showing related bikes from the same brand or same category.
 *   Maximum 4 related bikes."
 *
 * MPD Section 5.3, Bike Detail Page — Below the fold:
 *   "Related bikes: up to 4 BikeCard (compact) cards showing other
 *   motorcycles the user might consider. Priority: same brand first,
 *   then same category (different brand) to fill up to 4 total."
 *
 * COMPONENT TYPE: Server Component (no 'use client').
 *   RelatedBikes fetches its own data from MongoDB directly.
 *   This keeps page.tsx clean and makes the component self-contained.
 *   The DB-01 singleton ensures only one MongoDB connection is used
 *   regardless of how many Server Components call connectDB().
 *
 * QUERY STRATEGY:
 *   Step 1: Find up to 4 published bikes where:
 *             brandSlug === current bike's brand
 *             slug !== current bike's slug  (exclude itself)
 *             status === 'published'
 *           Sorted by publishedAt desc (most recent first).
 *
 *   Step 2: If step 1 returned fewer than 4 bikes, fill the remainder
 *           with published bikes where:
 *             category === current bike's category
 *             brandSlug !== current bike's brand  (different brand)
 *             status === 'published'
 *           Sorted by publishedAt desc.
 *
 *   Combined: deduplicated by slug (safety guard), capped at 4.
 *
 *   Returns null if combined result is empty (no related bikes in DB).
 *   For V1 with a single seeded bike (GT 650), this returns null until
 *   more bikes are added. The empty state is handled gracefully.
 *
 * LAYOUT:
 *   Desktop (≥ 769px): 4-column CSS grid — all 4 cards visible at once.
 *   Tablet (481–768px): 2-column CSS grid — 2 cards per row.
 *   Mobile (≤ 480px):  Horizontal scroll row — cards fixed 240px wide,
 *                       scroll-snap, touch-friendly.
 *
 *   The horizontal scroll on mobile prevents cards from becoming too
 *   narrow in a 1-column layout (BikeCard images look poor at ~335px).
 *   Fixed 240px cards at the list edge reveal the next card partially,
 *   signalling scrollability.
 *
 * CARD VARIANT:
 *   Uses BikeCard with variant="compact".
 *   Compact variant: smaller image (16:9 vs 4:3 default), reduced
 *   padding, smaller typography — appropriate for a supporting section.
 *
 * SECTION HEADER:
 *   Two label variants depending on whether all related bikes are from
 *   the same brand:
 *     All same brand: "More from [Brand Name]"
 *     Mixed brands:   "You Might Also Like"
 *
 * ACCENT MAP:
 *   Built from BRAND_ACCENT_MAP (S-08) for the related bikes' brands.
 *   Passed to each BikeCard for the arrow hover accent colour.
 *
 * ERROR HANDLING:
 *   Any DB error returns null — the section simply doesn't render.
 *   The page.tsx caller doesn't need to handle this; the section
 *   label is inside this component and is omitted on null return.
 */

import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import BikeCard from '@/components/listing/BikeCard'
import { BRAND_ACCENT_MAP, BRAND_MAP } from '@/constants/brands'
import type { BikeSummary } from '@/types/bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RELATED = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelatedBikesProps {
  /*
   * currentSlug — the slug of the bike currently being viewed.
   * Excluded from the related bikes query.
   */
  currentSlug: string

  /*
   * brandSlug — the brand of the current bike.
   * Used for same-brand priority query.
   */
  brandSlug: string

  /*
   * category — the category of the current bike.
   * Used for same-category fill query.
   */
  category: string

  /*
   * accentColor — the current bike's brand accent color.
   * Used for the section label accent bar.
   */
  accentColor: string
}

// ---------------------------------------------------------------------------
// RelatedBikes Component
// ---------------------------------------------------------------------------

export default async function RelatedBikes({
  currentSlug,
  brandSlug,
  category,
  accentColor,
}: RelatedBikesProps) {
  // ── Fetch related bikes ────────────────────────────────────────────

  let relatedBikes: BikeSummary[] = []

  try {
    await connectDB()

    /*
     * Shared projection — fields needed for BikeCard.
     * Matches the BikeSummary shape from types/bike.ts (S-07).
     */
    const projection =
      'slug brandSlug name tagline category status pricing heroImageUrl blurDataUrl publishedAt'

    /*
     * Step 1 — Same brand, different slug, published, newest first.
     * Primary source of related bikes — brand coherence matters most.
     */
    const sameBrandBikes = await Bike.find({
      brandSlug,
      slug: { $ne: currentSlug },
      status: 'published',
    })
      .select(projection)
      .sort({ publishedAt: -1 })
      .limit(MAX_RELATED)
      .lean<BikeSummary[]>()

    /*
     * Step 2 — Same category, different brand, published.
     * Fill remaining slots if same-brand produced fewer than MAX_RELATED.
     */
    const remaining = MAX_RELATED - sameBrandBikes.length

    let categoryBikes: BikeSummary[] = []

    if (remaining > 0) {
      categoryBikes = await Bike.find({
        category,
        brandSlug: { $ne: brandSlug },
        status: 'published',
      })
        .select(projection)
        .sort({ publishedAt: -1 })
        .limit(remaining)
        .lean<BikeSummary[]>()
    }

    /*
     * Combine and deduplicate by slug.
     * The deduplication guard handles the edge case where a category
     * query returns a bike already in the same-brand results
     * (unlikely but possible if brandSlug changes between queries).
     */
    const seen = new Set<string>()
    const combined = [...sameBrandBikes, ...categoryBikes].filter(
      (bike) => {
        if (seen.has(bike.slug)) return false
        seen.add(bike.slug)
        return true
      },
    )

    relatedBikes = combined.slice(0, MAX_RELATED)
  } catch {
    /*
     * DB error — return null silently.
     * The section simply doesn't appear rather than crashing the page.
     */
    return null
  }

  /*
   * No related bikes — return null.
   * The section label is inside this component, so nothing renders.
   * This is the expected state for V1 when only the GT 650 is seeded.
   */
  if (relatedBikes.length === 0) {
    return null
  }

  // ── Derived values ────────────────────────────────────────────────

  /*
   * Build brand accent map for the related bikes.
   * Each BikeCard uses its brand's accent color on arrow hover.
   */
  const relatedAccentMap: Record<string, string> = relatedBikes.reduce<
    Record<string, string>
  >((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] =
        BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  /*
   * Section heading — varies based on whether all related bikes
   * share the same brand as the current bike.
   *
   * All same brand: "More from Royal Enfield" — reinforces brand identity.
   * Mixed brands:   "You Might Also Like" — neutral discovery framing.
   */
  const allSameBrand = relatedBikes.every(
    (bike) => bike.brandSlug === brandSlug,
  )

  const brandName =
    BRAND_MAP[brandSlug]?.name ??
    brandSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const sectionHeading = allSameBrand
    ? `More from ${brandName}`
    : 'You Might Also Like'

  return (
    <>
      <style>{`
        /*
         * Related bikes grid.
         *
         * Desktop (≥ 769px): 4 equal columns.
         * Tablet (481–768px): 2 columns.
         * Mobile (≤ 480px): horizontal scroll row — fixed-width cards.
         */
        .related-bikes-grid {
          display: grid;
          grid-template-columns: repeat(${relatedBikes.length}, 1fr);
          gap: 16px;
        }

        @media (max-width: 1024px) {
          .related-bikes-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /*
         * Mobile horizontal scroll.
         * Cards are fixed 240px wide so they don't collapse too small.
         * The last card peeks at the edge, signalling scroll affordance.
         * scroll-snap-type: mandatory keeps cards aligned cleanly.
         */
        @media (max-width: 480px) {
          .related-bikes-grid {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
            padding-bottom: 4px;
          }

          .related-bikes-grid::-webkit-scrollbar {
            display: none;
          }

          .related-bikes-grid > * {
            flex: 0 0 220px;
            scroll-snap-align: start;
            min-width: 0;
          }
        }

        /*
         * "View all" link hover.
         */
        .related-view-all:hover {
          color: var(--color-ink-primary) !important;
        }

        .related-view-all:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
        }
      `}</style>

      {/* ── Section header ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/*
           * Accent bar — visual brand tie, matching BikeSpecTable and
           * BikeFeaturesList section header style for consistency.
           */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '3px',
              height: '16px',
              borderRadius: '999px',
              backgroundColor: accentColor,
              flexShrink: 0,
            }}
          />

          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(16px, 2vw, 20px)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink-primary)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {sectionHeading}
          </h3>
        </div>

        {/*
         * "View all [Brand] motorcycles" link.
         * Only shown when all related bikes share the current brand.
         * Links to the brand listing page for further exploration.
         */}
        {allSameBrand && (
          <Link
            href={`/brands/${brandSlug}`}
            className="related-view-all"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-ink-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
              transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
            }}
            aria-label={`View all ${brandName} motorcycles`}
          >
            View all
            <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>
              →
            </span>
          </Link>
        )}
      </div>

      {/* ── Related bikes grid ────────────────────────────────────── */}
      <div
        className="related-bikes-grid"
        role="list"
        aria-label={sectionHeading}
      >
        {relatedBikes.map((bike, index) => (
          <div
            key={bike.slug}
            role="listitem"
            style={{ minWidth: 0 }}
          >
            {/*
             * BikeCard — compact variant.
             * firstCardPriority=false — related bikes are below the fold
             * and should never be LCP candidates.
             * brandAccentMap provides the correct accent color per brand.
             */}
            <BikeCard
              bike={bike}
              variant="compact"
              brandAccentMap={relatedAccentMap}
              priority={index === 0 && false}
            />
          </div>
        ))}
      </div>
    </>
  )
}