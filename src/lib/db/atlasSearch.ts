/*
 * atlasSearch.ts — MongoDB Atlas Search utilities for MotoHub360.
 *
 * MPD Task DB-09:
 *   "Wire Atlas Search to /api/search/suggest. Replace mock with real
 *   Atlas Search aggregation pipeline using the 'bikes_search' index.
 *   Fuzzy matching, max 8 results."
 *
 * MPD Section 15, Search Architecture:
 *   "MongoDB Atlas Search (Lucene-based) on the bikes collection.
 *   Index fields: name, tagline, brandName, category.
 *   Fuzzy matching: maxEdits: 1 for queries >= 4 chars.
 *   Results include: slug, brandSlug, brandName, name, accentColor."
 *
 * ATLAS SEARCH INDEX — 'bikes_search':
 *   Before DB-09 can function, create this index in MongoDB Atlas:
 *
 *   Atlas UI → Your Cluster → Search → Create Search Index
 *   Index name: bikes_search
 *   Collection: motohub360.bikes
 *   Index definition (JSON editor):
 *
 *   {
 *     "mappings": {
 *       "dynamic": false,
 *       "fields": {
 *         "name": [
 *           { "type": "string", "analyzer": "lucene.standard" },
 *           { "type": "autocomplete", "tokenization": "edgeGram",
 *             "minGrams": 2, "maxGrams": 10, "foldDiacritics": true }
 *         ],
 *         "tagline": [
 *           { "type": "string", "analyzer": "lucene.standard" }
 *         ],
 *         "brandName": [
 *           { "type": "string", "analyzer": "lucene.standard" },
 *           { "type": "autocomplete", "tokenization": "edgeGram",
 *             "minGrams": 2, "maxGrams": 15, "foldDiacritics": true }
 *         ],
 *         "category": [
 *           { "type": "string", "analyzer": "lucene.keyword" }
 *         ],
 *         "status": [
 *           { "type": "string", "analyzer": "lucene.keyword" }
 *         ]
 *       }
 *     }
 *   }
 *
 * FUZZY MATCHING:
 *   maxEdits: 1 — allow one character substitution/insertion/deletion.
 *   prefixLength: 2 — first 2 characters must match exactly.
 *     This prevents "gt" matching "at" (both differ by 1 char).
 *   Only applied to queries >= 4 characters.
 *   Short queries (2-3 chars) use exact prefix matching via autocomplete.
 *
 * FALLBACK STRATEGY:
 *   If Atlas Search is unavailable (index not created, network error),
 *   falls back to a basic MongoDB regex query on name and brandName.
 *   The fallback is less powerful (no fuzzy, no relevance scoring) but
 *   ensures the search UI never shows an error to the user.
 *
 * RESULT SHAPE:
 *   Each result is a SearchSuggestion from types/bike.ts (S-07):
 *   { type, slug, label, brandSlug, brandName, accentColor }
 */

import type { PipelineStage } from 'mongoose'
import type { SearchSuggestion } from '@/types/bike'
import { BRAND_ACCENT_MAP } from '@/constants/brands'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * ATLAS_SEARCH_INDEX — the name of the Atlas Search index on the bikes collection.
 * Must match the index name created in the Atlas UI exactly (case-sensitive).
 */
export const ATLAS_SEARCH_INDEX = 'bikes_search'

/*
 * MAX_SUGGESTIONS — maximum number of suggestions to return.
 * Matches MAX_SUGGESTIONS in SR-02 SearchSuggestions component.
 */
export const MAX_SUGGESTIONS = 8

/*
 * FUZZY_THRESHOLD — minimum query length before fuzzy matching is applied.
 * Short queries (< 4 chars) use exact prefix matching only.
 * Fuzzy on short queries produces too many irrelevant results.
 */
export const FUZZY_THRESHOLD = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * AtlasSearchResult — the shape of documents returned from the
 * Atlas Search aggregation pipeline before mapping to SearchSuggestion.
 */
interface AtlasSearchResult {
  slug: string
  brandSlug: string
  brandName: string
  name: string
  category: string
  score?: number
  heroImageUrl: string
}

/*
 * SuggestPipelineOptions — options for buildSuggestPipeline().
 */
export interface SuggestPipelineOptions {
  /*
   * query — the search string from the user.
   * Must be >= 2 characters (validated by the route handler).
   */
  query: string

  /*
   * maxResults — maximum number of suggestions to return.
   * Default: MAX_SUGGESTIONS (8).
   */
  maxResults?: number
}

// ---------------------------------------------------------------------------
// Pipeline builder
// ---------------------------------------------------------------------------

/*
 * buildSuggestPipeline — builds the MongoDB Atlas Search aggregation
 * pipeline for the suggest API endpoint.
 *
 * Pipeline stages:
 *   1. $search     — Atlas Search text query with optional fuzzy
 *   2. $match      — filter to published bikes only
 *   3. $limit      — cap at maxResults
 *   4. $project    — return only fields needed for SearchSuggestion
 *   5. $addFields  — add Atlas Search score for debugging (dev only)
 *
 * Query strategy:
 *   query.length < FUZZY_THRESHOLD (4): uses 'autocomplete' operator
 *     on name and brandName fields for prefix matching.
 *     Better for short queries: "GT" matches "GT 650" immediately.
 *
 *   query.length >= FUZZY_THRESHOLD (4): uses 'text' operator with
 *     fuzzy: { maxEdits: 1, prefixLength: 2 } on all indexed fields.
 *     Better for longer queries: "Himal" matches "Himalayan".
 *
 * Both strategies use compound 'should' clauses with boost scores:
 *   name match: higher score (name is the primary identifier)
 *   brandName match: medium score
 *   tagline match: lower score (supplementary context)
 *
 * @param options — SuggestPipelineOptions
 * @returns        PipelineStage[] — MongoDB aggregation pipeline
 */
