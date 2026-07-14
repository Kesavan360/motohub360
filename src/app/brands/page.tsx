/*
 * All Brands Page — /brands
 *
 * MPD Section 4, Site Structure:
 *   "/brands → All brands listing | SSG | Static, rebuilt on deploy"
 *
 * MPD Section 5.1, Home Page:
 *   "Browse by Brand section — official brand logos displayed in a
 *   clean grid, each linking to that brand's listing page."
 *
 * This page serves as the hub for all brands. It shows every brand
 * as a BrandLogoChip in a responsive grid, each linking to its
 * dedicated /brands/[brand] listing page.
 *
 * SERVER COMPONENT: SSG — no dynamic data, rebuilt at deploy.
 * BrandLogoChip is 'use client' — Next.js handles the boundary.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumb from '@/components/layout/Breadcrumb'
import BrandLogoChip from '@/components/listing/BrandLogoChip'
import { BRANDS } from '@/constants/brands'

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

export default function AllBrandsPage() {
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
          .brands-page-inner {
            padding: 0 20px;
          }
        }

        /*
         * Brand chips grid.
         * Desktop: 6 columns (all brands in one row if space allows).
         * Tablet: 4 columns.
         * Mobile: 3 columns.
         */
        .brands-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 24px;
          padding: 48px 0 80px;
        }

        @media (max-width: 1024px) {
          .brands-grid {
            grid-template-columns: repeat(4, 1fr);
          }
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

          {/* Breadcrumb */}
          <div style={{ paddingTop: '20px' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Page heading */}
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
              {BRANDS.length} brands available on MotoHub360
            </p>
          </div>

          {/* Brand chips grid */}
          <div
            className="brands-grid"
            role="list"
            aria-label="Motorcycle brands"
          >
            {BRANDS.map((brand) => (
              <div
                key={brand.slug}
                role="listitem"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <BrandLogoChip
                  slug={brand.slug}
                  name={brand.name}
                  accentColor={brand.accentColor}
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