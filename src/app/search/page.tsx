/*
 * Search Results Page — /search?q=[query]
 *
 * MPD Task SR-06:
 *   "Search results page at /search?q=[query].
 *   SSR — always fresh, never cached.
 *   BikeGrid with results. Filter/sort controls.
 *   Shows 'Results for [query]' heading."
 *
 * MPD Section 15, Search Architecture:
 *   "Search results page at /search?q=[query].
 *   Server-side rendered — never cached (dynamic = 'force-dynamic').
 *   Displays BikeGrid with matching bikes from Atlas Search (DB-09).
 *   Filter/sort controls for refining results."
 *
 * RENDERING STRATEGY:
 *   export const dynamic = 'force-dynamic'
 *   Every request is server-rendered fresh — search results must never
 *   be stale. ISR is not appropriate for a search page because:
 *     1. Every query produces unique results
 *     2. The result set changes as bikes are added/published
 *     3. Caching search results would return wrong data to most users
 *
 * QUERY PARAMETER:
 *   The ?q=[query] param is read from searchParams.
 *   If q is missing or empty: redirect to Home (/).
 *   If q is present: render results for that query.
 *   q is sanitised (trimmed) before use in any display context.
 *   q is URL-decoded by Next.js before reaching this component.
 *
 * MOCK DATA (SR-06):
 *   Returns mock BikeSummary objects until DB-09 wires Atlas Search.
 *   The mock function filters bikes by name match (case-insensitive
 *   substring) to simulate realistic search behaviour.
 *   DB-09 replaces getMockSearchResults() with a real MongoDB Atlas
 *   Search aggregation pipeline.
 *
 * FILTER BEHAVIOUR:
 *   FilterBar shows all three filters (category, price, sort).
 *   No hidden filters — search results can be refined by any dimension.
 *   onChange logs in development. DB-09 combines FilterValues with
 *   the search query to build the Atlas Search pipeline.
 *
 * SEO:
 *   Search pages are NOT indexed (robots: noindex, nofollow).
 *   Per MPD Section 12: "Search result pages should not be indexed —
 *   they are utility pages, not content pages."
 *   Canonical URL is not set (no canonical for search pages).
 *
 * ACCESSIBILITY:
 *   - aria-live="polite" on result count for screen reader announcements
 *   - h1 contains the query term in quotes
 *   - Empty state heading uses h2 for correct hierarchy
 *
 * SERVER COMPONENT:
 *   This page is a Server Component.
 *   FilterBar is 'use client' — Next.js handles the boundary.
 *   BikeGrid is a Server Component. BikeCard is 'use client'.
 *
 * PARAMS:
 *   searchParams is typed as Promise<{ q?: string }> per
 *   Next.js 15+ App Router async searchParams convention.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBar from '@/components/listing/FilterBar'
import BikeGrid from '@/components/listing/BikeGrid'
import { BRAND_ACCENT_MAP } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { BikeSummary } from '@/types/bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

/*
 * force-dynamic — every request is SSR, never cached.
 * MPD Section 15: "SSR — always fresh, never cached."
 * Required because:
 *   1. Every unique query string produces unique results
 *   2. Results change as bikes are added or published
 *   3. Caching would serve wrong results to most users
 */
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

/*
 * Search pages are not indexed — utility page, not content page.
 * Per MPD Section 12.
 *
 * Title: "'[query]' — Search Results | MotoHub360"
 * Provides context in the browser tab and history.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
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
      /*
       * noindex: search result pages must not appear in Google.
       * nofollow: links within search results need not be followed
       * by crawlers (they are navigated by users, not crawlers).
       */
      index: false,
      follow: false,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock search results
// ---------------------------------------------------------------------------

/*
 * SEARCHABLE_BIKES — master list of all mock bikes across brands.
 * Used by getMockSearchResults() to simulate Atlas Search.
 *
 * DB-09 replaces this entire function with a MongoDB Atlas Search
 * aggregation pipeline:
 *   const results = await Bike.aggregate([
 *     {
 *       $search: {
 *         index: 'bikes_search',
 *         text: {
 *           query: sanitisedQuery,
 *           path: ['name', 'tagline', 'brandName', 'category'],
 *           fuzzy: { maxEdits: 1 },
 *         },
 *       },
 *     },
 *     { $match: { status: 'published' } },
 *     { $limit: 24 },
 *     { $project: { slug: 1, brandSlug: 1, name: 1, tagline: 1,
 *                   category: 1, pricing: 1, heroImageUrl: 1, blurDataUrl: 1 } },
 *   ])
 */
