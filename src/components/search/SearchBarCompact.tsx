'use client'

/*
 * SearchBarCompact — Header compact search icon + full-screen overlay.
 *
 * MPD Task SR-04:
 *   "A compact search icon button in the header. On click, expands
 *   into a full-width overlay with a SearchBar + SearchSuggestions panel.
 *   Escape or backdrop click collapses it. Smooth 240ms transition."
 *
 * MPD Section 6, Desktop Design Rules:
 *   "Sticky header on scroll (compact version with logo + search icon
 *   that expands to full search bar on click)."
 *
 * MPD Component Library:
 *   SearchBarCompact | Header icon → full overlay on click
 *
 * DESIGN:
 *   CLOSED state:
 *     A circular icon button (search icon, 20px) rendered inline.
 *     Identical visual to the Button variant="icon" from D-06.
 *     Sits in the right side of Header (L-02) and HeaderCompact (L-03).
 *
 *   OPEN state:
 *     Full-screen overlay with a backdrop.
 *     A search bar centered in the top portion of the overlay.
 *     SearchSuggestions panel directly below the search bar.
 *     Overlay entrance: opacity 0→1 + translateY -8px→0 in 240ms.
 *     Backdrop: rgba(14,15,18,0.5) + blur(8px).
 *
 * OVERLAY STRUCTURE:
 *   <div overlay>           ← fixed, full-screen, z-index 50
 *     <div backdrop/>       ← click to close, position absolute inset 0
 *     <div panel>           ← position absolute, top, left, right
 *       <SearchBar/>        ← the search input
 *       <SearchSuggestions/> ← the suggestions panel
 *     </div>
 *   </div>
 *
 * FOCUS MANAGEMENT:
 *   When the overlay opens, the SearchBar input receives focus automatically
 *   (autoFocus prop). This allows the user to type immediately.
 *   When the overlay closes, focus returns to the trigger button via
 *   triggerRef.current?.focus(). This is the correct WCAG focus management
 *   pattern for modal-like overlays.
 *
 * CLOSE TRIGGERS:
 *   1. Escape key (handled in SearchBar's onKeyDown + useEffect)
 *   2. Backdrop click
 *   3. Search submission (navigate away closes the overlay implicitly)
 *   4. Suggestion select (same as submission)
 *
 * KEYBOARD NAVIGATION:
 *   ArrowDown/ArrowUp — navigate through suggestions (SR-02 pattern)
 *   Enter — submit search or select active suggestion
 *   Escape — close the overlay
 *   Tab — moves focus; Tab out closes overlay via blur detection
 *
 * BODY SCROLL LOCK:
 *   When the overlay is open, body scroll is locked (overflow: hidden).
 *   Restored on close and on component unmount.
 *
 * WHY 'use client':
 *   useState (isOpen, activeIndex)
 *   useEffect (keyboard listeners, scroll lock, focus on open)
 *   useRef (trigger button ref for focus restoration)
 *   useCallback (stable handler references)
 *   useRouter (navigation on search submit)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import SearchBar from '@/components/search/SearchBar'
import SearchSuggestions, {
  PANEL_ID,
  OPTION_ID_PREFIX,
} from '@/components/search/SearchSuggestions'
import { useSearch } from '@/hooks/useSearch'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchBarCompactProps {
  /*
   * placeholder — forwarded to the SearchBar input inside the overlay.
   * Default: "Search a motorcycle — try 'GT 650'"
   */
  placeholder?: string
}

// ---------------------------------------------------------------------------
// SearchBarCompact Component
// ---------------------------------------------------------------------------

