/*
 * All Brands Hub Page — /brands
 *
 * DB-08: Queries real Brand documents from MongoDB.
 *   - Brand.find({ isActive: true }).sort({ displayOrder: 1 })
 *     replaces static BRANDS constant
 *   - Falls back to static BRANDS if DB unavailable
 *   - SSG with fallback to static data for build resilience
 */

import type { Metadata } from 'next'
import Breadcrumb from '@/components/layout/Breadcrumb'
import BrandLogoChip from '@/components/listing/BrandLogoChip'
import connectDB from '@/lib/db/mongodb'
import Brand from '@/lib/db/models/Brand'
import { BRANDS } from '@/constants/brands'
import type { IBrandSummary } from '@/lib/db/models/Brand'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'All Motorcycle Brands in India | MotoHub360',
  description:
    'Explore all motorcycle brands available in India. Browse Royal Enfield, KTM, Yamaha, Honda, TVS, Bajaj and more on MotoHub360.',
  openGraph: {
    title: 'All Motorcycle Brands in India | MotoHub360',
    description:
      'Explore all motorcycle brands available in India on MotoHub360.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/brands`,
    type: 'website',
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/brands`,
  },
}

// ---------------------------------------------------------------------------
// All Brands Page
// ---------------------------------------------------------------------------

export default async function AllBrandsPage() {
  /*
   * Fetch active brands from MongoDB sorted by displayOrder.
   * Falls back to static BRANDS constant if DB unavailable.
   *
   * The static fallback ensures the /brands page always renders
   * even before DB-10 seeds brand data.
   */
  let brands: IBrandSummary[] = []

  try {
    await connectDB()

    const dbBrands = await Brand.find({ isActive: true })
      .select('slug name accentColor logoUrl displayOrder')
      .sort({ displayOrder: 1, name: 1 })
      .lean<IBrandSummary[]>()

    if (dbBrands.length > 0) {
      brands = dbBrands
    } else {
      /*
       * DB connected but no brands seeded yet — use static fallback.
       */
      brands = BRANDS.map((b, index) => ({
        slug: b.slug,
        name: b.name,
        accentColor: b.accentColor,
        logoUrl: undefined,
        displayOrder: index,
      }))
    }
  } catch {
    /*
     * DB unavailable — use static BRANDS constant.
     */
    brands = BRANDS.map((b, index) => ({
      slug: b.slug,
      name: b.name,
      accentColor: b.accentColor,
      logoUrl: undefined,
      displayOrder: index,
    }))
  }

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'All Brands', href: '/brands' },
  ]

  return (
    <>
      <style>{`
        .brands-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
        }
        .brands-page-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }
        @media (max-width: 768px) {
          .brands-page-inner { padding: 0 20px; }
        }
        .brands-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 24px;
          padding: 48px 0 80px;
        }
        @media (max-width: 1024px) {
          .brands-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 768px) {
          .brands-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            padding: 32px 0 60px;
          }
        }
        @media (max-width: 480px) {
          .brands-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
        }
      `}</style>

      <main
        className="brands-page"
        role="main"
        aria-label="All motorcycle brands"
      >
        <div className="brands-page-inner">

          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div
            style={{
              padding: '32px 0 0',
              borderBottom: '1px solid var(--color-border-hairline)',
              paddingBottom: '28px',
            }}
          >
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(24px, 3.5vw, 40px)',
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink-primary)',
                margin: '0 0 8px',
              }}
            >
              All Brands
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 400,
                color: 'var(--color-ink-secondary)',
                margin: 0,
              }}
            >
              {brands.length} brand{brands.length !== 1 ? 's' : ''} available
              on MotoHub360
            </p>
          </div>

          <div
            className="brands-grid"
            role="list"
            aria-label="Motorcycle brands"
          >
            {brands.map((brand) => (
              <div
                key={brand.slug}
                role="listitem"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <BrandLogoChip
                  slug={brand.slug}
                  name={brand.name}
                  accentColor={brand.accentColor}
                  logoUrl={brand.logoUrl}
                  size={80}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}