'use client'

/*
 * Home page — MotoHub360 primary landing page ( / )
 *
 * SR-03 additions:
 *   "Wire SearchBar to useSearch + SearchSuggestions on Home page.
 *   Handle onFocus/onBlur to show/hide the suggestions panel.
 *   Keyboard navigation (ArrowUp/Down) moves through suggestions."
 *
 * WIRING:
 *   useSearch hook (SR-01) provides all search state.
 *   SearchBar (H-01, modified in SR-03) is the controlled input.
 *   SearchSuggestions (SR-02) is the dropdown panel.
 *
 * DATA FLOW:
 *   User types → SearchBar.onChange → useSearch.setQuery
 *   → 150ms debounce → useSearch.debouncedQuery updates
 *   → SR-07 will fetch suggestions → useSearch.suggestions updates
 *   → SearchSuggestions re-renders with new suggestions
 *
 * KEYBOARD NAVIGATION:
 *   ArrowDown / ArrowUp → update activeIndex
 *   Enter (with activeIndex >= 0) → select active suggestion
 *   Enter (with activeIndex = -1) → submit search (navigate to /search?q=...)
 *   Escape → close suggestions panel, clear input, blur
 *
 * PANEL VISIBILITY:
 *   isSuggestionsOpen = isFocused AND (query >= 2 chars OR recent searches exist)
 *   When false: SearchSuggestions does not render.
 *   When true: SearchSuggestions determines its internal display state.
 *
 * BLUR / CLICK TIMING:
 *   SearchSuggestions uses onMouseDown + e.preventDefault() on each row
 *   to prevent the input blur from firing before the click registers.
 *   After the click, the input blurs naturally and the panel closes.
 *
 * PREVIOUS CONTENT PRESERVED:
 *   All scroll-reveal sections (brand chips, category pills, price pills),
 *   BikeHero, and all CSS from H-06 through H-10 are unchanged.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useSearch } from '@/hooks/useSearch'
import SearchBar from '@/components/search/SearchBar'
import SearchSuggestions, {
  PANEL_ID,
  OPTION_ID_PREFIX,
} from '@/components/search/SearchSuggestions'
import BikeHero from '@/components/bike/BikeHero'
import BrandLogoChip from '@/components/listing/BrandLogoChip'
import CategoryPills from '@/components/listing/CategoryPills'
import PriceRangePills from '@/components/listing/PriceRangePills'
import { BRANDS } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'
import type { KeyboardEvent } from 'react'

// ---------------------------------------------------------------------------
// Home Page Component
// ---------------------------------------------------------------------------

export default function HomePage() {

  // ── Scroll reveal hooks (unchanged from H-08) ─────────────────────────
  const brandSection = useScrollReveal({
    threshold: 0.05,
    rootMargin: '0px 0px -30px 0px',
  })
  const categorySection = useScrollReveal({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
  })
  const priceSection = useScrollReveal({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
  })

  // ── Router — for navigating to /search?q=[term] ───────────────────────
  const router = useRouter()

  // ── useSearch — all search state (SR-01) ──────────────────────────────
  const {
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
  } = useSearch({
    debounceMs: 150,
    minQueryLength: 2,
    /*
     * onSearch — navigates to /search?q=[term] on form submit.
     * SR-06 builds the /search page that handles this route.
     * Until SR-06 is complete, this navigates to the 404 page.
     */
    onSearch: (q: string) => {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    },
  })

  // ── activeIndex — keyboard navigation state ────────────────────────────
  /*
   * activeIndex — the index of the keyboard-highlighted suggestion row.
   * -1 means no row is highlighted.
   * Passed to SearchSuggestions and used to compute aria-activedescendant.
   */
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  // ── Derived values ─────────────────────────────────────────────────────

  /*
   * isSuggestionsOpen — controls SearchSuggestions panel visibility.
   *
   * True when:
   *   - The input is focused AND
   *   - query >= 2 chars (live suggestions or empty state) OR
   *   - recentSearches has items (recent state when query < 2 chars)
   *
   * When false, SearchSuggestions returns null (not rendered).
   */
  const isSuggestionsOpen: boolean =
    isFocused &&
    (query.trim().length >= 2 || recentSearches.length > 0)

  /*
   * activeSuggestionId — the HTML id of the keyboard-highlighted option.
   * Used for aria-activedescendant on the SearchBar input.
   * Undefined when no option is highlighted (activeIndex === -1).
   */
  const activeSuggestionId: string | undefined =
    activeIndex >= 0 ? `${OPTION_ID_PREFIX}${activeIndex}` : undefined

  /*
   * navigableCount — total number of keyboard-navigable rows in the panel.
   * Computed from the current panel state:
   *   SUGGESTIONS: min(suggestions.length, 8) per MAX_SUGGESTIONS in SR-02
   *   RECENT: min(recentSearches.length, 5) per MAX_RECENT in SR-02
   *   Everything else: 0 (no navigation)
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

  // ── Handlers ───────────────────────────────────────────────────────────

  /*
   * handleSuggestionSelect — called when a suggestion row is clicked or
   * selected via Enter key.
   *
   * 1. Set the query to the selected term (updates the input value).
   * 2. Submit the search (navigates to /search?q=[term]).
   * 3. Add to recent searches (no-op in SR-01, wired in SR-05).
   * 4. Close the suggestions panel.
   * 5. Reset keyboard navigation.
   */
  const handleSuggestionSelect = useCallback(
    (term: string) => {
      setQuery(term)
      submitSearch(term)
      addRecentSearch(term)
      setIsFocused(false)
      setActiveIndex(-1)
    },
    [setQuery, submitSearch, addRecentSearch, setIsFocused],
  )

  /*
   * handleSuggestionClose — called when the panel should close.
   * Triggered by: Escape key (via SearchBar), Tab key (via SearchSuggestions).
   */
  const handleSuggestionClose = useCallback(() => {
    setIsFocused(false)
    setActiveIndex(-1)
  }, [setIsFocused])

  /*
   * handleClearRecent — called when "Clear recent searches" is clicked.
   * Delegates to useSearch.clearRecentSearches (no-op in SR-01).
   */
  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setActiveIndex(-1)
  }, [clearRecentSearches])

  /*
   * handleSearchFocus — input gains focus.
   * Resets active index so no stale highlight appears on re-focus.
   */
  const handleSearchFocus = useCallback(() => {
    setIsFocused(true)
    setActiveIndex(-1)
  }, [setIsFocused])

  /*
   * handleSearchBlur — input loses focus.
   * Closes the suggestions panel.
   * Note: onMouseDown + e.preventDefault() on suggestion rows prevents
   * blur from firing before a click registers (SR-02 pattern).
   */
  const handleSearchBlur = useCallback(() => {
    setIsFocused(false)
    setActiveIndex(-1)
  }, [setIsFocused])

  /*
   * handleSearchKeyDown — keyboard navigation in the suggestions panel.
   *
   * Passed to SearchBar as the external onKeyDown prop.
   * Called BEFORE SearchBar's internal Escape handler.
   *
   * ArrowDown: advance activeIndex (wraps from last to 0).
   * ArrowUp:   retreat activeIndex (wraps from 0 to last).
   * Enter:     select the active suggestion (if any).
   *            If no active suggestion, SearchBar's form submit fires.
   * Escape:    close panel + reset activeIndex.
   *            SearchBar's internal handler also clears input + blurs.
   * Tab:       close panel (focus moves naturally to next element).
   *
   * No navigation when isSuggestionsOpen=false or navigableCount=0.
   */
  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      /*
       * Only handle navigation keys when panel is open and has rows.
       */
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
            /*
             * Resolve the selected term from either suggestions or
             * recent searches, depending on the current panel state.
             */
            const selectedTerm: string =
              suggestions.length > 0
                ? (suggestions[activeIndex]?.label ?? '')
                : (recentSearches[activeIndex] ?? '')

            if (selectedTerm) {
              handleSuggestionSelect(selectedTerm)
            }
          }
          /*
           * If activeIndex === -1, do not prevent default.
           * The form's onSubmit will fire → submitSearch → navigation.
           */
          break
        }

        case 'Escape': {
          /*
           * Close the panel + reset navigation.
           * SearchBar's internal Escape handler also clears + blurs.
           */
          setIsFocused(false)
          setActiveIndex(-1)
          break
        }

        case 'Tab': {
          /*
           * Close the panel when Tab moves focus away.
           * Do not preventDefault — Tab should still move focus.
           */
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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .home-section-gap {
          margin-top: 80px;
        }
        .home-hero-gap {
          margin-top: 120px;
        }
        .home-search-wrapper {
          width: 100%;
          max-width: 680px;
          position: relative;
        }
        .home-content-pad {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }
        .home-section-label {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
        }
        .brand-chips-track {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-start;
        }
        .brand-chips-track::-webkit-scrollbar {
          display: none;
        }
        .brand-chips-track {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .home-pills-scroll::-webkit-scrollbar {
          display: none;
        }
        .home-pills-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .pill-tap-target {
          padding: 2px 0;
        }
        .home-price-section {
          padding-bottom: clamp(64px, 10vw, 120px);
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .home-price-section {
            padding-bottom: calc(
              clamp(64px, 10vw, 120px) + env(safe-area-inset-bottom)
            );
          }
        }

        @media (max-width: 768px) {
          .home-section-gap {
            margin-top: 48px;
          }
          .home-hero-gap {
            margin-top: 64px;
          }
          .home-content-pad {
            padding: 0 20px;
          }
          .home-search-wrapper {
            max-width: 100%;
          }
          .home-search-section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }

        @media (max-width: 480px) {
          .brand-chips-track {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            align-items: start;
          }
          .home-section-label {
            margin-bottom: 16px !important;
          }
          .home-hero-container {
            aspect-ratio: 9 / 10 !important;
          }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          .home-hero-container {
            aspect-ratio: 16 / 9 !important;
          }
        }
      `}</style>

      <main
        id="home-main"
        role="main"
        style={{
          backgroundColor: 'var(--color-surface-base)',
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
      >

        {/* ── ABOVE-FOLD: Wordmark + Search ─────────────────────── */}
        <section
          aria-label="Search motorcycles"
          className="home-search-section"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'clamp(40px, 8vh, 96px) 32px 0',
          }}
        >
          {/*
           * MotoHub360 wordmark — display-lg, centered.
           * No animation — above fold, immediate visibility.
           */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(24px, 4vw, 48px)',
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-primary)',
              textAlign: 'center',
              margin: '0 0 clamp(20px, 3vw, 32px)',
              userSelect: 'none',
            }}
          >
            MotoHub
            <span style={{ color: 'var(--color-ink-tertiary)' }}>360</span>
          </h1>

          {/*
           * Search wrapper — position: relative so SearchSuggestions
           * can position itself absolutely below the SearchBar.
           * Full-width on mobile, max-width 680px on desktop.
           */}
          <div className="home-search-wrapper">
            {/*
             * SearchBar — fully wired to useSearch (SR-03).
             *
             * value         → useSearch.query (controlled input)
             * onChange      → useSearch.setQuery (updates query + debounce)
             * onSubmit      → useSearch.submitSearch (navigate to /search)
             * onFocus       → sets isFocused=true, resets activeIndex
             * onBlur        → sets isFocused=false, resets activeIndex
             * onKeyDown     → handles ArrowUp/Down/Enter/Escape navigation
             * suggestionsId → PANEL_ID for aria-controls
             * activeSuggestionId → current highlighted option id
             * isSuggestionsOpen → dynamic aria-expanded
             */}
            <SearchBar
              id="home-search-input"
              value={query}
              onChange={setQuery}
              onSubmit={submitSearch}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              suggestionsId={PANEL_ID}
              activeSuggestionId={activeSuggestionId}
              isSuggestionsOpen={isSuggestionsOpen}
              placeholder="Search a motorcycle — try 'GT 650'"
            />

            {/*
             * SearchSuggestions panel — positioned absolutely below SearchBar.
             * Controlled entirely via props from useSearch + page state.
             *
             * isOpen             → isSuggestionsOpen (focus + query length)
             * query              → useSearch.query (for highlighting)
             * suggestions        → useSearch.suggestions (empty until SR-07)
             * isLoading          → useSearch.isLoading (skeleton while fetching)
             * recentSearches     → useSearch.recentSearches (empty until SR-05)
             * activeIndex        → page-level keyboard nav state
             * onActiveIndexChange → setActiveIndex
             * onSelect           → handleSuggestionSelect (sets query + navigates)
             * onClearRecent      → handleClearRecent
             * onClose            → handleSuggestionClose
             *
             * NOTE: debouncedQuery is not passed to SearchSuggestions.
             * The panel uses raw query for match highlighting — the debounced
             * value drives the API call (SR-07), not the display logic.
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
              onClose={handleSuggestionClose}
            />
          </div>
        </section>

        {/* ── HERO: Rotating featured motorcycle ────────────────── */}
        <section
          aria-label="Featured motorcycles"
          className="home-hero-gap"
        >
          <BikeHero
            bikes={MOCK_FEATURED_BIKES}
            intervalMs={5000}
            aspectRatio="16/7"
            className="home-hero-container"
          />
        </section>

        {/* ── BROWSE SECTIONS ───────────────────────────────────── */}
        <div className="home-content-pad">

          {/* ── Browse by Brand ─────────────────────────────────── */}
          <section
            ref={brandSection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by brand"
            className={`home-section-gap will-animate${
              brandSection.isVisible ? ' is-visible' : ''
            }`}
          >
            <p className="home-section-label">Browse by Brand</p>
            <div className="brand-chips-track">
              {BRANDS.map((brand, index) => (
                <div
                  key={brand.slug}
                  className={`will-animate${
                    brandSection.isVisible ? ' is-visible' : ''
                  }`}
                  style={{
                    animationDelay: `${index * 60}ms`,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <BrandLogoChip
                    slug={brand.slug}
                    name={brand.name}
                    accentColor={brand.accentColor}
                    size={72}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Browse by Category ──────────────────────────────── */}
          <section
            ref={categorySection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by category"
            className={`home-section-gap will-animate${
              categorySection.isVisible ? ' is-visible' : ''
            }`}
          >
            <p className="home-section-label">Browse by Category</p>
            <div className="pill-tap-target home-pills-scroll">
              <CategoryPills scrollable={true} />
            </div>
          </section>

          {/* ── Browse by Price ─────────────────────────────────── */}
          <section
            ref={priceSection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by price"
            className={`home-section-gap will-animate${
              priceSection.isVisible ? ' is-visible' : ''
            }`}
          >
            <p className="home-section-label">Browse by Price</p>
            <div className="pill-tap-target home-pills-scroll home-price-section">
              <PriceRangePills scrollable={true} />
            </div>
          </section>

        </div>
      </main>
    </>
  )
}