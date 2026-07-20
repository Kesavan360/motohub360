/*
 * Price Range Listing Page — /price/[range]
 *
 * DB-08: Replaced mock data with real MongoDB query.
 *   - connectDB() called before Mongoose operations
 *   - Bike.find({ 'pricing.exShowroom': { $gte, $lte }, status: 'published' })
 *     replaces getMockBikesForPriceRange()
 *   - maxPrice === POSITIVE_INFINITY handled correctly in the $lte clause
 *   - generateStaticParams() still uses static PRICE_RANGE_SLUGS (ranges are fixed)
 *   - brandAccentMap built from BRAND_ACCENT_MAP
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
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
import type { BikeSummary } from '@/types/bike'
import type { FilterQuery } from 'mongoose'
import type { IBike } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * Price ranges are fixed per MPD Section 4 — always 4 slugs.
 * No MongoDB query needed.
 */
export function generateStaticParams(): Array<{ range: string }> {
  return PRICE_RANGE_SLUGS.map((slug) => ({ range: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ range: string }>
}): Promise<Metadata> {
  const { range: rangeSlug } = await params

  if (!isValidPriceRange(rangeSlug)) {
    return { title: 'Price Range Not Found | MotoHub360' }
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
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/price/${rangeSlug}`,
    },
  }
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

  if (!isValidPriceRange(rangeSlug)) {
    notFound()
  }

  const rangeDef = PRICE_RANGE_MAP[rangeSlug]

  if (!rangeDef) {
    notFound()
  }

  await connectDB()

  /*
   * Build the MongoDB price query.
   *
   * minPrice is always defined (never 0 except for "under-1-lakh").
   * maxPrice is POSITIVE_INFINITY for "above-5-lakh" — omit $lte in this case.
   *
   * DB-08: Replaces getMockBikesForPriceRange().
   */
  const priceFilter: FilterQuery<IBike> = {
    status: 'published',
    'pricing.exShowroom': {
      $gte: rangeDef.minPrice,
      ...(rangeDef.maxPrice !== Number.POSITIVE_INFINITY
        ? { $lte: rangeDef.maxPrice }
        : {}),
    },
  }

  const bikes = await Bike.find(priceFilter)
    .select(
      'slug brandSlug name tagline category status pricing heroImageUrl blurDataUrl publishedAt',
    )
    .sort({ 'pricing.exShowroom': 1 })
    .lean<BikeSummary[]>()

  /*
   * Build brand accent map from actual bikes in this price range.
   */
  const priceAccentMap: Record<string, string> = bikes.reduce<
    Record<string, string>
  >((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] = BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  const isPriceOpenEnded = rangeDef.maxPrice === Number.POSITIVE_INFINITY

  const priceRangeDisplay = isPriceOpenEnded
    ? `Above ${formatPriceInLakhs(rangeDef.minPrice)}`
    : `${formatPriceInLakhs(rangeDef.minPrice)} – ${formatPriceInLakhs(rangeDef.maxPrice)}`

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: rangeDef.fullLabel,
      href: `/price/${rangeSlug}`,
    },
  ]

  return (
    <>
      <style>{`
        .price-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }
        .price-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }
        @media (max-width: 768px) {
          .price-page-inner { padding: 0 20px; }
        }
        .price-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        @media (max-width: 480px) {
          .price-header { padding: 20px 0 16px; }
        }
        .price-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        .price-grid-section { padding: 48px 0 80px; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .price-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }
        @media (max-width: 768px) {
          .price-grid-section { padding: 32px 0 60px; }
        }
        .price-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }
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
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .price-context-block {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 14px 16px;
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 10px;
          margin-top: 20px;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .price-context-block { display: none; }
        }
        .price-context-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .price-context-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          white-space: nowrap;
        }
        .price-context-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 500;
          color: var(--color-ink-primary);
          letter-spacing: -0.01em;
          white-space: nowrap;
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

          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="price-header">
            <div className="price-range-badge" aria-hidden="true">
              {priceRangeDisplay}
            </div>

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

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              {bikes.length} motorcycle{bikes.length !== 1 ? 's' : ''}{' '}
              available
            </p>

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

          <div className="price-filter-row">
            <FilterBar
              hiddenFilters={['priceRange']}
            />
          </div>

          <div className="price-grid-section">
            <p className="price-result-count" aria-live="polite">
              Showing {bikes.length}{' '}
              {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

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