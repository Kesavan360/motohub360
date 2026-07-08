/*
 * Footer — Site-wide footer component.
 *
 * MPD Section 5.1 Home Page:
 *   "The footer is dark (surface-inverse/text-inverse), a deliberate
 *   tonal shift signaling 'you've reached the end of the page' —
 *   minimal columns, no clutter."
 *
 * MPD Section 6, Desktop Design Rules:
 *   "Max content width: 1440px, centered."
 *
 * MPD Component Library:
 *   Footer | Default (single variant)
 *
 * MPD Task L-01:
 *   "Dark background (surface-inverse), minimal columns (About, Brands,
 *   Categories, Contact placeholder links), copyright line.
 *   Mobile: stacks to single column."
 *
 * DESIGN:
 *   background: surface-inverse (#0E0F12)
 *   text: text-inverse (#F5F5F4)
 *   Max content width: 1440px
 *   Desktop: 4-column grid
 *   Mobile: single column stack
 *   No clutter — no social icons, no newsletter, no ads
 *
 * LINKS:
 *   All links are placeholder hrefs for now.
 *   Real routes are wired as pages are built in later phases.
 *
 * This is a Server Component — no interactivity required.
 * No 'use client' directive needed.
 */

import Link from 'next/link'
import { BRANDS } from '@/constants/brands'
import { CATEGORIES } from '@/constants/categories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FooterLink {
  label: string
  href: string
}

interface FooterColumn {
  heading: string
  links: FooterLink[]
}

// ---------------------------------------------------------------------------
// Footer column data
// ---------------------------------------------------------------------------

/*
 * About column — static informational links.
 * Content pages are out of V1 scope but hrefs are established now
 * so internal links are consistent when pages are added.
 */
const ABOUT_LINKS: FooterLink[] = [
  { label: 'About MotoHub360', href: '/about' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Contact', href: '/contact' },
]

/*
 * Brands column — derived from the static BRANDS constant (S-08).
 * Shows the first 6 brands to keep the column scannable.
 * All brands are available via /brands page.
 */
const BRAND_LINKS: FooterLink[] = BRANDS.slice(0, 6).map((brand) => ({
  label: brand.name,
  href: `/brands/${brand.slug}`,
}))

/*
 * Categories column — derived from CATEGORIES constant (S-08).
 * Shows all 5 approved categories.
 */
const CATEGORY_LINKS: FooterLink[] = CATEGORIES.map((cat) => ({
  label: cat.pluralLabel,
  href: `/category/${cat.slug}`,
}))

/*
 * Browse column — price range and discovery links.
 */
const BROWSE_LINKS: FooterLink[] = [
  { label: 'Under ₹1 Lakh', href: '/price/under-1-lakh' },
  { label: '₹1 Lakh – ₹2 Lakh', href: '/price/1-2-lakh' },
  { label: '₹2 Lakh – ₹5 Lakh', href: '/price/2-5-lakh' },
  { label: 'Above ₹5 Lakh', href: '/price/above-5-lakh' },
  { label: 'All Brands', href: '/brands' },
]

/*
 * Footer columns — assembled in render order (left to right on desktop).
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  { heading: 'About', links: ABOUT_LINKS },
  { heading: 'Brands', links: BRAND_LINKS },
  { heading: 'Categories', links: CATEGORY_LINKS },
  { heading: 'Browse by Price', links: BROWSE_LINKS },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/*
 * FooterColumnBlock — renders a single column with heading + link list.
 */
function FooterColumnBlock({ column }: { column: FooterColumn }) {
  return (
    <div>
      <h3
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-inverse)',
          marginBottom: '16px',
          opacity: 0.5,
        }}
      >
        {column.heading}
      </h3>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {column.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-text-inverse)',
                textDecoration: 'none',
                opacity: 0.7,
                transition: 'opacity 280ms cubic-bezier(0.4,0,0.2,1)',
                display: 'inline-block',
              }}
              /*
               * Hover is applied via CSS class below.
               * Inline style transition covers the opacity change.
               */
              className="footer-link"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/*
 * FooterLogo — MotoHub360 wordmark in the footer.
 * Sits above the column grid on mobile, left-aligned on desktop.
 */
function FooterLogo() {
  return (
    <Link
      href="/"
      aria-label="MotoHub360 — Home"
      style={{ textDecoration: 'none', display: 'inline-block' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 600,
          color: 'var(--color-text-inverse)',
          letterSpacing: '-0.02em',
        }}
      >
        MotoHub<span style={{ opacity: 0.5 }}>360</span>
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Footer Component
// ---------------------------------------------------------------------------

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      aria-label="Site footer"
      style={{
        backgroundColor: 'var(--color-surface-inverse)',
        color: 'var(--color-text-inverse)',
        /*
         * Tailwind's prose max-width utilities don't apply to footer —
         * the footer spans full viewport width, content is constrained
         * by the inner container below.
         */
        width: '100%',
      }}
    >
      {/*
       * Hover style for footer links.
       * Cannot use Tailwind group-hover here because links are in a list —
       * a scoped style tag provides the hover effect without a 'use client'
       * directive (this is a Server Component).
       */}
      <style>{`
        .footer-link:hover {
          opacity: 1 !important;
        }
        .footer-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
          opacity: 1 !important;
        }
      `}</style>

      {/* ── Inner container — max 1440px, centered ─────────────────── */}
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '64px 32px 48px',
        }}
      >

        {/* ── Top section: Logo + Columns ────────────────────────── */}
        <div
          style={{
            display: 'grid',
            /*
             * Desktop: logo column (240px) + 4 link columns (1fr each).
             * Mobile: single column — overridden via media query below.
             */
            gridTemplateColumns: '240px repeat(4, 1fr)',
            gap: '48px',
          }}
          className="footer-grid"
        >

          {/* Logo + tagline */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <FooterLogo />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'var(--color-text-inverse)',
                opacity: 0.5,
                maxWidth: '200px',
                margin: 0,
              }}
            >
              India&apos;s premium motorcycle showcase.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <FooterColumnBlock key={column.heading} column={column} />
          ))}
        </div>

        {/* ── Divider ────────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            height: '1px',
            backgroundColor: 'var(--color-text-inverse)',
            opacity: 0.1,
            margin: '48px 0 32px',
          }}
        />

        {/* ── Bottom row: copyright + legal links ────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
          className="footer-bottom"
        >
          {/* Copyright */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-inverse)',
              opacity: 0.4,
              margin: 0,
              maxWidth: 'none',
            }}
          >
            © {currentYear} MotoHub360. All rights reserved.
          </p>

          {/* Legal links */}
          <nav aria-label="Legal links">
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Use', href: '/terms' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="footer-link"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--color-text-inverse)',
                      textDecoration: 'none',
                      opacity: 0.4,
                      transition:
                        'opacity 280ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/*
       * Responsive styles.
       * Scoped to the footer element — no global side effects.
       * Mobile breakpoint: ≤ 768px (tablet and below).
       * Tablet breakpoint: ≤ 1024px (3-column grid).
       */}
      <style>{`
        @media (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 40px !important;
          }
        }

        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </footer>
  )
}