const SEARCHABLE_BIKES: Array<{
  name: string
  tagline: string
  price: number
  brandSlug: string
  category: BikeSummary['category']
  slug: string
}> = [
  { slug: 'gt-650', name: 'GT 650', tagline: 'Modern Classic Roadster', price: 348000, brandSlug: 'royal-enfield', category: 'cruiser' },
  { slug: 'classic-350', name: 'Classic 350', tagline: 'Timeless Classic', price: 192000, brandSlug: 'royal-enfield', category: 'cruiser' },
  { slug: 'himalayan-450', name: 'Himalayan 450', tagline: 'Built for Adventure', price: 289000, brandSlug: 'royal-enfield', category: 'adventure' },
  { slug: 'meteor-350', name: 'Meteor 350', tagline: 'Cruise Easy, Live Free', price: 222000, brandSlug: 'royal-enfield', category: 'cruiser' },
  { slug: 'hunter-350', name: 'Hunter 350', tagline: 'City Born. Free Spirit.', price: 160000, brandSlug: 'royal-enfield', category: 'naked' },
  { slug: 'continental-gt-650', name: 'Continental GT 650', tagline: 'Pure Café Racer', price: 338000, brandSlug: 'royal-enfield', category: 'cruiser' },
  { slug: 'duke-390', name: 'Duke 390', tagline: 'Ready to Race', price: 295000, brandSlug: 'ktm', category: 'naked' },
  { slug: 'duke-250', name: 'Duke 250', tagline: 'Born to Scrap', price: 212000, brandSlug: 'ktm', category: 'naked' },
  { slug: 'duke-125', name: 'Duke 125', tagline: 'The Beginning of Fast', price: 158000, brandSlug: 'ktm', category: 'naked' },
  { slug: 'rc-390', name: 'RC 390', tagline: 'Track Every Day', price: 327000, brandSlug: 'ktm', category: 'sport' },
  { slug: 'rc-125', name: 'RC 125', tagline: 'Race Ready', price: 189000, brandSlug: 'ktm', category: 'sport' },
  { slug: 'adventure-390', name: 'Adventure 390', tagline: 'Go Anywhere', price: 349000, brandSlug: 'ktm', category: 'adventure' },
  { slug: 'mt-15-v2', name: 'MT-15 V2', tagline: 'Masters of Torque', price: 167900, brandSlug: 'yamaha', category: 'naked' },
  { slug: 'r15m', name: 'R15M', tagline: 'Born Racer', price: 185900, brandSlug: 'yamaha', category: 'sport' },
  { slug: 'fz-s-v3', name: 'FZ-S V3', tagline: 'Street Warrior', price: 118900, brandSlug: 'yamaha', category: 'naked' },
  { slug: 'mt-03', name: 'MT-03', tagline: 'Dark Side of Japan', price: 478900, brandSlug: 'yamaha', category: 'naked' },
  { slug: 'r3', name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900, brandSlug: 'yamaha', category: 'sport' },
  { slug: 'fascino-125', name: 'Fascino 125', tagline: 'Style Redefined', price: 84900, brandSlug: 'yamaha', category: 'scooter' },
  { slug: 'cb350rs', name: 'CB350RS', tagline: 'Refined Rebel', price: 209900, brandSlug: 'honda', category: 'cruiser' },
  { slug: 'hornet-2-0', name: 'Hornet 2.0', tagline: 'The Evolved Predator', price: 130900, brandSlug: 'honda', category: 'naked' },
  { slug: 'cb200x', name: 'CB200X', tagline: 'Your Adventure Begins', price: 147900, brandSlug: 'honda', category: 'adventure' },
  { slug: 'cbr-650r', name: 'CBR 650R', tagline: 'Sport in Every Sense', price: 895000, brandSlug: 'honda', category: 'sport' },
  { slug: 'cb500x', name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000, brandSlug: 'honda', category: 'adventure' },
  { slug: 'shine-100', name: 'Shine 100', tagline: 'Everyday Excellence', price: 74900, brandSlug: 'honda', category: 'cruiser' },
  { slug: 'apache-rtr-310', name: 'Apache RTR 310', tagline: 'Unleash the Beast', price: 246900, brandSlug: 'tvs', category: 'naked' },
  { slug: 'apache-rr-310', name: 'Apache RR 310', tagline: 'Race DNA', price: 278900, brandSlug: 'tvs', category: 'sport' },
  { slug: 'ronin', name: 'Ronin', tagline: 'Own Your Road', price: 164900, brandSlug: 'tvs', category: 'naked' },
  { slug: 'raider-125', name: 'Raider 125', tagline: 'Daring by Design', price: 91900, brandSlug: 'tvs', category: 'naked' },
  { slug: 'ntorq-125', name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900, brandSlug: 'tvs', category: 'scooter' },
  { slug: 'jupiter-125', name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900, brandSlug: 'tvs', category: 'scooter' },
  { slug: 'pulsar-ns400z', name: 'Pulsar NS400Z', tagline: 'The Apex Predator', price: 189000, brandSlug: 'bajaj', category: 'naked' },
  { slug: 'dominar-400', name: 'Dominar 400', tagline: 'Conquer Every Road', price: 230000, brandSlug: 'bajaj', category: 'adventure' },
  { slug: 'avenger-street-160', name: 'Avenger Street 160', tagline: 'Cruise Boss', price: 115000, brandSlug: 'bajaj', category: 'cruiser' },
  { slug: 'pulsar-150', name: 'Pulsar 150', tagline: 'The Bikes Indians Love', price: 107000, brandSlug: 'bajaj', category: 'naked' },
  { slug: 'chetak-electric', name: 'Chetak Electric', tagline: 'Electric Classic', price: 149900, brandSlug: 'bajaj', category: 'scooter' },
  { slug: 'ct125x', name: 'CT125X', tagline: 'Tough Commuter', price: 84900, brandSlug: 'bajaj', category: 'cruiser' },
]

