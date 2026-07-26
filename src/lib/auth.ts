/*
 * auth.ts — Server-side admin authentication utilities.
 *
 * MPD Task A-05:
 *   "withAdminAuth HOC — wraps admin Server Components.
 *   Reads iron-session, redirects to /admin/login if not authenticated,
 *   passes adminSession as prop to the wrapped component."
 *
 * THREE EXPORTS:
 *
 * 1. getAdminSession()
 *    Reads the iron-session cookie and returns the admin session data,
 *    or null if not authenticated (or any error occurs).
 *    Does NOT redirect — callers decide what to do with null.
 *    Use in: admin layout (to redirect), admin dashboard (for greeting).
 *
 * 2. requireAdminSession()
 *    Same as getAdminSession() but calls redirect('/admin/login') if
 *    the session is absent. Never returns null — always returns AdminSessionData.
 *    Use in: individual admin pages that need guaranteed auth.
 *
 * 3. withAdminAuth(Component)
 *    Higher-Order Component wrapper for async Server Components.
 *    Calls requireAdminSession() and passes adminSession as a prop.
 *    Use in: admin pages where you want the HOC pattern rather than
 *    calling requireAdminSession() explicitly at the top of the page.
 *
 * WHY THREE VARIANTS:
 *
 *   getAdminSession() — nullable return — used when the caller needs
 *   to branch on auth state (e.g. the layout redirects to login vs
 *   renders the admin shell).
 *
 *   requireAdminSession() — throws redirect — used inside pages that
 *   are already behind the middleware guard. The redirect is a safety
 *   net, not the primary enforcement mechanism.
 *
 *   withAdminAuth() — HOC — used for pages that want to receive
 *   adminSession as a typed prop without an explicit top-level await.
 *   Makes the auth requirement visible at the component declaration.
 *
 * RELATIONSHIP TO A-04 MIDDLEWARE:
 *   A-04 middleware is the PRIMARY auth enforcement layer (Edge Runtime).
 *   It redirects unauthenticated requests before the page renders.
 *
 *   A-05 auth utilities are the SECONDARY layer (Node.js Server Components).
 *   They protect against:
 *     - Middleware being bypassed (e.g. direct API calls)
 *     - Edge/Node session state drift (extremely rare)
 *     - Pages rendered outside the /admin/* matcher scope
 *
 *   The two layers use the same iron-session cookie and SESSION_SECRET.
 *   Both decrypt the same sealed session object.
 *
 * SERVER-ONLY:
 *   This module uses next/headers cookies() which is only available
 *   in Server Components and Route Handlers.
 *   Never import this in 'use client' components.
 *   Import from '@/lib/auth' only in:
 *     - Server Components (admin pages, admin layout)
 *     - Route Handlers (API routes)
 *
 * HOC TYPING:
 *   withAdminAuth() uses generics to preserve the full props type of
 *   the wrapped component, adding adminSession as an additional prop.
 *   The wrapped component's type is:
 *     (props: TProps & { adminSession: AdminSessionData }) => Promise<React.ReactNode>
 *   The wrapper's type is:
 *     (props: TProps) => Promise<React.ReactNode>
 *   TypeScript enforces that the wrapped component receives adminSession.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'
import type { AdminSessionData } from '@/lib/session'
import type React from 'react'

// ---------------------------------------------------------------------------
// Re-export AdminSessionData for consumers
// ---------------------------------------------------------------------------

/*
 * Re-export AdminSessionData so admin pages can import the type from
 * '@/lib/auth' without needing to know about '@/lib/session'.
 * This keeps the auth API surface clean — consumers only import auth.ts.
 */
export type { AdminSessionData }

// ---------------------------------------------------------------------------
// getAdminSession
// ---------------------------------------------------------------------------

/*
 * getAdminSession — reads and returns the admin session, or null.
 *
 * Returns:
 *   AdminSessionData — if a valid session exists with admin data.
 *   null             — if unauthenticated, session expired, or any error.
 *
 * Does NOT redirect — the caller decides how to handle null.
 *
 * Usage:
 *   const session = await getAdminSession()
 *   if (!session) {
 *     redirect('/admin/login')
 *   }
 *   // session is AdminSessionData here
 */
