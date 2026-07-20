/*
 * /api/bikes/[id] — Single bike REST API.
 *
 * MPD Task DB-06:
 *   "GET /api/bikes/[id] — returns full bike document.
 *   PUT /api/bikes/[id] — updates bike.
 *   DELETE /api/bikes/[id] — deletes bike.
 *   All mutations require admin auth."
 *
 * MPD Section 8, Technical Architecture — API Routes:
 *   "GET routes: public, cached at CDN where appropriate.
 *   POST/PUT/DELETE routes: admin-auth-protected."
 *
 * ─── ROUTE PARAMETER ──────────────────────────────────────────────
 *
 * The [id] segment accepts either:
 *   1. A MongoDB ObjectId string (24-char hex): "64f1a2b3c4d5e6f7a8b9c0d1"
 *   2. A bike slug string:                      "royal-enfield-gt-650"
 *
 * ID detection: if [id] matches the ObjectId hex pattern, query by _id.
 * Otherwise, query by slug. This allows both the admin panel (which uses
 * _id) and the bike detail page (which uses slug) to use the same endpoint.
 *
 * ─── GET /api/bikes/[id] ──────────────────────────────────────────
 *
 * Returns the full bike document including specs, gallery, colors, seo.
 * No projection — the detail page (B-xx) needs all fields.
 *
 * Public endpoint: published bikes only.
 * Admin endpoint: draft bikes accessible with admin session (A-04).
 *
 * Response:
 *   { bike: IBike } with status 200
 *   { error: string } with status 404 if not found
 *
 * Caching:
 *   Cache-Control: public, s-maxage=300, stale-while-revalidate=600
 *   Bike detail pages are less volatile than listing pages.
 *   5-minute CDN cache, 10-minute stale-while-revalidate.
 *   DB-07 purges this cache when the bike is published/updated.
 *
 * ─── PUT /api/bikes/[id] ──────────────────────────────────────────
 *
 * Accepts a partial bike update (Partial<IBikeInput>).
 * Only provided fields are updated — uses $set semantics.
 * Returns the updated bike document.
 *
 * Admin auth required (A-04 placeholder — returns 501 in production).
 *
 * Response:
 *   { bike: IBike } with status 200
 *   { error: string } with status 400 for validation errors
 *   { error: string } with status 404 if bike not found
 *   { error: string } with status 409 for slug conflicts
 *
 * ─── DELETE /api/bikes/[id] ───────────────────────────────────────
 *
 * Permanently deletes the bike document from MongoDB.
 * This is a hard delete — no soft-delete in V1.
 * Admin auth required (A-04 placeholder — returns 501 in production).
 *
 * Response:
 *   { message: string } with status 200
 *   { error: string } with status 404 if bike not found
 *
 * ─── AUTH PLACEHOLDER ─────────────────────────────────────────────
 *
 * PUT and DELETE return 501 in production until A-04 implements
 * iron-session admin authentication. In development, mutations are
 * allowed without auth to support DB-10 seed script operations.
 */

import { NextResponse, type NextRequest } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import type { IBikeInput } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * OBJECT_ID_REGEX — matches a valid MongoDB ObjectId (24 hex characters).
 * Used to determine whether [id] is an ObjectId or a slug string.
 */
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * RouteContext — the context object Next.js passes to App Router
 * route handlers. params contains the dynamic route segments.
 *
 * params is typed as Promise<{ id: string }> per Next.js 15+
 * async params convention.
 */
