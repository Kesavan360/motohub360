/*
 * POST /api/admin/login — Admin login endpoint.
 *
 * MPD Task A-03:
 *   "Login route: validates email + password against Admin collection.
 *   On success: sets iron-session cookie. On failure: 401."
 *
 * REQUEST BODY:
 *   { email: string, password: string }
 *
 * RESPONSE (success):
 *   200 { ok: true, admin: { id, email, name, role } }
 *   Sets iron-session cookie in the response.
 *
 * RESPONSE (failure):
 *   400 { error: 'Missing credentials' }
 *   401 { error: 'Invalid email or password' }
 *   403 { error: 'Account is disabled' }
 *   500 { error: 'Login failed. Please try again.' }
 *
 * SECURITY:
 *   - Constant-time password comparison via bcryptjs.compare().
 *   - Generic 401 message on failure (does not reveal whether email exists).
 *   - passwordHash explicitly selected via .select('+passwordHash').
 *   - lastLoginAt updated on successful authentication.
 *   - All responses: Cache-Control: no-store.
 *
 * BRUTE FORCE:
 *   No rate limiting in V1 — the admin panel is not publicly accessible
 *   and accounts are created manually. A-04 middleware adds an
 *   additional layer of protection in production.
 *   Future: add rate limiting middleware (e.g. Upstash Redis).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import connectDB from '@/lib/db/mongodb'
import Admin from '@/lib/db/models/Admin'
import {
  sessionOptions,
  validateSessionSecret,
  type SessionData,
} from '@/lib/session'

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  /*
   * No-cache headers on all responses — login must never be cached.
   */
  const noCache = { 'Cache-Control': 'no-store' }

  try {
    /*
     * Validate SESSION_SECRET at runtime.
     * Fails fast with a clear error message if misconfigured.
     */
    validateSessionSecret()

    // ── Parse request body ──────────────────────────────────────────

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400, headers: noCache },
      )
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Missing credentials.' },
        { status: 400, headers: noCache },
      )
    }

    const { email, password } = body as {
      email?: unknown
      password?: unknown
    }

    if (
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400, headers: noCache },
      )
    }

    const sanitisedEmail = email.trim().toLowerCase()

    // ── Connect to DB ───────────────────────────────────────────────

    await connectDB()

    // ── Find admin by email ─────────────────────────────────────────

    /*
     * .select('+passwordHash') — explicitly includes the field
     * excluded by DB-04 schema select:false.
     * Without this, verifyPassword() throws a guard error.
     */
    const admin = await Admin.findOne({
      email: sanitisedEmail,
    }).select('+passwordHash')

    /*
     * Use a generic error message for both "not found" and "wrong password"
     * to prevent email enumeration attacks.
     */
    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401, headers: noCache },
      )
    }

    // ── Check account is active ─────────────────────────────────────

    if (!admin.isActive) {
      return NextResponse.json(
        { error: 'This account has been disabled.' },
        { status: 403, headers: noCache },
      )
    }

    // ── Verify password ─────────────────────────────────────────────

    /*
     * bcryptjs.compare() — constant-time comparison.
     * Returns false (never throws) on mismatch.
     */
    const isPasswordValid = await admin.verifyPassword(password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401, headers: noCache },
      )
    }

    // ── Set iron-session cookie ─────────────────────────────────────

    /*
     * getIronSession() reads/writes the cookie jar.
     * await cookies() returns the Next.js cookie store.
     * Setting session.admin and calling session.save() encrypts
     * the session data and sets the cookie in the response.
     */
    const session = await getIronSession<SessionData>(
      await cookies(),
      sessionOptions,
    )

    session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role: admin.role,
    }

    await session.save()

    // ── Update lastLoginAt ──────────────────────────────────────────

    /*
     * Fire-and-forget — don't block the login response on this update.
     * lastLoginAt is for audit purposes; a failure here must not
     * prevent the user from logging in.
     */
    Admin.updateOne(
      { _id: admin._id },
      { $set: { lastLoginAt: new Date() } },
    ).catch(() => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[A-03] Failed to update lastLoginAt')
      }
    })

    // ── Return success ──────────────────────────────────────────────

    if (process.env.NODE_ENV === 'development') {
      console.log(`[A-03] Admin logged in: ${admin.email}`)
    }

    return NextResponse.json(
      {
        ok: true,
        admin: {
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
      { status: 200, headers: noCache },
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/admin/login] Error:', error)
    }

    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500, headers: noCache },
    )
  }
}