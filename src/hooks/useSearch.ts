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
 * MPD Section 15, Search Architecture:
 *   "Client calls GET /api/search/suggest?q=[query] with 150ms debounce.
 *   Response: { suggestions: SearchSuggestion[] }.
 *   Suggestions panel shows: recent searches (when query empty),
 *   live suggestions (when query >= 2 chars)."
 *
 * RESPONSIBILITIES OF THIS HOOK (SR-01):
 *   ✅ Query state management
 *   ✅ 150ms debounce on query changes
 *   ✅ Loading state during debounce window
 *   ✅ Focus state management
 *   ✅ clearSearch utility
 *   ✅ Suggestions array (empty until SR-07 wires the API route)
 *   ✅ recentSearches slot (empty array until SR-05 adds persistence)
 *   ✅ addRecentSearch stub (no-op until SR-05)
 *   ✅ Full TypeScript interface — SR-02/SR-03/SR-05/SR-07 extend
 *      without breaking changes
 *
 * RESPONSIBILITIES NOT IN SR-01:
 *   ❌ /api/search/suggest route — SR-07
 *   ❌ SearchSuggestions panel UI — SR-02
 *   ❌ Wiring into Home page SearchBar — SR-03
 *   ❌ localStorage recent search persistence — SR-05
 *
 * DEBOUNCE STRATEGY:
 *   Uses useRef to hold the timeout ID — no external library needed.
 *   On every setQuery call:
 *     1. Update query state immediately (input stays responsive)
 *     2. Set isLoading=true if query is non-empty (shows loading indicator)
 *     3. Clear any existing debounce timeout
 *     4. Start a new 150ms timeout
 *     5. After 150ms: update debouncedQuery (triggers API call in SR-07)
 *        and set isLoading=false
 *   On clearSearch:
 *     1. Cancel any pending debounce timeout
 *     2. Reset all state to initial values
 *
 * MINIMUM QUERY LENGTH:
 *   Suggestions are only fetched when debouncedQuery.length >= 2.
 *   Single-character queries (e.g. "K") produce too many irrelevant
 *   results and waste API calls.
 *   When query.length < 2: suggestions = [], isLoading = false.
 *   Per MPD Section 15: "live suggestions (when query >= 2 chars)."
 *
 * SSR SAFETY:
 *   Hook uses useEffect and useRef — client-only APIs.
 *   'use client' directive ensures it never runs on the server.
 *   No window/localStorage access in hook body or useState initializer.
 *   All browser API access is inside useEffect with proper cleanup.
 *
 * SUGGESTION FETCH (SR-07 INTEGRATION POINT):
 *   The fetch call is clearly marked with a TODO comment block.
 *   SR-07 uncomments and implements the actual fetch.
 *   Until then, suggestions stays as [] and isLoading returns false
 *   immediately after the debounce resolves.
 *
 * RECENT SEARCHES (SR-05 INTEGRATION POINT):
 *   recentSearches is always [] in SR-01.
 *   addRecentSearch is a no-op in SR-01.
 *   SR-05 replaces these with localStorage-backed implementations
 *   without changing the hook's public interface.
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
 * DEBOUNCE_MS — delay in milliseconds before debouncedQuery updates.
 * MPD Section 15: "150ms debounce."
 * Must match the API route's expected call frequency to avoid
 * hammering the Atlas Search endpoint.
 */
const DEBOUNCE_MS = 150

/*
 * MIN_QUERY_LENGTH — minimum characters before suggestions are fetched.
 * MPD Section 15: "live suggestions (when query >= 2 chars)."
 */
const MIN_QUERY_LENGTH = 2

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSearchOptions {
  /*
   * debounceMs — override for the debounce delay.
   * Default: 150 (DEBOUNCE_MS constant, per MPD Section 15).
   * Set lower in tests for faster verification.
   */
  debounceMs?: number

  /*
   * minQueryLength — minimum query length before suggestions fetch fires.
   * Default: 2 (MIN_QUERY_LENGTH constant, per MPD Section 15).
   */
  minQueryLength?: number

  /*
   * onSearch — called when the user submits a search (presses Enter).
   * The consuming component (Home page, SR-03) handles navigation to
   * /search?q=[query]. This callback is optional — the hook does not
   * navigate itself to preserve separation of concerns.
   */
  onSearch?: (query: string) => void
}

export interface UseSearchReturn {
  /*
   * query — the current raw query string.
   * Updated immediately on every keystroke.
   * Bind this to the SearchBar's value prop.
   */
  query: string

