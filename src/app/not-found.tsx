/*
 * not-found.tsx — Global 404 page.
 *
 * MPD Task L-07:
 *   "Clean, minimal: 'Page not found' in display-lg, short message
 *   in body-md, a Ghost button back to Home. Consistent with the
 *   premium aesthetic — no heavy illustration."
 *
 * MPD Section 5, Non-Goals:
 *   The 404 page follows the MotoHub360 design system exactly —
 *   the same neutral-premium palette, typography, and spacing used
 *   across all public pages.
 *
 * NEXT.JS APP ROUTER CONVENTION:
 *   A file named not-found.tsx in src/app/ is automatically used by
 *   Next.js as the global 404 page for any route that:
 *     (a) does not match any page.tsx file in the app directory, OR
 *     (b) calls the notFound() function from 'next/navigation'
 *         (used in bike detail page when slug not found — B-12).
 *
 *   This file does not need to be imported anywhere — Next.js
 *   registers it automatically by convention.
 *
 * SERVER COMPONENT:
 *   No interactivity required. The "Back to Home" button is a plain
 *   Next.js <Link> styled as a Ghost button — no onClick needed.
 *   No 'use client' directive.
 *
 * DESIGN:
 *   - Background: surface-base (#FAFAF9)
 *   - "404" numeral: display-xl, ink-tertiary (muted — not alarming)
 *   - "Page not found": display-lg, ink-primary
 *   - Message: body-md, ink-secondary
 *   - CTA: Ghost button link back to Home (no secondary actions)
 *   - Layout: full viewport height, centered vertically and horizontally
 *   - No illustration, no heavy graphic — premium minimal per MPD
 *
 * METADATA:
 *   Next.js automatically sets the HTTP status to 404 for not-found.tsx.
 *   A custom metadata export ensures the browser tab title is informative
 *   and the page is not indexed by search engines.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import Footer from '@/components/layout/Footer'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/*
 * Metadata for the 404 page.
 *
 * title: descriptive for the browser tab and screen readers.
 * robots: noindex — 404 pages must not be indexed by search engines.
 *   An indexed 404 page wastes crawl budget and harms SEO.
 */
export const metadata: Metadata = {
  title: 'Page Not Found | MotoHub360',
  description: 'The page you are looking for does not exist.',
  robots: {
    index: false,
    follow: false,
  },
}

// ---------------------------------------------------------------------------
// Not Found Page Component
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <>
      {/*
       * Scoped hover style for the Ghost CTA link.
       * Server Component — cannot use event handlers or Tailwind
       * pseudo-class utilities on inline-styled elements.
       * Scoped <style> is the correct approach here.
       */}
      <style>{`
        .not-found-cta:hover {
          color: var(--color-ink-primary) !important;
        }
        .not-found-cta:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 6px;
          color: var(--color-ink-primary) !important;
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface-base)',
        }}
      >
        {/*
         * SiteHeader — sticky header swap (L-06).
         * Present on the 404 page so users can navigate away easily.
         * Includes the search bar and nav links.
         */}
        <SiteHeader />

        {/*
         * Main content — centered vertically and horizontally.
         * flex: 1 ensures the content section fills available height
         * between the header and footer, keeping the footer pinned
         * to the bottom on short viewports.
         */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 32px',
            textAlign: 'center',
          }}
        >
          {/*
           * 404 numeral — large, muted, ink-tertiary.
           * Sets context immediately without being alarming.
           * Not display-xl (72px) — sits below display-lg heading
           * in visual hierarchy despite rendering above it.
           * MPD type scale: display-xl = 72px / 1.0 line-height.
           */}
          <p
            aria-hidden="true"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '120px',
              fontWeight: 600,
              lineHeight: 1,
              color: 'var(--color-ink-tertiary)',
              letterSpacing: '-0.04em',
              margin: '0 0 24px',
              userSelect: 'none',
              /*
               * Subtle opacity — reinforces the muted, non-alarming tone.
               * The "Page not found" heading below carries the real message.
               */
              opacity: 0.35,
            }}
          >
            404
          </p>

          {/*
           * Primary heading — "Page not found".
           * MPD L-07: "display-lg, short message in body-md".
           * display-lg = 48px desktop / 32px mobile per MPD type scale.
           */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 600,
              lineHeight: 1.05,
              color: 'var(--color-ink-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            Page not found
          </h1>

          {/*
           * Supportive message — body-md (15px), ink-secondary.
           * Short, factual, no blame. Consistent with MPD copy tone:
           * "Confident, minimal, factual — no sales language."
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--color-ink-secondary)',
              maxWidth: '400px',
              margin: '0 0 40px',
            }}
          >
            The page you are looking for does not exist or may have been
            moved. Try searching for a motorcycle or browse by brand.
          </p>

          {/*
           * Action row — Ghost CTA back to Home + secondary search link.
           * MPD L-07: "a Ghost button back to Home".
           * Ghost style: no border, no fill, ink-secondary text, ink-primary on hover.
           *
           * Two actions provided:
           *   1. Back to Home — primary, always useful
           *   2. Browse all brands — secondary, helps discovery
           *
           * Links are styled as Ghost buttons per MPD Section 6, Buttons:
           * "Ghost / Text — No border, no fill, ink-secondary text, accent on hover"
           */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {/*
             * Primary action — Back to Home.
             * Styled as a Secondary button (outlined) to give it more
             * visual weight as the primary recovery action.
             * Ghost style per MPD L-07 specification.
             */}
            <Link
              href="/"
              className="not-found-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '44px',
                padding: '0 24px',
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--color-ink-primary)',
                textDecoration: 'none',
                borderRadius: '999px',
                border: '1px solid var(--color-border-hairline)',
                backgroundColor: 'transparent',
                transition: 'box-shadow 280ms cubic-bezier(0.4,0,0.2,1), color 280ms cubic-bezier(0.4,0,0.2,1)',
                userSelect: 'none',
              }}
            >
              Back to Home
            </Link>

            {/*
             * Secondary action — Browse all brands.
             * Pure Ghost style — no border, muted text, primary on hover.
             */}
            <Link
              href="/brands"
              className="not-found-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '44px',
                padding: '0 24px',
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 400,
                color: 'var(--color-ink-secondary)',
                textDecoration: 'none',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'transparent',
                transition: 'color 280ms cubic-bezier(0.4,0,0.2,1)',
                userSelect: 'none',
              }}
            >
              Browse all brands
            </Link>
          </div>
        </main>

        {/*
         * Footer — present on 404 so users have full site navigation
         * available without needing to use the back button.
         */}
        <Footer />
      </div>
    </>
  )
}