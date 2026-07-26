/*
 * session.ts — iron-session configuration for MotoHub360 admin.
 *
 * MPD Task A-03:
 *   "Session management: iron-session (cookie-based, encrypted).
 *   Session persists for 7 days."
 *
 * MPD Section 8, Technical Architecture — Admin Auth:
 *   "Admin authentication: email + password (bcryptjs hash, cost 12).
 *   Session management: iron-session (cookie-based, encrypted).
 *   Single admin user for V1 (the founder). Role field reserved for
 *   future multi-admin expansion."
 *
 * HOW iron-session WORKS:
 *   iron-session stores encrypted session data in an HTTP-only cookie.
 *   The encryption key is SESSION_SECRET from .env.local.
 *   The cookie is never readable by JavaScript (httpOnly: true).
 *   The session data is HMAC-signed to prevent tampering.
 *   On each admin request, getIronSession() decrypts and validates the cookie.
 *
 * SESSION DATA:
 *   Only the minimal admin info needed for auth checks is stored:
 *     id:    admin._id.toString() — for DB lookups if needed
 *     email: for display in the admin header
 *     name:  for display in the admin panel
 *     role:  for future role-based access control
 *
 *   Passwords are NEVER stored in the session.
 *
 * COOKIE SECURITY:
 *   httpOnly: true  — JavaScript cannot read the cookie (XSS protection)
 *   secure: true    — cookie only sent over HTTPS in production
 *   sameSite: 'lax' — protects against CSRF on navigation
 *   maxAge: 7 days  — session persists across browser restarts
 *
 * SESSION_SECRET REQUIREMENTS:
 *   Minimum 32 characters (iron-session enforces this).
 *   Should be a cryptographically random string.
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Store only in .env.local (never commit to version control).
 *
 * USAGE:
 *   import { getIronSession } from 'iron-session'
 *   import { cookies } from 'next/headers'
 *   import { sessionOptions, type SessionData } from '@/lib/session'
 *
 *   const session = await getIronSession<SessionData>(
 *     await cookies(),
 *     sessionOptions,
 *   )
 *
 *   if (!session.admin) {
 *     // not authenticated
 *   }
 */

import type { SessionOptions } from 'iron-session'
import type { AdminRole } from '@/lib/db/models/Admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * AdminSessionData — the admin info stored in the iron-session cookie.
 * Matches IAdminSession from DB-04 Admin.ts.
 * Imported here to keep session.ts independent of the Mongoose model.
 */
export interface AdminSessionData {
  id: string       // admin._id.toString()
  email: string
  name: string
  role: AdminRole
}

/*
 * SessionData — the full shape of the iron-session payload.
 * `admin` is optional: undefined means not authenticated.
 */
export interface SessionData {
  admin?: AdminSessionData
}

// ---------------------------------------------------------------------------
// Session options
// ---------------------------------------------------------------------------

/*
 * SESSION_COOKIE_NAME — the name of the session cookie.
 * Namespaced to prevent collision with other apps on the same origin.
 */
const SESSION_COOKIE_NAME = 'motohub360-admin-session'

/*
 * SESSION_TTL — session lifetime in seconds.
 * 7 days = 60 * 60 * 24 * 7 = 604800 seconds.
 * Per MPD: "Session persists for 7 days."
 */
const SESSION_TTL = 60 * 60 * 24 * 7

/*
 * sessionOptions — iron-session configuration.
 *
 * password: SESSION_SECRET from .env.local.
 *   Must be at least 32 characters.
 *   iron-session throws at runtime if shorter.
 *
 * cookieName: unique name for the admin session cookie.
 *
 * ttl: session lifetime in seconds. iron-session also sets
 *   the cookie maxAge to this value.
 *
 * cookieOptions:
 *   httpOnly: true — prevents XSS cookie theft.
 *   secure: production only — prevents cookie over HTTP in dev.
 *   sameSite: 'lax' — CSRF protection on form submissions.
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? '',
  cookieName: SESSION_COOKIE_NAME,
  ttl: SESSION_TTL,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_TTL - 60, // slightly less than TTL per iron-session recommendation
  },
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/*
 * validateSessionSecret — checks SESSION_SECRET at runtime.
 * Called by login route to give a clear error when secret is missing.
 * iron-session throws an opaque error if the password is too short.
 */
export function validateSessionSecret(): void {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      '[MotoHub360] SESSION_SECRET is not set.\n' +
        'Add to .env.local:\n' +
        'SESSION_SECRET=<at least 32 random characters>\n' +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  if (secret.length < 32) {
    throw new Error(
      `[MotoHub360] SESSION_SECRET must be at least 32 characters (currently ${secret.length}).`,
    )
  }
}