/*
 * PriceRangePills — Horizontal row of price range filter pills.
 *
 * MPD Task H-04:
 *   "Same pattern as H-03 but for price ranges (< ₹1L, ₹1–2L,
 *   ₹2–5L, ₹5L+). Each links to /price/[range]. Pulls range
 *   labels from constants/priceRanges.ts."
 *
 * MPD Section 5.1, Home Page:
 *   "Browse by Price — pill row (< ₹1L, ₹1–2L, ₹2–5L, ₹5L+)."
 *
 * MPD High-Fidelity UI, Home Page:
 *   "Browse by Category and Browse by Price as quiet pill-button
 *   rows — text-forward, no icons needed."
 *
 * MPD Section 4, Price Ranges (final approved list):
 *   under-1-lakh · 1-2-lakh · 2-5-lakh · above-5-lakh
 *
 * RELATIONSHIP TO H-03 (CategoryPills):
 *   This component is structurally identical to CategoryPills.
 *   The only differences are:
 *     - Data source: PRICE_RANGES (S-08) instead of CATEGORIES
 *     - activePriceRangeSlug prop instead of activeCategorySlug
 *     - Route: /price/[range] instead of /category/[slug]
 *   Both components share the same Ghost pill visual language and
 *   mobile horizontal scroll behaviour per the MPD design system.
 *
 * DATA SOURCE:
 *   Pulls from PRICE_RANGES constant (S-08 / constants/priceRanges.ts).
 *   No props needed for the range list — fixed per MPD Section 4.
 *
 * SERVER COMPONENT:
 *   No 'use client' directive — Next.js <Link> handles navigation.
 *   Active state is determined by slug prop comparison, not useState.
 *
 * USAGE — Home page (H-06):
 *   <PriceRangePills />
 *
 * USAGE — Price listing page (LP-06) with active state:
 *   <PriceRangePills activePriceRangeSlug="2-5-lakh" />
 */

import Link from 'next/link'
import { PRICE_RANGES } from '@/constants/priceRanges'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceRangePillsProps {
  /*
   * activePriceRangeSlug — slug of the currently active price range.
   * When provided, that pill is highlighted with surface-sunken
   * background and ink-primary text to show the current filter.
   * On the Home page this is undefined (no active filter).
   * On /price/[range] pages this matches the route param.
   */
  activePriceRangeSlug?: string

  /*
   * className — additional CSS classes on the outer container.
   * Use for margin/spacing adjustments from the parent layout.
   */
  className?: string

  /*
   * scrollable — whether mobile horizontal scroll is enabled.
   * Default: true (Home page behaviour per MPD H-04).
   * Set false on listing pages where pills wrap instead of scroll.
   */
  scrollable?: boolean
}

// ---------------------------------------------------------------------------
// PriceRangePills Component
// ---------------------------------------------------------------------------

