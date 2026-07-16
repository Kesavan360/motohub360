/*
 * Price Range Listing Page — /price/[range]
 *
 * LP-07 Mobile Responsiveness Pass:
 *   - Added overflow-x: hidden to .price-page
 *   - Removed duplicate aria-live from header bike count
 *   - Adjusted price context block breakpoint from 480px to 640px
 *     so it hides earlier and avoids clipping on mid-range mobiles
 *   - Added safe-area-inset-bottom to grid section paddingBottom
 *   - Added min-width: 0 guard to price range badge for overflow
 *   - Added flex-shrink: 0 to price context dividers
 *   - Price range badge max-width + overflow truncation
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

export const revalidate = 3600

export function generateStaticParams(): Array<{ range: string }> {
  return PRICE_RANGE_SLUGS.map((slug) => ({ range: slug }))
}

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

function getMockBikesForPriceRange(
  minPrice: number,
  maxPrice: number,
): BikeSummary[] {
  const ALL_MOCK_BIKES: Array<{
    name: string
    tagline: string
    price: number
    brandSlug: string
    category: BikeSummary['category']
    slug: string
  }> = [
    { slug: 'shine-100', name: 'Shine 100', tagline: 'Everyday Excellence', price: 74900, brandSlug: 'honda', category: 'cruiser' },
    { slug: 'ct125x', name: 'CT125X', tagline: 'Tough Commuter', price: 84900, brandSlug: 'bajaj', category: 'cruiser' },
    { slug: 'jupiter-125', name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900, brandSlug: 'tvs', category: 'scooter' },
    { slug: 'ntorq-125', name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900, brandSlug: 'tvs', category: 'scooter' },
    { slug: 'raider-125', name: 'Raider 125', tagline: 'Daring by Design', price: 91900, brandSlug: 'tvs', category: 'naked' },
    { slug: 'fascino-125', name: 'Fascino 125', tagline: 'Style Redefined', price: 84900, brandSlug: 'yamaha', category: 'scooter' },
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
    { slug: 'r3', name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900, brandSlug: 'yamaha', category: 'sport' },
    { slug: 'cb500x', name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000, brandSlug: 'honda', category: 'adventure' },
    { slug: 'cbr650r', name: 'CBR 650R', tagline: 'Sport in Every Sense', price: 895000, brandSlug: 'honda', category: 'sport' },
  ]

  const filtered = ALL_MOCK_BIKES.filter(
    (bike) =>
      bike.price >= minPrice &&
      (maxPrice === Number.POSITIVE_INFINITY || bike.price <= maxPrice),
  )

  return filtered.slice(0, 6).map((bike, index) => ({
    _id: `mock-price-${bike.slug}-${index}`,
    slug: bike.slug,
    brandSlug: bike.brandSlug,
    name: bike.name,
    tagline: bike.tagline,
    category: bike.category,
    status: 'published' as const,
    pricing: { exShowroom: bike.price },
    heroImageUrl:
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]?.heroImageUrl ??
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
    blurDataUrl: '',
  }))
}

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

  const bikes = getMockBikesForPriceRange(
    rangeDef.minPrice,
    rangeDef.maxPrice,
  )

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: rangeDef.fullLabel, href: `/price/${rangeSlug}` },
  ]

  const priceAccentMap: Record<string, string> =
  bikes.reduce<Record<string, string>>((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] =
        BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  const isPriceOpenEnded = rangeDef.maxPrice === Number.POSITIVE_INFINITY

  const priceRangeDisplay = isPriceOpenEnded
    ? `Above ${formatPriceInLakhs(rangeDef.minPrice)}`
    : `${formatPriceInLakhs(rangeDef.minPrice)} – ${formatPriceInLakhs(rangeDef.maxPrice)}`

  return (
    <>
      <style>{`
        /*
         * LP-07 FIX: overflow-x hidden on page wrapper.
         */
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
          .price-page-inner {
            padding: 0 20px;
          }
        }

        .price-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        @media (max-width: 480px) {
          .price-header {
            padding: 20px 0 16px;
          }
        }

        .price-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * LP-07 FIX: safe-area-inset-bottom for iPhone home bar.
         */
        .price-grid-section {
          padding: 48px 0 80px;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .price-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 768px) {
          .price-grid-section {
            padding: 32px 0 60px;
          }

          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .price-grid-section {
              padding-bottom: calc(60px + env(safe-area-inset-bottom));
            }
          }
        }

        .price-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }

        /*
         * LP-07 FIX: max-width + overflow on badge.
         * Prevents the monospace price range badge from overflowing
         * on narrow screens where long price strings might clip.
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
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /*
         * LP-07 FIX: Adjusted breakpoint from 480px to 640px.
         * The price context block clips on mid-size Android phones
         * (540px–640px) — hiding it earlier preserves the layout.
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
          overflow: hidden;
        }

        @media (max-width: 640px) {
          .price-context-block {
            display: none;
          }
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

        /*
         * LP-07 FIX: flex-shrink: 0 prevents dividers from
         * collapsing when the context block is narrow.
         */
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

            {/*
             * LP-07 FIX: aria-live removed from header count.
             * Single aria-live on the grid result count below.
             */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              {bikes.length} motorcycle{bikes.length !== 1 ? 's' : ''} available
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