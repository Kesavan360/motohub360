/*
 * Price Range Listing Page — /price/[range]
 *
 * MPD Task LP-06:
 *   "Same structure, filtered by price range.
 *   Page title: 'Motorcycles under ₹2 Lakh.'"
 *
 * MPD Section 4, Site Structure:
 *   "/price/[range] → Price listing | ISR (1hr)"
 *
 * MPD Section 4, Price Ranges (final approved list):
 *   under-1-lakh  · 1-2-lakh  · 2-5-lakh  · above-5-lakh
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Clean grid of bike cards. Filter/sort controls kept minimal
 *   and unobtrusive. No clutter, no ads, no star ratings."
 *
 * MPD Section 8, Rendering Strategy:
 *   ISR (1hr revalidation). generateStaticParams() pre-builds all
 *   4 price range pages at deploy time using PRICE_RANGE_SLUGS (S-08).
 *   DB-08 replaces mock data with real MongoDB queries using
 *   minPrice/maxPrice from PRICE_RANGE_MAP as query boundaries.
 *
 * FILTER BEHAVIOUR:
 *   hiddenFilters={['priceRange']} — price range is implicit from the URL.
 *   Category and Sort filters remain to refine within the price band.
 *   onChange logs in development; wired to API in DB-08.
 *
 * PRICE BOUNDARIES:
 *   minPrice and maxPrice from PRICE_RANGE_MAP drive mock filtering.
 *   In DB-08 these become MongoDB query operators:
 *     { 'pricing.exShowroom': { $gte: minPrice, $lte: maxPrice } }
 *   maxPrice of Number.POSITIVE_INFINITY becomes { $gte: minPrice }
 *   with no upper bound.
 *
 * NOT FOUND:
 *   Invalid [range] params call notFound() → renders L-07.
 *
 * SERVER COMPONENT:
 *   Page is a Server Component. FilterBar/BikeCard are 'use client'
 *   — Next.js handles client boundaries at the component level.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBar from '@/components/listing/FilterBar'
import BikeGrid from '@/components/listing/BikeGrid'
import {
  PRICE_RANGE_MAP,
  PRICE_RANGE_SLUGS,
  isValidPriceRange,
  formatPriceInLakhs,
} from '@/constants/priceRanges'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { BikeSummary } from '@/types/bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

/*
 * ISR — revalidate every hour.
 * MPD Section 8: "/price/[range] → ISR (1hr)"
 */
export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * Pre-builds all 4 price range pages at deploy time.
 * Uses PRICE_RANGE_SLUGS from constants/priceRanges.ts (S-08):
 *   ['under-1-lakh', '1-2-lakh', '2-5-lakh', 'above-5-lakh']
 *
 * DB-08: price range pages remain static — ranges are fixed per MPD.
 * No MongoDB query needed here; the page content (bike grid) uses ISR.
 */