export default function PriceRangePills({
  activePriceRangeSlug,
  className = '',
  scrollable = true,
}: PriceRangePillsProps) {
  return (
    <>
      {/*
       * Scoped styles — identical pattern to CategoryPills (H-03).
       * Class names prefixed with 'price-pill' to avoid collision
       * when both components appear on the same page.
       */}
      <style>{`
        /*
         * Hide scrollbar on mobile scroll track.
         * Horizontal touch scroll still works — only the visual
         * scrollbar indicator is hidden for a clean premium feel.
         */
        .price-pills-track::-webkit-scrollbar {
          display: none;
        }
        .price-pills-track {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /*
         * Pill hover — ink-primary text + surface-sunken background.
         * Quiet, consistent with CategoryPills Ghost style.
         */
        .price-pill:hover {
          color: var(--color-ink-primary) !important;
          background-color: var(--color-surface-sunken) !important;
        }

        /*
         * Active pill — filled surface-sunken, ink-primary, weight 500.
         * Signals the currently selected price filter.
         */
        .price-pill--active {
          color: var(--color-ink-primary) !important;
          background-color: var(--color-surface-sunken) !important;
          border-color: var(--color-ink-tertiary) !important;
          font-weight: 500 !important;
        }

        /*
         * Focus-visible ring — uses --shadow-focus for the
         * accent-adaptive keyboard focus indicator (D-01).
         */
        .price-pill:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
          color: var(--color-ink-primary) !important;
        }

        /*
         * Desktop: allow wrapping so pills don't overflow wide layouts.
         * Mobile: no wrap (controlled by scrollable prop + overflow-x).
         */
        @media (min-width: 769px) {
          .price-pills-track--scrollable {
            flex-wrap: wrap !important;
            overflow-x: visible !important;
          }
        }
      `}</style>

      {/*
       * nav landmark — semantically marks this as a navigation region.
       * aria-label distinguishes it from other <nav> elements on the page
       * (header nav, breadcrumb, category pills, footer nav).
       */}
      <nav
        aria-label="Browse by price range"
        className={className}
        style={{ width: '100%' }}
      >
        {/*
         * Pills track — flex container.
         * scrollable=true (default/Home): nowrap + overflow-x: auto
         * scrollable=false (listing pages): wrap + overflow-x: visible
         *
         * paddingBottom: 4px prevents shadow clipping on hover state.
         */}
        <div
          className={`price-pills-track${scrollable ? ' price-pills-track--scrollable' : ''}`}
          style={{
            display: 'flex',
            flexWrap: scrollable ? 'nowrap' : 'wrap',
            gap: '8px',
            overflowX: scrollable ? 'auto' : 'visible',
            paddingBottom: '4px',
          }}
        >
          {PRICE_RANGES.map((range) => {
            const isActive = activePriceRangeSlug === range.slug
            const href = `/price/${range.slug}`

            return (
              <Link
                key={range.slug}
                href={href}
                /*
                 * aria-label uses fullLabel for screen readers —
                 * "Browse Under ₹1 Lakh motorcycles" is clearer
                 * than the short "< ₹1L" label text.
                 */
                aria-label={`Browse ${range.fullLabel} motorcycles`}
                aria-current={isActive ? 'page' : undefined}
                className={`price-pill${isActive ? ' price-pill--active' : ''}`}
                style={{
                  /*
                   * Pill dimensions — matches CategoryPills exactly
                   * for visual consistency on the Home page.
                   * Height: 40px with inline-flex centering.
                   * Padding: 0 20px horizontal breathing room.
                   */
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '40px',
                  padding: '0 20px',
                  /*
                   * Ghost pill style at rest:
                   *   - transparent background
                   *   - 1px border-hairline border
                   *   - r-full (999px) pill shape
                   *   - ink-secondary muted text
                   */
                  backgroundColor: isActive
                    ? 'var(--color-surface-sunken)'
                    : 'transparent',
                  border: '1px solid var(--color-border-hairline)',
                  borderRadius: '999px',
                  /*
                   * Typography: 14px body-md weight.
                   * Price pills use the short label (< ₹1L, ₹1–2L)
                   * which contains the ₹ symbol — ensure font supports it.
                   * var(--font-body) (Inter) has full Unicode coverage.
                   */
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive
                    ? 'var(--color-ink-primary)'
                    : 'var(--color-ink-secondary)',
                  textDecoration: 'none',
                  /*
                   * whiteSpace: nowrap — critical for price labels.
                   * "< ₹1L" must never break across lines.
                   * flexShrink: 0 — pills maintain their intrinsic
                   * width in the horizontal scroll track.
                   */
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition:
                    'color 200ms cubic-bezier(0.4,0,0.2,1), ' +
                    'background-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
                    'border-color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {/*
                 * Display the short label (< ₹1L, ₹1–2L, etc.)
                 * The fullLabel is reserved for aria-label only.
                 * Short labels keep the pills compact and scannable.
                 */}
                {range.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}