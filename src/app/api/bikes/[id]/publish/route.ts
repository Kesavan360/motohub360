/*
 * /api/bikes/[id]/publish — Bike publish/unpublish with ISR revalidation.
 *
 * MPD Task DB-07:
 *   "POST /api/bikes/[id]/publish — sets status:'published', triggers
 *   ISR revalidation via revalidatePath. Admin auth required."
 *
 * MPD Section 8, Technical Architecture — Rendering:
 *   "ISR (Incremental Static Regeneration) — listing pages and bike
 *   detail pages are statically generated. When a new bike is published,
 *   the admin triggers revalidation via the publish API route, which
 *   calls Next.js revalidatePath() to regenerate the affected pages
 *   without a full redeploy."
 *
 * MPD Section 8, Rendering Strategy (per route):
 *   /brands/[brand]     → ISR (1hr) — rebuild on bike publish
 *   /category/[cat]     → ISR (1hr) — rebuild on bike publish
 *   /price/[range]      → ISR (1hr) — rebuild on bike publish
 *   /bikes/[brand]/[slug] → ISR (5min) — rebuild on bike update
 *   /search             → SSR (force-dynamic) — always fresh
 *
 * ─── POST /api/bikes/[id]/publish ─────────────────────────────────
 *
 * Publishes a bike:
 *   1. Validates admin auth (A-04 placeholder)
 *   2. Finds the bike by _id or slug
 *   3. Validates it is currently a draft
 *   4. Sets status: 'published', publishedAt: new Date()
 *   5. Saves the document (triggers pre-save hook in DB-02)
 *   6. Calls revalidatePath() for all affected ISR pages
 *   7. Returns the updated bike + list of revalidated paths
 *
 * ─── DELETE /api/bikes/[id]/publish ───────────────────────────────
 *
 * Unpublishes a bike:
 *   1. Validates admin auth (A-04 placeholder)
 *   2. Finds the bike by _id or slug
 *   3. Validates it is currently published
 *   4. Sets status: 'draft', publishedAt: null
 *   5. Saves the document
 *   6. Calls revalidatePath() to purge cached pages
 *   7. Returns the updated bike + list of revalidated paths
 *
 * ─── ISR REVALIDATION PATHS ───────────────────────────────────────
 *
 * When a bike is published/unpublished, the following paths are
 * revalidated so that the Next.js ISR cache is purged and rebuilt:
 *
 *   /bikes/[brandSlug]/[slug]        — the bike's detail page
 *   /brands/[brandSlug]              — the brand listing page
 *   /category/[category]             — the category listing page
 *   /price/under-1-lakh              — all price range pages
 *   /price/1-2-lakh                    (bike may appear in any range)
 *   /price/2-5-lakh
 *   /price/above-5-lakh
 *   /brands                          — the all-brands hub page
 *   /                                — the home page (featured bikes)
 *
 * revalidatePath() is called with layout='page' for page-level
 * revalidation (not layout-level). This ensures only the specific
 * page is rebuilt, not all pages sharing the same layout.
 *
 * ─── IDEMPOTENCY ──────────────────────────────────────────────────
 *
 * POST on an already-published bike: returns 409 Conflict.
 * DELETE on an already-draft bike: returns 409 Conflict.
 * This prevents accidental double-publish or double-unpublish.
 *
 * ─── AUTH PLACEHOLDER ─────────────────────────────────────────────
 *
 * Returns 501 Not Implemented in production until A-04.
 * In development, operations are allowed without auth.
 *
 * ─── REVALIDATION SECRET ──────────────────────────────────────────
 *
 * In production, the revalidate endpoint is called via the
 * REVALIDATE_SECRET environment variable to allow external triggers
 * (e.g. from the admin panel running separately). For internal calls
 * (from this route handler), no secret is needed — revalidatePath()
 * runs server-side in the same Next.js process.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import mongoose from 'mongoose'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { PRICE_RANGE_SLUGS } from '@/constants/priceRanges'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * OBJECT_ID_REGEX — matches a valid MongoDB ObjectId (24 hex characters).
 * Duplicated from DB-06 to keep this route handler self-contained.
 * If this logic grows, extract to @/lib/db/utils.ts.
 */
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>
}

