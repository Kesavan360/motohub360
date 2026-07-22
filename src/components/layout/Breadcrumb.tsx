"use client"
/*
 * Breadcrumb — 3-level site navigation breadcrumb.
 *
 * MPD Task L-05:
 *   "Accepts an array of { label, href } objects. Renders as
 *   Home > Brand > Model with > separators. Last item is ink-primary,
 *   others are ink-secondary Ghost links. Chevron icon between segments."
 *
 * MPD Section 5.3, Bike Detail Page:
 *   "Breadcrumb navigation appears at the top of every bike page:
 *   Home > Brand > Bike Model — aids both user orientation and SEO
 *   (breadcrumb structured data)."
 *
 * MPD Section 12, SEO Architecture:
 *   "Schema: BreadcrumbList (Home > Royal Enfield > GT 650)
 *   BreadcrumbList schema matching the visible breadcrumb.
 *   Breadcrumb structured data is particularly important — it makes
 *   Google display the breadcrumb trail directly in search results,
 *   which improves click-through rate."
 *
 * MPD Section 8, Component Library:
 *   Breadcrumb | Standard 3-level (Home > Brand > Model)
 *
 * TWO OUTPUTS FROM ONE COMPONENT:
 *   1. Visual breadcrumb — the rendered <nav> element users see.
 *   2. JSON-LD structured data — a <script> tag with BreadcrumbList
 *      schema injected into the page <head> equivalent via inline
 *      script. This ensures SEO structured data and visible breadcrumb
 *      are always in sync — they share the same source array.
 *
 * WHY STRUCTURED DATA HERE (not P-02):
 *   P-02 adds Vehicle + VideoObject JSON-LD to the bike detail page.
 *   BreadcrumbList is different — it must be derived from the same
 *   breadcrumb array that drives the visual component to prevent
 *   drift between what the user sees and what Google reads.
 *   Co-locating both outputs in this component is the architecturally
 *   correct decision and is consistent with the MPD's statement:
 *   "Breadcrumb doubles as SEO structured data (BreadcrumbList)."
 *
 * DESIGN:
 *   - All items except the last: Ghost link style (ink-secondary, hover → ink-primary)
 *   - Last item: ink-primary, not a link (current page)
 *   - Separator: chevron-right Icon at 12px, ink-tertiary
 *   - Font: body-sm (13px) per MPD type scale
 *   - Focus ring: shadow-focus on each link for accessibility
 *
 * SERVER COMPONENT:
 *   No interactivity required — this is a pure Server Component.
 *   No 'use client' directive needed.
 *   JSON-LD script is rendered server-side for immediate availability
 *   to crawlers, not deferred until JS hydration.
 *
 * USAGE — Bike detail page (B-12):
 *   <Breadcrumb
 *     items={[
 *       { label: 'Home', href: '/' },
 *       { label: 'Royal Enfield', href: '/brands/royal-enfield' },
 *       { label: 'GT 650', href: '/bikes/royal-enfield/gt-650' },
 *     ]}
 *   />
 *
 * USAGE — Brand listing page (LP-04):
 *   <Breadcrumb
 *     items={[
 *       { label: 'Home', href: '/' },
 *       { label: 'Royal Enfield', href: '/brands/royal-enfield' },
 *     ]}
 *   />
 *
 * USAGE — Category listing page (LP-05):
 *   <Breadcrumb
 *     items={[
 *       { label: 'Home', href: '/' },
 *       { label: 'Cruiser', href: '/category/cruiser' },
 *     ]}
 *   />
 */

import Link from 'next/link'
import Icon from '@/components/ui/Icon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * BreadcrumbItem — a single step in the breadcrumb trail.
 *
 * label — display text shown to the user.
 * href  — canonical URL for this breadcrumb level.
 *         Used in both the visible link and the JSON-LD itemListElement.
 *         Must be an absolute path (starting with '/') or a full URL.
 *         The JSON-LD generator prepends NEXT_PUBLIC_SITE_URL to
 *         produce the fully qualified URL required by schema.org.
 */
export interface BreadcrumbItem {
  label: string
  href: string
}

/*
 * BreadcrumbProps — props for the Breadcrumb component.
 */
export interface BreadcrumbProps {
  /*
   * items — ordered array of breadcrumb steps, from root to current page.
   *
   * Requirements:
   *   - Minimum 1 item (Home alone is valid for the root page).
   *   - Maximum 5 items (MPD design allows up to 3 for most pages,
   *     capped at 5 as a safety limit for deeply nested routes).
   *   - Last item is always the current page — rendered as text, not a link.
   *   - All other items are rendered as Ghost links.
   *
   * Example (3-level — bike detail):
   *   [
   *     { label: 'Home', href: '/' },
   *     { label: 'Royal Enfield', href: '/brands/royal-enfield' },
   *     { label: 'GT 650', href: '/bikes/royal-enfield/gt-650' },
   *   ]
   */
  items: BreadcrumbItem[]

  /*
   * className — additional CSS classes applied to the <nav> wrapper.
   * Use for margin adjustments in consuming page layouts.
   * Example: className="mb-6" to add bottom margin on bike detail page.
   */
  className?: string

  /*
   * showStructuredData — whether to inject JSON-LD BreadcrumbList.
   * Default: true
   *
   * Set to false on pages where the parent already injects
   * BreadcrumbList via another mechanism (e.g. a shared metadata
   * utility in P-01/P-02). In V1, this is always true.
   */
  showStructuredData?: boolean
}

// ---------------------------------------------------------------------------
// JSON-LD structured data generator
// ---------------------------------------------------------------------------

