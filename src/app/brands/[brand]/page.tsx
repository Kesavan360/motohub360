/*
 * Brand Listing Page — /brands/[brand]
 *
 * LP-07 Mobile Responsiveness Pass:
 *   - Added overflow-x: hidden to .brand-page to prevent horizontal scroll
 *   - Added min-width: 0 to brand header flex children to prevent overflow
 *   - Added flex-wrap: wrap to brand header for very narrow viewports
 *   - Tightened brand header gap on mobile (20px → 12px)
 *   - Added max-width + text truncation to brand name <h1> for long names
 *   - Verified BikeCard touch targets via BikeGrid — cards fill 100vw
 *     on mobile (1-column grid), tap target is entire card height
 *   - Verified FilterBar bottom sheet animation — 240ms slide-up
 *     is in FilterBar component (LP-03), no page-level fix needed
 *   - Added paddingBottom safe-area inset for iPhone home bar
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBar from '@/components/listing/FilterBar'
import BikeGrid from '@/components/listing/BikeGrid'
import {
  BRANDS,
  BRAND_MAP,
  BRAND_SLUGS,
} from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { BikeSummary } from '@/types/bike'

export const revalidate = 3600

export function generateStaticParams(): Array<{ brand: string }> {
  return BRAND_SLUGS.map((slug) => ({ brand: slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>
}): Promise<Metadata> {
  const { brand: brandSlug } = await params
  const brandDef = BRAND_MAP[brandSlug]

  if (!brandDef) {
    return { title: 'Brand Not Found | MotoHub360' }
  }

  const title = `${brandDef.name} Motorcycles in India — Prices, Specs & Colours | MotoHub360`
  const description = brandDef.defaultMetaDescription

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/brands/${brandSlug}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/brands/${brandSlug}`,
    },
  }
}

function getMockBikesForBrand(brandSlug: string): BikeSummary[] {
  const brandModels: Record<
    string,
    Array<{ name: string; tagline: string; price: number }>
  > = {
    'royal-enfield': [
      { name: 'GT 650', tagline: 'Modern Classic Roadster', price: 348000 },
      { name: 'Classic 350', tagline: 'Timeless Classic', price: 192000 },
      { name: 'Himalayan 450', tagline: 'Built for Adventure', price: 289000 },
      { name: 'Meteor 350', tagline: 'Cruise Easy, Live Free', price: 222000 },
      { name: 'Hunter 350', tagline: 'City Born. Free Spirit.', price: 160000 },
      { name: 'Continental GT 650', tagline: 'Pure Café Racer', price: 338000 },
    ],
    ktm: [
      { name: 'Duke 390', tagline: 'Ready to Race', price: 295000 },
      { name: 'Duke 250', tagline: 'Born to Scrap', price: 212000 },
      { name: 'RC 390', tagline: 'Track Every Day', price: 327000 },
      { name: 'Adventure 390', tagline: 'Go Anywhere', price: 349000 },
      { name: 'Duke 125', tagline: 'The Beginning of Fast', price: 158000 },
      { name: 'RC 125', tagline: 'Race Ready', price: 189000 },
    ],
    yamaha: [
      { name: 'MT-15 V2', tagline: 'Masters of Torque', price: 167900 },
      { name: 'R15M', tagline: 'Born Racer', price: 185900 },
      { name: 'FZ-S V3', tagline: 'Street Warrior', price: 118900 },
      { name: 'FZS 25', tagline: 'Dominate the Street', price: 148900 },
      { name: 'MT-03', tagline: 'Dark Side of Japan', price: 478900 },
      { name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900 },
    ],
    honda: [
      { name: 'CB350RS', tagline: 'Refined Rebel', price: 209900 },
      { name: 'Hornet 2.0', tagline: 'The Evolved Predator', price: 130900 },
      { name: 'CB200X', tagline: 'Your Adventure Begins', price: 147900 },
      { name: 'CBR 650R', tagline: 'Sport in Every Sense', price: 895000 },
      { name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000 },
      { name: 'Shine 100', tagline: 'Everyday Excellence', price: 74900 },
    ],
    tvs: [
      { name: 'Apache RTR 310', tagline: 'Unleash the Beast', price: 246900 },
      { name: 'Apache RR 310', tagline: 'Race DNA', price: 278900 },
      { name: 'Ronin', tagline: 'Own Your Road', price: 164900 },
      { name: 'Raider 125', tagline: 'Daring by Design', price: 91900 },
      { name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900 },
      { name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900 },
    ],
    bajaj: [
      { name: 'Pulsar NS400Z', tagline: 'The Apex Predator', price: 189000 },
      { name: 'Pulsar N250', tagline: 'Nought to Stoked', price: 164900 },
      { name: 'Dominar 400', tagline: 'Conquer Every Road', price: 230000 },
      { name: 'Avenger Street 160', tagline: 'Cruise Boss', price: 115000 },
      { name: 'Pulsar 150', tagline: 'The Bikes Indians Love', price: 107000 },
      { name: 'CT125X', tagline: 'Tough Commuter', price: 84900 },
    ],
  }

  const fallbackImage =
    MOCK_FEATURED_BIKES[0]?.heroImageUrl ??
    'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg'

  const models = brandModels[brandSlug] ?? [
    { name: 'Model A', tagline: 'Coming Soon', price: 150000 },
    { name: 'Model B', tagline: 'Coming Soon', price: 200000 },
    { name: 'Model C', tagline: 'Coming Soon', price: 250000 },
    { name: 'Model D', tagline: 'Coming Soon', price: 300000 },
    { name: 'Model E', tagline: 'Coming Soon', price: 350000 },
    { name: 'Model F', tagline: 'Coming Soon', price: 400000 },
  ]

  return models.map((model, index) => ({
    _id: `mock-${brandSlug}-${index}`,
    slug: model.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
    brandSlug,
    name: model.name,
    tagline: model.tagline,
    category: 'cruiser' as const,
    status: 'published' as const,
    pricing: { exShowroom: model.price },
    heroImageUrl:
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]?.heroImageUrl ??
      fallbackImage,
    blurDataUrl: '',
  }))
}

export default async function BrandListingPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params

  if (!BRAND_SLUGS.includes(brandSlug)) {
    notFound()
  }

  const brandDef = BRAND_MAP[brandSlug]

  if (!brandDef) {
    notFound()
  }

  const bikes = getMockBikesForBrand(brandSlug)

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: brandDef.name, href: `/brands/${brandSlug}` },
  ]

  return (
    <>
      <style>{`
        /*
         * LP-07 FIX: overflow-x hidden prevents any child from
         * causing horizontal page scroll on mobile.
         */
        .brand-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }

        .brand-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }

        @media (max-width: 768px) {
          .brand-page-inner {
            padding: 0 20px;
          }
        }

        /*
         * LP-07 FIX: flex-wrap allows the chip + name row to wrap
         * on very narrow screens (< 340px) without overflow.
         * min-width: 0 on children allows text truncation to work
         * inside a flex container — without it, flex items grow
         * to accommodate their content and overflow the parent.
         * gap reduced on mobile for tighter proportions.
         */
        .brand-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        @media (max-width: 480px) {
          .brand-header {
            padding: 24px 0 20px;
            gap: 12px;
          }
        }

        /*
         * LP-07 FIX: min-width: 0 is critical for text truncation
         * inside flex containers. Without it, the h1 will overflow.
         */
        .brand-header-text {
          min-width: 0;
          flex: 1;
        }

        .brand-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * LP-07 FIX: paddingBottom uses safe-area inset so content
         * is not hidden behind the iPhone home indicator.
         */
        .brand-grid-section {
          padding: 48px 0 80px;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .brand-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 768px) {
          .brand-grid-section {
            padding: 32px 0 60px;
          }

          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .brand-grid-section {
              padding-bottom: calc(60px + env(safe-area-inset-bottom));
            }
          }
        }

        .brand-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }
      `}</style>

      <main
        className="brand-page"
        role="main"
        aria-label={`${brandDef.name} motorcycles`}
      >
        <div className="brand-page-inner">

          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="brand-header">
            {/*
             * Brand logo chip — static (non-interactive) on own page.
             * flex-shrink: 0 prevents the chip from being compressed
             * when the text beside it is long.
             */}
            <div
              aria-hidden="true"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '999px',
                backgroundColor: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: brandDef.accentColor,
                  userSelect: 'none',
                  lineHeight: 1,
                }}
              >
                {brandDef.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </span>
            </div>

            {/*
             * LP-07 FIX: .brand-header-text has min-width: 0 so
             * text truncation works inside the flex container.
             */}
            <div className="brand-header-text">
              {/*
               * LP-07 FIX: overflow hidden + text-overflow ellipsis
               * prevents very long brand names from overflowing.
               * In practice, all 6 curated brand names are short,
               * but this guard protects future brand additions.
               */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(22px, 3vw, 32px)',
                  fontWeight: 600,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-ink-primary)',
                  margin: '0 0 4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {brandDef.name}
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
                {bikes.length} motorcycle{bikes.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>

          <div className="brand-filter-row">
            <FilterBar
              hiddenFilters={[]}
            />
          </div>

          <div className="brand-grid-section">
            <p className="brand-result-count" aria-live="polite">
              Showing {bikes.length}{' '}
              {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

            <BikeGrid
              bikes={bikes}
              loading={false}
              variant="default"
              columns={3}
              brandAccentMap={{ [brandSlug]: brandDef.accentColor }}
              firstCardPriority={true}
              emptyMessage={`No ${brandDef.name} motorcycles found.`}
              emptySubMessage="Try adjusting your filters or browse all brands."
            />
          </div>
        </div>
      </main>
    </>
  )
}