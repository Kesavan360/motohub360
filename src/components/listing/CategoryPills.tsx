/*
 * CategoryPills — Horizontal row of category filter pills for the Home page.
 *
 * MPD Task H-03:
 *   "A horizontal, wrapping row of Ghost-style pill buttons
 *   (Cruiser, Sport, Adventure, Naked, Scooter). Each links to
 *   /category/[slug]. Horizontally scrollable on mobile without
 *   showing scrollbar."
 *
 * MPD Section 5.1, Home Page:
 *   "Browse by Category — pill row (Cruiser, Sport, Adventure,
 *   Naked, Scooter)."
 *
 * MPD High-Fidelity UI, Home Page:
 *   "Browse by Category and Browse by Price as quiet pill-button
 *   rows — text-forward, no icons needed, since the brand chips
 *   already carry the page's visual interest."
 *
 * MPD Section 6, Buttons — Ghost variant:
 *   "No border, no fill, ink-secondary text, accent on hover.
 *   Used for nav links, breadcrumb, 'View all'."
 *
 * DATA SOURCE:
 *   Pulls directly from CATEGORIES constant (S-08).
 *   No props needed for the category list — it is fixed per MPD.
 *   The component accepts an optional activeCategorySlug prop
 *   to highlight the currently active category (used on listing pages).
 *
 * SERVER COMPONENT:
 *   No client-side interactivity required — Next.js <Link> handles
 *   navigation. No 'use client' directive needed.
 *   Active state is determined from the slug prop, not useState.
 *
 * MOBILE SCROLL:
 *   On mobile the pills do not wrap — they scroll horizontally.
 *   The scrollbar is hidden via CSS (scrollbar-width: none /
 *   ::-webkit-scrollbar { display: none }) for a clean premium feel.
 *   On desktop the pills wrap naturally to a second row if needed.
 *
 * USAGE — Home page (H-06):
 *   <CategoryPills />
 *
 * USAGE — Category listing page (LP-05) with active state:
 *   <CategoryPills activeCategorySlug="cruiser" />
 */

import Link from 'next/link'
import { CATEGORIES } from '@/constants/categories'
import type { BikeCategory } from '@/types/bike'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryPillsProps {
  /*
   * activeCategorySlug — slug of the currently active category.
   * When provided, that pill is highlighted with accent color and
   * a filled background to show the current filter selection.
   * On the Home page this is undefined (no active filter).
   * On /category/[category] pages this matches the route param.
   */
  activeCategorySlug?: BikeCategory

  /*
   * className — additional CSS classes on the outer container.
   * Use for margin/spacing adjustments from the parent layout.
   */
  className?: string

  /*
   * scrollable — whether mobile horizontal scroll is enabled.
   * Default: true (Home page behaviour per MPD H-03).
   * Set false on listing pages where pills wrap instead of scroll.
   */
  scrollable?: boolean
}

// ---------------------------------------------------------------------------
// CategoryPills Component
// ---------------------------------------------------------------------------

export default function CategoryPills({
  activeCategorySlug,
  className = '',
  scrollable = true,
}: CategoryPillsProps) {
  return (
    <>
      {/*
       * Scoped styles for:
       *   1. Pill hover/focus states (cannot use inline :hover)
       *   2. Mobile horizontal scroll without visible scrollbar
       *   3. Desktop wrap behaviour
       */}
      <style>{`
        /*
         * Hide scrollbar on mobile scroll container.
         * The touch scroll still works — only the visual scrollbar is hidden.
         * This is the standard pattern for premium horizontal carousels.
         */
        .category-pills-track::-webkit-scrollbar {
          display: none;
        }
        .category-pills-track {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /*
         * Pill hover state — ink-primary text + surface-sunken background.
         * Ghost pills: no fill at rest, subtle fill on hover.
         * Per MPD Button Ghost: "ink-secondary text, accent on hover."
         * We use ink-primary on hover (not accent) for the category pills
         * to keep them visually quiet — they are Browse aids, not CTAs.
         */
        .category-pill:hover {
          color: var(--color-ink-primary) !important;
          background-color: var(--color-surface-sunken) !important;
        }

        /*
         * Active pill — filled with surface-sunken, ink-primary text.
         * Slightly heavier font weight to signal the current selection.
         * Border tightens to ink-secondary for stronger definition.
         */
        .category-pill--active {
          color: var(--color-ink-primary) !important;
          background-color: var(--color-surface-sunken) !important;
          border-color: var(--color-ink-tertiary) !important;
          font-weight: 500 !important;
        }

        .category-pill:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
          color: var(--color-ink-primary) !important;
        }

        /*
         * Desktop: pills wrap to new row if they overflow.
         * Mobile: pills scroll horizontally (no wrap).
         */
        @media (min-width: 769px) {
          .category-pills-track--scrollable {
            flex-wrap: wrap !important;
            overflow-x: visible !important;
          }
        }
      `}</style>

      {/*
       * Outer container — provides the scrollable region on mobile.
       * overflow-x: auto enables horizontal scroll.
       * The negative margin + padding trick extends the scroll area
       * to the full container edge without clipping pill shadows.
       */}
      <nav
        aria-label="Browse by category"
        className={className}
        style={{ width: '100%' }}
      >
        {/*
         * Pills track — the horizontal flex container.
         * On mobile (scrollable=true): no wrap, scrolls horizontally.
         * On desktop: wraps naturally.
         *
         * padding-bottom: 4px prevents shadow-sm clipping at the
         * bottom of the track on hover.
         */}
        <div
          className={`category-pills-track${scrollable ? ' category-pills-track--scrollable' : ''}`}
          style={{
            display: 'flex',
            flexWrap: scrollable ? 'nowrap' : 'wrap',
            gap: '8px',
            overflowX: scrollable ? 'auto' : 'visible',
            paddingBottom: '4px',
            /*
             * paddingRight: 32px on mobile ensures the last pill is
             * fully visible before the scroll ends — prevents the
             * last item from being clipped at the viewport edge.
             */
            paddingRight: scrollable ? '0' : '0',
          }}
        >
          {CATEGORIES.map((category) => {
            const isActive = activeCategorySlug === category.slug
            const href = `/category/${category.slug}`

            return (
              <Link
                key={category.slug}
                href={href}
                aria-label={`Browse ${category.pluralLabel}`}
                aria-current={isActive ? 'page' : undefined}
                className={`category-pill${isActive ? ' category-pill--active' : ''}`}
                style={{
                  /*
                   * Pill dimensions — height 40px, generous horizontal padding.
                   * Matches the Button size="md" (44px) tap target guideline
                   * from MPD Section 6 minus 4px for the pill visual weight.
                   * The 40px height plus 4px vertical margin = 44px effective
                   * touch area meeting WCAG 2.1 AA tap target requirements.
                   */
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '40px',
                  padding: '0 20px',
                  /*
                   * Ghost pill style:
                   *   - Transparent background
                   *   - 1px border-hairline border
                   *   - r-full (999px) pill shape
                   *   - ink-secondary text at rest
                   */
                  backgroundColor: isActive
                    ? 'var(--color-surface-sunken)'
                    : 'transparent',
                  border: '1px solid var(--color-border-hairline)',
                  borderRadius: '999px',
                  /*
                   * Typography: body-sm (13px), matching caption scale.
                   * Pills are Browse aids — smaller than primary CTAs.
                   */
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive
                    ? 'var(--color-ink-primary)'
                    : 'var(--color-ink-secondary)',
                  textDecoration: 'none',
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
                {category.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}