export function buildSuggestPipeline(
  options: SuggestPipelineOptions,
): PipelineStage[] {
  const { query, maxResults = MAX_SUGGESTIONS } = options
  const useAutocomplete = query.length < FUZZY_THRESHOLD

  /*
   * Atlas Search stage.
   *
   * compound.should — all clauses are optional but ranked by score.
   * Documents matching higher-weight clauses rank higher.
   * A document need only match ONE should clause to be included.
   *
   * For autocomplete: use the autocomplete operator on name + brandName.
   * For fuzzy text: use the text operator on name + tagline + brandName.
   */
  const searchStage: PipelineStage = useAutocomplete
    ? {
        $search: {
          index: ATLAS_SEARCH_INDEX,
          compound: {
            should: [
              /*
               * Name autocomplete — highest priority.
               * "GT" → matches "GT 650", "GT 500" immediately.
               */
              {
                autocomplete: {
                  query,
                  path: 'name',
                  score: { boost: { value: 3 } },
                },
              },
              /*
               * Brand name autocomplete — second priority.
               * "Yam" → matches all Yamaha bikes.
               */
              {
                autocomplete: {
                  query,
                  path: 'brandName',
                  score: { boost: { value: 2 } },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      }
    : {
        $search: {
          index: ATLAS_SEARCH_INDEX,
          compound: {
            should: [
              /*
               * Name fuzzy match — highest priority.
               * "Himalay" → matches "Himalayan 450" (1 missing char).
               */
              {
                text: {
                  query,
                  path: 'name',
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 2,
                  },
                  score: { boost: { value: 3 } },
                },
              },
              /*
               * Brand name fuzzy match — second priority.
               * "Yamha" → matches "Yamaha" (1 char transposition).
               */
              {
                text: {
                  query,
                  path: 'brandName',
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 2,
                  },
                  score: { boost: { value: 2 } },
                },
              },
              /*
               * Tagline fuzzy match — lowest priority.
               * "roadster" → matches "Modern Classic Roadster".
               */
              {
                text: {
                  query,
                  path: 'tagline',
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 2,
                  },
                  score: { boost: { value: 1 } },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      }

  /*
   * $match — filter to published bikes only.
   * Atlas Search does not filter by non-indexed fields automatically.
   * Adding status: 'published' AFTER $search filters out drafts from results.
   *
   * Note: For better performance, the 'status' field is included in the
   * Atlas Search index as a keyword type, allowing it to be used as a
   * filter within the $search stage in future (Atlas Search filter clause).
   * The post-search $match is simpler and correct for V1.
   */
  const matchStage: PipelineStage = {
    $match: { status: 'published' },
  }

  /*
   * $limit — cap results before $project to avoid projecting unnecessary docs.
   */
  const limitStage: PipelineStage = {
    $limit: maxResults,
  }

  /*
   * $project — return only fields needed for SearchSuggestion.
   * Excludes specs, gallery, colors, pricing — large fields not needed here.
   * _id: 0 — we don't need the MongoDB ObjectId in suggestions.
   *
   * searchScore is included in development for debugging relevance.
   */
  const projectStage: PipelineStage =
    process.env.NODE_ENV === 'development'
      ? {
          $project: {
            _id: 0,
            slug: 1,
            brandSlug: 1,
            brandName: 1,
            name: 1,
            category: 1,
            heroImageUrl: 1,
            score: { $meta: 'searchScore' },
          },
        }
      : {
          $project: {
            _id: 0,
            slug: 1,
            brandSlug: 1,
            brandName: 1,
            name: 1,
            category: 1,
          },
        }

  return [searchStage, matchStage, limitStage, projectStage]
}

// ---------------------------------------------------------------------------
// Result mapper
// ---------------------------------------------------------------------------

/*
 * mapToSearchSuggestions — converts Atlas Search result documents to
 * the SearchSuggestion shape expected by the suggest API and SR-02.
 *
 * Adds accentColor from BRAND_ACCENT_MAP (S-08) for SR-02 match highlighting.
 * Falls back to '#15161A' (ink-primary) for unknown brands.
 */
export function mapToSearchSuggestions(
  results: AtlasSearchResult[],
): SearchSuggestion[] {
    return results.map((result) => ({
        type: 'bike',
        slug: result.slug,
        label: result.name,
        brandSlug: result.brandSlug,
        brandName: result.brandName,
        accentColor: BRAND_ACCENT_MAP[result.brandSlug] ?? '#15161A',
        heroImageUrl: result.heroImageUrl,
      }))
}

// ---------------------------------------------------------------------------
// Fallback regex query builder
// ---------------------------------------------------------------------------

/*
 * buildFallbackRegexFilter — builds a basic MongoDB regex filter
 * for use when Atlas Search is unavailable.
 *
 * Used by the route handler's catch block when the Atlas Search
 * aggregation throws an error (e.g. index not yet created).
 *
 * The regex is case-insensitive and matches the query as a substring
 * in name or brandName.
 *
 * This is SIGNIFICANTLY less powerful than Atlas Search:
 *   - No fuzzy matching
 *   - No relevance scoring
 *   - Slower on large collections (no text index, uses collscan or regex index)
 *   - No tagline matching
 *
 * It exists purely as a fallback to prevent the search UI from breaking
 * while the Atlas Search index is being created or is temporarily unavailable.
 */
export function buildFallbackRegexFilter(query: string): object {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escapedQuery, 'i')

  return {
    status: 'published',
    $or: [
      { name: { $regex: regex } },
      { brandName: { $regex: regex } },
      { tagline: { $regex: regex } },
    ],
  }
}