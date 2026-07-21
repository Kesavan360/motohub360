/*
 * GET /api/search/suggest?q=[query]
 *
 * MPD Task SR-07 (initial implementation):
 *   "API route stub at /api/search/suggest. Returns { suggestions: SearchSuggestion[] }."
 *
 * MPD Task DB-09 (this update):
 *   "Wire Atlas Search to /api/search/suggest. Replace mock with real
 *   Atlas Search aggregation pipeline using the 'bikes_search' index.
 *   Fuzzy matching, max 8 results."
 *
 * CHANGES FROM SR-07:
 *   - getMockSuggestions() removed entirely
 *   - SUGGESTION_SOURCE mock data array removed
 *   - connectDB() called before Mongoose operations
 *   - Bike.aggregate(buildSuggestPipeline()) replaces mock filter
 *   - mapToSearchSuggestions() converts Mongoose result to SearchSuggestion[]
 *   - Atlas Search error → fallback to regex query via buildFallbackRegexFilter()
 *   - Development logs include Atlas Search score for relevance debugging
 *
 * ATLAS SEARCH AVAILABILITY:
 *   Atlas Search requires the 'bikes_search' index to be created in
 *   the Atlas UI before this route returns real results. Until the
 *   index is created, Mongoose.aggregate() with $search throws an error.
 *
 *   This route handles that error gracefully:
 *     1. Catches the Atlas Search error
 *     2. Falls back to a regex query on name/brandName/tagline
 *     3. Returns results (less relevant but functional)
 *     4. Logs a warning in development
 *
 *   The fallback ensures the search UI always works even before the
 *   Atlas Search index is configured.
 *
 * CACHING:
 *   Cache-Control: no-store — suggestions must always be fresh.
 *   See SR-07 for full caching rationale.
 */

import { NextResponse, type NextRequest } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import {
  buildSuggestPipeline,
  buildFallbackRegexFilter,
  mapToSearchSuggestions,
  MAX_SUGGESTIONS,
} from '@/lib/db/atlasSearch'
import type { SearchSuggestion } from '@/types/bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_QUERY_LENGTH = 2

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * AtlasSearchAggregateResult — the shape returned by Bike.aggregate()
 * with the Atlas Search pipeline from atlasSearch.ts.
 */
interface AtlasAggregateSearchResult {
  slug: string
  brandSlug: string
  brandName: string
  name: string
  category: string
  score?: number
  heroImageUrl: string
}

// ---------------------------------------------------------------------------
// GET /api/search/suggest
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')

    // ── Validate query parameter ────────────────────────────────────

    if (!q || typeof q !== 'string') {
      return NextResponse.json(
        { error: 'Invalid query', suggestions: [] },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }

    const sanitised = q.trim()

    if (sanitised.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Query too short', suggestions: [] },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }

    // ── Connect to MongoDB ──────────────────────────────────────────

    await connectDB()

    // ── Run Atlas Search aggregation ────────────────────────────────

    let suggestions: SearchSuggestion[] = []

    try {
      /*
       * Build and execute the Atlas Search pipeline.
       * buildSuggestPipeline() selects autocomplete or fuzzy text
       * based on query length (see atlasSearch.ts for strategy).
       */
      const pipeline = buildSuggestPipeline({
        query: sanitised,
        maxResults: MAX_SUGGESTIONS,
      })

      const results = await Bike.aggregate<AtlasAggregateSearchResult>(
        pipeline,
      )
      console.log("Atlas Results:", results)
      if (process.env.NODE_ENV === 'development' && results.length > 0) {
        console.log(
          `[/api/search/suggest] Atlas Search: "${sanitised}" → ${results.length} results`,
          results.map((r) => ({
            name: r.name,
            score: r.score?.toFixed(3),
          })),
        )
      }

      /*
       * Map Mongoose aggregate results to SearchSuggestion shape.
       * Adds accentColor from BRAND_ACCENT_MAP for SR-02 highlighting.
       */
      suggestions = mapToSearchSuggestions(results)
    } catch (atlasError) {
      console.error("Atlas Error:", atlasError)
      /*
       * Atlas Search failed — likely because:
       *   1. The 'bikes_search' index has not been created in Atlas UI yet
       *   2. The index is being built (can take 1–5 minutes for first build)
       *   3. Atlas Search is temporarily unavailable
       *
       * Fall back to a basic regex query.
       * Results are less relevant but the search UI remains functional.
       */
      if (process.env.NODE_ENV === 'development') {
        const errorMessage =
          atlasError instanceof Error
            ? atlasError.message
            : String(atlasError)
        console.warn(
          `[/api/search/suggest] Atlas Search unavailable: ${errorMessage}`,
          '\nFalling back to regex query.',
          '\nTo enable Atlas Search, create the "bikes_search" index in MongoDB Atlas UI.',
        )
      }

      try {
        /*
         * Fallback: basic regex query on name, brandName, tagline.
         * Less relevant than Atlas Search but always works.
         * Capped at MAX_SUGGESTIONS for consistency.
         */
        const filter = buildFallbackRegexFilter(sanitised)

        const fallbackResults = await Bike.find(filter)
          .select('slug brandSlug brandName name category heroImageUrl')
          .limit(MAX_SUGGESTIONS)
          .lean<AtlasAggregateSearchResult[]>()
        console.log("FILTER:", filter)   
        console.log("Fallback Results:", fallbackResults)
        suggestions = mapToSearchSuggestions(fallbackResults)

        if (
          process.env.NODE_ENV === 'development' &&
          fallbackResults.length > 0
        ) {
          console.log(
            `[/api/search/suggest] Fallback regex: "${sanitised}" → ${fallbackResults.length} results`,
          )
        }
      } catch (fallbackError) {
        /*
         * Both Atlas Search AND the fallback failed.
         * Return empty suggestions rather than an error response.
         * The search UI shows "No results" — not a crash.
         */
        if (process.env.NODE_ENV === 'development') {
          console.error(
            '[/api/search/suggest] Fallback query also failed:',
            fallbackError,
          )
        }
        suggestions = []
      }
    }

    return NextResponse.json(
      { suggestions },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    /*
     * Top-level catch — DB connection failure or unexpected error.
     * Returns empty suggestions with 500 status.
     * The search UI shows "No results" — not a crash.
     */
    if (process.env.NODE_ENV === 'development') {
      console.error('[/api/search/suggest] Unexpected error:', error)
    }

    return NextResponse.json(
      { suggestions: [] },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}