/*
 * Brand Listing Page — /brands/[brand]
 *
 * DB-08: Replaced mock data with real MongoDB query.
 *   - connectDB() called before all Mongoose operations
 *   - Bike.find({ brandSlug, status: 'published' }) replaces getMockBikesForBrand()
 *   - Brand.findOne({ slug: brandSlug, isActive: true }) replaces BRAND_MAP lookup
 *   - generateStaticParams() now queries Brand collection for all active slugs
 *   - Falls back gracefully to notFound() when brand not in DB
 *
 * ISR: revalidate = 3600 (1 hour) — unchanged from LP-04.
 * DB-07 publish route triggers revalidatePath('/brands/[brand]') on bike publish.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import Brand from '@/lib/db/models/Brand'
import Breadcrumb from '@/components/layout/Breadcrumb'
import FilterBar from '@/components/listing/FilterBar'
import BikeGrid from '@/components/listing/BikeGrid'
import { BRAND_SLUGS, BRAND_MAP } from '@/constants/brands'
import type { BikeSummary } from '@/types/bike'
import type { IBrand } from '@/lib/db/models/Brand'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

export const revalidate = 3600

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * generateStaticParams — pre-builds all active brand pages at deploy time.
 *
 * Queries MongoDB for all active brand slugs.
 * Falls back to static BRAND_SLUGS if the DB is unavailable at build time
 * (e.g. first deploy before brands are seeded).
 *
 * DB-10 seeds the Brand collection so this query always returns results
 * after the first seed run.
 */
export async function generateStaticParams(): Promise<
  Array<{ brand: string }>
> {
  try {
    await connectDB()
    const brands = await Brand.find({ isActive: true })
      .select('slug')
      .lean<Array<{ slug: string }>>()

    if (brands.length > 0) {
      return brands.map((b) => ({ brand: b.slug }))
    }
  } catch {
    /*
     * DB unavailable at build time — fall back to static slugs.
     * This allows the build to succeed even before DB-10 seeds data.
     */
  }

  return BRAND_SLUGS.map((slug) => ({ brand: slug }))
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>
}): Promise<Metadata> {
  const { brand: brandSlug } = await params

  /*
   * Try to get meta description from MongoDB Brand document.
   * Falls back to static BRAND_MAP if DB unavailable.
   */
  let title = 'Brand Not Found | MotoHub360'
  let description = ''

  try {
    await connectDB()
    const brand = await Brand.findOne({ slug: brandSlug, isActive: true })
      .select('name defaultMetaDescription')
      .lean<Pick<IBrand, 'name' | 'defaultMetaDescription'>>()

    if (brand) {
      title = `${brand.name} Motorcycles in India — Prices, Specs & Colours | MotoHub360`
      description = brand.defaultMetaDescription
    }
  } catch {
    /*
     * DB unavailable — fall back to static constant.
     */
    const staticBrand = BRAND_MAP[brandSlug]
    if (staticBrand) {
      title = `${staticBrand.name} Motorcycles in India — Prices, Specs & Colours | MotoHub360`
      description = staticBrand.defaultMetaDescription
    }
  }

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

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function BrandListingPage({
  params,
}: {
  params: Promise<{ brand: string }>
}) {
  const { brand: brandSlug } = await params

  await connectDB()

  /*
   * Fetch the Brand document from MongoDB.
   * Falls back to static BRAND_MAP if not found in DB
   * (handles the pre-seed state gracefully).
   */
  const brandDoc = await Brand.findOne({
    slug: brandSlug,
    isActive: true,
  })
    .select('slug name accentColor logoUrl defaultMetaDescription')
    .lean<Pick<IBrand, 'slug' | 'name' | 'accentColor' | 'logoUrl' | 'defaultMetaDescription'>>()

  /*
   * Fall back to static BRAND_MAP if brand not in DB.
   * This handles the period before DB-10 seeds brand data.
   */
  const staticBrand = BRAND_MAP[brandSlug]

  /*
   * Resolve brand definition — DB takes priority over static.
   * notFound() if brand exists in neither source.
   */
  const brandDef = brandDoc ?? (staticBrand
    ? {
        slug: staticBrand.slug,
        name: staticBrand.name,
        accentColor: staticBrand.accentColor,
        logoUrl: undefined,
        defaultMetaDescription: staticBrand.defaultMetaDescription,
      }
    : null)

  if (!brandDef) {
    notFound()
  }

  /*
   * Fetch published bikes for this brand from MongoDB.
   *
   * DB-08: Replaces getMockBikesForBrand().
   *
   * Projection mirrors BikeSummary from types/bike.ts (S-07).
   * .lean() for performance — plain objects, no Mongoose overhead.
   * Sorted by publishedAt descending — most recently published first.
   */
  const bikes = await Bike.find({
    brandSlug: brandDef.slug,
    status: 'published',
  })
    .select(
      'slug brandSlug name tagline category status pricing heroImageUrl blurDataUrl publishedAt',
    )
    .sort({ publishedAt: -1 })
    .lean<BikeSummary[]>()

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: brandDef.name, href: `/brands/${brandSlug}` },
  ]

  /*
   * Build a single-brand accent map.
   * BikeGrid uses this to colour the arrow icon on hover for each BikeCard.
   */
  const brandAccentMap: Record<string, string> = {
    [brandDef.slug]: brandDef.accentColor,
  }

  return (
    <>
      <style>{`
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
          .brand-page-inner { padding: 0 20px; }
        }
        .brand-header {
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--color-border-hairline);
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        @media (max-width: 480px) {
          .brand-header { padding: 24px 0 20px; gap: 12px; }
        }
        .brand-header-text { min-width: 0; flex: 1; }
        .brand-filter-row {
          padding: 20px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        .brand-grid-section { padding: 48px 0 80px; }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .brand-grid-section {
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }
        @media (max-width: 768px) {
          .brand-grid-section { padding: 32px 0 60px; }
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

            <div className="brand-header-text">
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
                {bikes.length} motorcycle{bikes.length !== 1 ? 's' : ''}{' '}
                available
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
              brandAccentMap={brandAccentMap}
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