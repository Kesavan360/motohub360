/*
 * /api/bikes/[id] â€” Single bike REST API.
 *
 * MPD Task DB-06:
 *   "GET /api/bikes/[id] â€” returns full bike document.
 *   PUT /api/bikes/[id] â€” updates bike.
 *   DELETE /api/bikes/[id] â€” deletes bike.
 *   All mutations require admin auth."
 *
 * MPD Section 8, Technical Architecture â€” API Routes:
 *   "GET routes: public, cached at CDN where appropriate.
 *   POST/PUT/DELETE routes: admin-auth-protected."
 *
 * â”€â”€â”€ ROUTE PARAMETER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * The [id] segment accepts either:
 *   1. A MongoDB ObjectId string (24-char hex): "64f1a2b3c4d5e6f7a8b9c0d1"
 *   2. A bike slug string:                      "royal-enfield-gt-650"
 *
 * ID detection: if [id] matches the ObjectId hex pattern, query by _id.
 * Otherwise, query by slug. This allows both the admin panel (which uses
 * _id) and the bike detail page (which uses slug) to use the same endpoint.
 *
 * â”€â”€â”€ GET /api/bikes/[id] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Returns the full bike document including specs, gallery, colors, seo.
 * No projection â€” the detail page (B-xx) needs all fields.
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
 * â”€â”€â”€ PUT /api/bikes/[id] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Accepts a partial bike update (Partial<IBikeInput>).
 * Only provided fields are updated â€” uses $set semantics.
 * Returns the updated bike document.
 *
 * Admin auth required (A-04 placeholder â€” returns 501 in production).
 *
 * Response:
 *   { bike: IBike } with status 200
 *   { error: string } with status 400 for validation errors
 *   { error: string } with status 404 if bike not found
 *   { error: string } with status 409 for slug conflicts
 *
 * â”€â”€â”€ DELETE /api/bikes/[id] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Permanently deletes the bike document from MongoDB.
 * This is a hard delete â€” no soft-delete in V1.
 * Admin auth required (A-04 placeholder â€” returns 501 in production).
 *
 * Response:
 *   { message: string } with status 200
 *   { error: string } with status 404 if bike not found
 *
 * â”€â”€â”€ AUTH PLACEHOLDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * PUT and DELETE return 501 in production until A-04 implements
 * iron-session admin authentication. In development, mutations are
 * allowed without auth to support DB-10 seed script operations.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import type { IBikeInput } from '@/lib/db/models/Bike'
import { buildBikeQuery } from '@/lib/db/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * RouteContext â€” the context object Next.js passes to App Router
 * route handlers. params contains the dynamic route segments.
 *
 * params is typed as Promise<{ id: string }> per Next.js 15+
 * async params convention.
 */
interface RouteContext {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------

/*
 * handleMongooseError â€” converts Mongoose errors to HTTP responses.
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
   * Mongoose ValidationError â€” invalid field values.
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
   * Generic server error â€” safe message, no internal details.
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

    // â”€â”€ Validate id param â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // â”€â”€ Fetch bike document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /*
     * Find the bike by _id or slug.
     *
     * Public access (no auth): only published bikes.
     * Authenticated admins may also fetch draft bikes.
     */
    const adminSession = await getAdminSession()
    const statusFilter = adminSession ? {} : { status: 'published' as const }

    const bike = await Bike.findOne({
      ...query,
      ...statusFilter,
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
  const adminSession = await getAdminSession()

  if (!adminSession) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin session required.' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  try {
    await connectDB()

    const { id } = await context.params

    // â”€â”€ Validate id param â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // â”€â”€ Parse request body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Reject immutable fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /*
     * _id and __v must never be updated directly.
     * Silently remove them from the update payload rather than
     * returning an error â€” this is the most defensive approach.
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

    // â”€â”€ Update bike document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /*
     * findOneAndUpdate with:
     *   $set: mutablePayload â€” only update the provided fields
     *   new: true â€” return the updated document (not the original)
     *   runValidators: true â€” run Mongoose schema validators on update
     *   context: 'query' â€” required for validators to work on update ops
     *
     * We do NOT use `overwrite: true` â€” partial updates ($set) are
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
  const adminSession = await getAdminSession()

  if (!adminSession) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin session required.' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  try {
    await connectDB()

    const { id } = await context.params

    // â”€â”€ Validate id param â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const query = buildBikeQuery(id)

    if (!query) {
      return NextResponse.json(
        { error: 'Invalid bike identifier.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // â”€â”€ Delete bike document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /*
     * findOneAndDelete returns the deleted document.
     * If null is returned, the bike was not found.
     *
     * Hard delete â€” no soft-delete in V1.
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


