/*
 * Search Results Page — /search?q=[query]
 *
 * RENDERING STRATEGY:
 *   export const dynamic = 'force-dynamic'
 *   Every request is server-rendered fresh.
 *
 * DATA (DB-FIX-03):
 *   getSearchResults() queries real published Bike documents from MongoDB.
 *   Tries Atlas Search (buildSuggestPipeline) first; falls back to regex
 *   (buildFallbackRegexFilter) if the Atlas index is unavailable.
 *   Results are capped at 24 (MAX_SEARCH_RESULTS).
 *
 * FILTER BEHAVIOUR:
 *   category, priceRange and sort URL params are validated and applied
 *   to the MongoDB query. FilterBarConnector renders the filter UI.
 *
 * SEO:
 *   Search pages are NOT indexed (robots: noindex, nofollow).
 *
 * ACCESSIBILITY:
 *   - aria-live="polite" on result count for screen reader announcements
 *   - h1 contains the query term in quotes
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBarConnector from '@/components/listing/FilterBarConnector'
import BikeGrid from '@/components/listing/BikeGrid'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import { PRICE_RANGE_MAP } from '@/constants/priceRanges'
import {
  buildSuggestPipeline,
  buildFallbackRegexFilter,
} from '@/lib/db/atlasSearch'
import type { BikeSummary } from '@/types/bike'
import type { FilterQuery, SortOrder } from 'mongoose'
import type { IBike } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    category?: string
    priceRange?: string
    sort?: string
  }>
}): Promise<Metadata> {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  if (!query) {
    return {
      title: 'Search | MotoHub360',
      robots: { index: false, follow: false },
    }
  }

  return {
    title: `"${query}" — Search Results | MotoHub360`,
    description: `Search results for "${query}" on MotoHub360. Find motorcycles by name, brand, or category.`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

// ---------------------------------------------------------------------------
// DB search (DB-FIX-03)
// ---------------------------------------------------------------------------

const MAX_SEARCH_RESULTS = 24

async function getSearchResults(
  query: string,
  category: string,
  priceRange: string,
  sort: string,
): Promise<BikeSummary[]> {
  await connectDB()

  const baseMatch: FilterQuery<IBike> = { status: 'published' }

  if (category !== 'all') {
    baseMatch.category = category
  }

  if (priceRange !== 'all') {
    const rangeDef = PRICE_RANGE_MAP[priceRange]
    if (rangeDef) {
      baseMatch['pricing.exShowroom'] = {
        $gte: rangeDef.minPrice,
        ...(rangeDef.maxPrice !== Number.POSITIVE_INFINITY
          ? { $lte: rangeDef.maxPrice }
          : {}),
      }
    }
  }

  function buildSortQuery(s: string): Record<string, SortOrder> {
    switch (s) {
      case 'price-asc':  return { 'pricing.exShowroom': 1 }
      case 'price-desc': return { 'pricing.exShowroom': -1 }
      case 'name-asc':   return { name: 1 }
      case 'newest':     return { publishedAt: -1 }
      case 'featured':
      default:           return { publishedAt: -1 }
    }
  }

  const projectStage = {
    $project: {
      _id:          1,
      slug:         1,
      brandSlug:    1,
      name:         1,
      tagline:      1,
      category:     1,
      status:       1,
      pricing:      { exShowroom: 1 },
      heroImageUrl: 1,
      blurDataUrl:  1,
    },
  }

  function mapToBikeSummary(doc: Record<string, unknown>): BikeSummary {
    const pricing = doc.pricing as { exShowroom?: number } | undefined
    return {
      _id:          String(doc._id ?? ''),
      slug:         String(doc.slug         ?? ''),
      brandSlug:    String(doc.brandSlug    ?? ''),
      name:         String(doc.name         ?? ''),
      tagline:      String(doc.tagline      ?? ''),
      category:     (doc.category as BikeSummary['category']) ?? 'naked',
      status:       'published' as const,
      pricing:      { exShowroom: pricing?.exShowroom ?? 0 },
      heroImageUrl: String(doc.heroImageUrl ?? ''),
      blurDataUrl:  String(doc.blurDataUrl  ?? ''),
    }
  }

  // 1. Atlas Search
  try {
    const atlasPipeline = buildSuggestPipeline({ query, maxResults: MAX_SEARCH_RESULTS })
    const searchStage = atlasPipeline[0]!

    const raw = await Bike.aggregate([
      searchStage,
      { $match: baseMatch },
      { $limit: MAX_SEARCH_RESULTS },
      projectStage,
    ]).sort(buildSortQuery(sort))

    return (raw as Record<string, unknown>[]).map(mapToBikeSummary)
  } catch {
    // Atlas Search unavailable — fall through to regex
  }

  // 2. Regex fallback
  try {
    const regexFilter = buildFallbackRegexFilter(query) as FilterQuery<IBike>
    const combinedFilter: FilterQuery<IBike> = { ...regexFilter, ...baseMatch }

    const docs = await Bike.find(combinedFilter)
      .select(
        '_id slug brandSlug name tagline category status pricing heroImageUrl blurDataUrl',
      )
      .sort(buildSortQuery(sort))
      .limit(MAX_SEARCH_RESULTS)
      .lean<Array<Record<string, unknown>>>()

    return docs.map(mapToBikeSummary)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    category?: string
    priceRange?: string
    sort?: string
  }>
}) {
  const {
    q,
    category: rawCategory,
    priceRange: rawPriceRange,
    sort: rawSort,
  } = await searchParams

  const VALID_CATEGORIES   = ['cruiser', 'sport', 'adventure', 'naked', 'scooter'] as const
  const VALID_PRICE_RANGES = ['under-1-lakh', '1-2-lakh', '2-5-lakh', 'above-5-lakh'] as const
  const VALID_SORTS        = ['featured', 'price-asc', 'price-desc', 'name-asc', 'newest'] as const

  const activeCategory =
    rawCategory && (VALID_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory : 'all'

  const activePriceRange =
    rawPriceRange && (VALID_PRICE_RANGES as readonly string[]).includes(rawPriceRange)
      ? rawPriceRange : 'all'

  const activeSort =
    rawSort && (VALID_SORTS as readonly string[]).includes(rawSort)
      ? rawSort : 'featured'

  const query = q?.trim() ?? ''
  if (!query) { redirect('/') }

  const bikes = await getSearchResults(query, activeCategory, activePriceRange, activeSort)

  const searchAccentMap = bikes.reduce<Record<string, string>>((acc, bike) => {
    if (!acc[bike.brandSlug]) {
      acc[bike.brandSlug] = BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
    }
    return acc
  }, {})

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Search Results', href: `/search?q=${encodeURIComponent(query)}` },
  ]

  return (
    <>
      <style>{`
        .search-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }
        .search-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }
        @media (max-width: 768px) {
          .search-page-inner { padding: 0 20px; }
        }
        .search-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        @media (max-width: 480px) {
          .search-header { padding: 20px 0 16px; }
        }
        .search-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        .search-grid-section { padding: 48px 0 80px; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .search-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }
        @media (max-width: 768px) {
          .search-grid-section { padding: 32px 0 60px; }
          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .search-grid-section {
              padding-bottom: calc(60px + env(safe-area-inset-bottom));
            }
          }
        }
        .search-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }
        .search-query-display {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
          display: block;
        }
      `}</style>

      <main
        className="search-page"
        role="main"
        aria-label={`Search results for ${query}`}
      >
        <div className="search-page-inner">

          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="search-header">
            <div
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 10px',
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                backgroundColor: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '999px',
                marginBottom: '12px',
              }}
            >
              Search
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
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '0.3em',
                maxWidth: '100%',
              }}
            >
              Results for
              <span
                className="search-query-display"
                style={{ color: 'var(--color-ink-primary)', maxWidth: '60vw' }}
                title={query}
              >
                &ldquo;{query}&rdquo;
              </span>
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
              {bikes.length === 0
                ? 'No motorcycles found'
                : `${bikes.length} motorcycle${bikes.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          <div className="search-filter-row">
            <FilterBarConnector
              hiddenFilters={[]}
              initialValues={{
                category:   activeCategory   !== 'all'      ? activeCategory   : undefined,
                priceRange: activePriceRange !== 'all'      ? activePriceRange : undefined,
                sort:       activeSort       !== 'featured' ? activeSort       : undefined,
              }}
            />
          </div>

          <div className="search-grid-section">
            <p className="search-result-count" aria-live="polite">
              {bikes.length === 0
                ? `No results for \u201C${query}\u201D`
                : `Showing ${bikes.length} result${bikes.length !== 1 ? 's' : ''} for \u201C${query}\u201D`}
            </p>

            <BikeGrid
              bikes={bikes}
              loading={false}
              variant="default"
              columns={3}
              brandAccentMap={searchAccentMap}
              firstCardPriority={true}
              emptyMessage={`No motorcycles found for \u201C${query}\u201D`}
              emptySubMessage="Try a different search term, or browse by brand or category."
            />
          </div>
        </div>
      </main>
    </>
  )
}