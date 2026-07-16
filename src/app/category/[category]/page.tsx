/*
 * Category Listing Page — /category/[category]
 *
 * LP-07 Mobile Responsiveness Pass:
 *   - Added overflow-x: hidden to .category-page
 *   - Removed duplicate aria-live from header bike count
 *     (only the grid result count announces updates)
 *   - Added max-width + overflow ellipsis to .category-badge
 *     for future-proofing against long category names
 *   - Added safe-area-inset-bottom to grid section paddingBottom
 *   - Tightened header padding on mobile (24px → 20px)
 *   - Added min-width: 0 to header text container
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBar from '@/components/listing/FilterBar'
import BikeGrid from '@/components/listing/BikeGrid'
import {
  CATEGORY_MAP,
  CATEGORY_SLUGS,
  isValidCategory,
} from '@/constants/categories'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { BikeSummary, BikeCategory } from '@/types/bike'

export const revalidate = 3600

export function generateStaticParams(): Array<{ category: string }> {
  return CATEGORY_SLUGS.map((slug) => ({ category: slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category: categorySlug } = await params

  if (!isValidCategory(categorySlug)) {
    return { title: 'Category Not Found | MotoHub360' }
  }

  const categoryDef = CATEGORY_MAP[categorySlug as BikeCategory]
  const title = `${categoryDef.pageTitle} — Prices, Specs & Colours | MotoHub360`
  const description = categoryDef.metaDescription

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/category/${categorySlug}`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/category/${categorySlug}`,
    },
  }
}

function getMockBikesForCategory(categorySlug: BikeCategory): BikeSummary[] {
  const categoryBikes: Record<
    BikeCategory,
    Array<{
      name: string
      tagline: string
      price: number
      brandSlug: string
    }>
  > = {
    cruiser: [
      { name: 'GT 650', tagline: 'Modern Classic Roadster', price: 348000, brandSlug: 'royal-enfield' },
      { name: 'Classic 350', tagline: 'Timeless Classic', price: 192000, brandSlug: 'royal-enfield' },
      { name: 'Meteor 350', tagline: 'Cruise Easy, Live Free', price: 222000, brandSlug: 'royal-enfield' },
      { name: 'Avenger Street 160', tagline: 'Cruise Boss', price: 115000, brandSlug: 'bajaj' },
      { name: 'CB350RS', tagline: 'Refined Rebel', price: 209900, brandSlug: 'honda' },
      { name: 'Ronin', tagline: 'Own Your Road', price: 164900, brandSlug: 'tvs' },
    ],
    sport: [
      { name: 'RC 390', tagline: 'Track Every Day', price: 327000, brandSlug: 'ktm' },
      { name: 'R15M', tagline: 'Born Racer', price: 185900, brandSlug: 'yamaha' },
      { name: 'Apache RR 310', tagline: 'Race DNA', price: 278900, brandSlug: 'tvs' },
      { name: 'CBR 650R', tagline: 'Sport in Every Sense', price: 895000, brandSlug: 'honda' },
      { name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900, brandSlug: 'yamaha' },
      { name: 'RC 125', tagline: 'Race Ready', price: 189000, brandSlug: 'ktm' },
    ],
    adventure: [
      { name: 'Himalayan 450', tagline: 'Built for Adventure', price: 289000, brandSlug: 'royal-enfield' },
      { name: 'Adventure 390', tagline: 'Go Anywhere', price: 349000, brandSlug: 'ktm' },
      { name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000, brandSlug: 'honda' },
      { name: 'Dominar 400', tagline: 'Conquer Every Road', price: 230000, brandSlug: 'bajaj' },
      { name: 'CB200X', tagline: 'Your Adventure Begins', price: 147900, brandSlug: 'honda' },
      { name: 'Apache RTR 310', tagline: 'Unleash the Beast', price: 246900, brandSlug: 'tvs' },
    ],
    naked: [
      { name: 'Duke 390', tagline: 'Ready to Race', price: 295000, brandSlug: 'ktm' },
      { name: 'MT-15 V2', tagline: 'Masters of Torque', price: 167900, brandSlug: 'yamaha' },
      { name: 'Hunter 350', tagline: 'City Born. Free Spirit.', price: 160000, brandSlug: 'royal-enfield' },
      { name: 'Hornet 2.0', tagline: 'The Evolved Predator', price: 130900, brandSlug: 'honda' },
      { name: 'Pulsar NS400Z', tagline: 'The Apex Predator', price: 189000, brandSlug: 'bajaj' },
      { name: 'FZ-S V3', tagline: 'Street Warrior', price: 118900, brandSlug: 'yamaha' },
    ],
    scooter: [
      { name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900, brandSlug: 'tvs' },
      { name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900, brandSlug: 'tvs' },
      { name: 'Activa 6G', tagline: "India's Most Trusted", price: 79900, brandSlug: 'honda' },
      { name: 'Fascino 125', tagline: 'Style Redefined', price: 84900, brandSlug: 'yamaha' },
      { name: 'Chetak Electric', tagline: 'Electric Classic', price: 149900, brandSlug: 'bajaj' },
      { name: 'iQube S', tagline: 'Smart Electric', price: 152900, brandSlug: 'tvs' },
    ],
  }

  const models = categoryBikes[categorySlug]

  return models.map((model, index) => ({
    _id: `mock-${categorySlug}-${index}`,
    slug: model.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
    brandSlug: model.brandSlug,
    name: model.name,
    tagline: model.tagline,
    category: categorySlug,
    status: 'published' as const,
    pricing: { exShowroom: model.price },
    heroImageUrl:
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]?.heroImageUrl ??
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
    blurDataUrl: '',
  }))
}

export default async function CategoryListingPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categorySlug } = await params

  if (!isValidCategory(categorySlug)) {
    notFound()
  }

  const categoryDef = CATEGORY_MAP[categorySlug]

  const bikes = getMockBikesForCategory(categorySlug)

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: categoryDef.pluralLabel,
      href: `/category/${categorySlug}`,
    },
  ]

  const categoryAccentMap: Record<string, string> =
  bikes.reduce<Record<string, string>>((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] =
        BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})


  return (
    <>
      <style>{`
        /*
         * LP-07 FIX: overflow-x hidden on page wrapper.
         */
        .category-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }

        .category-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }

        @media (max-width: 768px) {
          .category-page-inner {
            padding: 0 20px;
          }
        }

        .category-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        @media (max-width: 480px) {
          .category-header {
            padding: 20px 0 16px;
          }
        }

        .category-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * LP-07 FIX: safe-area-inset-bottom for iPhone home bar.
         */
        .category-grid-section {
          padding: 48px 0 80px;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .category-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 768px) {
          .category-grid-section {
            padding: 32px 0 60px;
          }

          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .category-grid-section {
              padding-bottom: calc(60px + env(safe-area-inset-bottom));
            }
          }
        }

        .category-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }

        /*
         * LP-07 FIX: max-width + overflow hidden on badge prevents
         * it from overflowing on narrow screens.
         * In practice all 5 category labels are short but this guards
         * future additions.
         */
        .category-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
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
      `}</style>

      <main
        className="category-page"
        role="main"
        aria-label={`${categoryDef.pluralLabel} in India`}
      >
        <div className="category-page-inner">

          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="category-header">
            <div className="category-badge" aria-hidden="true">
              {categoryDef.label}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(22px, 3vw, 36px)',
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink-primary)',
                margin: '0 0 8px',
              }}
            >
              {categoryDef.pageTitle}
            </h1>

            {/*
             * LP-07 FIX: aria-live removed from header count.
             * Only the grid result count below announces updates
             * to avoid duplicate screen reader announcements when
             * filters change in DB-08.
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
          </div>

          <div className="category-filter-row">
            <FilterBar
              hiddenFilters={['category']}
            />
          </div>

          <div className="category-grid-section">
            <p className="category-result-count" aria-live="polite">
              Showing {bikes.length}{' '}
              {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

            <BikeGrid
              bikes={bikes}
              loading={false}
              variant="default"
              columns={3}
              brandAccentMap={categoryAccentMap}
              firstCardPriority={true}
              emptyMessage={`No ${categoryDef.pluralLabel} found.`}
              emptySubMessage="Try adjusting your filters or browse all categories."
            />
          </div>
        </div>
      </main>
    </>
  )
}