  /*
   * debouncedQuery — the debounced query string.
   * Updated 150ms after the user stops typing.
   * This is what triggers the suggestions API call (SR-07).
   * Only updates when query.length >= minQueryLength.
   * Exposed so consuming components can display it in the
   * suggestions panel (e.g. "Results for 'GT 650'").
   */
  debouncedQuery: string

  /*
   * setQuery — updates the query state.
   * Call this from SearchBar's onChange handler.
   * Triggers the debounce cycle.
   * Stable reference via useCallback — safe to use in useEffect deps.
   */
  setQuery: (value: string) => void

  /*
   * suggestions — array of search suggestion results.
   * Empty array in SR-01 until SR-07 wires the API route.
   * Each suggestion is a SearchSuggestion from types/bike.ts (S-07).
   */
  suggestions: SearchSuggestion[]

  /*
   * isLoading — true during the debounce window when query >= minQueryLength.
   * Use this to show a loading indicator in the suggestions panel (SR-02).
   * Transitions:
   *   false → true: when setQuery is called with query.length >= minQueryLength
   *   true → false: after debounceMs elapses OR when query is cleared
   */
  isLoading: boolean

  /*
   * isFocused — whether the search input currently has focus.
   * Controls the visibility of the suggestions panel (SR-02/SR-03).
   * Set by the SearchBar via setIsFocused on onFocus/onBlur.
   */
  isFocused: boolean

  /*
   * setIsFocused — updates focus state from the SearchBar component.
   * Called by SearchBar's onFocus (true) and onBlur (false) handlers.
   * Stable reference via useCallback.
   */
  setIsFocused: (focused: boolean) => void

  /*
   * clearSearch — resets all search state to initial values.
   * Cancels any pending debounce timeout.
   * Clears: query, debouncedQuery, suggestions, isLoading.
   * Does NOT clear recentSearches (those persist across searches).
   * Call from SearchBar's clear button handler or Escape key handler.
   * Stable reference via useCallback.
   */
  clearSearch: () => void

  /*
   * submitSearch — triggers a search submission.
   * Calls onSearch option with the current trimmed query.
   * Adds the query to recentSearches (no-op in SR-01; wired in SR-05).
   * Called from SearchBar's onSubmit (Enter key / form submit).
   * Stable reference via useCallback.
   */
  submitSearch: (value?: string) => void

  /*
   * recentSearches — array of recent search terms.
   * Always empty [] in SR-01.
   * SR-05 replaces with localStorage-backed implementation.
   * Used by SearchSuggestions panel (SR-02) when query is empty.
   */
  recentSearches: string[]

  /*
   * addRecentSearch — adds a search term to recentSearches.
   * No-op in SR-01.
   * SR-05 implements localStorage persistence.
   * Stable reference via useCallback.
   */
  addRecentSearch: (term: string) => void

  /*
   * clearRecentSearches — removes all recent searches.
   * No-op in SR-01.
   * SR-05 implements localStorage clear.
   * Stable reference via useCallback.
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

  // ── State ────────────────────────────────────────────────────────────────

  /*
   * query — raw query string, updated immediately on every keystroke.
   * Initialised as empty string — SSR safe (no browser APIs).
   */
  const [query, setQueryState] = useState<string>('')

  /*
   * debouncedQuery — debounced version of query.
   * Updated after debounceMs elapses without a new setQuery call.
   * SR-07 watches this value to trigger the API call.
   */
  const [debouncedQuery, setDebouncedQuery] = useState<string>('')