interface RouteContext {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * buildBikeQuery — builds a Mongoose filter for a single bike lookup.
 *
 * If id matches ObjectId format → query by _id.
 * Otherwise → query by slug.
 *
 * Returns null if the id is a malformed ObjectId attempt
 * (starts with hex chars but is the wrong length — not a valid slug either).
 */
function buildBikeQuery(
  id: string,
): { _id: mongoose.Types.ObjectId } | { slug: string } | null {
  const trimmed = id.trim()

  if (OBJECT_ID_REGEX.test(trimmed)) {
    /*
     * Valid 24-char hex string — treat as MongoDB ObjectId.
     */
    return { _id: new mongoose.Types.ObjectId(trimmed) }
  }

  /*
   * Not an ObjectId — treat as a slug.
   * Slugs are lowercase kebab-case: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
   * We accept any non-empty string as a potential slug and let
   * Mongoose return null if no document matches.
   */
  if (trimmed.length > 0) {
    return { slug: trimmed.toLowerCase() }
  }

  return null
}

/*
 * isAdminAuthenticated — placeholder for A-04 iron-session check.
 *
 * In development: always returns true (allows mutations without auth).
 * In production: always returns false until A-04 implements real auth.
 *
 * A-04 INTEGRATION POINT:
 *   Replace this function body with:
 *
 *   import { getIronSession } from 'iron-session'
 *   import { cookies } from 'next/headers'
 *   import { sessionOptions } from '@/lib/session'
 *   import type { IAdminSession } from '@/lib/db/models/Admin'
 *
 *   const session = await getIronSession<{ admin?: IAdminSession }>(
 *     await cookies(),
 *     sessionOptions,
 *   )
 *   return session.admin !== undefined
 */
function isAdminAuthenticated(): boolean {
  return process.env.NODE_ENV === 'development'
}

/*
 * handleMongooseError — converts Mongoose errors to HTTP responses.
 * Centralises error handling for PUT and DELETE handlers.
 */
function handleMongooseError(
  error: unknown,
  operation: 'update' | 'delete',
): NextResponse {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[/api/bikes/[id]] ${operation} error:`, error)
  }

  /*
   * Mongoose ValidationError — invalid field values.
   */
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ValidationError' &&
    'errors' in error
  ) {
    const validationErrors = error.errors as Record<
      string,
      { message: string }
    >
    const fieldErrors = Object.fromEntries(
      Object.entries(validationErrors).map(([field, err]) => [
        field,
        err.message,
      ]),
    )
    return NextResponse.json(
      { error: 'Validation failed', fields: fieldErrors },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  /*
   * MongoDB duplicate key error (code 11000).
   * Occurs on PUT when updating slug to a value that already exists.
   */
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 11000
  ) {
    return NextResponse.json(
      { error: 'A bike with this slug already exists.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  /*
   * Generic server error — safe message, no internal details.
   */
  return NextResponse.json(
    {
      error: `Failed to ${operation} bike. Please try again.`,
    },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  )
}

// ---------------------------------------------------------------------------
// GET /api/bikes/[id]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    await connectDB()

    const { id } = await context.params

    // ── Validate id param ───────────────────────────────────────────

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Fetch bike document ─────────────────────────────────────────

    /*
     * Find the bike by _id or slug.
     *
     * Public access (no auth): only published bikes.
     * The status: 'published' filter prevents draft bikes from being
     * accessed without admin auth.
     *
     * A-04 INTEGRATION POINT:
     *   After A-04 is implemented, authenticated admin requests
     *   should be allowed to fetch draft bikes:
     *
     *   const statusFilter = isAdminAuthenticated()
     *     ? {}
     *     : { status: 'published' }
     *   const bike = await Bike.findOne({ ...query, ...statusFilter })
     */
    const bike = await Bike.findOne({
      ...query,
      status: 'published',
    }).lean()

    if (!bike) {
      return NextResponse.json(
        { error: 'Bike not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      { bike },
      {
        status: 200,
        headers: {
          /*
           * Bike detail pages are less volatile than listing pages.
           * 5-minute CDN cache, 10-minute stale-while-revalidate.
           * DB-07 purges on publish/update.
           */
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[GET /api/bikes/[id]] Error:', error)
    }

    return NextResponse.json(
      { error: 'Failed to fetch bike. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/bikes/[id]
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  /*
   * AUTH CHECK — A-04 placeholder.
   * Returns 501 in production. Allows mutations in development.
   */
  if (!isAdminAuthenticated()) {
    return NextResponse.json(
      {
        error:
          'Admin authentication is not yet implemented. ' +
          'PUT /api/bikes/[id] will be available after A-04 is complete.',
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    await connectDB()

    const { id } = await context.params

    // ── Validate id param ───────────────────────────────────────────

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Parse request body ──────────────────────────────────────────

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Reject immutable fields ─────────────────────────────────────

    /*
     * _id and __v must never be updated directly.
     * Silently remove them from the update payload rather than
     * returning an error — this is the most defensive approach.
     */
    const updatePayload = { ...(body as Partial<IBikeInput>) }
    const mutablePayload: Partial<IBikeInput> = Object.fromEntries(
      Object.entries(updatePayload).filter(
        ([key]) => key !== '_id' && key !== '__v',
      ),
    ) as Partial<IBikeInput>

    if (Object.keys(mutablePayload).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Update bike document ────────────────────────────────────────

    /*
     * findOneAndUpdate with:
     *   $set: mutablePayload — only update the provided fields
     *   new: true — return the updated document (not the original)
     *   runValidators: true — run Mongoose schema validators on update
     *   context: 'query' — required for validators to work on update ops
     *
     * We do NOT use `overwrite: true` — partial updates ($set) are
     * safer than full document replacement to prevent accidental data loss.
     */
    const updatedBike = await Bike.findOneAndUpdate(
      query,
      { $set: mutablePayload },
      {
        new: true,
        runValidators: true,
        context: 'query',
      },
    ).lean()

    if (!updatedBike) {
      return NextResponse.json(
        { error: 'Bike not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      { bike: updatedBike },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleMongooseError(error, 'update')
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/bikes/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  /*
   * AUTH CHECK — A-04 placeholder.
   * Returns 501 in production. Allows mutations in development.
   */
  if (!isAdminAuthenticated()) {
    return NextResponse.json(
      {
        error:
          'Admin authentication is not yet implemented. ' +
          'DELETE /api/bikes/[id] will be available after A-04 is complete.',
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    await connectDB()

    const { id } = await context.params

    // ── Validate id param ───────────────────────────────────────────

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Delete bike document ────────────────────────────────────────

    /*
     * findOneAndDelete returns the deleted document.
     * If null is returned, the bike was not found.
     *
     * Hard delete — no soft-delete in V1.
     * Admin must confirm deletion in the UI (A-06) before this fires.
     */
    const deletedBike = await Bike.findOneAndDelete(query).lean()

    if (!deletedBike) {
      return NextResponse.json(
        { error: 'Bike not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      {
        message: `Bike "${deletedBike.name}" deleted successfully.`,
        slug: deletedBike.slug,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleMongooseError(error, 'delete')
  }
}