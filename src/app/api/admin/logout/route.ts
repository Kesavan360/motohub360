/*
 * POST /api/admin/logout — Admin logout endpoint.
 *
 * MPD Task A-03:
 *   "Logout: destroys the iron-session cookie."
 *
 * RESPONSE:
 *   200 { ok: true }
 *   Cookie cleared in the response (iron-session sets Max-Age: 0).
 *
 * IDEMPOTENT:
 *   Calling logout when not logged in still returns 200.
 *   session.destroy() is safe to call on an empty session.
 *
 * METHOD: POST (not GET).
 *   Logout must be a POST to prevent CSRF via <img src="/logout">.
 *   The login form includes a CSRF-safe POST request.
 */

import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function POST(): Promise<NextResponse> {
  const noCache = { 'Cache-Control': 'no-store' }

  try {
    const session = await getIronSession<SessionData>(
      await cookies(),
      sessionOptions,
    )

    if (process.env.NODE_ENV === 'development' && session.admin) {
      console.log(`[A-03] Admin logged out: ${session.admin.email}`)
    }

    /*
     * session.destroy() clears the session data and sets the cookie
     * to expire immediately (Max-Age: 0) in the response.
     */
    session.destroy()

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: noCache },
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/admin/logout] Error:', error)
    }

    return NextResponse.json(
      { error: 'Logout failed.' },
      { status: 500, headers: noCache },
    )
  }
}