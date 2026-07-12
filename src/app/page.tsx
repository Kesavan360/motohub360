'use client'

/*
 * Home page — MotoHub360 primary landing page ( / )
 *
 * MPD Task H-06: Assembled Home page with all sections.
 * MPD Task H-08: Add scroll-reveal animations to brand, category,
 *   and price sections. Stagger delay 60ms between brand logo chips.
 *
 * CHANGES FROM H-06:
 *   - Added 'use client' — required because useScrollReveal uses
 *     useEffect + useRef (client hooks).
 *   - Brand section, Category section, Price section now use
 *     useScrollReveal to trigger fade-slide-up on viewport entry.
 *   - Brand logo chips have staggered animation delay (index × 60ms).
 *   - will-animate / is-visible CSS classes from D-04 are applied.
 *
 * MPD Section 6, Animations:
 *   "Scroll reveal — Sections fade + 16px slide-up as they enter
 *   viewport, staggered slightly for grouped elements (e.g. feature
 *   icons). 400ms, triggered once per element."
 *   "Stagger delay 60ms between brand logo chips."
 *
 * MPD Task H-08:
 *   "Add fade-slide-up animation to Brand logo section, Category
 *   pills, and Price pills sections — triggered as they scroll into
 *   viewport using IntersectionObserver in a useScrollReveal hook.
 *   Stagger delay 60ms between brand logo chips."
 *
 * ANIMATION CLASSES (defined in D-04 globals.css):
 *   .will-animate     → opacity: 0, transform: translateY(16px)
 *   .will-animate.is-visible → animation: fade-slide-up 400ms ease forwards
 *
 * STAGGER PATTERN for brand chips:
 *   Each BrandLogoChip wrapper has animationDelay set inline:
 *   style={{ animationDelay: `${index * 60}ms` }}
 *   This creates a left-to-right wave reveal effect.
 */

import { useScrollReveal } from '@/hooks/useScrollReveal'
import SearchBar from '@/components/search/SearchBar'
import BikeHero from '@/components/bike/BikeHero'
import BrandLogoChip from '@/components/listing/BrandLogoChip'
import CategoryPills from '@/components/listing/CategoryPills'
import PriceRangePills from '@/components/listing/PriceRangePills'
import { BRANDS } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'

