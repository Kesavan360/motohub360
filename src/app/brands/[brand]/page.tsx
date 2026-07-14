/*
 * Brand Listing Page — /brands/[brand]
 *
 * MPD Task LP-04:
 *   "Breadcrumb (Home > [Brand]), brand logo + name header,
 *   FilterBar, BikeGrid with mock data (6 bikes).
 *   Uses generateStaticParams() stub returning mock brand slugs for now."
 *
 * MPD Section 4, Site Structure:
 *   "/brands/[brand] → Brand listing | ISR (1hr) |
 *   Rebuilds when new bike published."
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Clean grid of bike cards: image, name, starting ex-showroom price.
 *   Filter/sort controls kept minimal and unobtrusive.
 *   No clutter: no ads, no sponsored placements, no review-style ratings."
 *
 * MPD High-Fidelity UI, Brand Listing Page:
 *   "Header carries the breadcrumb (Home > Royal Enfield) in
 *   body-sm/ink-secondary, with the final segment in ink-primary.
 *   Directly below, the brand's logo appears at a larger scale
 *   (48–64px) alongside the brand name in display-md — a brief,
 *   confident introduction, no marketing copy."
 *
 * MPD Section 8, Rendering Strategy:
 *   ISR (1hr revalidation) — pages are pre-built at deploy time.
 *   generateStaticParams() fetches all published brand slugs.
 *   In LP-04 this is a stub using BRAND_SLUGS from constants.
 *   Real MongoDB query is wired in DB-08.
 *
 * FILTER STATE:
 *   FilterBar manages its own state locally (LP-03 design).
 *   The onChange callback receives FilterValues and will be
 *   used in DB-08 to filter the bikes API query.
 *   For LP-04, filtering is visual-only (mock data is static).
 *
 * METADATA:
 *   Per-page generateMetadata() provides SEO title + description.
 *   Canonical URL is set to the brand page.
 *   robots: index, follow — brand pages are public SEO content.
 *
 * MOCK DATA:
 *   6 mock bikes sourced from MOCK_FEATURED_BIKES (H-07) and
 *   supplemented with additional entries to fill the grid.
 *   Replaced with real MongoDB data in DB-08.
 *
 * NOT FOUND:
 *   If [brand] param is not in BRAND_SLUGS, notFound() is called.
 *   Next.js renders not-found.tsx (L-07).
 *
 * SERVER COMPONENT:
 *   This page is a Server Component.
 *   FilterBar is 'use client' — client boundary handled by Next.js
 *   at the FilterBar component level, not the page level.
 *   BikeGrid is a Server Component.
 *   BikeCard is 'use client' — same pattern.
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

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

/*
 * ISR — revalidate every 3600 seconds (1 hour).
 * Pages rebuild automatically when new bikes are published (DB-07).
 * MPD Section 8: "/brands/[brand] → ISR (1hr)"
 */
export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams — pre-build all brand pages at deploy time
// ---------------------------------------------------------------------------

/*
 * MPD LP-04:
 *   "Uses generateStaticParams() stub returning mock brand slugs for now."
 *
 * Returns the 6 curated brand slugs from constants/brands.ts (S-08).
 * DB-08 replaces this with a real MongoDB query:
 *   const brands = await Brand.find().select('slug').lean()
 *   return brands.map(b => ({ brand: b.slug }))
 */
