'use client'

/*
 * useSearch — Search state management hook.
 *
 * MPD Task SR-01: Debounced query state, suggestions, loading state.
 * MPD Task SR-05: localStorage recent search persistence.
 * MPD Task SR-07: Wire fetch to /api/search/suggest on debouncedQuery.
 *
 * SR-07 CHANGES FROM SR-05:
 *   - Added a useEffect watching debouncedQuery.
 *   - When debouncedQuery.length >= minQueryLength:
 *       fetch /api/search/suggest?q=[debouncedQuery]
 *       update suggestions with response.suggestions
 *       set isLoading=false after fetch completes
 *   - Uses AbortController to cancel in-flight requests when
 *     debouncedQuery changes before the fetch completes.
 *   - On fetch error: suggestions silently resets to [].
 *   - isLoading=true is set in setQuery (during debounce window).
 *     isLoading=false is set after fetch completes (success or error).
 *   - SR-07 integration point comment removed (now implemented).
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

const DEBOUNCE_MS = 150
const MIN_QUERY_LENGTH = 2
const RECENT_SEARCHES_KEY = 'motohub360:recent-searches'
const MAX_RECENT_SEARCHES = 5

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)

    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return (parsed as string[]).slice(0, MAX_RECENT_SEARCHES)
    }

    window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    return []
  } catch {
    return []
  }
}

function saveRecentSearches(searches: string[]): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(searches),
    )
  } catch {
    // Silently ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSearchOptions {
  debounceMs?: number
  minQueryLength?: number
  onSearch?: (query: string) => void
}

export interface UseSearchReturn {
  query: string
  debouncedQuery: string
  setQuery: (value: string) => void
  suggestions: SearchSuggestion[]
  isLoading: boolean
  isFocused: boolean
  setIsFocused: (focused: boolean) => void
  clearSearch: () => void
  submitSearch: (value?: string) => void
  recentSearches: string[]
  addRecentSearch: (term: string) => void
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
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // ── Refs ──────────────────────────────────────────────────────────────

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Effects ───────────────────────────────────────────────────────────

  /*
   * Hydrate recentSearches from localStorage on mount.
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

  /*
   * SR-07 — Fetch suggestions when debouncedQuery changes.
   *
   * Fires when debouncedQuery is updated by the debounce timer in setQuery.
   * Uses AbortController to cancel stale in-flight requests.
   *
   * Flow:
   *   1. debouncedQuery updates (after 150ms debounce)
   *   2. If length < minQueryLength: clear suggestions + isLoading=false
   *   3. If length >= minQueryLength: fetch /api/search/suggest?q=[query]
   *   4. On success: setSuggestions(data.suggestions), isLoading=false
   *   5. On error/abort: setSuggestions([]), isLoading=false
   *
   * AbortController:
   *   Each effect run creates a new AbortController.
   *   The cleanup function aborts any in-flight request from the
   *   previous effect run before the new one starts.
   *   This prevents stale responses from overwriting newer results.
   */
  useEffect(() => {
    if (debouncedQuery.length < minQueryLength) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    setIsLoading(true)

    const fetchSuggestions = async (): Promise<void> => {
      try {
        const url = `/api/search/suggest?q=${encodeURIComponent(debouncedQuery)}`
        const response = await fetch(url, { signal })

        if (!response.ok) {
          if (!signal.aborted) {
            setSuggestions([])
            setIsLoading(false)
          }
          return
        }

        const data: unknown = await response.json()

        if (signal.aborted) return

        /*
         * Type-safe extraction of suggestions from the response.
         * The API returns { suggestions: SearchSuggestion[] }.
         * We validate the shape before trusting the data.
         */
        if (
          data !== null &&
          typeof data === 'object' &&
          'suggestions' in data &&
          Array.isArray((data as { suggestions: unknown }).suggestions)
        ) {
          setSuggestions(
            (data as { suggestions: SearchSuggestion[] }).suggestions,
          )
        } else {
          setSuggestions([])
        }

        setIsLoading(false)
      } catch (error) {
        /*
         * AbortError is expected when the request is cancelled —
         * do not update state on abort (a newer request is already
         * in flight or the component has unmounted).
         */
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        if (!signal.aborted) {
          setSuggestions([])
          setIsLoading(false)
        }
      }
    }

    void fetchSuggestions()

    return () => {
      controller.abort()
    }
  }, [debouncedQuery, minQueryLength])

  // ── Callbacks ─────────────────────────────────────────────────────────

  /*
   * setQuery — updates query immediately and starts the debounce cycle.
   * isLoading=true is set here (during the debounce window).
   * isLoading=false is set by the fetch useEffect after fetch completes.
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

      /*
       * Set isLoading=true during the debounce window.
       * The fetch useEffect sets it back to false after the request completes.
       */
      setIsLoading(true)

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        /*
         * Update debouncedQuery — triggers the fetch useEffect above.
         * isLoading remains true until the fetch useEffect sets it false.
         */
        setDebouncedQuery(value)
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
   * Does NOT clear recentSearches.
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
   */
  const addRecentSearch = useCallback((term: string): void => {
    const trimmed = term.trim()
    if (!trimmed) return

    setRecentSearches((prev) => {
      const deduplicated = prev.filter((existing) => existing !== trimmed)
      const next = [trimmed, ...deduplicated].slice(0, MAX_RECENT_SEARCHES)
      saveRecentSearches(next)
      return next
    })
  }, [])

  /*
   * clearRecentSearches — SR-05: removes all recent searches.
   */
  const clearRecentSearches = useCallback((): void => {
    setRecentSearches([])

    if (typeof window === 'undefined') return

    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // Silently ignore localStorage errors
    }
  }, [])

  /*
   * submitSearch — handles search form submission.
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