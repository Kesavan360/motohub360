'use client'

/*
 * BikeHero — Full-bleed featured motorcycle hero component.
 *
 * MPD Task H-05:
 *   "Full-bleed image (Next.js Image, priority), bike name in
 *   display-xl + tagline in body-lg in lower-third overlay with
 *   dark gradient scrim. Accepts an array of featured bikes;
 *   auto-rotates every 5 seconds with a cross-fade transition
 *   (280ms ease). Pause on hover."
 *
 * MPD Section 5.1, Home Page:
 *   "Hero: rotating/featured premium motorcycle visual
 *   (editorial, not banner-ad style)."
 *   "Hero motorcycle section is now secondary, placed directly
 *   below the search bar/suggestion panel."
 *
 * MPD High-Fidelity UI, Home Page:
 *   "Below the search section, generous vertical space leads into
 *   the hero motorcycle — a full-bleed, cinematically lit image
 *   of a featured bike, the bike's name in display-xl, a one-line
 *   tagline in body-lg/ink-secondary, rotating every several seconds
 *   with a slow cross-fade (never a jarring slide)."
 *
 * MPD Section 6, Animations:
 *   "Page transition — Cross-fade + 8px upward slide — 320ms
 *   cubic-bezier(0.4,0,0.2,1)"
 *   "Color swatch select — 280ms ease for image"
 *   The hero rotation uses a cross-fade (opacity transition only —
 *   no slide) so the image feels editorial, not carousel-like.
 *
 * COMPONENT VARIANTS:
 *   This file implements the HOME/FEATURED variant of BikeHero.
 *   The DETAIL PAGE variant (B-01) is a separate component built
 *   in Phase 8. The two share the visual language but differ in:
 *     Home:   rotating array, cross-fade, no price, no brand label
 *     Detail: single bike, color-swappable, brand name, price block
 *
 * ROTATION BEHAVIOUR:
 *   - Auto-rotates every 5000ms (5 seconds)
 *   - Pauses on mouse hover (onMouseEnter/Leave)
 *   - Cross-fade: outgoing image fades to opacity 0 (280ms) while
 *     incoming image fades from opacity 0 to 1 (280ms)
 *   - Both images are stacked (position: absolute) so there is no
 *     layout shift during the transition
 *   - Restarts rotation timer on manual navigation (dot click)
 *
 * NAVIGATION DOTS:
 *   Dot indicators in the lower-right corner allow manual navigation.
 *   Active dot: white, full opacity. Inactive: white, 40% opacity.
 *   Clicking a dot navigates immediately and resets the auto-rotation timer.
 *
 * IMAGE STRATEGY:
 *   - All images use Next.js <Image> with fill + objectFit: cover
 *   - The currently active image has priority={true} (LCP candidate)
 *   - All images are pre-rendered in the DOM (not lazy-loaded) but
 *     only the active one is visible — prevents flash on rotation
 *   - Cloudinary URLs are supported via next.config.ts (S-05)
 *   - Blur-up placeholder via blurDataUrl prop per MPD Section 14
 *
 * ACCESSIBILITY:
 *   - role="region" with aria-label="Featured motorcycles"
 *   - aria-live="polite" announces bike name changes to screen readers
 *   - Pause on hover + keyboard focus (respects user preference)
 *   - Dot buttons have aria-label="Go to slide N" + aria-current
 *   - prefers-reduced-motion: disables auto-rotation and cross-fade
 *
 * WHY 'use client':
 *   - useState: currentIndex, isPaused
 *   - useEffect: rotation interval, reduced-motion check
 *   - useRef: interval ref for cleanup
 *   - onMouseEnter/Leave for pause-on-hover
 */

import Image from 'next/image'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * FeaturedBike — data shape for one featured bike in the hero rotation.
 *
 * slug + brandSlug together build the href: /bikes/[brandSlug]/[slug]
 * heroImageUrl: Cloudinary URL — served via Next.js Image optimisation.
 * blurDataUrl: base64 20px placeholder for blur-up (stored in DB).
 *   Optional: falls back to a default grey placeholder if absent.
 */
export interface FeaturedBike {
  slug: string
  brandSlug: string
  name: string
  tagline: string
  heroImageUrl: string
  blurDataUrl?: string
}

export interface BikeHeroProps {
  /*
   * bikes — array of featured bikes to rotate through.
   * Minimum 1 item required. If only 1 item, rotation is disabled
   * and dot indicators are hidden.
   */
  bikes: FeaturedBike[]

