/*
 * Home page — MotoHub360 primary landing page ( / )
 *
 * MPD Task H-06:
 *   "Assemble: SearchBar (hero) → BikeHero (featured, with mock data)
 *   → Brand logo grid (mock 6 brands) → Category pills → Price pills.
 *   Use space-7/space-8 between sections per Design System spacing."
 *
 * MPD Section 5.1, Home Page layout order (top to bottom):
 *   1. Header (via root layout — SiteHeader)
 *   2. MotoHub wordmark — display-lg, centered
 *   3. SearchBar — dominant, full-width, hero-sized (MOST IMPORTANT)
 *   4. SearchSuggestions panel (wired in SR-03 — placeholder here)
 *   5. Hero motorcycle — full-bleed, rotating (BikeHero)
 *   6. Browse by Brand — BrandLogoChip grid
 *   7. Browse by Category — CategoryPills
 *   8. Browse by Price — PriceRangePills
 *   9. Footer (via root layout)
 *
 * MPD High-Fidelity UI, Home Page:
 *   "The page opens almost entirely on the search experience —
 *   MotoHub is not asking to be browsed, it's offering to be asked."
 *   "The MotoHub wordmark sits quietly above it in display-lg,
 *   no tagline clutter beneath — the search bar is the tagline."
 *
 * SERVER COMPONENT:
 *   This page is a Server Component — no 'use client' directive.
 *   SearchBar is 'use client' (SR-01 wiring needs client state) but
 *   is imported here — Next.js handles the client boundary at the
 *   SearchBar component level, not the page level.
 *   BikeHero is 'use client' (rotation interval) — same pattern.
 *
 * MOCK DATA:
 *   BikeHero uses MOCK_FEATURED_BIKES from mockData.ts (H-07).
 *   BrandLogoChip uses BRANDS from constants/brands.ts (S-08).
 *   Both are replaced with real MongoDB data in DB-08.
 *
 * SEARCH WIRING:
 *   SearchBar's onChange/onSubmit/onFocus/onBlur props are wired
 *   to useSearch (SR-01) and SearchSuggestions (SR-02) in SR-03.
 *   For H-06, SearchBar renders in stub mode (no props) — the
 *   search icon and focus states work; typing logs to console.
 *
 * SPACING:
 *   MPD Section 6 Spacing System:
 *     space-7: 80px — major section breaks (desktop)
 *     space-8: 120px — hero-to-content breathing room (desktop)
 *   Mobile: space-7 → 48px, space-8 → 64px via CSS media query.
 *
 * RENDERING:
 *   SSG (Static Site Generation) — this page is pre-built at deploy
 *   time and served from Vercel's CDN. No database queries at runtime
 *   for the home page — all content is either static (brand chips,
 *   category/price pills) or mock (hero bikes until DB-08).
 */

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
  return (
    <>
      {/*
       * Scoped spacing styles.
       * CSS custom properties from D-01 are used directly.
       * Media queries apply the mobile compression defined in MPD Section 6:
       *   space-7: 80px desktop → 48px mobile
       *   space-8: 120px desktop → 64px mobile
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
      `}</style>

      {/*
       * Page wrapper — surface-base background, full viewport height.
       * The root layout (built in L-06 as part of next tasks) will
       * render SiteHeader above this and Footer below.
       * For now this page is self-contained with correct spacing.
       */}
      <main
        id="home-main"
        role="main"
        style={{
          backgroundColor: 'var(--color-surface-base)',
          minHeight: '100vh',
        }}
      >

        {/* ── ABOVE-FOLD: Wordmark + Search ─────────────────────── */}
        {/*
         * Above-fold section: centered wordmark + dominant search bar.
         * This is the first thing the user sees.
         * Padding-top: generous breathing room from the header.
         * Padding-bottom: matches the spacing before the hero below.
         *
         * MPD HiFi: "Centered, roughly 30% down the viewport on
         * desktop (higher on mobile, near the top under the header)"
         */}
        <section
          aria-label="Search motorcycles"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 'clamp(48px, 8vh, 96px) 32px 0',
          }}
        >
          {/*
           * MotoHub360 wordmark — display-lg (48px desktop / 32px mobile).
           * Sits quietly above the search bar.
           * MPD HiFi: "The MotoHub wordmark sits quietly above it in
           * display-lg, no tagline clutter beneath."
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
           * Search bar container — max-width 680px on desktop, full
           * width on mobile. Centered via margin auto.
           *
           * MPD HiFi: "large, r-full rounded, surface-raised on
           * surface-base, with a soft shadow-md that intensifies on focus."
           *
           * SearchBar is in stub mode here (no onChange/onSubmit props).
           * SR-03 wires it to useSearch + SearchSuggestions.
           *
           * The suggestions panel (SearchSuggestions, SR-02) will be
           * rendered here as a child/sibling after SR-03 is implemented.
           * The container position:relative allows the panel to position
           * absolutely below the search bar without affecting page layout.
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
              /*
               * SR-03 placeholder: onFocus/onBlur will show/hide
               * the SearchSuggestions panel when wired in Phase 6.
               */
            />

            {/*
             * SR-03 PLACEHOLDER — SearchSuggestions panel.
             * Replace this comment with <SearchSuggestions /> after SR-02.
             *
             * <SearchSuggestions
             *   isOpen={isSuggestionsOpen}
             *   suggestions={suggestions}
             *   recentSearches={recentSearches}
             *   onSelect={handleSuggestionSelect}
             *   onClose={handleSuggestionsClose}
             *   query={query}
             * />
             */}
          </div>
        </section>

        {/* ── HERO: Rotating featured motorcycle ────────────────── */}
        {/*
         * BikeHero sits below the search section with space-8 gap.
         * Full-bleed — no horizontal padding on the hero section.
         *
         * MPD Section 5.1:
         *   "Hero motorcycle section is now secondary, placed directly
         *   below the search bar/suggestion panel."
         *
         * The home-hero-gap class applies:
         *   Desktop: 120px (space-8)
         *   Mobile:  64px (compressed space-8)
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

        {/* ── BROWSE SECTIONS: Brand, Category, Price ───────────── */}
        {/*
         * All three browse sections share the same horizontal padding
         * and gap rhythm. Each is a distinct <section> with an
         * aria-label for screen reader navigation.
         *
         * Section heading pattern:
         *   Small uppercase label (body-sm, ink-tertiary, tracking-widest)
         *   followed immediately by the pill/chip row.
         *   No large display headings — these are quiet browse aids.
         *
         * MPD HiFi: "Browse by Category and Browse by Price as quiet
         * pill-button rows — text-forward, no icons needed."
         */}
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 32px',
          }}
        >

          {/* ── Browse by Brand ─────────────────────────────────── */}
          <section
            aria-label="Browse by brand"
            className="home-section-gap"
          >
            {/*
             * Section label — uppercase body-sm per MPD section heading pattern.
             */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 24px',
              }}
            >
              Browse by Brand
            </p>

            {/*
             * Brand logo chip grid.
             * Desktop: horizontal row, wraps if needed.
             * Mobile: horizontal scroll (BrandLogoChip is flex-shrink: 0).
             *
             * MPD HiFi: "circular r-full logo chips on surface-sunken,
             * monochrome by default, gaining their brand accent color
             * and a subtle lift on hover."
             *
             * BRANDS from constants/brands.ts (S-08) provides the
             * initial 6 brands. Additional brands are added via admin.
             * BrandLogoChip uses fallback initials (no logoUrl) until
             * brand logos are uploaded via admin (A-08 → DB-03).
             */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                /*
                 * On mobile: horizontal scroll without visible scrollbar.
                 * overflowX: auto + flexWrap: nowrap achieves this.
                 * Mirroring the CategoryPills/PriceRangePills pattern.
                 */
              }}
              className="brand-chips-track"
            >
              {BRANDS.map((brand) => (
                <BrandLogoChip
                  key={brand.slug}
                  slug={brand.slug}
                  name={brand.name}
                  accentColor={brand.accentColor}
                  /*
                   * logoUrl is absent here — BrandLogoChip renders
                   * initials fallback. Cloudinary logo URLs are set
                   * after brands are added to MongoDB via admin (DB-03).
                   */
                  size={80}
                />
              ))}
            </div>
          </section>

          {/* ── Browse by Category ──────────────────────────────── */}
          <section
            aria-label="Browse by category"
            className="home-section-gap"
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 16px',
              }}
            >
              Browse by Category
            </p>

            {/*
             * CategoryPills — scrollable on mobile per H-03.
             * No active slug on Home page (no filter selected).
             */}
            <CategoryPills scrollable={true} />
          </section>

          {/* ── Browse by Price ─────────────────────────────────── */}
          <section
            aria-label="Browse by price"
            className="home-section-gap"
            style={{
              /*
               * Bottom padding — space between the last browse section
               * and the Footer. Uses space-8 (120px desktop / 64px mobile)
               * for generous breathing room before the dark footer.
               */
              paddingBottom: 'clamp(64px, 10vw, 120px)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 16px',
              }}
            >
              Browse by Price
            </p>

            {/*
             * PriceRangePills — scrollable on mobile per H-04.
             * No active slug on Home page.
             */}
            <PriceRangePills scrollable={true} />
          </section>
        </div>
      </main>

      {/*
       * Mobile horizontal scroll style for brand chips track.
       * Mirrors the CategoryPills/PriceRangePills scrollbar-hide pattern.
       */}
      <style>{`
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
          #home-main {
            overflow-x: hidden;
          }
        }
        @media (max-width: 768px) {
          section[aria-label="Search motorcycles"] {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          div[style*="padding: 0 32px"] {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }
      `}</style>
    </>
  )
}