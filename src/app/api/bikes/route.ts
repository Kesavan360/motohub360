/*
 * /api/bikes — Bike collection REST API.
 *
 * MPD Task DB-05:
 *   "GET /api/bikes — returns published bikes with optional filters
 *   (brand, category, price range, sort).
 *   POST /api/bikes — creates new bike (admin auth required)."
 *
 * MPD Section 8, Technical Architecture — API Routes:
 *   "All /api/* routes are Next.js App Router Route Handlers.
 *   GET routes: public, cached at CDN where appropriate.
 *   POST/PUT/DELETE routes: admin-auth-protected (A-04 middleware)."
 *
 * ─── GET /api/bikes ────────────────────────────────────────────────
 *
 * Query parameters (all optional):
 *   brand      string   Filter by brandSlug (e.g. "royal-enfield")
 *   category   string   Filter by category  (e.g. "cruiser")
 *   priceMin   number   Min exShowroom price in INR
 *   priceMax   number   Max exShowroom price in INR
 *   sort       string   "featured" | "price-asc" | "price-desc" |
 *                       "name-asc" | "newest"
 *   page       number   Page number (1-indexed). Default: 1
 *   limit      number   Results per page. Default: 12. Max: 48.
 *   status     string   "published" | "draft" | "all"
 *                       Default: "published" (public API)
 *                       "draft" and "all" require admin auth (A-04)
 *
 * Response shape:
 *   {
 *     bikes: BikeSummary[]
 *     total: number          // total matching documents
 *     page: number           // current page
 *     limit: number          // results per page
 *     totalPages: number     // ceil(total / limit)
 *     hasNextPage: boolean
 *     hasPrevPage: boolean
 *   }
 *
 * ─── POST /api/bikes ───────────────────────────────────────────────
 *
 * Request body: IBikeInput (JSON)
 * Auth: admin session required (A-04 — placeholder check in DB-05)
 * Response: { bike: IBike } with status 201
 *
 * ─── SORT OPTIONS ──────────────────────────────────────────────────
 *   featured:   publishedAt desc (most recently published first)
 *   price-asc:  exShowroom price ascending
 *   price-desc: exShowroom price descending
 *   name-asc:   bike name A–Z
 *   newest:     createdAt desc (most recently created first)
 *
 * ─── VALIDATION ────────────────────────────────────────────────────
 *   Invalid query params return 400 with { error: string }.
 *   Missing required body fields return 400 with { error, fields }.
 *   Mongoose validation errors are caught and returned as 400.
 *   All other errors return 500 with a safe error message.
 *
 * ─── AUTH PLACEHOLDER ──────────────────────────────────────────────
 *   POST requires admin auth. A-04 (middleware) enforces this in
 *   Phase 9. For DB-05, a placeholder comment marks the integration
 *   point. POST returns 501 Not Implemented until A-04 is complete.
 *   This prevents accidentally creating bikes without auth during
 *   the development phase.
 *
 * ─── CACHING ───────────────────────────────────────────────────────
 *   GET: Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 *   This allows Vercel's Edge CDN to cache the response for 60 seconds
 *   and serve stale content for up to 5 minutes while revalidating.
 *   Appropriate for listing pages where slight staleness is acceptable.
 *   DB-07 (ISR trigger) purges the cache on bike publish.
 *
 *   POST: Cache-Control: no-store (mutations must not be cached)
 */

import { NextResponse, type NextRequest } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import type { IBikeInput } from '@/lib/db/models/Bike'
import type { FilterQuery, SortOrder } from 'mongoose'
import type { IBike } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 48

const VALID_SORT_OPTIONS = [
  'featured',
  'price-asc',
  'price-desc',
  'name-asc',
  'newest',
] as const

type SortOption = (typeof VALID_SORT_OPTIONS)[number]

const VALID_CATEGORIES = [
  'cruiser',
  'sport',
  'adventure',
  'naked',
  'scooter',
] as const

type ValidCategory = (typeof VALID_CATEGORIES)[number]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * BikeSummaryProjection — the fields returned in the bikes array.
 * A lightweight projection to keep response payloads small.
 * Full bike details are fetched via GET /api/bikes/[id] (DB-06).
 */