/*
 * buildBreadcrumbJsonLd — generates schema.org BreadcrumbList JSON-LD.
 *
 * Schema reference: https://schema.org/BreadcrumbList
 *
 * Google requires:
 *   - @context: "https://schema.org"
 *   - @type: "BreadcrumbList"
 *   - itemListElement: array of ListItem with position, name, item (URL)
 *
 * The URL in each ListItem must be a fully qualified absolute URL.
 * NEXT_PUBLIC_SITE_URL from .env.local provides the domain
 * (e.g. http://localhost:3000 in dev, https://motohub360.in in prod).
 *
 * The last breadcrumb item (current page) is included in the JSON-LD
 * even though it renders as text (not a link) in the visual component.
 * Google's BreadcrumbList spec requires all levels including the current
 * page to be present in the structured data.
 *
 * dangerouslySetInnerHTML is used for the JSON-LD script tag because:
 *   1. The content is machine-generated JSON, not user input — safe.
 *   2. JSON.stringify produces valid, escaped output.
 *   3. React does not support <script> children as string literals.
 *   4. This is the standard pattern for JSON-LD in Next.js App Router.
 */
function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): string {
  /*
   * Read the site URL from the environment variable.
   * Falls back to empty string in environments where the variable
   * is not set — the href is still valid as a relative path,
   * but Google requires absolute URLs for structured data.
   * The env var is always set in production via Vercel (DEP-04).
   */
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      /*
       * position — 1-based index per schema.org spec.
       * Google uses this to determine the order of breadcrumb levels.
       */
      position: index + 1,
      name: item.label,
      item: item.href.startsWith('http')
        ? item.href
        : `${siteUrl}${item.href}`,
    })),
  }

  return JSON.stringify(breadcrumbList)
}

// ---------------------------------------------------------------------------
// Breadcrumb Component
// ---------------------------------------------------------------------------

export default function Breadcrumb({
  items,
  className = '',
  showStructuredData = true,
}: BreadcrumbProps) {
  /*
   * Guard: require at least 1 item.
   * Return null silently rather than throwing — a missing breadcrumb
   * is preferable to a page crash. The TypeScript type already enforces
   * the items array requirement at compile time.
   */
  if (!items || items.length === 0) {
    return null
  }

  const jsonLd = showStructuredData ? buildBreadcrumbJsonLd(items) : null

  return (
    <>
      {/*
       * JSON-LD structured data.
       * Rendered as a server-side <script> tag.
       * Placed before the <nav> so crawlers encounter it first.
       * type="application/ld+json" is the standard MIME type for JSON-LD.
       */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}

      {/*
       * Visual breadcrumb navigation.
       *
       * aria-label="Breadcrumb" distinguishes this nav from other
       * <nav> elements on the page (e.g. the header's primary nav).
       *
       * role="navigation" is implicit on <nav> but aria-label makes
       * the landmark uniquely identifiable in screen reader navigation.
       */}
      <nav
        aria-label="Breadcrumb"
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          /*
           * Row gap allows wrapping on narrow screens without items
           * running together. Column gap is handled by the separator icon.
           */
          rowGap: '4px',
        }}
      >
        {/*
         * Ordered list — correct semantic element for a sequence of steps.
         * Screen readers announce "1 of 3", "2 of 3" etc. from <ol>.
         */}
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: '4px',
          }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isFirst = index === 0

            return (
              <li
                key={`${item.href}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  /*
                   * gap between the item content and the following separator.
                   * The separator is rendered as the first child of the
                   * NEXT list item (not this one) to keep semantics clean.
                   */
                }}
              >
                {/*
                 * Chevron separator — rendered before all items except the first.
                 * Placed inside each <li> (before the item content) rather than
                 * between <li> elements to keep the separator visually associated
                 * with the transition between levels.
                 *
                 * aria-hidden="true" — the separator is purely decorative.
                 * Screen readers convey breadcrumb structure via the <ol> and
                 * aria-current, not the visual separators.
                 */}
                {!isFirst && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      margin: '0 4px',
                      color: 'var(--color-ink-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      name="chevron-right"
                      size={12}
                      strokeWidth={2}
                    />
                  </span>
                )}

                {/*
                 * Last item — current page.
                 * Rendered as plain text, not a link (linking to the
                 * current page is redundant and confusing for screen readers).
                 *
                 * aria-current="page" signals to assistive technology that
                 * this is the currently active page in the breadcrumb trail.
                 * This is the correct ARIA pattern for breadcrumb current items.
                 */}
                {isLast ? (
                  <span
                    aria-current="page"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-ink-primary)',
                      lineHeight: 1.5,
                      /*
                       * Truncate very long model names on narrow screens.
                       * Max-width is generous — only clips extreme cases.
                       */
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : (
                  /*
                   * Non-last items — Ghost link style.
                   * ink-secondary at rest, ink-primary on hover.
                   * font-weight 400 (lighter than the current page item).
                   *
                   * The className "breadcrumb-link" is used for the
                   * hover style defined in the scoped <style> block below,
                   * since inline styles cannot express :hover pseudo-class.
                   */
                  <Link
                    href={item.href}
                    className="breadcrumb-link"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: 'var(--color-ink-secondary)',
                      textDecoration: 'none',
                      lineHeight: 1.5,
                      borderRadius: '4px',
                      padding: '1px 2px',
                      margin: '-1px -2px',
                      transition:
                        'color 200ms cubic-bezier(0.4,0,0.2,1)',
                      display: 'inline-block',
                    }}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/*
       * Scoped hover and focus styles for breadcrumb links.
       * Cannot use Tailwind :hover on inline-styled elements,
       * and this component is a Server Component so no 'use client'
       * can be added for event handlers. Scoped <style> is the
       * correct approach for Server Component hover styles.
       */}
      <style>{`
        .breadcrumb-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .breadcrumb-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          color: var(--color-ink-primary) !important;
        }
      `}</style>
    </>
  )
}