'use client'

/*
 * BikeMobileActionBar — Sticky bottom action bar for mobile.
 *
 * MPD Task B-08:
 *   "Mobile action bar — sticky bottom bar on mobile. Contains
 *   ex-showroom price (compact mono) and 'Get On-Road Price' CTA
 *   button (accent color). Hides when the price block is visible.
 *   Safe area insets for iPhone home bar."
 *
 * MPD Section 5.3, Bike Detail Page — Mobile:
 *   "Sticky bottom action bar: always visible when scrolled past the
 *   price block. Contains price (mono, compact) + primary CTA button.
 *   Slides in from the bottom when the price block leaves the viewport.
 *   Slides out when price block re-enters. Safe area bottom padding
 *   for iPhone Dynamic Island / home indicator."
 *
 * VISIBILITY LOGIC:
 *   Uses IntersectionObserver to watch the `.bike-price-block` element.
 *   When the price block IS visible in the viewport → bar is hidden.
 *   When the price block is NOT visible → bar slides in from the bottom.
 *
 *   The `priceBlockId` prop is the HTML id of the price block element
 *   in page.tsx. The bar listens on this element.
 *
 *   Default: hidden (assumes price block is above the fold on load).
 *   IntersectionObserver updates the state after mount.
 *
 * ANIMATION:
 *   Slides in/out via CSS transform: translateY(100%) → translateY(0).
 *   200ms ease-out cubic-bezier — snappy but not jarring.
 *   opacity transition for smoother visual feel.
 *
 * DESKTOP HIDDEN:
 *   The bar is hidden on desktop (≥ 769px) via CSS `display: none`.
 *   The IntersectionObserver still runs but has no visual effect.
 *   This is intentional — CSS is cheaper than a resize listener.
 *
 * SAFE AREA:
 *   `padding-bottom: env(safe-area-inset-bottom)` via @supports.
 *   Prevents the CTA button from being obscured by the iPhone home
 *   indicator or Dynamic Island gesture area.
 *   Falls back gracefully on devices without safe area (padding: 0).
 *
 * CTA BUTTON:
 *   "Get On-Road Price" — the primary conversion action for the page.
 *   On click: scrolls back to the price block (smooth scroll).
 *   The price block contains the on-road price footnote and ex-showroom
 *   price, which is the closest V1 can offer to a live on-road quote.
 *   In a future phase, this could open a modal for dealer enquiry.
 *
 * PRICE FORMAT:
 *   Matches the page price block format: formatted in Lakhs (₹X.XXL).
 *   `formatPriceInLakhs` from constants/priceRanges (S-08).
 *
 * WHY 'use client':
 *   useState (isVisible)
 *   useEffect (IntersectionObserver setup/teardown)
 *   useRef (observer ref)
 *   onClick (scroll to price block)
 */

import { useEffect, useRef, useState } from 'react'
import { formatPriceInLakhs } from '@/constants/priceRanges'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeMobileActionBarProps {
  /*
   * price — ex-showroom price in INR.
   * Formatted via formatPriceInLakhs and displayed in the bar.
   */
  price: number

  /*
   * bikeName — used in the aria-label on the action bar region.
   */
  bikeName: string

  /*
   * accentColor — brand accent hex for the CTA button background.
   * Example: '#7A2E2E' for Royal Enfield.
   */
  accentColor: string

  /*
   * priceBlockId — the HTML id of the price block element to observe.
   * The bar hides when this element is in the viewport.
   * Default: 'bike-price-block'
   */
  priceBlockId?: string
}

// ---------------------------------------------------------------------------
// BikeMobileActionBar Component
// ---------------------------------------------------------------------------