/*
 * getMockSearchResults — simulates an Atlas Search query against the
 * SEARCHABLE_BIKES list.
 *
 * Matching strategy:
 *   1. Split the query into individual words (tokens).
 *   2. A bike matches if ANY searchable field contains ANY query token
 *      (case-insensitive substring match).
 *   3. Searchable fields: name, tagline, brandSlug.
 *   4. Results are capped at 12 (one page of results).
 *
 * This is intentionally simple — Atlas Search provides fuzzy matching,
 * relevance scoring, and compound queries. This mock approximates the
 * user experience until DB-09.
 *
 * DB-09 replacement:
 *   async function getSearchResults(query: string): Promise<BikeSummary[]> {
 *     const results = await Bike.aggregate([
 *       { $search: { index: 'bikes_search', text: {
 *           query, path: ['name', 'tagline', 'brandName'], fuzzy: { maxEdits: 1 }
 *       }}},
 *       { $match: { status: 'published' } },
 *       { $limit: 24 },
 *       { $project: { slug:1, brandSlug:1, name:1, tagline:1,
 *                     category:1, pricing:1, heroImageUrl:1 } },
 *     ])
 *     return results
 *   }
 */
function getMockSearchResults(query: string): BikeSummary[] {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  if (tokens.length === 0) {
    return []
  }

  const matched = SEARCHABLE_BIKES.filter((bike) => {
    const searchableText = [
      bike.name,
      bike.tagline,
      bike.brandSlug.replace(/-/g, ' '),
      bike.category,
    ]
      .join(' ')
      .toLowerCase()

    /*
     * Match if ALL tokens appear in the searchable text.
     * "GT 650" → tokens: ["gt", "650"] → both must appear.
     * "duke" → tokens: ["duke"] → matches Duke 250, Duke 390, Duke 125.
     */
    return tokens.every((token) => searchableText.includes(token))
  })

  /*
   * Cap at 12 results for the mock.
   * Atlas Search returns paginated results — DB-09 adds pagination.
   */
  const limited = matched.slice(0, 12)

  return limited.map((bike, index) => ({
    _id: `search-${bike.slug}`,
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
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]
        ?.heroImageUrl ??
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
    blurDataUrl: '',
  }))
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  /*
   * Sanitise the query parameter.
   * trim() removes leading/trailing whitespace.
   * If q is undefined, empty, or whitespace-only: redirect to Home.
   * redirect() throws a special Next.js error — no HTML is rendered.
   */
  const query = q?.trim() ?? ''

  if (!query) {
    redirect('/')
  }

  /*
   * Fetch search results.
   * DB-09: replace with real Atlas Search aggregation.
   */
  const bikes = getMockSearchResults(query)

  /*
   * Build brand accent map from result bikes.
   * Each BikeCard uses its brand's accent color for the arrow hover.
   */
  const searchAccentMap = bikes.reduce<Record<string, string>>(
    (acc, bike) => {
      if (!acc[bike.brandSlug]) {
        acc[bike.brandSlug] =
          BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A'
      }
  
      return acc
    },
    {}
  )
  /*
   * Breadcrumb: Home > Search Results
   * Does not include the query in the breadcrumb — long queries would
   * overflow the breadcrumb component on narrow screens.
   */
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Search Results', href: `/search?q=${encodeURIComponent(query)}` },
  ]

  return (
    <>
      <style>{`
        /*
         * Page wrapper — surface-base, full height, overflow hidden.
         */
        .search-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }

        /*
         * Content container — max-width 1440px, centered.
         * 32px desktop padding, 20px mobile padding.
         */
        .search-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }

        @media (max-width: 768px) {
          .search-page-inner {
            padding: 0 20px;
          }
        }

        /*
         * Page header — query heading + result count.
         * Consistent with LP-04/05/06 header pattern.
         */
        .search-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        @media (max-width: 480px) {
          .search-header {
            padding: 20px 0 16px;
          }
        }

        /*
         * FilterBar row — consistent with listing pages.
         */
        .search-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * Grid section — space-6 top, generous bottom.
         */
        .search-grid-section {
          padding: 48px 0 80px;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .search-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 768px) {
          .search-grid-section {
            padding: 32px 0 60px;
          }

          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .search-grid-section {
              padding-bottom: calc(60px + env(safe-area-inset-bottom));
            }
          }
        }

        /*
         * Result count label — body-sm, ink-tertiary, above the grid.
         */
        .search-result-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }

        /*
         * Query display — the search term shown in the page heading.
         * Truncates on narrow screens with ellipsis.
         */
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

          {/* ── Breadcrumb ──────────────────────────────────────── */}
          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* ── Search header ────────────────────────────────────── */}
          <div className="search-header">

            {/*
             * Results label — small uppercase prefix above the heading.
             * Consistent with the category badge pattern from LP-05.
             */}
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

            {/*
             * Page heading — "Results for '[query]'"
             * Per MPD SR-06: "Shows 'Results for [query]' heading."
             *
             * The query is wrapped in quotation marks (curly quotes)
             * for typographic precision.
             *
             * clamp() scales from 20px mobile to 36px desktop.
             * max-width ensures the heading doesn't overflow on very
             * long queries — .search-query-display handles truncation.
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
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '0.3em',
                maxWidth: '100%',
              }}
            >
              Results for
              {/*
               * Query term — truncated with ellipsis on narrow screens.
               * max-width: 60vw prevents very long queries from wrapping
               * into multiple lines and pushing the result count off screen.
               */}
              <span
                className="search-query-display"
                style={{
                  color: 'var(--color-ink-primary)',
                  maxWidth: '60vw',
                }}
                title={query}
              >
                &ldquo;{query}&rdquo;
              </span>
            </h1>

            {/*
             * Bike count — body-sm, ink-tertiary.
             * Shows total results found for the query.
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
              {bikes.length === 0
                ? 'No motorcycles found'
                : `${bikes.length} motorcycle${bikes.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          {/* ── FilterBar ───────────────────────────────────────── */}
          {/*
           * All three filters available on search results page.
           * Category, Price, and Sort can all refine search results.
           * No hidden filters — the query already narrowed the result set.
           *
           * DB-09: FilterValues + query → Atlas Search pipeline with
           * additional $match stages for category/price filters.
           */}
          <div className="search-filter-row">
          <FilterBar hiddenFilters={[]} 
          />
          </div>

          {/* ── Results grid ─────────────────────────────────────── */}
          <div className="search-grid-section">

            {/*
             * Result count above the grid — consistent with listing pages.
             * aria-live="polite" announces count changes when filters are
             * applied in DB-09.
             */}
            <p className="search-result-count" aria-live="polite">
              {bikes.length === 0
                ? `No results for \u201C${query}\u201D`
                : `Showing ${bikes.length} result${bikes.length !== 1 ? 's' : ''} for \u201C${query}\u201D`}
            </p>

            {/*
             * BikeGrid — same responsive 3/2/1 layout as listing pages.
             *
             * emptyMessage is query-specific for clear user feedback.
             * emptySubMessage offers alternative navigation paths.
             *
             * firstCardPriority=true — first card is the LCP candidate.
             */}
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