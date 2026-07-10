'use client'

/*
 * error.tsx — Global error boundary for the Next.js App Router.
 *
 * MPD Task L-08:
 *   "Client component (required by Next.js). Shows a minimal error
 *   message + 'Refresh page' button. Never exposes raw error stack
 *   to users."
 *
 * NEXT.JS APP ROUTER CONVENTION:
 *   A file named error.tsx in src/app/ is automatically used by Next.js
 *   as the global error boundary. It wraps every route segment in the
 *   application and catches runtime errors thrown during rendering,
 *   in event handlers, or in async Server Component data fetches.
 *
 *   Next.js requires error.tsx to be a Client Component ('use client')
 *   because it uses the React Error Boundary API under the hood, which
 *   relies on class-based lifecycle methods only available on the client.
 *
 * SCOPE:
 *   This global error boundary catches errors that escape page-level
 *   error.tsx boundaries. In MotoHub360:
 *     - A broken bike detail page (B-12) never breaks the entire site.
 *     - A failing API call in a Server Component renders this boundary
 *       rather than a raw Next.js error page or blank screen.
 *
 * WHAT IS NEVER SHOWN TO USERS:
 *   - Raw error.message strings (may contain internal paths or secrets)
 *   - Stack traces (error.stack) — internal implementation detail
 *   - Error digest codes — Next.js internal reference, not user-facing
 *   - Any technical detail that does not help the user recover
 *
 * WHAT IS LOGGED:
 *   The full error object is logged to the browser console in
 *   development only (process.env.NODE_ENV === 'development').
 *   In production, errors should be forwarded to an error tracking
 *   service (e.g. Sentry) in a future task — the console.error call
 *   is the hook point for that integration.
 *
 * RECOVERY:
 *   The reset() function provided by Next.js attempts to re-render
 *   the failed route segment. This is the correct primary recovery
 *   action — it does not do a full page reload, preserving any
 *   client state in unaffected parts of the app.
 *
 *   A full page reload link is provided as a secondary fallback for
 *   cases where reset() alone does not resolve the error (e.g. a
 *   persistent data fetch failure).
 *
 * DESIGN:
 *   Matches the premium minimal aesthetic of not-found.tsx (L-07):
 *   - Background: surface-base
 *   - Error icon: warning Icon at 32px, ink-tertiary (not alarming red)
 *   - Heading: display-md, ink-primary
 *   - Message: body-md, ink-secondary
 *   - Primary CTA: Secondary button style (outlined) — "Refresh page"
 *   - Secondary CTA: Ghost link — "Go to Home"
 *   - Full viewport height, centered
 *   - No raw technical details exposed
 *
 * NOTE ON LAYOUT:
 *   error.tsx replaces the entire page content including the layout
 *   hierarchy BELOW the level at which it is placed. The root
 *   layout.tsx (HTML shell, body) still renders — only the page
 *   content within it is replaced by this error UI.
 *   SiteHeader and Footer are rendered here to keep navigation
 *   accessible when an error occurs on any page.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import Footer from '@/components/layout/Footer'
import Icon from '@/components/ui/Icon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * ErrorPageProps — props injected by Next.js into error.tsx.
 *
 * error  — the Error object that was thrown. Contains:
 *            - message: string (never shown to user)
 *            - digest: string | undefined — Next.js server-side error ID
 *              (safe to log but not shown in UI)
 *
 * reset  — function provided by Next.js to attempt recovery.
 *          Calls React's error boundary reset, which re-renders
 *          the failed route segment from scratch.
 */
interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

// ---------------------------------------------------------------------------
// Error Page Component
// ---------------------------------------------------------------------------

