/*
 * GET /api/search/suggest?q=[query]
 *
 * MPD Task SR-07:
 *   "API route stub at /api/search/suggest. Accepts ?q=[query].
 *   Returns { suggestions: SearchSuggestion[] }.
 *   DB-09 replaces mock with real Atlas Search aggregation pipeline."
 *
 * MPD Section 15, Search Architecture:
 *   "Client calls GET /api/search/suggest?q=[query] with 150ms debounce.
 *   Response: { suggestions: SearchSuggestion[] }
 *   Each suggestion: { type, slug, label, brandSlug, brandName, accentColor }"
 *
 * RENDERING:
 *   This is a Next.js App Router Route Handler (not a Pages API route).
 *   File location: src/app/api/search/suggest/route.ts
 *   Exported function: GET
 *
 * RESPONSE SHAPE:
 *   {
 *     suggestions: SearchSuggestion[]
 *   }
 *   Each SearchSuggestion:
 *     type:        'bike' | 'brand' | 'category'
 *     slug:        string (bike slug or brand slug)
 *     label:       string (display name — highlighted in SearchSuggestions SR-02)
 *     brandSlug:   string (for accent color lookup)
 *     brandName:   string (shown below the label in the panel)
 *     accentColor: string (hex — used for match highlight in SR-02)
 *
 * VALIDATION:
 *   q must be a non-empty string with length >= 2.
 *   Returns 400 with { error: 'Query too short' } if q.length < 2.
 *   Returns 400 with { error: 'Invalid query' } if q is missing.
 *   Returns 200 with { suggestions: [] } if no matches found.
 *
 * MOCK MATCHING STRATEGY:
 *   Same substring token-matching as SR-06 getMockSearchResults().
 *   Split query into tokens, match bikes where all tokens appear
 *   in the searchable text (name + tagline + brandSlug + category).
 *   Results capped at 8 (MAX_SUGGESTIONS from SR-02).
 *
 * CACHING:
 *   Cache-Control: no-store — suggestions must always be fresh.
 *   Caching suggestions would return stale results after new bikes
 *   are published. Atlas Search (DB-09) always queries live data.
 *
 * CORS:
 *   No CORS headers needed — same-origin requests only.
 *   The API is called from the client hook (useSearch) on the same
 *   Next.js origin.
 *
 * DB-09 REPLACEMENT:
 *   Replace the getMockSuggestions() call with:
 *
 *   import { connectDB } from '@/lib/db/mongodb'
 *   import Bike from '@/lib/db/models/Bike'
 *
 *   await connectDB()
 *   const results = await Bike.aggregate([
 *     {
 *       $search: {
 *         index: 'bikes_search',
 *         text: {
 *           query: sanitisedQuery,
 *           path: ['name', 'tagline', 'brandName'],
 *           fuzzy: { maxEdits: 1 },
 *         },
 *       },
 *     },
 *     { $match: { status: 'published' } },
 *     { $limit: 8 },
 *     {
 *       $project: {
 *         _id: 0,
 *         type: { $literal: 'bike' },
 *         slug: 1,
 *         label: '$name',
 *         brandSlug: 1,
 *         brandName: 1,
 *         accentColor: 1,
 *       },
 *     },
 *   ])
 */

import { NextResponse, type NextRequest } from 'next/server'
import type { SearchSuggestion } from '@/types/bike'
import { BRAND_ACCENT_MAP } from '@/constants/brands'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 8
const MIN_QUERY_LENGTH = 2

// ---------------------------------------------------------------------------
// Mock suggestion data
// ---------------------------------------------------------------------------

/*
 * SUGGESTION_SOURCE — all bikes available for suggestion matching.
 * Each entry maps to a SearchSuggestion shape.
 * DB-09 replaces this with a real MongoDB Atlas Search query.
 */
