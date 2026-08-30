/*
 * Category Listing Page — /category/[category]
 *
 * DB-08: Replaced mock data with real MongoDB query.
 *   - connectDB() called before Mongoose operations
 *   - Bike.find({ category, status: 'published' }) replaces getMockBikesForCategory()
 *   - CATEGORY_MAP still used for page metadata (categories are static)
 *   - generateStaticParams() still uses static CATEGORY_SLUGS (categories are fixed)
 *   - brandAccentMap built from BRAND_ACCENT_MAP for real bike brand slugs
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBarConnector from '@/components/listing/FilterBarConnector'
import BikeGrid from '@/components/listing/BikeGrid'
import {
  CATEGORY_MAP,
  CATEGORY_SLUGS,
  isValidCategory,
} from '@/constants/categories'
import {
  isValidPriceRange,
  PRICE_RANGE_MAP,
} from '@/constants/priceRanges'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import type { BikeSummary, BikeCategory } from '@/types/bike'
import type { FilterQuery } from 'mongoose'
import type { IBike } from '@/lib/db/models/Bike'

const LISTING_SORT_OPTIONS = [
  'featured',
  'price-asc',
  'price-desc',
  'name-asc',
  'newest',
] as const

type ListingSortOption = (typeof LISTING_SORT_OPTIONS)[number]

function parseListingSort(value: string | undefined): ListingSortOption {
  if (
    value !== undefined &&
    (LISTING_SORT_OPTIONS as readonly string[]).includes(value)
  ) {
    return value as ListingSortOption
  }
  return 'featured'
}

function listingSortQuery(
  sort: ListingSortOption,
): Record<string, 1 | -1> {
  switch (sort) {
    case 'price-asc':
      return { 'pricing.exShowroom': 1 }
    case 'price-desc':
      return { 'pricing.exShowroom': -1 }
    case 'name-asc':
      return { name: 1 }
    case 'newest':
      return { createdAt: -1 }
    case 'featured':
    default:
      return { publishedAt: -1 }
  }
}

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * Categories are fixed per MPD Section 4 — always 5 slugs.
 * No MongoDB query needed here; categories never change dynamically.
 */
export function generateStaticParams(): Array<{ category: string }> {
  return CATEGORY_SLUGS.map((slug) => ({ category: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function CategoryListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<{
    category?: string
    priceRange?: string
    sort?: string
  }>
}) {
  const { category: categorySlug } = await params
  const { priceRange: priceRangeParam, sort: sortParam } = await searchParams

  if (!isValidCategory(categorySlug)) {
    notFound()
  }

  const categoryDef = CATEGORY_MAP[categorySlug]

  await connectDB()

  /*
   * Fetch all published bikes in this category from MongoDB.
   *
   * DB-08: Replaces getMockBikesForCategory().
   *
   * Sorted by publishedAt descending — most recently published first
   * (matches the default "Featured" sort on listing pages).
   */
  const filter: FilterQuery<IBike> = {
    category: categorySlug,
    status: 'published',
  }

  const priceRangeFilter =
    priceRangeParam && isValidPriceRange(priceRangeParam)
      ? PRICE_RANGE_MAP[priceRangeParam]
      : undefined
  if (priceRangeFilter) {
    filter['pricing.exShowroom'] = {
      $gte: priceRangeFilter.minPrice,
      ...(priceRangeFilter.maxPrice !== Number.POSITIVE_INFINITY
        ? { $lte: priceRangeFilter.maxPrice }
        : {}),
    }
  }

  const sort = parseListingSort(sortParam)

  const bikes = await Bike.find(filter)
    .select(
      'slug brandSlug name tagline category status pricing heroImageUrl blurDataUrl publishedAt',
    )
    .sort(listingSortQuery(sort))
    .lean<BikeSummary[]>()

  /*
   * Build brand accent map from the actual bikes returned.
   * Multiple brands appear on category pages (e.g. "cruiser" has
   * Royal Enfield, Honda, Bajaj etc.).
   * BRAND_ACCENT_MAP covers all 6 initial brands from S-08.
   */
  const categoryAccentMap: Record<string, string> = bikes.reduce<
    Record<string, string>
  >((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] = BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: categoryDef.pluralLabel,
      href: `/category/${categorySlug}`,
    },
  ]

  return (
    <>
      <style>{`
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
          .category-page-inner { padding: 0 20px; }
        }
        .category-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        @media (max-width: 480px) {
          .category-header { padding: 20px 0 16px; }
        }
        .category-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        .category-grid-section { padding: 48px 0 80px; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .category-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }
        @media (max-width: 768px) {
          .category-grid-section { padding: 32px 0 60px; }
        }
        .category-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }
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
          </div>

          <div className="category-filter-row">
            <FilterBarConnector
              hiddenFilters={['category']}
              initialValues={{
                priceRange: priceRangeFilter ? priceRangeFilter.slug : 'all',
                sort,
              }}
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