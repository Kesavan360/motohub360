'use client'

/*
 * useSearch — Search state management hook.
 *
 * MPD Task SR-01:
 *   "Custom hook that manages debounced query state, suggestions
 *   array, loading state. Calls /api/search/suggest?q=[query]
 *   with 150ms debounce. Returns { query, setQuery, suggestions,
 *   isLoading, clearSearch }."
 *
 * MPD Task SR-05:
 *   "Persist recent searches to localStorage. Max 5 terms.
 *   De-duplicate on add (most recent first). Clear all button
 *   removes from localStorage."
 *
 * SR-05 CHANGES FROM SR-01:
 *   - Added RECENT_SEARCHES_KEY constant (localStorage key)
 *   - Added MAX_RECENT_SEARCHES constant (5 terms per MPD)
 *   - Added loadRecentSearches() helper — SSR-safe localStorage read
 *   - Added saveRecentSearches() helper — SSR-safe localStorage write
 *   - recentSearches state initialises as [] (SSR safe)
 *   - useEffect on mount reads localStorage and hydrates recentSearches
 *   - addRecentSearch: replaced no-op with localStorage persistence
 *     Deduplicates: if term exists, moves it to front. Caps at MAX_RECENT.
 *   - clearRecentSearches: replaced no-op with localStorage.removeItem
 *
 * ALL SR-01 INTEGRATION POINTS PRESERVED:
 *   - SR-07 fetch integration point comment intact
 *   - All 12 return fields unchanged
 *   - UseSearchReturn interface unchanged (no breaking changes)
 *   - UseSearchOptions interface unchanged
 *
 * SSR SAFETY:
 *   localStorage is only accessed inside useEffect (client-only).
 *   State initialises as [] on both server and client first render.
 *   useEffect hydrates recentSearches from localStorage after mount.
 *   No hydration mismatch because server and client first render are
 *   identical (both use [] as the initial value).
 *
 * DEDUPLICATION STRATEGY:
 *   When addRecentSearch('GT 650') is called and 'GT 650' is already
 *   in recentSearches:
 *     1. Remove the existing occurrence
 *     2. Prepend the new occurrence (most recent first)
 *     3. Slice to MAX_RECENT_SEARCHES
 *   This means the most recently used term always appears at the top.
 *
 * STORAGE ERROR HANDLING:
 *   localStorage can throw in private browsing mode (Safari) or when
 *   storage quota is exceeded. All localStorage access is wrapped in
 *   try/catch. On error: state update still fires (in-memory only),
 *   persistence silently fails. The search UI continues to work.
 *
 * WHY 'use client':
 *   useState, useEffect, useRef, useCallback — all client-only React hooks.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { SearchSuggestion } from '@/types/bike'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * DEBOUNCE_MS — delay before debouncedQuery updates.
 * MPD Section 15: "150ms debounce."
 */
const DEBOUNCE_MS = 150

/*
 * MIN_QUERY_LENGTH — minimum characters before suggestions are fetched.
 * MPD Section 15: "live suggestions (when query >= 2 chars)."
 */
const MIN_QUERY_LENGTH = 2

/*
 * RECENT_SEARCHES_KEY — localStorage key for persisting recent searches.
 * Namespaced with 'motohub360:' to avoid collision with other apps
 * on the same origin.
 */
const RECENT_SEARCHES_KEY = 'motohub360:recent-searches'

/*
 * MAX_RECENT_SEARCHES — maximum number of recent search terms to persist.
 * MPD Section 15: "recent searches (max 5)."
 */
const MAX_RECENT_SEARCHES = 5

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

/*
 * loadRecentSearches — safely reads recent searches from localStorage.
 *
 * Returns [] on any error:
 *   - Server-side rendering (typeof window === 'undefined')
 *   - Private browsing mode (Safari throws on localStorage access)
 *   - Corrupted/invalid JSON in storage
 *   - Storage not available
 *
 * Validates that the stored value is a string array before returning.
 * If the stored value is not a valid string array (e.g. corrupted data),
 * removes the corrupted entry and returns [].
 */
function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) {
      return []
    }

    const parsed: unknown = JSON.parse(stored)

    /*
     * Type guard: validate that parsed value is string[].
     * Protects against corrupted localStorage data from old versions
     * or other apps writing to the same key.
     */
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return (parsed as string[]).slice(0, MAX_RECENT_SEARCHES)
    }

    /*
     * Corrupted data — remove it and start fresh.
     */
    window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    return []
  } catch {
    /*
     * localStorage access threw (private browsing, quota exceeded, etc.).
     * Return empty array — search still works, just without persistence.
     */
    return []
  }
}