const SUGGESTION_SOURCE: Array<{
    slug: string
    label: string
    brandSlug: string
    brandName: string
    tagline: string
    category: string
    heroImageUrl: string
}> = [
  { slug: 'gt-650', label: 'GT 650', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'Modern Classic Roadster', category: 'cruiser',heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'classic-350', label: 'Classic 350', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'Timeless Classic', category: 'cruiser', heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'himalayan-450', label: 'Himalayan 450', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'Built for Adventure', category: 'adventure', heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'meteor-350', label: 'Meteor 350', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'Cruise Easy, Live Free', category: 'cruiser', heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'hunter-350', label: 'Hunter 350', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'City Born. Free Spirit.', category: 'naked', heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'continental-gt-650', label: 'Continental GT 650', brandSlug: 'royal-enfield', brandName: 'Royal Enfield', tagline: 'Pure Café Racer', category: 'cruiser', heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'duke-390', label: 'Duke 390', brandSlug: 'ktm', brandName: 'KTM', tagline: 'Ready to Race', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'duke-250', label: 'Duke 250', brandSlug: 'ktm', brandName: 'KTM', tagline: 'Born to Scrap', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'duke-125', label: 'Duke 125', brandSlug: 'ktm', brandName: 'KTM', tagline: 'The Beginning of Fast', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'rc-390', label: 'RC 390', brandSlug: 'ktm', brandName: 'KTM', tagline: 'Track Every Day', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'rc-125', label: 'RC 125', brandSlug: 'ktm', brandName: 'KTM', tagline: 'Race Ready', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'adventure-390', label: 'Adventure 390', brandSlug: 'ktm', brandName: 'KTM', tagline: 'Go Anywhere', category: 'adventure' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'mt-15-v2', label: 'MT-15 V2', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Masters of Torque', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'r15m', label: 'R15M', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Born Racer', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'fz-s-v3', label: 'FZ-S V3', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Street Warrior', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'mt-03', label: 'MT-03', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Dark Side of Japan', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'r3', label: 'R3', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Precision. Power. Pride.', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'fascino-125', label: 'Fascino 125', brandSlug: 'yamaha', brandName: 'Yamaha', tagline: 'Style Redefined', category: 'scooter' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'cb350rs', label: 'CB350RS', brandSlug: 'honda', brandName: 'Honda', tagline: 'Refined Rebel', category: 'cruiser' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'hornet-2-0', label: 'Hornet 2.0', brandSlug: 'honda', brandName: 'Honda', tagline: 'The Evolved Predator', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'cb200x', label: 'CB200X', brandSlug: 'honda', brandName: 'Honda', tagline: 'Your Adventure Begins', category: 'adventure' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'cbr-650r', label: 'CBR 650R', brandSlug: 'honda', brandName: 'Honda', tagline: 'Sport in Every Sense', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'cb500x', label: 'CB500X', brandSlug: 'honda', brandName: 'Honda', tagline: 'Adventure, Your Way', category: 'adventure' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'shine-100', label: 'Shine 100', brandSlug: 'honda', brandName: 'Honda', tagline: 'Everyday Excellence', category: 'cruiser' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'apache-rtr-310', label: 'Apache RTR 310', brandSlug: 'tvs', brandName: 'TVS', tagline: 'Unleash the Beast', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'apache-rr-310', label: 'Apache RR 310', brandSlug: 'tvs', brandName: 'TVS', tagline: 'Race DNA', category: 'sport' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'ronin', label: 'Ronin', brandSlug: 'tvs', brandName: 'TVS', tagline: 'Own Your Road', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'raider-125', label: 'Raider 125', brandSlug: 'tvs', brandName: 'TVS', tagline: 'Daring by Design', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'ntorq-125', label: 'Ntorq 125', brandSlug: 'tvs', brandName: 'TVS', tagline: 'Be the Champ', category: 'scooter' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'jupiter-125', label: 'Jupiter 125', brandSlug: 'tvs', brandName: 'TVS', tagline: 'The Extra Miler', category: 'scooter' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'pulsar-ns400z', label: 'Pulsar NS400Z', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'The Apex Predator', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'dominar-400', label: 'Dominar 400', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'Conquer Every Road', category: 'adventure' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'avenger-street-160', label: 'Avenger Street 160', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'Cruise Boss', category: 'cruiser' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'pulsar-150', label: 'Pulsar 150', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'The Bikes Indians Love', category: 'naked' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'chetak-electric', label: 'Chetak Electric', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'Electric Classic', category: 'scooter' ,heroImageUrl: '/images/placeholder-bike.webp'},
  { slug: 'ct125x', label: 'CT125X', brandSlug: 'bajaj', brandName: 'Bajaj', tagline: 'Tough Commuter', category: 'cruiser' ,heroImageUrl: '/images/placeholder-bike.webp'},
]

// ---------------------------------------------------------------------------
// Mock suggestion matcher
// ---------------------------------------------------------------------------

/*
 * getMockSuggestions — filters SUGGESTION_SOURCE for matching bikes.
 *
 * Matching: all query tokens must appear in the combined searchable
 * text (label + tagline + brandName + category).
 * Case-insensitive substring match.
 * Results capped at MAX_SUGGESTIONS (8).
 *
 * DB-09: replace with Atlas Search aggregation (see route header comment).
 */
function getMockSuggestions(query: string): SearchSuggestion[] {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  if (tokens.length === 0) {
    return []
  }

  const matched = SUGGESTION_SOURCE.filter((bike) => {
    const searchableText = [
      bike.label,
      bike.tagline,
      bike.brandName,
      bike.brandSlug.replace(/-/g, ' '),
      bike.category,
    ]
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => searchableText.includes(token))
  })

  return matched.slice(0, MAX_SUGGESTIONS).map((bike) => ({
    type: 'bike' as const,
    slug: bike.slug,
    label: bike.label,
    brandSlug: bike.brandSlug,
    brandName: bike.brandName,
    accentColor: BRAND_ACCENT_MAP[bike.brandSlug] ?? '#15161A',
    heroImageUrl: bike.heroImageUrl,
 }))
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')

    /*
     * Validate query parameter.
     */
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

    /*
     * Get suggestions — mock in SR-07, Atlas Search in DB-09.
     */
    const suggestions = getMockSuggestions(sanitised)

    return NextResponse.json(
      { suggestions },
      {
        status: 200,
        headers: {
          /*
           * Cache-Control: no-store — suggestions must always be fresh.
           * Prevents CDN/browser from caching stale suggestion lists
           * after new bikes are published.
           */
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    /*
     * Catch-all: log in development, return empty suggestions.
     * Never expose internal error details to the client.
     */
    if (process.env.NODE_ENV === 'development') {
      console.error('[/api/search/suggest] Error:', error)
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