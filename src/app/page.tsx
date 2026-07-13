'use client'

import { useScrollReveal } from '@/hooks/useScrollReveal'
import SearchBar from '@/components/search/SearchBar'
import BikeHero from '@/components/bike/BikeHero'
import BrandLogoChip from '@/components/listing/BrandLogoChip'
import CategoryPills from '@/components/listing/CategoryPills'
import PriceRangePills from '@/components/listing/PriceRangePills'
import { BRANDS } from '@/constants/brands'
import { MOCK_FEATURED_BIKES } from '@/lib/mockData'

export default function HomePage() {
  const brandSection = useScrollReveal({ threshold: 0.05, rootMargin: '0px 0px -30px 0px' })
  const categorySection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
  const priceSection = useScrollReveal({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

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
            <SearchBar id="home-search-input" placeholder="Search a motorcycle — try 'GT 650'" />
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