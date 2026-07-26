/*
 * middleware.ts — Next.js Edge middleware for admin route protection.
 *
 * MPD Task A-04:
 *   "Middleware session guard for /admin/* routes.
 *   Unauthenticated requests redirect to /admin/login.
 *   Runs on Edge Runtime."
 *
 * EDGE RUNTIME:
 *   Next.js middleware always runs on the Edge Runtime — a lightweight
 *   V8 isolate that does NOT support Node.js native modules.
 *   This means:
 *     ✗ Cannot import Mongoose
 *     ✗ Cannot import connectDB
 *     ✗ Cannot use iron-session's getIronSession() (uses Node.js crypto)
 *     ✓ CAN use Web Crypto API (available on Edge)
 *     ✓ CAN read cookies via NextRequest
 *     ✓ CAN use iron-session's unsealData() (Edge-compatible)
 *
 * APPROACH:
 *   1. Read the raw session cookie value from the request.
 *   2. If cookie is absent → redirect to /admin/login.
 *   3. If cookie is present → attempt to unseal it with SESSION_SECRET.
 *   4. If unsealing fails (tampered/expired) → redirect to /admin/login.
 *   5. If session.admin is present → allow through.
 *   6. If session.admin is absent (empty session) → redirect to /admin/login.
 *
 * unsealData():
 *   iron-session exports unsealData() as a separate Edge-compatible utility.
 *   It decrypts and verifies the cookie value using the SESSION_SECRET.
 *   Returns the original session object or throws on invalid data.
 *
 * PROTECTED PATHS:
 *   /admin/* — all admin panel routes.
 *
 * PUBLIC ADMIN PATHS:
 *   /admin/login — the login page itself must be accessible without auth.
 *
 * SPECIAL CASE — already logged in visiting /admin/login:
 *   If the user has a valid session and visits /admin/login, redirect
 *   them to /admin (dashboard). No need to log in again.
 *
 * MATCHER:
 *   Only runs on /admin/* paths — not on public routes or API routes.
 *   This keeps the middleware fast and focused.
 *
 * SESSION_SECRET on Edge:
 *   process.env is available on Edge Runtime in Next.js.
 *   The SESSION_SECRET env var must be set in Vercel's environment
 *   variables for production (Edge reads from process.env, not .env.local).
 *
 * ERROR HANDLING:
 *   Any error (missing secret, corrupted cookie, unseal failure) →
 *   redirect to /admin/login. Never expose error details to the client.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = 'motohub360-admin-session'
const LOGIN_PATH = '/admin/login'
const DASHBOARD_PATH = '/admin'

// ---------------------------------------------------------------------------
// Middleware function
// ---------------------------------------------------------------------------

export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  /*
   * Read the session cookie from the request.
   * NextRequest.cookies is available on Edge Runtime.
   */
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value

  /*
   * Attempt to unseal and parse the session.
   * Returns null on any failure (missing cookie, bad secret, expired, tampered).
   */
  const session = await tryGetSession(cookieValue)

  /*
   * Check whether the user has a valid admin session.
   */
  const isAuthenticated =
    session !== null &&
    typeof session.admin === 'object' &&
    session.admin !== null &&
    typeof session.admin.id === 'string' &&
    session.admin.id.length > 0

  /*
   * CASE 1: Visiting /admin/login with a valid session.
   * Redirect to dashboard — no need to log in again.
   */
  if (pathname === LOGIN_PATH && isAuthenticated) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url))
  }

  /*
   * CASE 2: Visiting /admin/login without a session.
   * Allow through — this is the login page itself.
   */
  if (pathname === LOGIN_PATH) {
    return NextResponse.next()
  }

  /*
   * CASE 3: Visiting any /admin/* path without a valid session.
   * Redirect to /admin/login, preserving the original URL as a
   * `callbackUrl` query parameter for post-login redirect.
   */
  if (!isAuthenticated) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    /*
     * Preserve the attempted URL so after login we can redirect back.
     * Example: /admin/bikes → /admin/login?callbackUrl=%2Fadmin%2Fbikes
     * A-05 (withAdminAuth) or the login page can read this param to redirect.
     */
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  /*
   * CASE 4: Authenticated request to /admin/*.
   * Allow through — the admin panel renders normally.
   */
  return NextResponse.next()
}

// ---------------------------------------------------------------------------
// tryGetSession — Edge-safe session decryption
// ---------------------------------------------------------------------------

/*
 * tryGetSession — attempts to unseal the session cookie.
 *
 * Returns the SessionData object if successful.
 * Returns null if:
 *   - cookieValue is undefined (no cookie)
 *   - SESSION_SECRET is missing or too short
 *   - Cookie is expired, tampered, or malformed
 *   - Any other error
 *
 * unsealData() from iron-session uses the Web Crypto API internally
 * and is safe to use on the Edge Runtime.
 */
async function tryGetSession(
  cookieValue: string | undefined,
): Promise<SessionData | null> {
  if (!cookieValue) {
    return null
  }

  const secret = process.env.SESSION_SECRET

  if (!secret || secret.length < 32) {
    /*
     * Secret missing or too short — cannot unseal.
     * Log in development; silent in production to avoid exposing config.
     */
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[A-04] SESSION_SECRET is missing or too short. ' +
          'Admin routes will reject all requests until it is set.',
      )
    }
    return null
  }

  try {
    /*
     * unsealData<T>(sealedData, options) — Edge-compatible decryption.
     * password: the same secret used in sessionOptions (session.ts).
     * ttl: must match the ttl in sessionOptions for expiry validation.
     *
     * TTL here = 7 days in seconds, matching SESSION_TTL in session.ts.
     * If the cookie was sealed with a different TTL, unseal will fail.
     */
    const session = await unsealData<SessionData>(cookieValue, {
      password: secret,
      ttl: 60 * 60 * 24 * 7,
    })

    return session
  } catch {
    /*
     * unsealData throws on:
     *   - Wrong password (secret mismatch)
     *   - Expired session (TTL exceeded)
     *   - Tampered cookie (HMAC mismatch)
     *   - Malformed cookie data
     *
     * All treated as "not authenticated" — redirect to login.
     */
    return null
  }
}

// ---------------------------------------------------------------------------
// Matcher config
// ---------------------------------------------------------------------------

/*
 * matcher — tells Next.js which paths this middleware runs on.
 *
 * Only runs on /admin/* paths.
 * Excludes:
 *   - Public routes (/, /bikes/*, /brands/*, etc.)
 *   - API routes (/api/*) — these have their own auth checks in A-03
 *   - Static assets (_next/static, _next/image, favicon.ico)
 *
 * '/admin/:path*' matches:
 *   /admin          → dashboard
 *   /admin/login    → login page (handled as special case above)
 *   /admin/bikes    → bike list
 *   /admin/bikes/new → new bike form
 *   etc.
 */
export const config = {
  matcher: ['/admin/:path*'],
}