/*
 * Category Listing Page — /category/[category]
 *
 * MPD Task LP-05:
 *   "Same structure as LP-04 but filtered by category.
 *   Page title: 'Cruiser Motorcycles in India.'
 *   Reuses FilterBar and BikeGrid."
 *
 * MPD Section 4, Site Structure:
 *   "/category/[category] → Category listing | ISR (1hr)"
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Clean grid of bike cards: image, name, starting ex-showroom
 *   price. Filter/sort controls kept minimal and unobtrusive.
 *   No clutter: no ads, no sponsored placements, no star ratings."
 *
 * MPD High-Fidelity UI, Brand Listing Page (same pattern):
 *   "Filters sit on a single quiet row: three pill-style dropdown
 *   triggers, collapsing into a single Filters button + bottom
 *   sheet on mobile."
 *
 * MPD Section 8, Rendering Strategy:
 *   ISR (1hr revalidation). generateStaticParams() pre-builds all
 *   5 category pages at deploy time using CATEGORY_SLUGS (S-08).
 *   DB-08 replaces mock data with real MongoDB queries.
 *
 * FILTER BEHAVIOUR:
 *   hiddenFilters={['category']} — category is implicit from the URL.
 *   Price and Sort filters remain available to refine within the category.
 *   onChange logs in development; wired to API in DB-08.
 *
 * CATEGORY ICONS:
 *   Each category has a visual icon identifier that maps to a
 *   descriptive emoji-free label used in the page header.
 *   No icons in the header — text-only per MPD minimalist aesthetic.
 *
 * NOT FOUND:
 *   Invalid [category] params call notFound() → renders L-07.
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
  CATEGORY_MAP,
  CATEGORY_SLUGS,
  isValidCategory,
} from '@/constants/categories'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { BikeSummary, BikeCategory } from '@/types/bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

/*
 * ISR — revalidate every hour.
 * MPD Section 8: "/category/[category] → ISR (1hr)"
 */
export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * Pre-builds all 5 category pages at deploy time.
 * Uses CATEGORY_SLUGS from constants/categories.ts (S-08):
 *   ['cruiser', 'sport', 'adventure', 'naked', 'scooter']
 *
 * DB-08 replacement (if categories become dynamic):
 *   const categories = await Category.find().select('slug').lean()
 *   return categories.map(c => ({ category: c.slug }))
 *
 * For V1, categories are fixed per MPD Section 4.
 */