export function generateStaticParams(): Array<{ range: string }> {
  return PRICE_RANGE_SLUGS.map((slug) => ({ range: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

/*
 * MPD Section 12, SEO Architecture:
 *   "Listing pages: metadata generated from brand/category name."
 *   Applies equally to price range pages.
 *
 * Title format: "[pageTitle] — Prices, Specs & Colours | MotoHub360"
 * Example for '2-5-lakh':
 *   "Motorcycles Between ₹2 Lakh and ₹5 Lakh in India —
 *    Prices, Specs & Colours | MotoHub360"
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ range: string }>
}): Promise<Metadata> {
  const { range: rangeSlug } = await params

  if (!isValidPriceRange(rangeSlug)) {
    return {
      title: 'Price Range Not Found | MotoHub360',
    }
  }

  const rangeDef = PRICE_RANGE_MAP[rangeSlug]
  const title = `${rangeDef.pageTitle} — Prices, Specs & Colours | MotoHub360`
  const description = rangeDef.metaDescription

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/price/${rangeSlug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/price/${rangeSlug}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock bike data for LP-06
// ---------------------------------------------------------------------------

/*
 * Builds mock BikeSummary objects whose prices fall within the
 * given price range boundaries (minPrice / maxPrice).
 *
 * The mock data includes bikes from all brands at various price points.
 * Bikes are filtered to only include those whose exShowroom price
 * falls within [minPrice, maxPrice].
 *
 * DB-08 replacement:
 *   const { minPrice, maxPrice } = PRICE_RANGE_MAP[rangeSlug]
 *   const priceQuery = maxPrice === Number.POSITIVE_INFINITY
 *     ? { 'pricing.exShowroom': { $gte: minPrice } }
 *     : { 'pricing.exShowroom': { $gte: minPrice, $lte: maxPrice } }
 *   const bikes = await Bike.find({ ...priceQuery, status: 'published' })
 *     .select('slug brandSlug name tagline category pricing colors gallery')
 *     .lean()
 */
function getMockBikesForPriceRange(
  minPrice: number,
  maxPrice: number,
): BikeSummary[] {
  /*
   * Master list of mock bikes across all brands and price points.
   * Covers a realistic spread of the Indian motorcycle market.
   * Each bike's exShowroom price determines which price range page
   * it appears on.
   */
  const ALL_MOCK_BIKES: Array<{
    name: string
    tagline: string
    price: number
    brandSlug: string
    category: BikeSummary['category']
    slug: string
  }> = [
    /*
     * Under ₹1 Lakh — entry-level commuters and scooters
     */
    { slug: 'shine-100', name: 'Shine 100', tagline: 'Everyday Excellence', price: 74900, brandSlug: 'honda', category: 'cruiser' },
    { slug: 'ct125x', name: 'CT125X', tagline: 'Tough Commuter', price: 84900, brandSlug: 'bajaj', category: 'cruiser' },
    { slug: 'jupiter-125', name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900, brandSlug: 'tvs', category: 'scooter' },
    { slug: 'ntorq-125', name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900, brandSlug: 'tvs', category: 'scooter' },
    { slug: 'raider-125', name: 'Raider 125', tagline: 'Daring by Design', price: 91900, brandSlug: 'tvs', category: 'naked' },
    { slug: 'fascino-125', name: 'Fascino 125', tagline: 'Style Redefined', price: 84900, brandSlug: 'yamaha', category: 'scooter' },

    /*
     * ₹1 Lakh – ₹2 Lakh — popular commuters and entry-level sport
     */
    { slug: 'pulsar-150', name: 'Pulsar 150', tagline: 'The Bikes Indians Love', price: 107000, brandSlug: 'bajaj', category: 'naked' },
    { slug: 'avenger-street-160', name: 'Avenger Street 160', tagline: 'Cruise Boss', price: 115000, brandSlug: 'bajaj', category: 'cruiser' },
    { slug: 'fz-s-v3', name: 'FZ-S V3', tagline: 'Street Warrior', price: 118900, brandSlug: 'yamaha', category: 'naked' },
    { slug: 'hornet-2-0', name: 'Hornet 2.0', tagline: 'The Evolved Predator', price: 130900, brandSlug: 'honda', category: 'naked' },
    { slug: 'cb200x', name: 'CB200X', tagline: 'Your Adventure Begins', price: 147900, brandSlug: 'honda', category: 'adventure' },
    { slug: 'chetak', name: 'Chetak Electric', tagline: 'Electric Classic', price: 149900, brandSlug: 'bajaj', category: 'scooter' },
    { slug: 'hunter-350', name: 'Hunter 350', tagline: 'City Born. Free Spirit.', price: 160000, brandSlug: 'royal-enfield', category: 'naked' },
    { slug: 'ronin', name: 'Ronin', tagline: 'Own Your Road', price: 164900, brandSlug: 'tvs', category: 'naked' },
    { slug: 'mt-15-v2', name: 'MT-15 V2', tagline: 'Masters of Torque', price: 167900, brandSlug: 'yamaha', category: 'naked' },
    { slug: 'duke-125', name: 'Duke 125', tagline: 'The Beginning of Fast', price: 158000, brandSlug: 'ktm', category: 'naked' },
    { slug: 'r15m', name: 'R15M', tagline: 'Born Racer', price: 185900, brandSlug: 'yamaha', category: 'sport' },
    { slug: 'rc-125', name: 'RC 125', tagline: 'Race Ready', price: 189000, brandSlug: 'ktm', category: 'sport' },
    { slug: 'pulsar-ns400z', name: 'Pulsar NS400Z', tagline: 'The Apex Predator', price: 189000, brandSlug: 'bajaj', category: 'naked' },
    { slug: 'classic-350', name: 'Classic 350', tagline: 'Timeless Classic', price: 192000, brandSlug: 'royal-enfield', category: 'cruiser' },

    /*
     * ₹2 Lakh – ₹5 Lakh — mid-range and performance
     */
    { slug: 'cb350rs', name: 'CB350RS', tagline: 'Refined Rebel', price: 209900, brandSlug: 'honda', category: 'cruiser' },
    { slug: 'duke-250', name: 'Duke 250', tagline: 'Born to Scrap', price: 212000, brandSlug: 'ktm', category: 'naked' },
    { slug: 'meteor-350', name: 'Meteor 350', tagline: 'Cruise Easy, Live Free', price: 222000, brandSlug: 'royal-enfield', category: 'cruiser' },
    { slug: 'dominar-400', name: 'Dominar 400', tagline: 'Conquer Every Road', price: 230000, brandSlug: 'bajaj', category: 'adventure' },
    { slug: 'apache-rtr-310', name: 'Apache RTR 310', tagline: 'Unleash the Beast', price: 246900, brandSlug: 'tvs', category: 'naked' },
    { slug: 'himalayan-450', name: 'Himalayan 450', tagline: 'Built for Adventure', price: 289000, brandSlug: 'royal-enfield', category: 'adventure' },
    { slug: 'duke-390', name: 'Duke 390', tagline: 'Ready to Race', price: 295000, brandSlug: 'ktm', category: 'naked' },
    { slug: 'apache-rr-310', name: 'Apache RR 310', tagline: 'Race DNA', price: 278900, brandSlug: 'tvs', category: 'sport' },
    { slug: 'gt-650', name: 'GT 650', tagline: 'Modern Classic Roadster', price: 348000, brandSlug: 'royal-enfield', category: 'cruiser' },
    { slug: 'continental-gt-650', name: 'Continental GT 650', tagline: 'Pure Café Racer', price: 338000, brandSlug: 'royal-enfield', category: 'cruiser' },
    { slug: 'adventure-390', name: 'Adventure 390', tagline: 'Go Anywhere', price: 349000, brandSlug: 'ktm', category: 'adventure' },
    { slug: 'rc-390', name: 'RC 390', tagline: 'Track Every Day', price: 327000, brandSlug: 'ktm', category: 'sport' },
    { slug: 'mt-03', name: 'MT-03', tagline: 'Dark Side of Japan', price: 478900, brandSlug: 'yamaha', category: 'naked' },

    /*
     * Above ₹5 Lakh — premium performance
     */
    { slug: 'r3', name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900, brandSlug: 'yamaha', category: 'sport' },
    { slug: 'cb500x', name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000, brandSlug: 'honda', category: 'adventure' },
    { slug: 'cbr650r', name: 'CBR 650R', tagline: 'Sport in Every Sense', price: 895000, brandSlug: 'honda', category: 'sport' },
  ]

  /*
   * Filter bikes whose price falls within [minPrice, maxPrice].
   * maxPrice of Number.POSITIVE_INFINITY means no upper bound.
   */
  const filtered = ALL_MOCK_BIKES.filter(
    (bike) =>
      bike.price >= minPrice &&
      (maxPrice === Number.POSITIVE_INFINITY || bike.price <= maxPrice),
  )

  /*
   * Limit to 6 bikes for the initial LP-06 grid display.
   * DB-08 removes this limit — full paginated results are returned.
   */
  const limited = filtered.slice(0, 6)

  return limited.map((bike, index) => ({
    _id: `mock-price-${bike.slug}-${index}`,
    slug: bike.slug,
    brandSlug: bike.brandSlug,
    name: bike.name,
    tagline: bike.tagline,
    category: bike.category,
    status: 'published' as const,
    pricing: {
      exShowroom: bike.price,
    },
    heroImageUrl:
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]?.heroImageUrl ??
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
    blurDataUrl: '',
  }))
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function PriceListingPage({
  params,
}: {
  params: Promise<{ range: string }>
}) {
  const { range: rangeSlug } = await params

  /*
   * Validate the range slug against approved PRICE_RANGE_SLUGS (S-08).
   * isValidPriceRange returns boolean (not a type guard) — we cast after.
   * Invalid slugs render the 404 page.
   */
  if (!isValidPriceRange(rangeSlug)) {
    notFound()
  }

  const rangeDef = PRICE_RANGE_MAP[rangeSlug]

  /*
   * TypeScript guard — PRICE_RANGE_MAP[rangeSlug] is always defined
   * after isValidPriceRange() passes, but strict TypeScript requires
   * an explicit check because PRICE_RANGE_MAP is typed as
   * Record<string, PriceRangeDefinition> (string-keyed).
   */
  if (!rangeDef) {
    notFound()
  }

  /*
   * Fetch mock bikes within this price range.
   * DB-08: replace with real MongoDB query:
   *   const priceQuery = rangeDef.maxPrice === Number.POSITIVE_INFINITY
   *     ? { 'pricing.exShowroom': { $gte: rangeDef.minPrice } }
   *     : { 'pricing.exShowroom': { $gte: rangeDef.minPrice, $lte: rangeDef.maxPrice } }
   *   const bikes = await Bike.find({ ...priceQuery, status: 'published' }).lean()
   */
  const bikes = getMockBikesForPriceRange(
    rangeDef.minPrice,
    rangeDef.maxPrice,
  )

  /*
   * Breadcrumb: Home > [fullLabel]
   * Uses fullLabel ("₹2 Lakh to ₹5 Lakh") for the breadcrumb
   * — more descriptive than the short label ("₹2–5L").
   */
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: rangeDef.fullLabel,
      href: `/price/${rangeSlug}`,
    },
  ]

  /*
   * Build brand accent map from bikes in this price range.
   * Multiple brands may appear — each gets its own accent color.
   */
  const priceAccentMap: Record<string, string> =
  bikes.reduce<Record<string, string>>((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] =
        BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  /*
   * Format the price boundary labels for display.
   * Used in the price context block and page sub-heading.
   *
   * maxPrice === POSITIVE_INFINITY: show "Above [minPrice]" format.
   * Otherwise: show "[minPrice] – [maxPrice]" range format.
   */
  const isPriceOpenEnded = rangeDef.maxPrice === Number.POSITIVE_INFINITY

  const priceRangeDisplay = isPriceOpenEnded
    ? `Above ${formatPriceInLakhs(rangeDef.minPrice)}`
    : `${formatPriceInLakhs(rangeDef.minPrice)} – ${formatPriceInLakhs(rangeDef.maxPrice)}`

  return (
    <>
      <style>{`
        /*
         * Page wrapper — surface-base background, full height.
         */
        .price-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
        }

        /*
         * Content container — max-width 1440px, centered.
         * 32px padding desktop, 20px mobile.
         */
        .price-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }

        @media (max-width: 768px) {
          .price-page-inner {
            padding: 0 20px;
          }
        }

        /*
         * Page header — price title + count + range display.
         * Same structural pattern as LP-04/LP-05 headers.
         */
        .price-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        @media (max-width: 480px) {
          .price-header {
            padding: 24px 0 20px;
          }
        }

        /*
         * FilterBar row — consistent with LP-04 and LP-05.
         */
        .price-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * Grid section — space-6 (48px) top, generous bottom.
         */
        .price-grid-section {
          padding: 48px 0 80px;
        }

        @media (max-width: 768px) {
          .price-grid-section {
            padding: 32px 0 60px;
          }
        }

        /*
         * Result count — body-sm, ink-tertiary, above the grid.
         */
        .price-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }

        /*
         * Price range pill — displays the formatted price range
         * (e.g. "₹2.00L – ₹5.00L") as a small badge above the h1.
         * Identical visual style to the category badge in LP-05.
         */
        .price-range-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-ink-tertiary);
          background-color: var(--color-surface-sunken);
          border: 1px solid var(--color-border-hairline);
          border-radius: 999px;
          margin-bottom: 12px;
        }

        /*
         * Price context block — a subtle informational row showing
         * the exact rupee range for this page.
         * Sits below the bike count, above the FilterBar.
         * Only shown on desktop — removed on mobile for space.
         */
        .price-context-block {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 14px 16px;
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 10px;
          margin-top: 20px;
        }

        @media (max-width: 480px) {
          .price-context-block {
            display: none;
          }
        }

        .price-context-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .price-context-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
        }

        .price-context-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 500;
          color: var(--color-ink-primary);
          letter-spacing: -0.01em;
        }

        .price-context-divider {
          width: 1px;
          height: 32px;
          background-color: var(--color-border-hairline);
          flex-shrink: 0;
        }
      `}</style>

      <main
        className="price-page"
        role="main"
        aria-label={`Motorcycles ${rangeDef.fullLabel}`}
      >
        <div className="price-page-inner">

          {/* ── Breadcrumb ──────────────────────────────────────── */}
          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* ── Price header ─────────────────────────────────────── */}
          {/*
           * MPD LP-06: "Page title: 'Motorcycles under ₹2 Lakh.'"
           *
           * Header structure:
           *   - Price range badge (monospace, e.g. "₹2.00L – ₹5.00L")
           *   - h1: pageTitle from PRICE_RANGE_MAP (S-08)
           *   - Bike count sub-label
           *   - Price context block (min/max rupee amounts, desktop only)
           *
           * pageTitle examples:
           *   "Motorcycles Under ₹1 Lakh in India"
           *   "Motorcycles Between ₹2 Lakh and ₹5 Lakh in India"
           *   "Motorcycles Above ₹5 Lakh in India"
           */}
          <div className="price-header">
            {/*
             * Price range badge — monospace for the numeric range.
             * Provides immediate visual context before reading the h1.
             * aria-hidden: h1 + bike count carry the accessible heading.
             */}
            <div className="price-range-badge" aria-hidden="true">
              {priceRangeDisplay}
            </div>

            {/*
             * Page title — display-md scale.
             * Uses pageTitle from PRICE_RANGE_MAP (S-08).
             * Example: "Motorcycles Between ₹2 Lakh and ₹5 Lakh in India"
             */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(20px, 3vw, 36px)',
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink-primary)',
                margin: '0 0 8px',
              }}
            >
              {rangeDef.pageTitle}
            </h1>

            {/*
             * Bike count — body-sm, ink-tertiary.
             * aria-live="polite" announces count updates when
             * filtering is wired to real data in DB-08.
             */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
              aria-live="polite"
            >
              {bikes.length} motorcycle{bikes.length !== 1 ? 's' : ''} available
            </p>

            {/*
             * Price context block — desktop only, aria-hidden.
             * Shows exact rupee boundaries for the current price band.
             * Helps users understand the exact range without reading
             * the page title carefully.
             *
             * Three items:
             *   Starting From:  formatted minPrice
             *   │ divider
             *   Up To:          formatted maxPrice (or "No upper limit")
             *   │ divider
             *   Ex-showroom:    "All prices are ex-showroom"
             */}
            <div
              className="price-context-block"
              aria-hidden="true"
            >
              <div className="price-context-item">
                <span className="price-context-label">Starting From</span>
                <span className="price-context-value">
                  {formatPriceInLakhs(rangeDef.minPrice)}
                </span>
              </div>

              <div className="price-context-divider" />

              <div className="price-context-item">
                <span className="price-context-label">
                  {isPriceOpenEnded ? 'Upper Limit' : 'Up To'}
                </span>
                <span className="price-context-value">
                  {isPriceOpenEnded
                    ? 'No upper limit'
                    : formatPriceInLakhs(rangeDef.maxPrice)}
                </span>
              </div>

              <div className="price-context-divider" />

              <div className="price-context-item">
                <span className="price-context-label">Price Type</span>
                <span
                  className="price-context-value"
                  style={{ fontSize: '12px' }}
                >
                  Ex-showroom
                </span>
              </div>
            </div>
          </div>

          {/* ── FilterBar ───────────────────────────────────────── */}
          {/*
           * hiddenFilters: ['priceRange'] — price range is already
           * implied by the URL (/price/2-5-lakh).
           * Showing a Price filter fixed to "₹2–5L" would be redundant.
           *
           * Category and Sort remain available:
           *   - Category: filter to e.g. "only adventure bikes under ₹5L"
           *   - Sort: order by price or name within the range
           *
           * onChange logs in development.
           * DB-08: combine FilterValues with price range boundaries
           * to build the MongoDB query.
           */}
          <div className="price-filter-row">
          <FilterBar
  hiddenFilters={['priceRange']}
/>
          </div>

          {/* ── Bike grid ────────────────────────────────────────── */}
          <div className="price-grid-section">
            {/*
             * Result count — above the grid.
             * Consistent with LP-04 and LP-05 format.
             */}
            <p className="price-result-count" aria-live="polite">
              Showing {bikes.length}{' '}
              {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

            {/*
             * BikeGrid — same 3/2/1 responsive layout as LP-04/LP-05.
             *
             * brandAccentMap: built from all bikes in this price range.
             * May contain multiple brands (unlike brand pages which
             * only have one brand).
             *
             * emptyMessage: price-specific — names the range label.
             *
             * firstCardPriority=true: first card is the LCP candidate.
             */}
            <BikeGrid
              bikes={bikes}
              loading={false}
              variant="default"
              columns={3}
              brandAccentMap={priceAccentMap}
              firstCardPriority={true}
              emptyMessage={`No motorcycles found in the ${rangeDef.fullLabel} range.`}
              emptySubMessage="Try a different price range or browse all motorcycles."
            />
          </div>
        </div>
      </main>
    </>
  )
}