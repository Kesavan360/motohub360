/*
 * GET /api/admin/slug-check — Admin-only slug uniqueness check.
 *
 * MPD Task A-08.3:
 *   "URL slug field: auto-generated from name, editable. Async uniqueness
 *   check on blur via debounced API call."
 *
 * REQUEST:
 *   GET /api/admin/slug-check?slug=gt-650
 *   GET /api/admin/slug-check?slug=gt-650&excludeId=64a1b2c3d4e5f6a7b8c9d0e1
 *
 *   slug      — the slug string to check (required)
 *   excludeId — an existing bike's MongoDB _id to exclude from the check.
 *               Required in edit mode so the current bike's own slug
 *               does not trigger a "slug is taken" result.
 *
 * RESPONSE (200):
 *   { available: true }   — no bike with this slug exists (or only the excluded one)
 *   { available: false }  — a different bike already uses this slug
 *
 * RESPONSE (errors):
 *   401 { error: '...' } — not authenticated
 *   400 { error: '...' } — slug query param missing or empty
 *   500 { error: '...' } — unexpected server error
 *
 * AUTH:
 *   This route is under /api/admin/* — requires a valid admin session.
 *   The middleware (A-04) does NOT protect /api/* routes; auth is enforced
 *   explicitly via getAdminSession() (A-05), same pattern as A-07.2.
 *
 * PERFORMANCE:
 *   .select('_id') — fetches only the _id field.
 *   .lean()        — returns a plain object, not a Mongoose document.
 *   .findOne() already returns only the first matching document.; no full collection scan.
 *   Atlas indexes the `slug` field (unique index from DB-02), so this
 *   query is O(1) on the index, not O(n) on the collection.
 *
 * RATE LIMITING:
 *   No explicit rate limiting in V1. The route is admin-only (requires
 *   authenticated session) and called only on debounce (400ms), making
 *   abuse from the admin panel unlikely. Add Upstash rate limiting in V2.
 *
 * CACHE:
 *   Cache-Control: no-store on all responses.
 *   Slug availability must always be current — never served from cache.
 */

import { NextResponse, type NextRequest } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { getAdminSession } from '@/lib/auth'

const NO_CACHE: Record<string, string> = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest): Promise<NextResponse> {

  // ── Auth check ────────────────────────────────────────────────────────
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401, headers: NO_CACHE },
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to read session.' },
      { status: 401, headers: NO_CACHE },
    )
  }

  // ── Parse query params ────────────────────────────────────────────────
  const { searchParams } = request.nextUrl
  const slug =
  searchParams
  .get('slug')
  ?.trim()
  ?.toLowerCase()
  const excludeId = searchParams.get('excludeId')?.trim()

  if (!slug) {
    return NextResponse.json(
      { error: 'slug query parameter is required.' },
      { status: 400, headers: NO_CACHE },
    )
  }

  // ── DB check ──────────────────────────────────────────────────────────
  try {
    await connectDB()

    /*
     * Build the query filter.
     * In edit mode: exclude the current bike's _id so its own slug
     * does not report as taken.
     */
    const filter: Record<string, unknown> = { slug }
    if (excludeId) {
      filter._id = { $ne: excludeId }
    }

    const existing = await Bike.findOne(filter)
      .select('_id')
      .lean<{ _id: unknown }>()

    return NextResponse.json(
      { available: existing === null },
      { status: 200, headers: NO_CACHE },
    )
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[GET /api/admin/slug-check] Error:', err)
    }

    return NextResponse.json(
      { error: 'Failed to check slug availability.' },
      { status: 500, headers: NO_CACHE },
    )
  }
} 