export function generateStaticParams(): Array<{ brand: string }> {
  return BRAND_SLUGS.map((slug) => ({ brand: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata — per-page SEO metadata
// ---------------------------------------------------------------------------

/*
 * MPD Section 12, SEO Architecture:
 *   "Per-page meta tags, canonical URLs."
 *   "Listing pages: generated from brand/category name."
 *
 * Title format: "[Brand] Motorcycles in India — Prices, Specs & Colours | MotoHub360"
 * Description: specific to the brand.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>
}): Promise<Metadata> {
  const { brand: brandSlug } = await params
  const brandDef = BRAND_MAP[brandSlug]

  /*
   * Guard: unknown brand — metadata still needed before notFound().
   * notFound() is called in the page component, not in generateMetadata.
   */
  if (!brandDef) {
    return {
      title: 'Brand Not Found | MotoHub360',
    }
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
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/brands/${brandSlug}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock bike data for LP-04
// ---------------------------------------------------------------------------

/*
 * Builds 6 mock BikeSummary objects for the brand listing grid.
 * Uses MOCK_FEATURED_BIKES as the base (3 bikes) and duplicates
 * with varied data to fill a 6-bike grid for testing.
 *
 * DB-08 replaces this with a real MongoDB aggregation:
 *   const bikes = await Bike.find({ brandSlug, status: 'published' })
 *     .select('slug brandSlug name tagline category pricing colors gallery')
 *     .lean()
 */
function getMockBikesForBrand(brandSlug: string): BikeSummary[] {
  /*
   * Base mock entries — maps each brand to 3 representative model names.
   * These are plausible model names for each brand, not real data.
   */
  const brandModels: Record<string, Array<{ name: string; tagline: string; price: number }>> = {
    'royal-enfield': [
      { name: 'GT 650', tagline: 'Modern Classic Roadster', price: 348000 },
      { name: 'Classic 350', tagline: 'Timeless Classic', price: 192000 },
      { name: 'Himalayan 450', tagline: 'Built for Adventure', price: 289000 },
      { name: 'Meteor 350', tagline: 'Cruise Easy, Live Free', price: 222000 },
      { name: 'Hunter 350', tagline: 'City Born. Free Spirit.', price: 160000 },
      { name: 'Continental GT 650', tagline: 'Pure Café Racer', price: 338000 },
    ],
    'ktm': [
      { name: 'Duke 390', tagline: 'Ready to Race', price: 295000 },
      { name: 'Duke 250', tagline: 'Born to Scrap', price: 212000 },
      { name: 'RC 390', tagline: 'Track Every Day', price: 327000 },
      { name: 'Adventure 390', tagline: 'Go Anywhere', price: 349000 },
      { name: 'Duke 125', tagline: 'The Beginning of Fast', price: 158000 },
      { name: 'RC 125', tagline: 'Race Ready', price: 189000 },
    ],
    'yamaha': [
      { name: 'MT-15 V2', tagline: 'Masters of Torque', price: 167900 },
      { name: 'R15M', tagline: 'Born Racer', price: 185900 },
      { name: 'FZ-S V3', tagline: 'Street Warrior', price: 118900 },
      { name: 'FZS 25', tagline: 'Dominate the Street', price: 148900 },
      { name: 'MT-03', tagline: 'Dark Side of Japan', price: 478900 },
      { name: 'R3', tagline: 'Precision. Power. Pride.', price: 468900 },
    ],
    'honda': [
      { name: 'CB350RS', tagline: 'Refined Rebel', price: 209900 },
      { name: 'Hornet 2.0', tagline: 'The Evolved Predator', price: 130900 },
      { name: 'CB200X', tagline: 'Your Adventure Begins', price: 147900 },
      { name: 'CBR650R', tagline: 'Sport in Every Sense', price: 895000 },
      { name: 'CB500X', tagline: 'Adventure, Your Way', price: 695000 },
      { name: 'Shine 100', tagline: 'Everyday Excellence', price: 74900 },
    ],
    'tvs': [
      { name: 'Apache RTR 310', tagline: 'Unleash the Beast', price: 246900 },
      { name: 'Apache RR 310', tagline: 'Race DNA', price: 278900 },
      { name: 'Ronin', tagline: 'Own Your Road', price: 164900 },
      { name: 'Raider 125', tagline: 'Daring by Design', price: 91900 },
      { name: 'Ntorq 125', tagline: 'Be the Champ', price: 94900 },
      { name: 'Jupiter 125', tagline: 'The Extra Miler', price: 89900 },
    ],
    'bajaj': [
      { name: 'Pulsar NS400Z', tagline: 'The Apex Predator', price: 189000 },
      { name: 'Pulsar N250', tagline: 'Nought to Stoked', price: 164900 },
      { name: 'Dominar 400', tagline: 'Conquer Every Road', price: 230000 },
      { name: 'Avenger Street 160', tagline: 'Cruise Boss', price: 115000 },
      { name: 'Pulsar 150', tagline: 'The Bikes Indians Love', price: 107000 },
      { name: 'CT125X', tagline: 'Tough Commuter', price: 84900 },
    ],
  }

  /*
   * Fallback image — use the first MOCK_FEATURED_BIKES image.
   * All mock bikes share the same Cloudinary demo image.
   * Real images come from the bikes MongoDB collection (DB-10).
   */
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
    pricing: {
      exShowroom: model.price,
    },
    heroImageUrl:
      MOCK_FEATURED_BIKES[index % MOCK_FEATURED_BIKES.length]?.heroImageUrl ??
      fallbackImage,
      blurDataUrl: '',
  }))
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function BrandListingPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params

  /*
   * Validate the brand slug against the static BRAND_SLUGS list.
   * Unknown slugs render the 404 page (not-found.tsx, L-07).
   *
   * DB-08: replace this check with a MongoDB Brand.findOne({ slug }) query.
   * If no document is found, call notFound().
   */
  if (!BRAND_SLUGS.includes(brandSlug)) {
    notFound()
  }

  const brandDef = BRAND_MAP[brandSlug]

  /*
   * Type-narrowing guard after notFound().
   * After the BRAND_SLUGS.includes() check above, brandDef is always
   * defined — but TypeScript doesn't know that BRAND_MAP[brandSlug]
   * is guaranteed. This explicit check satisfies strict TypeScript.
   */
  if (!brandDef) {
    notFound()
  }

  /*
   * Fetch mock bikes for this brand.
   * DB-08: replace with:
   *   const bikes = await getBikesByBrand(brandSlug)
   */
  const bikes = getMockBikesForBrand(brandSlug)

  /*
   * Breadcrumb items — Home > [Brand Name].
   * Used by both the visual Breadcrumb component (L-05) and
   * the JSON-LD BreadcrumbList structured data it emits.
   */
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: brandDef.name, href: `/brands/${brandSlug}` },
  ]

  return (
    <>
      <style>{`
        /*
         * Page layout — surface-base background, full height.
         */
        .brand-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
        }

        /*
         * Content container — max-width 1440px, centered.
         * Desktop: 32px horizontal padding.
         * Mobile: 20px horizontal padding.
         * MPD Section 6 Desktop Design Rules: max-width 1440px.
         */
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
         * Brand header — logo chip + name + separator.
         * Matches MPD HiFi: "brand's logo appears at a larger scale
         * (48–64px) alongside the brand name in display-md."
         */
        .brand-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
          display: flex;
          align-items: center;
          gap: 20px;
        }

        @media (max-width: 480px) {
          .brand-header {
            padding: 24px 0 20px;
            gap: 16px;
          }
        }

        /*
         * FilterBar row — sits between the brand header and the grid.
         * Padding: 20px top/bottom for breathing room.
         */
        .brand-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * Bike grid section — padding above and below.
         * space-6 (48px) top, generous bottom for footer clearance.
         */
        .brand-grid-section {
          padding: 48px 0 80px;
        }

        @media (max-width: 768px) {
          .brand-grid-section {
            padding: 32px 0 60px;
          }
        }

        /*
         * Result count — small label above the grid.
         */
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

          {/* ── Breadcrumb ──────────────────────────────────────── */}
          {/*
           * Breadcrumb renders Home > [Brand] navigation + BreadcrumbList
           * JSON-LD structured data (L-05).
           * Padding-top: 20px creates breathing room from the page top.
           */}
          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* ── Brand header ────────────────────────────────────── */}
          {/*
           * MPD HiFi Brand Listing Page:
           *   "The brand's logo appears at a larger scale (48–64px)
           *   alongside the brand name in display-md — a brief, confident
           *   introduction, no marketing copy."
           *
           * BrandLogoChip is used here in non-link mode (same slug as page)
           * — the chip is decorative here, not a navigation element.
           * We render a static version (div not Link) to avoid linking to
           * the current page from itself.
           */}
          <div className="brand-header">
            {/*
             * Brand logo chip — static (non-interactive) variant.
             * On the brand's own page, the chip is decorative — it
             * should not link back to the page the user is already on.
             * We render the chip visual manually to avoid a self-link.
             *
             * Size: 64px — "larger scale" per MPD HiFi spec.
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

            {/* Brand name + meta */}
            <div>
              {/*
               * Brand name — display-md (32px desktop / 24px mobile).
               * No tagline or marketing copy — MPD: "brief, confident
               * introduction, no marketing copy."
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
                }}
              >
                {brandDef.name}
              </h1>

              {/*
               * Subtle sub-label — "motorcycles" clarifies context
               * without being redundant on larger screens.
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
          </div>

          {/* ── FilterBar ───────────────────────────────────────── */}
          {/*
           * MPD LP-03 / LP-04:
           *   "FilterBar, BikeGrid with mock data (6 bikes)."
           *
           * hiddenFilters: brand is implicit on this page so the brand
           * filter is not shown. Only category, price, and sort are shown.
           *
           * onChange: logs to console in LP-04.
           * DB-08 replaces with: setFilterValues(values) → re-fetch bikes.
           *
           * The category filter defaults to the current page's brand
           * context — the user is already browsing Royal Enfield, so
           * the category filter refines within that brand.
           */}
          <div className="brand-filter-row">
            <FilterBar
              hiddenFilters={[]} />
                /*
                 * LP-04: filter state logged to console.
                 * DB-08: use these values to call the bikes API:
                 *   router.push with updated search params, or
                 *   call a server action / API route with values.
                 */
                if (process.env.NODE_ENV === 'development') 
          </div>

          {/* ── Bike grid ────────────────────────────────────────── */}
          <div className="brand-grid-section">
            {/*
             * Result count — shown above the grid.
             * Provides context for how many bikes match the current filters.
             * In LP-04 this is always the total mock bike count.
             * DB-08 updates this to reflect filtered results.
             */}
            <p className="brand-result-count" aria-live="polite">
              Showing {bikes.length} {bikes.length === 1 ? 'motorcycle' : 'motorcycles'}
            </p>

            {/*
             * BikeGrid — 3-column desktop / 2-column tablet / 1-column mobile.
             * loading=false: mock data is available synchronously.
             * brandAccentMap: passes the brand accent so BikeCard arrow
             * uses the correct color on hover.
             * firstCardPriority=true: first card is the LCP candidate.
             */}
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