export async function getAdminSession(): Promise<AdminSessionData | null> {
  try {
    const session = await getIronSession<SessionData>(
      await cookies(),
      sessionOptions,
    )

    /*
     * Validate that session.admin has all required fields.
     * Prevents partial session objects from being treated as valid.
     */
    if (
      !session.admin ||
      typeof session.admin.id !== 'string' ||
      session.admin.id.length === 0 ||
      typeof session.admin.email !== 'string' ||
      typeof session.admin.role !== 'string'
    ) {
      return null
    }

    return session.admin
  } catch {
    /*
     * getIronSession can throw if the cookie is malformed, the secret
     * is wrong, or cookies() is called in an invalid context.
     * Return null in all cases — treated as unauthenticated.
     */
    return null
  }
}

// ---------------------------------------------------------------------------
// requireAdminSession
// ---------------------------------------------------------------------------

/*
 * requireAdminSession — reads the admin session or redirects to login.
 *
 * Returns:
 *   AdminSessionData — always (never returns null).
 *
 * Throws:
 *   redirect('/admin/login') — if unauthenticated (Next.js NEXT_REDIRECT).
 *   This is not a true throw — Next.js catches it internally and sends
 *   a redirect response. The calling function never continues after redirect().
 *
 * Usage:
 *   const adminSession = await requireAdminSession()
 *   // adminSession is guaranteed AdminSessionData here
 *
 * Use this in individual admin page components for belt-and-suspenders
 * protection. The A-04 middleware will have already redirected unauthed
 *  requests before this is called, but requireAdminSession provides a
 * secondary check at the page level.
 */
export async function requireAdminSession(): Promise<AdminSessionData> {
  const session = await getAdminSession()

  if (!session) {
    redirect('/admin/login')
  }

  return session
}

// ---------------------------------------------------------------------------
// withAdminAuth HOC
// ---------------------------------------------------------------------------

/*
 * AdminPageProps — the props injected by the withAdminAuth HOC.
 * Wrapped components receive this in addition to their own props.
 */
export interface AdminPageProps {
  adminSession: AdminSessionData
}

/*
 * withAdminAuth<TProps> — Higher-Order Component for admin Server Components.
 *
 * Wraps an async Server Component, adds auth protection, and injects
 * adminSession as a prop.
 *
 * TYPE PARAMETERS:
 *   TProps — the wrapped component's own props (e.g. { params: {...} }).
 *
 * EXAMPLE USAGE:
 *
 *   // src/app/admin/bikes/page.tsx
 *   import { withAdminAuth, type AdminPageProps } from '@/lib/auth'
 *
 *   interface BikesPageOwnProps {
 *     searchParams: Promise<{ page?: string }>
 *   }
 *
 *   type BikesPageProps = BikesPageOwnProps & AdminPageProps
 *
 *   export default withAdminAuth<BikesPageOwnProps>(
 *     async function AdminBikesPage({ adminSession, searchParams }) {
 *       // adminSession.email, adminSession.role available here
 *       // redirect() already called if not authenticated
 *       return <div>...</div>
 *     }
 *   )
 *
 * ALTERNATIVE — direct requireAdminSession() usage (also valid):
 *
 *   export default async function AdminBikesPage() {
 *     const adminSession = await requireAdminSession()
 *     return <div>...</div>
 *   }
 *
 * Both patterns provide the same protection. withAdminAuth() is more
 * explicit at the declaration site — you can see at a glance that
 * this component requires authentication.
 *
 * NOTE ON NEXT.JS PAGE COMPONENTS:
 *   Next.js page components receive props like `params` and `searchParams`
 *   via the framework — not via JSX props. When using withAdminAuth on
 *   pages, the TProps must include the framework-injected props:
 *     withAdminAuth<{ params: Promise<{ slug: string }> }>(...)
 *
 * NOTE ON HOC COMPOSITION:
 *   The returned wrapper function is an async function that Next.js
 *   treats as a Server Component (async functions that return JSX).
 *   No special Next.js metadata exports (generateMetadata, etc.) survive
 *   HOC wrapping — define those as named exports on the module, not
 *   inside the wrapped component.
 */
export function withAdminAuth<TProps extends object>(
  Component: (
    props: TProps & AdminPageProps,
  ) => Promise<React.ReactNode> | React.ReactNode,
): (props: TProps) => Promise<React.ReactNode> {
  return async function WithAdminAuthWrapper(
    props: TProps,
  ): Promise<React.ReactNode> {
    /*
     * requireAdminSession() either returns AdminSessionData or
     * calls redirect('/admin/login') which Next.js handles internally.
     * Execution never reaches Component() if not authenticated.
     */
    const adminSession = await requireAdminSession()

    /*
     * Spread props + inject adminSession into the wrapped component.
     * TypeScript enforces that the wrapped component accepts adminSession.
     */
    return Component({ ...props, adminSession })
  }
}