interface BikeSummaryProjection {
  _id: string
  slug: string
  brandSlug: string
  brandName: string
  name: string
  tagline: string
  category: string
  status: string
  pricing: {
    exShowroom: number
    onRoad?: number
  }
  heroImageUrl: string
  blurDataUrl?: string
  publishedAt: Date | null
  createdAt: Date
}

/*
 * PaginatedBikesResponse — shape of the GET /api/bikes response.
 */
interface PaginatedBikesResponse {
  bikes: BikeSummaryProjection[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * buildSortQuery — converts a sort option string to a Mongoose sort object.
 * Returns a Record with field names and sort direction (1 or -1).
 */
function buildSortQuery(
  sort: SortOption,
): Record<string, SortOrder> {
  switch (sort) {
    case 'price-asc':
      return { 'pricing.exShowroom': 1 }
    case 'price-desc':
      return { 'pricing.exShowroom': -1 }
    case 'name-asc':
      return { name: 1 }
    case 'newest':
      return { createdAt: -1 }
    case 'featured':
    default:
      return { publishedAt: -1 }
  }
}

/*
 * parsePaginationParams — parses and validates page + limit from URL params.
 * Returns sanitised { page, limit } or an error string.
 */
function parsePaginationParams(
  pageParam: string | null,
  limitParam: string | null,
): { page: number; limit: number } | { error: string } {
  const page = pageParam ? parseInt(pageParam, 10) : DEFAULT_PAGE
  const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT

  if (isNaN(page) || page < 1) {
    return { error: 'page must be a positive integer' }
  }

  if (isNaN(limit) || limit < 1) {
    return { error: 'limit must be a positive integer' }
  }

  if (limit > MAX_LIMIT) {
    return { error: `limit cannot exceed ${MAX_LIMIT}` }
  }

  return { page, limit }
}

/*
 * isValidCategory — type guard for category query param.
 */
function isValidCategory(value: string): value is ValidCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(value)
}

/*
 * isValidSort — type guard for sort query param.
 */
function isValidSort(value: string): value is SortOption {
  return (VALID_SORT_OPTIONS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// GET /api/bikes
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    await connectDB()

    const { searchParams } = request.nextUrl

    // ── Parse query parameters ──────────────────────────────────────

    const brandParam = searchParams.get('brand')
    const categoryParam = searchParams.get('category')
    const priceMinParam = searchParams.get('priceMin')
    const priceMaxParam = searchParams.get('priceMax')
    const sortParam = searchParams.get('sort') ?? 'featured'
    const statusParam = searchParams.get('status') ?? 'published'
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    // ── Validate sort ───────────────────────────────────────────────

    if (!isValidSort(sortParam)) {
      return NextResponse.json(
        {
          error: `Invalid sort value. Must be one of: ${VALID_SORT_OPTIONS.join(', ')}`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Validate category ───────────────────────────────────────────

    if (categoryParam !== null && !isValidCategory(categoryParam)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Validate price range ────────────────────────────────────────

    let priceMin: number | undefined
    let priceMax: number | undefined

    if (priceMinParam !== null) {
      priceMin = parseInt(priceMinParam, 10)
      if (isNaN(priceMin) || priceMin < 0) {
        return NextResponse.json(
          { error: 'priceMin must be a non-negative integer' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    if (priceMaxParam !== null) {
      priceMax = parseInt(priceMaxParam, 10)
      if (isNaN(priceMax) || priceMax < 0) {
        return NextResponse.json(
          { error: 'priceMax must be a non-negative integer' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    if (
      priceMin !== undefined &&
      priceMax !== undefined &&
      priceMin > priceMax
    ) {
      return NextResponse.json(
        { error: 'priceMin cannot be greater than priceMax' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Validate status ─────────────────────────────────────────────

    /*
     * Public API: only 'published' status is accessible without auth.
     * 'draft' and 'all' require admin session (A-04 enforces this).
     *
     * DB-05 PLACEHOLDER: for now, any request for draft/all returns 403.
     * A-04 middleware will intercept these requests before they reach
     * this handler in Phase 9.
     */
    if (statusParam !== 'published') {
      return NextResponse.json(
        {
          error:
            'Filtering by draft status requires admin authentication.',
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Validate pagination ─────────────────────────────────────────

    const pagination = parsePaginationParams(pageParam, limitParam)
    if ('error' in pagination) {
      return NextResponse.json(
        { error: pagination.error },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { page, limit } = pagination
    const skip = (page - 1) * limit

    // ── Build Mongoose filter query ─────────────────────────────────

    const filter: FilterQuery<IBike> = {
      status: 'published',
    }

    if (brandParam) {
      filter['brandSlug'] = brandParam.toLowerCase().trim()
    }

    if (categoryParam) {
      filter['category'] = categoryParam
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      filter['pricing.exShowroom'] = {}
      if (priceMin !== undefined) {
        filter['pricing.exShowroom']['$gte'] = priceMin
      }
      if (priceMax !== undefined) {
        filter['pricing.exShowroom']['$lte'] = priceMax
      }
    }

    // ── Build sort query ────────────────────────────────────────────

    const sortQuery = buildSortQuery(sortParam)

    // ── Projection — only fields needed for BikeCard / BikeSummary ──

    /*
     * Project only the fields needed for listing pages.
     * Excludes specs, seo, video360Url, colors array (not needed in grid).
     * Full document is fetched via GET /api/bikes/[id] (DB-06).
     */
    const projection = {
      _id: 1,
      slug: 1,
      brandSlug: 1,
      brandName: 1,
      name: 1,
      tagline: 1,
      category: 1,
      status: 1,
      'pricing.exShowroom': 1,
      'pricing.onRoad': 1,
      heroImageUrl: 1,
      blurDataUrl: 1,
      publishedAt: 1,
      createdAt: 1,
    }

    // ── Execute query + count in parallel ───────────────────────────

    /*
     * Run the document query and the count query in parallel.
     * Promise.all reduces total latency vs sequential awaits.
     * countDocuments uses the same filter as the find query.
     */
    const [bikes, total] = await Promise.all([
      Bike.find(filter, projection)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean<BikeSummaryProjection[]>(),
      Bike.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limit)

    const response: PaginatedBikesResponse = {
      bikes,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        /*
         * Cache-Control for listing API responses.
         * s-maxage=60: Vercel Edge CDN caches for 60 seconds.
         * stale-while-revalidate=300: serve stale for 5 min while updating.
         * public: shared caches (CDN) can cache this response.
         *
         * DB-07 (ISR trigger) calls revalidateTag/revalidatePath
         * to purge this cache when a bike is published.
         */
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[GET /api/bikes] Error:', error)
    }

    return NextResponse.json(
      { error: 'Failed to fetch bikes. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/bikes
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  /*
   * AUTH PLACEHOLDER — A-04 integration point.
   *
   * Phase 9 (A-04) adds admin session verification here:
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
   *
   *   if (!session.admin) {
   *     return NextResponse.json(
   *       { error: 'Unauthorized' },
   *       { status: 401, headers: { 'Cache-Control': 'no-store' } },
   *     )
   *   }
   *
   * Until A-04 is implemented, POST returns 501 Not Implemented.
   * This prevents accidental bike creation without authentication
   * during development.
   *
   * DO NOT REMOVE THIS COMMENT — it marks the A-04 integration point.
   */
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      {
        error:
          'Admin authentication is not yet implemented. ' +
          'POST /api/bikes will be available after A-04 is complete.',
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  /*
   * Development-only POST implementation.
   * Allows seed script (DB-10) and admin testing without full auth.
   * This block is unreachable in production (NODE_ENV !== 'development'
   * returns 501 above).
   */
  try {
    await connectDB()

    // ── Parse request body ──────────────────────────────────────────

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Validate required fields ────────────────────────────────────

    const bikeInput = body as Partial<IBikeInput>

    const requiredFields: Array<keyof IBikeInput> = [
      'slug',
      'brandSlug',
      'name',
      'tagline',
      'brandName',
      'category',
      'heroImageUrl',
      'pricing',
      'colors',
    ]

    const missingFields = requiredFields.filter(
      (field) =>
        bikeInput[field] === undefined ||
        bikeInput[field] === null ||
        bikeInput[field] === '',
    )

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          fields: missingFields,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Create bike document ────────────────────────────────────────

    const bike = await Bike.create(bikeInput)

    return NextResponse.json(
      { bike },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/bikes] Error:', error)
    }

    /*
     * Mongoose validation errors — return 400 with field-level details.
     * These occur when the bike input fails schema validation
     * (e.g. invalid category, missing required field, slug format invalid).
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
     * MongoDB duplicate key error (code 11000) — slug already exists.
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

    return NextResponse.json(
      { error: 'Failed to create bike. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}