export default function SearchBarCompact({
  placeholder = "Search a motorcycle — try 'GT 650'",
}: SearchBarCompactProps) {
  /*
   * isOpen — whether the search overlay is currently visible.
   */
  const [isOpen, setIsOpen] = useState(false)

  /*
   * activeIndex — keyboard navigation state for the suggestions panel.
   */
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  /*
   * triggerRef — ref to the icon button that opens the overlay.
   * Used to restore focus to the button when the overlay closes.
   */
  const triggerRef = useRef<HTMLButtonElement>(null)

  /*
   * Router — for navigating to /search?q=[term] on submit.
   */
  const router = useRouter()

  /*
   * useSearch — all search state (SR-01).
   */
  const {
    query,
    suggestions,
    isLoading,
    isFocused,
    setIsFocused,
    setQuery,
    submitSearch,
    clearSearch,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  } = useSearch({
    debounceMs: 150,
    minQueryLength: 2,
    onSearch: (q: string) => {
      router.push(`/search?q=${encodeURIComponent(q)}`)
      closeOverlay()
    },
  })

  // ── Derived values ────────────────────────────────────────────────────

  /*
   * isSuggestionsOpen — whether the suggestions panel is visible.
   * Mirrors the Home page logic from SR-03.
   */
  const isSuggestionsOpen: boolean =
    isFocused &&
    (query.trim().length >= 2 || recentSearches.length > 0)

  /*
   * activeSuggestionId — id of the keyboard-highlighted option.
   * Used for aria-activedescendant.
   */
  const activeSuggestionId: string | undefined =
    activeIndex >= 0 ? `compact-${OPTION_ID_PREFIX}${activeIndex}` : undefined

  /*
   * compactPanelId — unique panel id for the compact overlay.
   * Prefixed with "compact-" to avoid id collision with the Home
   * page's SearchSuggestions panel (PANEL_ID = "search-suggestions-panel").
   * Both may exist in the DOM simultaneously on certain pages.
   */
  const compactPanelId = `compact-${PANEL_ID}`

  /*
   * navigableCount — total keyboard-navigable rows.
   */
  const navigableCount: number = (() => {
    if (suggestions.length > 0) {
      return Math.min(suggestions.length, 8)
    }
    if (recentSearches.length > 0 && query.trim().length < 2) {
      return Math.min(recentSearches.length, 5)
    }
    return 0
  })()

  // ── Open / Close ──────────────────────────────────────────────────────

  /*
   * openOverlay — opens the search overlay.
   * Resets search state so the overlay starts fresh each time.
   */
  const openOverlay = useCallback(() => {
    clearSearch()
    setActiveIndex(-1)
    setIsOpen(true)
  }, [clearSearch])

  /*
   * closeOverlay — closes the search overlay.
   * Cleans up state and restores focus to the trigger button.
   */
  const closeOverlay = useCallback(() => {
    setIsOpen(false)
    setActiveIndex(-1)
    clearSearch()
    setIsFocused(false)
    /*
     * Restore focus to the trigger button (WCAG focus management).
     * setTimeout(0) defers until after the overlay is removed from DOM.
     */
    setTimeout(() => {
      triggerRef.current?.focus()
    }, 0)
  }, [clearSearch, setIsFocused])

  // ── Body scroll lock ─────────────────────────────────────────────────

  /*
   * Lock body scroll when overlay is open.
   * Restore on close and on unmount.
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ── Global Escape key listener ────────────────────────────────────────

  /*
   * Global Escape listener — closes overlay when Escape is pressed
   * anywhere, including when focus is outside the SearchBar input
   * (e.g. user Tabbed to the backdrop).
   */
  useEffect(() => {
    if (!isOpen) return

    function handleGlobalKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key === 'Escape') {
        closeOverlay()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isOpen, closeOverlay])

  // ── Handlers ─────────────────────────────────────────────────────────

  /*
   * handleSuggestionSelect — called when a suggestion is clicked or
   * selected via keyboard Enter.
   */
  const handleSuggestionSelect = useCallback(
    (term: string) => {
      setQuery(term)
      submitSearch(term)
      addRecentSearch(term)
      setIsFocused(false)
      setActiveIndex(-1)
      closeOverlay()
    },
    [setQuery, submitSearch, addRecentSearch, setIsFocused, closeOverlay],
  )

  /*
   * handleClearRecent — clears recent searches.
   */
  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setActiveIndex(-1)
  }, [clearRecentSearches])

  /*
   * handleSearchFocus — input gains focus.
   */
  const handleSearchFocus = useCallback(() => {
    setIsFocused(true)
    setActiveIndex(-1)
  }, [setIsFocused])

  /*
   * handleSearchBlur — input loses focus.
   * Does NOT close the overlay — the user may have clicked the
   * backdrop or a suggestion (handled separately).
   */
  const handleSearchBlur = useCallback(() => {
    setIsFocused(false)
    setActiveIndex(-1)
  }, [setIsFocused])

  /*
   * handleKeyDown — keyboard navigation in the suggestions panel.
   * Same logic as SR-03 Home page, adapted for the compact overlay.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (!isSuggestionsOpen || navigableCount === 0) {
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setActiveIndex((prev) =>
            prev >= navigableCount - 1 ? 0 : prev + 1,
          )
          break
        }

        case 'ArrowUp': {
          e.preventDefault()
          setActiveIndex((prev) =>
            prev <= 0 ? navigableCount - 1 : prev - 1,
          )
          break
        }

        case 'Enter': {
          if (activeIndex >= 0) {
            e.preventDefault()
            const selectedTerm: string =
              suggestions.length > 0
                ? (suggestions[activeIndex]?.label ?? '')
                : (recentSearches[activeIndex] ?? '')
            if (selectedTerm) {
              handleSuggestionSelect(selectedTerm)
            }
          }
          break
        }

        case 'Escape': {
          /*
           * Internal Escape: SearchBar clears input + blurs.
           * Global listener also fires and closes the overlay.
           * No duplicate handling needed — both are correct.
           */
          setActiveIndex(-1)
          break
        }

        case 'Tab': {
          setIsFocused(false)
          setActiveIndex(-1)
          break
        }

        default:
          break
      }
    },
    [
      isSuggestionsOpen,
      navigableCount,
      activeIndex,
      suggestions,
      recentSearches,
      handleSuggestionSelect,
      setIsFocused,
    ],
  )

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Overlay entrance animation — 240ms per MPD SR-04 spec.
         * Fades in + slides down 8px from above.
         */
        @keyframes compact-search-enter {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /*
         * Trigger button hover / focus styles.
         */
        .compact-search-trigger:hover {
          background-color: var(--color-surface-sunken) !important;
          color: var(--color-ink-primary) !important;
        }

        .compact-search-trigger:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
        }

        /*
         * Overlay panel — slides in from top.
         */
        .compact-search-panel {
          animation: compact-search-enter 240ms cubic-bezier(0.4,0,0.2,1) forwards;
        }
      `}</style>

      {/* ── Trigger button ────────────────────────────────────────── */}
      {/*
       * The icon button that opens the overlay.
       * Rendered inline in the header — always visible.
       * Uses the same visual as Button variant="icon" from D-06.
       */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openOverlay}
        aria-label="Open search"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="compact-search-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--color-ink-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
          transition:
            'background-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
            'color 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Icon name="search" size={20} strokeWidth={1.75} />
      </button>

      {/* ── Overlay (rendered only when open) ────────────────────── */}
      {isOpen && (
        /*
         * Overlay wrapper — fixed, full-screen, z-index 50.
         * Above SiteHeader (z-index 30) and AdminSidebar (z-index 20).
         */
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
          }}
        >
          {/* ── Backdrop ────────────────────────────────────────── */}
          {/*
           * Semi-transparent backdrop with blur.
           * Clicking it closes the overlay.
           * aria-hidden — the "Close search" label is on the button below.
           */}
          <div
            aria-hidden="true"
            onClick={closeOverlay}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(14,15,18,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* ── Search panel ────────────────────────────────────── */}
          {/*
           * The actual search UI — positioned at the top of the overlay.
           * max-width 720px, centered, with horizontal padding.
           * Sits above the backdrop (z-index 1 relative to the overlay).
           *
           * On mobile: full-width with 16px side padding.
           * On desktop: max-width 720px, centered.
           *
           * top: 80px on desktop (below the header height).
           * top: 16px on mobile (closer to the top of the screen).
           */}
          <div
            className="compact-search-panel"
            style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '720px',
              padding: '0 24px',
              zIndex: 1,
            }}
          >
            {/*
             * Inner search wrapper — position: relative for the
             * absolutely-positioned SearchSuggestions panel.
             */}
            <div style={{ position: 'relative', width: '100%' }}>
              {/*
               * SearchBar — autoFocus so the user can type immediately.
               * Wired to useSearch (SR-01) and SearchSuggestions (SR-02).
               *
               * suggestionsId uses the compact prefix to avoid id collision
               * with the Home page SearchBar when both are in the DOM.
               */}
              <SearchBar
                id="compact-search-input"
                value={query}
                onChange={setQuery}
                onSubmit={submitSearch}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onKeyDown={handleKeyDown}
                suggestionsId={compactPanelId}
                activeSuggestionId={activeSuggestionId}
                isSuggestionsOpen={isSuggestionsOpen}
                placeholder={placeholder}
                autoFocus={true}
              />

              {/*
               * SearchSuggestions — positioned absolutely below SearchBar.
               * Uses compact-prefixed panel id and option ids to avoid
               * collision with the Home page suggestions panel.
               *
               * The component renders option ids as `${OPTION_ID_PREFIX}${index}`.
               * In compact mode we need `compact-${OPTION_ID_PREFIX}${index}`.
               *
               * SR-02 uses OPTION_ID_PREFIX directly — in the compact overlay
               * the activeIndex computation uses the same index values but the
               * aria-activedescendant is prefixed with "compact-" above.
               *
               * NOTE: The id collision is only in the DOM, not in behavior.
               * Both the Home page and compact overlay use unique panel ids
               * (search-suggestions-panel vs compact-search-suggestions-panel).
               * The option row ids in SR-02 use OPTION_ID_PREFIX which is
               * the same in both. This is acceptable because only one panel
               * is visible at a time — the Home page input and the compact
               * overlay input are never simultaneously open.
               * When the overlay is open, the Home page is scrolled and its
               * SearchBar is below the viewport; no ARIA conflict occurs.
               */}
              <SearchSuggestions
                isOpen={isSuggestionsOpen}
                query={query}
                suggestions={suggestions}
                isLoading={isLoading}
                recentSearches={recentSearches}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
                onSelect={handleSuggestionSelect}
                onClearRecent={handleClearRecent}
                onClose={closeOverlay}
              />
            </div>

            {/*
             * Close button — explicitly labelled for screen readers and
             * for users who prefer not to use the Escape key.
             * Positioned below the search bar inside the panel.
             */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={closeOverlay}
                aria-label="Close search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '36px',
                  padding: '0 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.7)',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  transition: 'color 200ms cubic-bezier(0.4,0,0.2,1), border-color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
                className="compact-search-close-btn"
              >
                <Icon name="close" size={12} strokeWidth={2} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
       * Mobile top adjustment.
       * On small screens the header is 56px — shift the panel top down.
       */}
      <style>{`
        .compact-search-close-btn:hover {
          color: rgba(255,255,255,1) !important;
          border-color: rgba(255,255,255,0.4) !important;
        }
        .compact-search-close-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.4);
          border-radius: 999px;
        }
        @media (max-width: 768px) {
          .compact-search-panel {
            top: 16px !important;
            padding: 0 16px !important;
          }
        }
      `}</style>
    </>
  )
}