  /*
   * suggestions — search suggestion results from the API.
   * Empty array in SR-01. SR-07 populates this via fetch.
   */
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])

  /*
   * isLoading — true during the debounce window for non-trivial queries.
   * Shows the loading state in the suggestions panel (SR-02).
   */
  const [isLoading, setIsLoading] = useState<boolean>(false)

  /*
   * isFocused — whether the search input has focus.
   * Controls suggestions panel visibility.
   */
  const [isFocused, setIsFocusedState] = useState<boolean>(false)

  /*
   * recentSearches — recent search terms.
   * Empty in SR-01. SR-05 adds localStorage persistence.
   */
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // ── Refs ─────────────────────────────────────────────────────────────────

  /*
   * debounceTimerRef — holds the setTimeout ID for the debounce.
   * Using useRef (not useState) so updating it does not trigger a re-render.
   * Cleared on each setQuery call and on unmount.
   */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  /*
   * Clear the debounce timer on unmount to prevent setState calls
   * on an unmounted component (would produce a React warning).
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // ── Callbacks ────────────────────────────────────────────────────────────

  /*
   * setQuery — updates query immediately and starts the debounce cycle.
   *
   * On each call:
   *   1. Update query state immediately → input stays responsive
   *   2. Clear any pending debounce timer
   *   3. If new value is below minQueryLength:
   *      - Reset debouncedQuery, suggestions, isLoading immediately
   *      - No debounce needed (no API call will fire)
   *   4. If new value meets minQueryLength:
   *      - Set isLoading=true (debounce window begins)
   *      - Start a new debounce timer
   *      - After debounceMs: update debouncedQuery, set isLoading=false
   *        (SR-07 watches debouncedQuery to trigger the fetch)
   *
   * Wrapped in useCallback with stable deps so SearchBar does not
   * re-render on every parent render.
   */
  const setQuery = useCallback(
    (value: string) => {
      /*
       * 1. Update raw query immediately.
       */
      setQueryState(value)

      /*
       * 2. Cancel any pending debounce.
       */
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      /*
       * 3. Below minimum length — reset immediately, no debounce needed.
       */
      if (value.length < minQueryLength) {
        setDebouncedQuery('')
        setSuggestions([])
        setIsLoading(false)
        return
      }

      /*
       * 4. At or above minimum length — enter debounce window.
       *    isLoading=true signals to SearchSuggestions (SR-02) that
       *    results are incoming, allowing it to show a skeleton loader.
       */
      setIsLoading(true)

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null

        /*
         * Update debouncedQuery — this is the value SR-07 watches.
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

        /*
         * SR-01: No API call yet. Set isLoading=false immediately
         * after the debounce resolves. SR-07 will set it to false
         * after the fetch completes instead.
         */
        setIsLoading(false)
      }, debounceMs)
    },
    [debounceMs, minQueryLength],
  )

  /*
   * setIsFocused — updates focus state from SearchBar.
   * Stable useCallback — no deps change at runtime.
   */
  const setIsFocused = useCallback((focused: boolean) => {
    setIsFocusedState(focused)
  }, [])

  /*
   * clearSearch — resets all transient search state.
   * Cancels any pending debounce timeout.
   * Does NOT clear recentSearches (those persist).
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
   * submitSearch — handles search form submission.
   * Accepts an optional value override (useful when SearchBar passes
   * its current value directly on Enter without waiting for state sync).
   * Calls onSearch option if provided.
   * Calls addRecentSearch — no-op in SR-01, wired in SR-05.
   */
  const submitSearch = useCallback(
    (value?: string) => {
      const term = (value ?? query).trim()
      if (!term) return

      /*
       * Cancel any pending debounce — the user has committed to this search.
       */
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      /*
       * Immediately set debouncedQuery to the submitted term so that
       * any downstream consumers (suggestions panel) update synchronously.
       */
      setDebouncedQuery(term)
      setIsLoading(false)

      /*
       * SR-05 INTEGRATION POINT:
       *   addRecentSearch(term) will be called here once SR-05
       *   implements localStorage persistence. The call is already
       *   in place — SR-05 just replaces the no-op implementation.
       */
      addRecentSearch(term)

      /*
       * Notify the parent page to navigate to /search?q=[term].
       * SR-03 wires this to router.push on the Home page.
       */
      onSearch?.(term)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, onSearch],
  )

  /*
   * addRecentSearch — SR-05 INTEGRATION POINT.
   * No-op in SR-01. SR-05 replaces with:
   *   const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
   *   const prev: string[] = stored ? JSON.parse(stored) : []
   *   const next = [term, ...prev.filter(s => s !== term)].slice(0, 5)
   *   localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
   *   setRecentSearches(next)
   *
   * Stable useCallback — implementation is a no-op in SR-01.
   * SR-05 replaces the body without changing the interface.
   */
  const addRecentSearch = useCallback(
    (_term: string): void => {
      /*
       * SR-05: Replace this no-op with localStorage persistence.
       * _term is prefixed with _ to suppress the unused-variable
       * ESLint rule while the body is a stub.
       */
    },
    [],
  )

  /*
   * clearRecentSearches — SR-05 INTEGRATION POINT.
   * No-op in SR-01. SR-05 replaces with:
   *   localStorage.removeItem(RECENT_SEARCHES_KEY)
   *   setRecentSearches([])
   */
  const clearRecentSearches = useCallback((): void => {
    setRecentSearches([])
  }, [])

  // ── Return ───────────────────────────────────────────────────────────────

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

/*
 * Default export for convenience.
 * Both import styles work:
 *   import { useSearch } from '@/hooks/useSearch'
 *   import useSearch from '@/hooks/useSearch'
 */
export default useSearch