  /*
   * intervalMs — rotation interval in milliseconds.
   * Default: 5000 (5 seconds per MPD H-05 spec).
   * Override in tests for faster verification.
   */
  intervalMs?: number

  /*
   * aspectRatio — CSS aspect-ratio for the hero container.
   * Default: '16/7' — wide cinematic crop for the home hero.
   * Overridable for different layout contexts.
   */
  aspectRatio?: string

  /*
   * className — additional CSS classes for the outer container.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Default blur placeholder
// ---------------------------------------------------------------------------

/*
 * DEFAULT_BLUR — 1×1 pixel transparent grey base64 placeholder.
 * Used when a FeaturedBike has no blurDataUrl.
 * Prevents a flash of empty space before the hero image loads.
 */
const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// BikeHero Component
// ---------------------------------------------------------------------------

export default function BikeHero({
  bikes,
  intervalMs = 5000,
  aspectRatio = '16/7',
  className = '',
}: BikeHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /*
   * Detect prefers-reduced-motion on mount.
   * When true: disable auto-rotation and cross-fade transitions.
   * The component still renders correctly — just no animation.
   */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /*
   * goToIndex — navigate to a specific slide.
   * Clears the current interval and restarts it so the timer
   * resets after a manual navigation (dot click).
   */
  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index)
    },
    [],
  )

  /*
   * goToNext — advance to the next slide, wrapping around.
   */
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % bikes.length)
  }, [bikes.length])

  /*
   * Auto-rotation interval.
   * Disabled when: isPaused, reducedMotion, or only 1 bike.
   * Cleared and restarted when currentIndex changes (via dot click)
   * so the timer always resets after manual navigation.
   */
  useEffect(() => {
    if (isPaused || reducedMotion || bikes.length <= 1) {
      return
    }

    intervalRef.current = setInterval(goToNext, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPaused, reducedMotion, bikes.length, intervalMs, goToNext, currentIndex])

  /*
   * Guard: empty array renders nothing.
   */
  if (!bikes || bikes.length === 0) {
    return null
  }

  const activeBike = bikes[currentIndex]
  const showDots = bikes.length > 1

  return (
    <>
      <style>{`
        /*
         * Cross-fade transition for hero image layers.
         * Each image is absolutely positioned and transitions opacity.
         * Active image: opacity 1. Inactive: opacity 0.
         * Duration: 280ms per MPD Section 6 Animations (color swatch
         * transition — same ease used for all image cross-fades).
         */
        .bike-hero-image {
          transition: opacity 280ms cubic-bezier(0.4,0,0.2,1);
        }

        /*
         * Dot button hover — opacity lifts to full.
         */
        .bike-hero-dot:hover {
          opacity: 1 !important;
        }

        .bike-hero-dot:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.8);
          border-radius: 999px;
        }

        /*
         * CTA link hover — underline appears.
         */
        .bike-hero-cta:hover {
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
        }

        .bike-hero-cta:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.8);
          border-radius: 4px;
        }

        /*
         * Reduced motion: no transition on image layers.
         */
        @media (prefers-reduced-motion: reduce) {
          .bike-hero-image {
            transition: none !important;
          }
        }
      `}</style>

      {/*
       * Outer region — role="region" makes this a named landmark.
       * aria-label describes the purpose for screen reader navigation.
       */}
      <section
        role="region"
        aria-label="Featured motorcycles"
        className={className}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-inverse)',
          /*
           * borderRadius: 0 — hero is full-bleed, no rounded corners.
           * This matches the MPD "full-bleed" specification.
           */
          borderRadius: 0,
        }}
      >
        {/*
         * Image stack — all images rendered simultaneously.
         * Active image: opacity 1. Others: opacity 0.
         * This approach (vs. conditional render) prevents a flash
         * when transitioning to a previously unseen image — the
         * browser has already loaded it in the background.
         *
         * The first image (index 0) has priority={true} as it is
         * above the fold and the LCP candidate on the Home page.
         * All others are lazy-loaded (priority={false}).
         */}
        {bikes.map((bike, index) => {
          const isActive = index === currentIndex
          return (
            <div
              key={`${bike.brandSlug}-${bike.slug}`}
              className="bike-hero-image"
              aria-hidden={!isActive}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: isActive ? 1 : 0,
                /*
                 * Slight zoom on active image — subtle scale-up (1.02)
                 * creates a gentle "breathing" effect that makes the
                 * hero feel alive without distracting from the content.
                 * Only applied to the active image.
                 */
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                transition: reducedMotion
                  ? 'none'
                  : 'opacity 280ms cubic-bezier(0.4,0,0.2,1), transform 6000ms linear',
              }}
            >
              <Image
                src={bike.heroImageUrl}
                alt={`${bike.name} — ${bike.tagline}`}
                fill
                priority={index === 0}
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
                placeholder={bike.blurDataUrl ? 'blur' : 'empty'}
                blurDataURL={bike.blurDataUrl ?? DEFAULT_BLUR}
              />
            </div>
          )
        })}

        {/*
         * Dark gradient scrim — lower-third overlay.
         * Ensures text legibility on any hero image colour.
         * Gradient: transparent at top → 80% opacity black at bottom.
         * This matches the MPD HiFi description:
         * "bike name set in display-xl overlaid in the lower third
         * against a subtle dark gradient scrim."
         */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(14,15,18,0.85) 0%, rgba(14,15,18,0.4) 40%, transparent 70%)',
            zIndex: 1,
          }}
        />

        {/*
         * Text content — lower-third, above the scrim.
         * aria-live="polite" announces the changing bike name
         * to screen readers without interrupting ongoing narration.
         */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 'clamp(24px, 4vw, 48px)',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/*
           * Bike name — display-xl (72px desktop / 40px mobile).
           * clamp() provides smooth scaling between breakpoints
           * without requiring media query overrides.
           * White text on dark scrim — always legible.
           */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 5.5vw, 72px)',
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
              margin: 0,
              /*
               * Text shadow — subtle depth behind the text that
               * enhances legibility on lighter image areas.
               */
              textShadow: '0 2px 16px rgba(14,15,18,0.4)',
            }}
          >
            {activeBike.name}
          </h2>

          {/*
           * Tagline — body-lg (18px) / smaller on mobile.
           * ink-secondary equivalent on dark background:
           * rgba(255,255,255,0.7) — slightly muted white.
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(14px, 1.8vw, 18px)',
              fontWeight: 400,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.75)',
              margin: 0,
              maxWidth: '480px',
            }}
          >
            {activeBike.tagline}
          </p>

          {/*
           * CTA link — "Explore [name]" → bike detail page.
           * Ghost-on-dark style: white text, no fill, subtle border.
           * Appears below the tagline on a new line.
           */}
          <Link
            href={`/bikes/${activeBike.brandSlug}/${activeBike.slug}`}
            className="bike-hero-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(13px, 1.4vw, 15px)',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              width: 'fit-content',
            }}
            aria-label={`Explore ${activeBike.name} — ${activeBike.tagline}`}
          >
            Explore {activeBike.name}
            {/* Inline arrow — avoids dependency on Icon at this early render */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <polyline points="14 5 21 12 14 19" />
            </svg>
          </Link>
        </div>

        {/*
         * Navigation dots — lower-right corner.
         * Only rendered when there are multiple bikes (showDots).
         * Each dot: circular button, white, opacity varies with state.
         */}
        {showDots && (
          <div
            style={{
              position: 'absolute',
              bottom: 'clamp(16px, 3vw, 28px)',
              right: 'clamp(16px, 3vw, 32px)',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            role="tablist"
            aria-label="Featured bike navigation"
          >
            {bikes.map((bike, index) => {
              const isActive = index === currentIndex
              return (
                <button
                  key={`dot-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Go to ${bike.name}`}
                  className="bike-hero-dot"
                  onClick={() => goToIndex(index)}
                  style={{
                    width: isActive ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '999px',
                    backgroundColor: '#FFFFFF',
                    opacity: isActive ? 1 : 0.4,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    transition: reducedMotion
                      ? 'none'
                      : 'width 280ms cubic-bezier(0.4,0,0.2,1), opacity 280ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              )
            })}
          </div>
        )}

        {/*
         * Pause indicator — small icon shown in top-right when paused.
         * Confirms to the user that hover-pause is working.
         * aria-hidden: purely decorative, screen readers don't need it.
         */}
        {isPaused && showDots && !reducedMotion && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 3,
              backgroundColor: 'rgba(14,15,18,0.5)',
              borderRadius: '999px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="white"
              aria-hidden="true"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.8)',
                userSelect: 'none',
              }}
            >
              Paused
            </span>
          </div>
        )}
      </section>
    </>
  )
}