export default function BikeMobileActionBar({
  price,
  bikeName,
  accentColor,
  priceBlockId = 'bike-price-block',
}: BikeMobileActionBarProps) {
  /*
   * isVisible — whether the action bar is currently shown.
   * Starts false (price block is above fold on initial load).
   * Updated by IntersectionObserver.
   */
  const [isVisible, setIsVisible] = useState<boolean>(false)

  /*
   * observerRef — stores the IntersectionObserver instance.
   * Cleaned up on unmount.
   */
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ── IntersectionObserver setup ────────────────────────────────────

  useEffect(() => {
    /*
     * Find the price block element by id.
     * If not found (e.g. on a page without the price block),
     * show the bar by default as a safe fallback.
     */
    const priceBlock = document.getElementById(priceBlockId)

    if (!priceBlock) {
      setIsVisible(true)
      return
    }

    /*
     * IntersectionObserver — watches the price block.
     *
     * threshold: 0.1 — fire when 10% of the price block enters or
     * exits the viewport. Prevents flickering on the exact boundary.
     *
     * isIntersecting: true  → price block is visible → hide bar.
     * isIntersecting: false → price block is gone   → show bar.
     */
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsVisible(!entry.isIntersecting)
        }
      },
      { threshold: 0.1 },
    )

    observerRef.current.observe(priceBlock)

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [priceBlockId])

  // ── Handlers ─────────────────────────────────────────────────────

  /*
   * handleCTAClick — scrolls the price block into view.
   * Smooth scroll behavior for a polished feel.
   *
   * In a future phase this opens a dealer enquiry modal or a lead
   * capture form. For V1, scrolling to the price block shows the
   * on-road price footnote and ex-showroom pricing detail.
   */
  function handleCTAClick(): void {
    const priceBlock = document.getElementById(priceBlockId)
    if (priceBlock) {
      priceBlock.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ── Format price ──────────────────────────────────────────────────

  const formattedPrice = formatPriceInLakhs(price)

  return (
    <>
      <style>{`
        /*
         * Action bar — fixed to bottom, full width.
         * Hidden on desktop via display: none.
         * Slides in/out from the bottom via transform + opacity.
         */
        .bike-action-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background-color: var(--color-surface-raised);
          border-top: 1px solid var(--color-border-hairline);
          box-shadow: 0 -4px 16px rgba(14,15,18,0.08);
          transition:
            transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
            opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        /*
         * Safe area inset — accounts for iPhone home indicator.
         * The extra padding keeps the CTA above the gesture bar.
         */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bike-action-bar {
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
          }
        }

        /*
         * Hidden state — slides off the bottom edge.
         * pointer-events: none prevents invisible bar from blocking taps.
         */
        .bike-action-bar--hidden {
          transform: translateY(100%);
          opacity: 0;
          pointer-events: none;
        }

        /*
         * Visible state — slides into view.
         */
        .bike-action-bar--visible {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        /*
         * Hide on desktop — the bar is a mobile-only element.
         * CSS approach is cheaper than a JS resize listener.
         */
        @media (min-width: 769px) {
          .bike-action-bar {
            display: none !important;
          }
        }

        /*
         * CTA button hover + active states.
         */
        .bike-action-cta:hover {
          filter: brightness(1.08);
        }

        .bike-action-cta:active {
          filter: brightness(0.92);
          transform: scale(0.98);
        }

        .bike-action-cta:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--color-surface-base),
                      0 0 0 4px ${accentColor};
          border-radius: 10px;
        }
      `}</style>

      <div
        role="region"
        aria-label={`${bikeName} — quick actions`}
        aria-hidden={!isVisible}
        className={`bike-action-bar ${
          isVisible
            ? 'bike-action-bar--visible'
            : 'bike-action-bar--hidden'
        }`}
      >
        {/* ── Price display ─────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {/*
           * "Starting at" label — makes it clear this is the base price.
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              margin: '0 0 2px',
              lineHeight: 1,
            }}
          >
            Starting at
          </p>

          {/*
           * Price — monospace, compact.
           * Same visual language as the price block above.
           */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '3px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--color-ink-primary)',
                lineHeight: 1.1,
              }}
            >
              {formattedPrice}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                lineHeight: 1,
              }}
            >
              *
            </span>
          </div>

          {/*
           * "Ex-showroom" footnote — clarifies the price type.
           * Important for Indian motorcycle market context.
           */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              margin: '2px 0 0',
              lineHeight: 1,
            }}
          >
            Ex-showroom
          </p>
        </div>

        {/* ── CTA button ────────────────────────────────────────── */}
        {/*
         * "Get On-Road Price" — the primary conversion CTA.
         * Scroll to price block on click (V1 behaviour).
         * Background: brand accent color.
         * Text: always white regardless of accent color.
         * tabIndex={-1} when hidden — prevents hidden bar from
         * appearing in the tab order when not visible.
         */}
        <button
          type="button"
          className="bike-action-cta"
          onClick={handleCTAClick}
          tabIndex={isVisible ? 0 : -1}
          aria-label={`Get on-road price for ${bikeName}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '44px',
            padding: '0 20px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: accentColor,
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            transition:
              'filter 150ms cubic-bezier(0.4,0,0.2,1), ' +
              'transform 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          Get On-Road Price
        </button>
      </div>
    </>
  )
}