/*
 * saveRecentSearches — safely writes recent searches to localStorage.
 *
 * Silently fails on any error (private browsing, quota exceeded, etc.).
 * The in-memory state (recentSearches) is always updated regardless
 * of whether localStorage persistence succeeds.
 */
function saveRecentSearches(searches: string[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(searches),
    )
  } catch {
    /*
     * Silently ignore localStorage errors.
     * The in-memory state remains correct.
     */
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSearchOptions {
  /*
   * debounceMs — override for the debounce delay.
   * Default: 150 (per MPD Section 15).
   */
  debounceMs?: number

  /*
   * minQueryLength — minimum query length before suggestions fetch fires.
   * Default: 2 (per MPD Section 15).
   */
  minQueryLength?: number

  /*
   * onSearch — called when the user submits a search (presses Enter).
   * The consuming component handles navigation to /search?q=[query].
   */
  onSearch?: (query: string) => void
}

export interface UseSearchReturn {
  /*
   * query — the current raw query string.
   * Updated immediately on every keystroke.
   */
  query: string

  /*
   * debouncedQuery — the debounced query string.
   * Updated 150ms after the user stops typing.
   * Drives the suggestions API call (SR-07).
   */
  debouncedQuery: string

  /*
   * setQuery — updates the query state.
   * Triggers the debounce cycle.
   */
  setQuery: (value: string) => void

  /*
   * suggestions — array of search suggestion results.
   * Empty until SR-07 wires the API route.
   */
  suggestions: SearchSuggestion[]

  /*
   * isLoading — true during the debounce window for query >= minQueryLength.
   */
  isLoading: boolean

  /*
   * isFocused — whether the search input has focus.
   */
  isFocused: boolean

  /*
   * setIsFocused — updates focus state from the SearchBar component.
   */
  setIsFocused: (focused: boolean) => void

  /*
   * clearSearch — resets all transient search state.
   * Does NOT clear recentSearches.
   */
  clearSearch: () => void

  /*
   * submitSearch — handles search form submission.
   * Calls onSearch option if provided.
   * Calls addRecentSearch with the submitted term.
   */
  submitSearch: (value?: string) => void

  /*
   * recentSearches — array of recent search terms.
   * Persisted to localStorage (SR-05).
   * Max 5 terms, most recent first.
   * [] on first render (hydrated from localStorage after mount).
   */
  recentSearches: string[]

  /*
   * addRecentSearch — adds a search term to recentSearches.
   * Persists to localStorage (SR-05).
   * Deduplicates: existing term is moved to front.
   * Caps at MAX_RECENT_SEARCHES (5).
   */
  addRecentSearch: (term: string) => void

  /*
   * clearRecentSearches — removes all recent searches.
   * Clears localStorage entry (SR-05).
   */
  clearRecentSearches: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch(
  options: UseSearchOptions = {},
): UseSearchReturn {
  const {
    debounceMs = DEBOUNCE_MS,
    minQueryLength = MIN_QUERY_LENGTH,
    onSearch,
  } = options

  // ── State ─────────────────────────────────────────────────────────────

  const [query, setQueryState] = useState<string>('')
  const [debouncedQuery, setDebouncedQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isFocused, setIsFocusedState] = useState<boolean>(false)

  /*
   * recentSearches — initialises as [] for SSR safety.
   *
   * We do NOT call loadRecentSearches() in the useState initializer
   * because that would run on the server (where localStorage is undefined)
   * AND on the client first render, creating a potential hydration mismatch
   * if the server and client produce different HTML.
   *
   * Instead, we hydrate from localStorage in a useEffect (client-only).
   * Both server and client first renders use [] — no mismatch.
   */
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // ── Refs ──────────────────────────────────────────────────────────────

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Effects ───────────────────────────────────────────────────────────

  /*
   * Hydrate recentSearches from localStorage on mount.
   *
   * This useEffect runs only on the client (after hydration).
   * It reads from localStorage and updates the state.
   * Because this runs after the first render, there is no hydration
   * mismatch — the server rendered [] and the client first render
   * also rendered []. The localStorage values appear after mount.
   */
  useEffect(() => {
    const stored = loadRecentSearches()
    if (stored.length > 0) {
      setRecentSearches(stored)
    }
  }, [])

  /*
   * Cleanup debounce timer on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // ── Callbacks ─────────────────────────────────────────────────────────

  /*
   * setQuery — updates query immediately and starts the debounce cycle.
   */
  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value)

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (value.length < minQueryLength) {
        setDebouncedQuery('')
        setSuggestions([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null

        /*
         * SR-07 INTEGRATION POINT:
         *   When SR-07 is implemented, a useEffect watching debouncedQuery
         *   will call fetch(`/api/search/suggest?q=${debouncedQuery}`)
         *   and update suggestions with the response.
         *
         *   Example (add in SR-07):
         *   useEffect(() => {
         *     if (debouncedQuery.length < minQueryLength) return
         *     let cancelled = false
         *     setIsLoading(true)
         *     fetch(`/api/search/suggest?q=${encodeURIComponent(debouncedQuery)}`)
         *       .then(res => res.json())
         *       .then(data => {
         *         if (!cancelled) {
         *           setSuggestions(data.suggestions ?? [])
         *           setIsLoading(false)
         *         }
         *       })
         *       .catch(() => {
         *         if (!cancelled) {
         *           setSuggestions([])
         *           setIsLoading(false)
         *         }
         *       })
         *     return () => { cancelled = true }
         *   }, [debouncedQuery])
         */
        setDebouncedQuery(value)
        setIsLoading(false)
      }, debounceMs)
    },
    [debounceMs, minQueryLength],
  )

  /*
   * setIsFocused — updates focus state from SearchBar.
   */
  const setIsFocused = useCallback((focused: boolean) => {
    setIsFocusedState(focused)
  }, [])

  /*
   * clearSearch — resets all transient search state.
   * Does NOT clear recentSearches (those persist across searches).
   */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    setQueryState('')
    setDebouncedQuery('')
    setSuggestions([])
    setIsLoading(false)
  }, [])

  /*
   * addRecentSearch — SR-05: localStorage-backed recent search persistence.
   *
   * Algorithm:
   *   1. Trim the term — reject empty strings.
   *   2. De-duplicate: filter out any existing occurrence of the term
   *      (case-sensitive — "GT 650" and "gt 650" are treated as different
   *      terms per the raw user input, consistent with how queries are stored).
   *   3. Prepend the new term (most recent first).
   *   4. Slice to MAX_RECENT_SEARCHES (5) — discard oldest terms.
   *   5. Update state (triggers re-render).
   *   6. Persist to localStorage (saveRecentSearches).
   *
   * Stable useCallback — deps: MAX_RECENT_SEARCHES is a module constant.
   */
  const addRecentSearch = useCallback((term: string): void => {
    const trimmed = term.trim()
    if (!trimmed) {
      return
    }

    setRecentSearches((prev) => {
      /*
       * De-duplicate: remove any existing occurrence of this term.
       * Then prepend the new term (most-recent-first ordering).
       * Finally slice to the maximum allowed count.
       */
      const deduplicated = prev.filter(
        (existing) => existing !== trimmed,
      )
      const next = [trimmed, ...deduplicated].slice(
        0,
        MAX_RECENT_SEARCHES,
      )

      /*
       * Persist to localStorage after computing the new array.
       * saveRecentSearches silently ignores storage errors.
       */
      saveRecentSearches(next)

      return next
    })
  }, [])

  /*
   * clearRecentSearches — SR-05: removes all recent searches.
   * Clears both the React state and the localStorage entry.
   */
  const clearRecentSearches = useCallback((): void => {
    setRecentSearches([])

    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      /*
       * Silently ignore localStorage errors.
       * The in-memory state is already cleared above.
       */
    }
  }, [])

  /*
   * submitSearch — handles search form submission.
   * Calls onSearch option if provided.
   * Calls addRecentSearch with the submitted term (now persisted via SR-05).
   */
  const submitSearch = useCallback(
    (value?: string) => {
      const term = (value ?? query).trim()
      if (!term) return

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      setDebouncedQuery(term)
      setIsLoading(false)

      /*
       * SR-05: addRecentSearch now persists to localStorage.
       * Previously a no-op in SR-01.
       */
      addRecentSearch(term)

      onSearch?.(term)
    },
    [query, onSearch, addRecentSearch],
  )

  // ── Return ────────────────────────────────────────────────────────────

  return {
    query,
    debouncedQuery,
    setQuery,
    suggestions,
    isLoading,
    isFocused,
    setIsFocused,
    clearSearch,
    submitSearch,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  }
}

export default useSearch