export function generateStaticParams(): Array<{ category: string }> {
  return CATEGORY_SLUGS.map((slug) => ({ category: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

/*
 * MPD Section 12, SEO Architecture:
 *   "Listing pages: metadata generated from brand/category name."
 *
 * Title format: "[pageTitle] — Prices, Specs & Colours | MotoHub360"
 * Description: category-specific from CATEGORY_MAP (S-08).
 *
 * Example for 'cruiser':
 *   title: "Cruiser Motorcycles in India — Prices, Specs & Colours | MotoHub360"
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category: categorySlug } = await params

  if (!isValidCategory(categorySlug)) {
    return {
      title: 'Category Not Found | MotoHub360',
    }
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
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/category/${categorySlug}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock bike data for LP-05
// ---------------------------------------------------------------------------

/*
 * Generates mock BikeSummary objects filtered by category.
 * Each category gets 6 plausible bikes from various brands.
 *
 * DB-08 replacement:
 *   const bikes = await Bike.find({ category: categorySlug, status: 'published' })
 *     .select('slug brandSlug name tagline category pricing colors gallery')
 *     .lean()
 *   return bikes.map(mapBikeDocumentToBikeSummary)
 */
function getMockBikesForCategory(categorySlug: BikeCategory): BikeSummary[] {
  /*
   * Category-specific mock models — plausible bikes per category.
   * brandSlug determines which brand accent color is applied to BikeCard.
   */
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
      { name: 'CBR650R', tagline: 'Sport in Every Sense', price: 895000, brandSlug: 'honda' },
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
      { name: 'Chetak', tagline: 'Electric Classic', price: 149900, brandSlug: 'bajaj' },
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
    pricing: {
      exShowroom: model.price,
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

export default async function CategoryListingPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categorySlug } = await params

  /*
   * Validate category slug — isValidCategory is a type guard from S-08.
   * Invalid slugs (e.g. /category/unicycle) render the 404 page.
   */
  if (!isValidCategory(categorySlug)) {
    notFound()
  }

  /*
   * TypeScript now knows categorySlug is BikeCategory.
   * CATEGORY_MAP lookup is safe.
   */
  const categoryDef = CATEGORY_MAP[categorySlug]

  /*
   * Mock bikes for this category.
   * DB-08: replace with real MongoDB query filtered by category.
   */
  const bikes = getMockBikesForCategory(categorySlug)

  /*
   * Breadcrumb: Home > [Category plural label]
   * Uses pluralLabel ("Cruiser Motorcycles") not label ("Cruiser")
   * for the breadcrumb — more descriptive in context.
   */
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: categoryDef.pluralLabel,
      href: `/category/${categorySlug}`,
    },
  ]

  /*
   * Build a brand accent map from all bikes in this category.
   * Each BikeCard uses its brand's accent color for the arrow icon.
   * Falls back to BRAND_ACCENT_MAP which covers the 6 initial brands.
   */
  const categoryAccentMap: Record<string, string> = bikes.reduce<
    Record<string, string>
  >((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] = BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  return (
    <>
      <style>{`
        /*
         * Page wrapper — full height, surface-base background.
         */
        .category-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
        }

        /*
         * Content container — max-width 1440px centered.
         * Desktop: 32px padding. Mobile: 20px padding.
         */
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

        /*
         * Page header — category title + count.
         * Matches LP-04 brand header visual weight.
         * border-bottom separates header from FilterBar.
         */
        .category-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        @media (max-width: 480px) {
          .category-header {
            padding: 24px 0 20px;
          }
        }

        /*
         * FilterBar row — consistent with LP-04.
         */
        .category-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * Grid section — space-6 (48px) top padding on desktop.
         * Generous bottom padding for footer clearance.
         */
        .category-grid-section {
          padding: 48px 0 80px;
        }

        @media (max-width: 768px) {
          .category-grid-section {
            padding: 32px 0 60px;
          }
        }

        /*
         * Result count — body-sm, ink-tertiary, above the grid.
         */
        .category-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }

        /*
         * Category badge — small pill showing the category name.
         * Sits beside the page title for quick visual identification.
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
        }
      `}</style>

      <main
        className="category-page"
        role="main"
        aria-label={`${categoryDef.pluralLabel} in India`}
      >
        <div className="category-page-inner">

          {/* ── Breadcrumb ──────────────────────────────────────── */}
          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* ── Category header ──────────────────────────────────── */}
          {/*
           * MPD LP-05: "Page title: 'Cruiser Motorcycles in India.'"
           *
           * Header structure:
           *   - Small category badge pill (e.g. "Cruiser")
           *   - Large h1 using pageTitle from CATEGORY_MAP
           *   - Bike count sub-label
           *
           * pageTitle from S-08 provides the correct SEO-optimised
           * heading: e.g. "Cruiser Motorcycles in India"
           * This is the <h1> — the main page heading per accessibility
           * best practice and MPD Section 12 SEO spec.
           */}
          <div className="category-header">
            {/*
             * Category badge — quick visual label.
             * Shows the short category name (e.g. "Cruiser")
             * above the full pageTitle heading.
             */}
            <div className="category-badge" aria-hidden="true">
              {categoryDef.label}
            </div>

            {/*
             * Page title — display-md scale.
             * Example: "Cruiser Motorcycles in India"
             * Matches MPD LP-05: "Page title: 'Cruiser Motorcycles in India'"
             */}
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
             * Bike count — body-sm, ink-tertiary.
             * Provides immediate context on the number of bikes.
             * aria-live="polite" will announce count changes when
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
          </div>

          {/* ── FilterBar ───────────────────────────────────────── */}
          {/*
           * MPD LP-05: "Reuses FilterBar."
           *
           * hiddenFilters: ['category'] — category is already implied
           * by the URL (/category/cruiser). Showing a Category filter
           * that is fixed to "Cruiser" would be redundant and confusing.
           *
           * Price and Sort filters remain to let users refine within
           * the category (e.g. "Show me sport bikes under ₹2L").
           *
           * onChange logs in development. DB-08 wires this to:
           *   router.push with updated searchParams, triggering
           *   a re-fetch with the new filter values applied.
           */}
          <div className="category-filter-row">
            <FilterBar
              hiddenFilters={['category']}
            />
          </div>

          {/* ── Bike grid ────────────────────────────────────────── */}
          <div className="category-grid-section">
            {/*
             * Result count — above the grid.
             * Consistent label format with LP-04 brand listing page.
             */}
            <p className="category-result-count" aria-live="polite">
              Showing {bikes.length}{' '}
              {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

            {/*
             * BikeGrid — same 3/2/1 responsive column layout as LP-04.
             *
             * brandAccentMap: built from the category's bikes above.
             * Ensures each BikeCard shows the correct brand accent
             * on its arrow icon hover (e.g. Royal Enfield → #7A2E2E).
             *
             * emptyMessage: category-specific — if no bikes match the
             * applied filters, the message names the category.
             *
             * firstCardPriority=true: first card is above the fold
             * on desktop and is the LCP image candidate.
             */}
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