export default function GlobalError({ error, reset }: ErrorPageProps) {
  /*
   * Log the full error in development only.
   * In production: integrate with Sentry or similar in a future task.
   * Never log to console in production — exposes internal detail.
   *
   * The digest (if present) is Next.js's server-side error reference.
   * It can be used to correlate client errors with server logs.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MotoHub360] Runtime error caught by error boundary:')
      console.error(error)
      if (error.digest) {
        console.error('[MotoHub360] Error digest:', error.digest)
      }
    }
  }, [error])

  return (
    <>
      {/*
       * Scoped hover and focus styles for action links and buttons.
       * Error page is a Client Component but we use a scoped style
       * block to avoid adding Tailwind dependency on this emergency UI.
       * The error page must render even if the Tailwind stylesheet
       * fails to load — inline styles + scoped <style> are resilient.
       */}
      <style>{`
        .error-btn-primary:hover {
          box-shadow: 0 4px 12px rgba(15,16,20,0.08) !important;
          background-color: var(--color-surface-sunken) !important;
        }
        .error-btn-primary:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
        }
        .error-btn-primary:active {
          transform: scale(0.98);
        }
        .error-link-ghost:hover {
          color: var(--color-ink-primary) !important;
        }
        .error-link-ghost:focus-visible {
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
         * SiteHeader — keeps navigation accessible during error states.
         * Users can navigate away from the broken page using the header.
         */}
        <SiteHeader />

        {/*
         * Main error content — centered vertically and horizontally.
         * flex: 1 fills available height between header and footer.
         */}
        <main
          id="error-content"
          role="main"
          aria-labelledby="error-heading"
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
           * Warning icon — 32px, ink-tertiary.
           * Signals a problem without the alarming connotation of red.
           * MPD Section 6 Icons: "32px — empty states."
           * aria-hidden: the heading conveys the error state.
           */}
          <div
            aria-hidden="true"
            style={{
              marginBottom: '24px',
              color: 'var(--color-ink-tertiary)',
              opacity: 0.6,
            }}
          >
            <Icon
              name="warning"
              size={32}
              strokeWidth={1.5}
            />
          </div>

          {/*
           * Primary heading — clear, calm, non-technical.
           * id="error-heading" is referenced by aria-labelledby on <main>.
           * display-md (32px desktop / 24px mobile) per MPD type scale.
           */}
          <h1
            id="error-heading"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 600,
              lineHeight: 1.15,
              color: 'var(--color-ink-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
            }}
          >
            Something went wrong
          </h1>

          {/*
           * Supportive message — body-md, ink-secondary.
           * Factual, no blame, directs user to the recovery action.
           * Does not expose error.message — internal detail.
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--color-ink-secondary)',
              maxWidth: '380px',
              margin: '0 0 36px',
            }}
          >
            An unexpected error occurred. Refreshing the page usually
            resolves this. If the problem persists, try going back to
            the home page.
          </p>

          {/*
           * Action row — primary recovery + secondary escape.
           * Matches the action pattern from not-found.tsx (L-07)
           * for visual consistency across error states.
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
             * Primary action — "Refresh page".
             * Calls Next.js reset() to attempt re-render of the
             * failed segment without a full page reload.
             * Styled as a Secondary button (outlined pill) to give
             * it clear visual priority.
             *
             * aria-label clarifies that "Refresh" means the failed
             * section, not a browser page reload.
             */}
            <button
              type="button"
              onClick={reset}
              aria-label="Refresh the page to try again"
              className="error-btn-primary"
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
                cursor: 'pointer',
                transition:
                  'box-shadow 280ms cubic-bezier(0.4,0,0.2,1), ' +
                  'background-color 280ms cubic-bezier(0.4,0,0.2,1), ' +
                  'transform 120ms cubic-bezier(0.4,0,0.2,1)',
                userSelect: 'none',
              }}
            >
              Refresh page
            </button>

            {/*
             * Secondary action — Go to Home.
             * Ghost link style: no border, muted ink-secondary text.
             * Hard navigation to Home — escapes the broken page entirely.
             * Uses <Link> (not window.location) to preserve Next.js
             * navigation context where possible.
             */}
            <Link
              href="/"
              className="error-link-ghost"
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
              Go to Home
            </Link>
          </div>
        </main>

        {/*
         * Footer — present during errors so users have full site
         * navigation without needing the browser back button.
         */}
        <Footer />
      </div>
    </>
  )
}