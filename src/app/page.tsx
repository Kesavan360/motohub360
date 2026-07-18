'use client'

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

export default function HomePage() {
  const brandSection = useScrollReveal({ threshold: 0.05, rootMargin: '0px 0px -30px 0px' })
  const categorySection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
  const priceSection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  const router = useRouter()

  const {
    query,
    setQuery,
    suggestions,
    isLoading,
    isFocused,
    setIsFocused,
    clearSearch: _clearSearch,
    submitSearch,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  } = useSearch({
    debounceMs: 150,
    minQueryLength: 2,
    onSearch: (q: string) => {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    },
  })

  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const isSuggestionsOpen: boolean =
    isFocused &&
    (query.trim().length >= 2 || recentSearches.length > 0)

  const activeSuggestionId: string | undefined =
    activeIndex >= 0 ? `${OPTION_ID_PREFIX}${activeIndex}` : undefined

  const navigableCount: number = (() => {
    if (suggestions.length > 0) return Math.min(suggestions.length, 8)
    if (recentSearches.length > 0 && query.trim().length < 2) return Math.min(recentSearches.length, 5)
    return 0
  })()

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

  const handleSuggestionClose = useCallback(() => {
    setIsFocused(false)
    setActiveIndex(-1)
  }, [setIsFocused])

  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setActiveIndex(-1)
  }, [clearRecentSearches])

  const handleSearchFocus = useCallback(() => {
    setIsFocused(true)
    setActiveIndex(-1)
  }, [setIsFocused])

  const handleSearchBlur = useCallback(() => {
    setIsFocused(false)
    setActiveIndex(-1)
  }, [setIsFocused])

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (!isSuggestionsOpen || navigableCount === 0) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => (prev >= navigableCount - 1 ? 0 : prev + 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => (prev <= 0 ? navigableCount - 1 : prev - 1))
          break
        case 'Enter':
          if (activeIndex >= 0) {
            e.preventDefault()
            const selectedTerm: string =
              suggestions.length > 0
                ? (suggestions[activeIndex]?.label ?? '')
                : (recentSearches[activeIndex] ?? '')
            if (selectedTerm) handleSuggestionSelect(selectedTerm)
          }
          break
        case 'Escape':
          setIsFocused(false)
          setActiveIndex(-1)
          break
        case 'Tab':
          setIsFocused(false)
          setActiveIndex(-1)
          break
        default:
          break
      }
    },
    [isSuggestionsOpen, navigableCount, activeIndex, suggestions, recentSearches, handleSuggestionSelect, setIsFocused],
  )

  return (
    <>
      <style>{`
        .home-section-gap { margin-top: 80px; }
        .home-hero-gap { margin-top: 120px; }
        .home-search-wrapper { width: 100%; max-width: 680px; position: relative; }
        .home-content-pad { max-width: 1440px; margin: 0 auto; padding: 0 32px; }
        .home-section-label { font-family: var(--font-body); font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-ink-tertiary); margin: 0 0 24px; }
        .brand-chips-track { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
        .brand-chips-track::-webkit-scrollbar { display: none; }
        .brand-chips-track { -ms-overflow-style: none; scrollbar-width: none; }
        .home-pills-scroll::-webkit-scrollbar { display: none; }
        .home-pills-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .pill-tap-target { padding: 2px 0; }
        .home-price-section { padding-bottom: clamp(64px, 10vw, 120px); }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .home-price-section { padding-bottom: calc(clamp(64px, 10vw, 120px) + env(safe-area-inset-bottom)); }
        }
        @media (max-width: 768px) {
          .home-section-gap { margin-top: 48px; }
          .home-hero-gap { margin-top: 64px; }
          .home-content-pad { padding: 0 20px; }
          .home-search-wrapper { max-width: 100%; }
          .home-search-section { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (max-width: 480px) {
          .brand-chips-track { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 12px !important; align-items: start; }
          .home-section-label { margin-bottom: 16px !important; }
          .home-hero-container { aspect-ratio: 9 / 10 !important; }
        }
        @media (min-width: 481px) and (max-width: 768px) {
          .home-hero-container { aspect-ratio: 16 / 9 !important; }
        }
      `}</style>
      <main id="home-main" role="main" style={{ backgroundColor: 'var(--color-surface-base)', minHeight: '100vh', overflowX: 'hidden' }}>
        <section aria-label="Search motorcycles" className="home-search-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(40px, 8vh, 96px) 32px 0' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 48px)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'var(--color-ink-primary)', textAlign: 'center', margin: '0 0 clamp(20px, 3vw, 32px)', userSelect: 'none' }}>
            MotoHub<span style={{ color: 'var(--color-ink-tertiary)' }}>360</span>
          </h1>
          <div className="home-search-wrapper">
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
        <section aria-label="Featured motorcycles" className="home-hero-gap">
          <BikeHero bikes={MOCK_FEATURED_BIKES} intervalMs={5000} aspectRatio="16/7" className="home-hero-container" />
        </section>
        <div className="home-content-pad">
          <section ref={brandSection.ref as React.RefObject<HTMLElement>} aria-label="Browse by brand" className={`home-section-gap will-animate${brandSection.isVisible ? ' is-visible' : ''}`}>
            <p className="home-section-label">Browse by Brand</p>
            <div className="brand-chips-track">
              {BRANDS.map((brand, index) => (
                <div key={brand.slug} className={`will-animate${brandSection.isVisible ? ' is-visible' : ''}`} style={{ animationDelay: `${index * 60}ms`, display: 'flex', justifyContent: 'center' }}>
                  <BrandLogoChip slug={brand.slug} name={brand.name} accentColor={brand.accentColor} size={72} />
                </div>
              ))}
            </div>
          </section>
          <section ref={categorySection.ref as React.RefObject<HTMLElement>} aria-label="Browse by category" className={`home-section-gap will-animate${categorySection.isVisible ? ' is-visible' : ''}`}>
            <p className="home-section-label">Browse by Category</p>
            <div className="pill-tap-target home-pills-scroll"><CategoryPills scrollable={true} /></div>
          </section>
          <section ref={priceSection.ref as React.RefObject<HTMLElement>} aria-label="Browse by price" className={`home-section-gap will-animate${priceSection.isVisible ? ' is-visible' : ''}`}>
            <p className="home-section-label">Browse by Price</p>
            <div className="pill-tap-target home-pills-scroll home-price-section"><PriceRangePills scrollable={true} /></div>
          </section>
        </div>
      </main>
    </>
  )
}