interface PublishResult {
  bike: {
    _id: string
    slug: string
    brandSlug: string
    name: string
    status: string
    publishedAt: Date | null
  }
  revalidatedPaths: string[]
  message: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * buildBikeQuery — identical to DB-06 helper.
 * Kept local to avoid a shared utility import until DB-08+ warrants it.
 */
function buildBikeQuery(
  id: string,
): { _id: mongoose.Types.ObjectId } | { slug: string } | null {
  const trimmed = id.trim()

  if (OBJECT_ID_REGEX.test(trimmed)) {
    return { _id: new mongoose.Types.ObjectId(trimmed) }
  }

  if (trimmed.length > 0) {
    return { slug: trimmed.toLowerCase() }
  }

  return null
}

/*
 * isAdminAuthenticated — A-04 placeholder.
 * See DB-06 for full documentation of this pattern.
 *
 * A-04 INTEGRATION POINT:
 *   Replace with iron-session check identical to DB-06.
 */
function isAdminAuthenticated(): boolean {
  return process.env.NODE_ENV === 'development'
}

/*
 * buildRevalidationPaths — returns all Next.js paths that need
 * revalidation when a bike's publish status changes.
 *
 * Called for both publish (POST) and unpublish (DELETE) operations
 * because the same set of pages are affected in both cases.
 *
 * @param brandSlug  — the bike's brand (e.g. "royal-enfield")
 * @param bikeSlug   — the bike's slug  (e.g. "gt-650")
 * @param category   — the bike's category (e.g. "cruiser")
 * @returns           array of Next.js path strings to revalidate
 */
function buildRevalidationPaths(
  brandSlug: string,
  bikeSlug: string,
  category: string,
): string[] {
  return [
    /*
     * Bike detail page — the most specific path.
     * Rebuilt to reflect new published status and publishedAt timestamp.
     */
    `/bikes/${brandSlug}/${bikeSlug}`,

    /*
     * Brand listing page — bike appears or disappears from the grid.
     */
    `/brands/${brandSlug}`,

    /*
     * Category listing page — bike appears or disappears.
     */
    `/category/${category}`,

    /*
     * All price range listing pages.
     * We revalidate all ranges because we don't know which price range
     * this bike falls into without querying the price — it's cheaper to
     * revalidate all 4 price pages than to add another DB query here.
     * Price range pages are fast to rebuild (static data + ISR).
     */
    ...PRICE_RANGE_SLUGS.map((slug) => `/price/${slug}`),

    /*
     * All brands hub page — bike count may change.
     */
    '/brands',

    /*
     * Home page — featured bikes section may update.
     * BikeHero and Browse sections reflect published bike count.
     */
    '/',
  ]
}

/*
 * revalidateAllPaths — calls revalidatePath for each path in the array.
 *
 * Uses 'page' type (not 'layout') to revalidate only the specific page,
 * not all pages sharing the same layout.
 *
 * revalidatePath() is synchronous in Next.js 14+ — it schedules the
 * revalidation to occur on the next request to that path. The path is
 * marked stale immediately; it is rebuilt when first requested.
 *
 * Returns the list of paths that were revalidated (for the API response).
 */
function revalidateAllPaths(paths: string[]): string[] {
  paths.forEach((path) => {
    revalidatePath(path, 'page')
  })
  return paths
}

// ---------------------------------------------------------------------------
// POST /api/bikes/[id]/publish — Publish a bike
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  /*
   * AUTH CHECK — A-04 placeholder.
   */
  if (!isAdminAuthenticated()) {
    return NextResponse.json(
      {
        error:
          'Admin authentication is not yet implemented. ' +
          'POST /api/bikes/[id]/publish will be available after A-04.',
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

    // ── Find the bike — any status (admin can publish drafts) ───────

    const bike = await Bike.findOne(query)

    if (!bike) {
      return NextResponse.json(
        { error: 'Bike not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Idempotency check ───────────────────────────────────────────

    if (bike.status === 'published') {
      return NextResponse.json(
        {
          error: `Bike "${bike.name}" is already published.`,
          bike: {
            _id: bike._id,
            slug: bike.slug,
            brandSlug: bike.brandSlug,
            name: bike.name,
            status: bike.status,
            publishedAt: bike.publishedAt,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Publish the bike ────────────────────────────────────────────

    /*
     * Set status to 'published'.
     * The pre-save hook in Bike.ts (DB-02) automatically sets
     * publishedAt = new Date() when status changes to 'published'.
     *
     * We use .save() here (not findOneAndUpdate) so the pre-save
     * middleware fires. This is intentional — the middleware handles
     * publishedAt correctly for all publish scenarios.
     */
    bike.status = 'published'
    await bike.save()

    // ── Trigger ISR revalidation ────────────────────────────────────

    const paths = buildRevalidationPaths(
      bike.brandSlug,
      bike.slug,
      bike.category,
    )

    const revalidatedPaths = revalidateAllPaths(paths)

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[DB-07] Published "${bike.name}". Revalidated ${revalidatedPaths.length} paths.`,
      )
    }

    const result: PublishResult = {
      bike: {
        _id: bike._id.toString(),
        slug: bike.slug,
        brandSlug: bike.brandSlug,
        name: bike.name,
        status: bike.status,
        publishedAt: bike.publishedAt,
      },
      revalidatedPaths,
      message: `"${bike.name}" published successfully. ${revalidatedPaths.length} pages revalidated.`,
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/bikes/[id]/publish] Error:', error)
    }

    return NextResponse.json(
      { error: 'Failed to publish bike. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/bikes/[id]/publish — Unpublish a bike
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  /*
   * AUTH CHECK — A-04 placeholder.
   */
  if (!isAdminAuthenticated()) {
    return NextResponse.json(
      {
        error:
          'Admin authentication is not yet implemented. ' +
          'DELETE /api/bikes/[id]/publish will be available after A-04.',
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

    // ── Find the bike ───────────────────────────────────────────────

    const bike = await Bike.findOne(query)

    if (!bike) {
      return NextResponse.json(
        { error: 'Bike not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── Idempotency check ───────────────────────────────────────────

    if (bike.status === 'draft') {
      return NextResponse.json(
        {
          error: `Bike "${bike.name}" is already a draft.`,
          bike: {
            _id: bike._id,
            slug: bike.slug,
            brandSlug: bike.brandSlug,
            name: bike.name,
            status: bike.status,
            publishedAt: bike.publishedAt,
          },
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    /*
     * Capture slug and category BEFORE updating status.
     * After .save(), we need these values for revalidation.
     * They don't change during unpublish but capturing them before
     * save is more explicit and avoids any confusion.
     */
    const { slug, brandSlug, category, name } = bike

    // ── Unpublish the bike ──────────────────────────────────────────

    /*
     * Set status to 'draft'.
     * The pre-save hook in Bike.ts (DB-02) automatically clears
     * publishedAt = null when status changes to 'draft'.
     */
    bike.status = 'draft'
    await bike.save()

    // ── Trigger ISR revalidation ────────────────────────────────────

    /*
     * Revalidate the same paths as publish.
     * The pages that previously showed this bike must now exclude it.
     * The bike detail page (/bikes/[brandSlug]/[slug]) becomes 404
     * after unpublish — revalidating it ensures the cached 200 is purged.
     */
    const paths = buildRevalidationPaths(brandSlug, slug, category)
    const revalidatedPaths = revalidateAllPaths(paths)

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[DB-07] Unpublished "${name}". Revalidated ${revalidatedPaths.length} paths.`,
      )
    }

    const result: PublishResult = {
      bike: {
        _id: bike._id.toString(),
        slug: bike.slug,
        brandSlug: bike.brandSlug,
        name: bike.name,
        status: bike.status,
        publishedAt: bike.publishedAt,
      },
      revalidatedPaths,
      message: `"${name}" unpublished successfully. ${revalidatedPaths.length} pages revalidated.`,
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[DELETE /api/bikes/[id]/publish] Error:', error)
    }

    return NextResponse.json(
      { error: 'Failed to unpublish bike. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}