// ---------------------------------------------------------------------------
// Home Page Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  /*
   * Three separate scroll-reveal observers — one per animated section.
   * Each section animates independently as it enters the viewport.
   * Using separate hooks (not one shared hook) so each section has
   * its own intersection state and fires independently.
   */
  const brandSection = useScrollReveal({ threshold: 0.05, rootMargin: '0px 0px -30px 0px' })
  const categorySection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
  const priceSection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  return (
    <>
      {/*
       * Scoped spacing + scroll-reveal override styles.
       *
       * The .will-animate and .is-visible classes are defined globally
       * in D-04 globals.css. The overrides here set the animation-delay
       * via the inline style prop on individual brand chip wrappers
       * (not via CSS here — inline style is the correct approach for
       * dynamic delay values based on index).
       *
       * .home-section-gap / .home-hero-gap: spacing between sections.
       * Mobile compression per MPD Section 6 Spacing System.
       */}
      <style>{`
        .home-section-gap {
          margin-top: 80px;
        }
        .home-hero-gap {
          margin-top: 120px;
        }
        .home-search-wrapper {
          max-width: 680px;
        }

        @media (max-width: 768px) {
          .home-section-gap {
            margin-top: 48px;
          }
          .home-hero-gap {
            margin-top: 64px;
          }
          .home-search-wrapper {
            max-width: 100%;
          }
        }

        /*
         * Brand chips track — mobile horizontal scroll.
         * Same pattern as CategoryPills / PriceRangePills.
         */
        .brand-chips-track::-webkit-scrollbar {
          display: none;
        }
        .brand-chips-track {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @media (max-width: 768px) {
          .brand-chips-track {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            padding-bottom: 4px;
          }
        }

        /*
         * Mobile padding reduction for content sections.
         */
        @media (max-width: 768px) {
          .home-content-pad {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .home-search-pad {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }

        /*
         * Section label — consistent uppercase style across browse sections.
         */
        .home-section-label {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 24px;
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
          className="home-search-pad"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'clamp(48px, 8vh, 96px) 32px 0',
          }}
        >
          {/*
           * MotoHub360 wordmark — display-lg (48px desktop / 32px mobile).
           * No scroll-reveal on the wordmark — it is above the fold and
           * visible immediately. Animating it would feel clunky.
           */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-primary)',
              textAlign: 'center',
              margin: '0 0 32px',
              userSelect: 'none',
            }}
          >
            MotoHub
            <span style={{ color: 'var(--color-ink-tertiary)' }}>360</span>
          </h1>

          {/*
           * Search bar — also above fold, no scroll-reveal.
           * Stub mode: wired to useSearch + SearchSuggestions in SR-03.
           */}
          <div
            className="home-search-wrapper"
            style={{
              width: '100%',
              position: 'relative',
            }}
          >
            <SearchBar
              id="home-search-input"
              placeholder="Search a motorcycle — try 'GT 650'"
            />
            {/*
             * SR-03 PLACEHOLDER: <SearchSuggestions /> added here in Phase 6.
             */}
          </div>
        </section>

        {/* ── HERO: Rotating featured motorcycle ────────────────── */}
        {/*
         * No scroll-reveal on the hero — it is the largest element
         * on the page and positioned immediately below the fold.
         * Animating it would create a jarring empty space flash.
         * The hero appears instantly — premium, confident, immediate.
         */}
        <section
          aria-label="Featured motorcycles"
          className="home-hero-gap"
        >
          <BikeHero
            bikes={MOCK_FEATURED_BIKES}
            intervalMs={5000}
          />
        </section>

        {/* ── BROWSE SECTIONS ───────────────────────────────────── */}
        <div
          className="home-content-pad"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 32px',
          }}
        >

          {/* ── Browse by Brand ─────────────────────────────────── */}
          {/*
           * SCROLL-REVEAL: The entire brand section fades + slides up
           * when it enters the viewport. ref is attached to the section.
           *
           * Each individual BrandLogoChip also has a stagger delay
           * (index × 60ms) so they wave in left-to-right.
           *
           * MPD H-08: "Stagger delay 60ms between brand logo chips."
           *
           * The will-animate/is-visible pattern:
           *   - will-animate: sets initial hidden state (opacity 0, translateY 16px)
           *   - is-visible: triggers the fade-slide-up keyframe (400ms)
           */}
          <section
            ref={brandSection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by brand"
            className={`home-section-gap will-animate${brandSection.isVisible ? ' is-visible' : ''}`}
          >
            <p className="home-section-label">
              Browse by Brand
            </p>

            {/*
             * Brand chips container — flex row, wraps on desktop,
             * scrolls horizontally on mobile.
             *
             * Each chip wrapper has an animationDelay set via inline style.
             * The delay only applies when the is-visible class is active
             * (because the fade-slide-up animation is triggered by is-visible).
             * When is-visible fires, each chip starts its own animation
             * with the staggered delay — creating the wave effect.
             *
             * The wrapper div (not BrandLogoChip itself) carries the
             * stagger style so BrandLogoChip stays pure and reusable.
             */}
            <div
              className="brand-chips-track"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              {BRANDS.map((brand, index) => (
                <div
                  key={brand.slug}
                  style={{
                    /*
                     * Stagger delay: each chip animates 60ms after the previous.
                     * Index 0: 0ms, Index 1: 60ms, Index 2: 120ms, etc.
                     * Applied as animationDelay so it takes effect when the
                     * parent section's is-visible class triggers the animation.
                     *
                     * Note: animationDelay only has effect when an animation
                     * is running. Setting it on a static element has no cost.
                     */
                    animationDelay: `${index * 60}ms`,
                    /*
                     * will-animate state is inherited from the parent section.
                     * Individual chips don't need their own will-animate class
                     * because the parent section already handles the overall
                     * section reveal. The stagger only affects timing within
                     * the parent animation — not a separate animation per chip.
                     *
                     * For the stagger to work correctly on individual chips,
                     * each chip needs its own will-animate + is-visible classes.
                     */
                  }}
                  className={`will-animate${brandSection.isVisible ? ' is-visible' : ''}`}
                >
                  <BrandLogoChip
                    slug={brand.slug}
                    name={brand.name}
                    accentColor={brand.accentColor}
                    size={80}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── Browse by Category ──────────────────────────────── */}
          {/*
           * SCROLL-REVEAL: Category section fades + slides up as a unit.
           * No per-pill stagger — pills are small and close together,
           * staggering them would look too busy.
           * MPD H-08 only mentions stagger for brand logo chips.
           */}
          <section
            ref={categorySection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by category"
            className={`home-section-gap will-animate${categorySection.isVisible ? ' is-visible' : ''}`}
          >
            <p className="home-section-label">
              Browse by Category
            </p>
            <CategoryPills scrollable={true} />
          </section>

          {/* ── Browse by Price ─────────────────────────────────── */}
          {/*
           * SCROLL-REVEAL: Price section fades + slides up as a unit.
           * Same pattern as category section — no per-pill stagger.
           */}
          <section
            ref={priceSection.ref as React.RefObject<HTMLElement>}
            aria-label="Browse by price"
            className={`home-section-gap will-animate${priceSection.isVisible ? ' is-visible' : ''}`}
            style={{
              paddingBottom: 'clamp(64px, 10vw, 120px)',
            }}
          >
            <p className="home-section-label">
              Browse by Price
            </p>
            <PriceRangePills scrollable={true} />
          </section>

        </div>
      </main>
    </>
  )
}