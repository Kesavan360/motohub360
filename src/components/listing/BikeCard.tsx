'use client'

/*
 * BikeCard — Motorcycle listing card component.
 *
 * MPD Task LP-01:
 *   "Full spec per Design System: 4:3 image (Next.js Image, lazy),
 *   bike name (display-md), tagline (body-sm, ink-secondary), price
 *   (data-md, mono), nav arrow icon (bottom-right, accent on hover).
 *   Hover: image scale 1.03, shadow-md lift (400ms ease). Entire
 *   card is click target. Accepts variant='compact' prop for
 *   Related Bikes use."
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Clean grid of bike cards: image, name, starting ex-showroom
 *   price, brand badge. No clutter: no ads, no sponsored placements,
 *   no review-style star ratings."
 *
 * MPD High-Fidelity UI, Brand Listing Page:
 *   "The bike grid uses the BikeCard component at r-lg: image first
 *   (4:3, subtle hover zoom on desktop), then name + tagline + price
 *   stacked tightly, with the navigation arrow icon appearing in
 *   ink-tertiary at rest and shifting to the bike-page's eventual
 *   accent on hover."
 *
 * MPD Section 6, Cards — Bike Card:
 *   "surface-raised background, 1px border-hairline, radius r-lg.
 *   Image area: fixed aspect ratio 4:3, object-fit cover, subtle
 *   zoom-on-hover (scale 1.03, 400ms ease).
 *   Content padding: 20px.
 *   Hierarchy: Bike Name (display-md) → Tagline (body-sm,
 *   ink-secondary) → Price (data-md) → nav arrow icon (bottom-right,
 *   accent color on hover).
 *   Entire card is the click target; arrow is a visual cue."
 *
 * MPD Component Library:
 *   BikeCard | Grid card (listing), Related card (compact) via variant prop
 *
 * TWO VARIANTS:
 *   default  → full card used in BikeGrid (listing pages, search results)
 *   compact  → smaller card used in RelatedBikes (B-12) — less padding,
 *              smaller image, no tagline displayed
 *
 * PRICE FORMATTING:
 *   Uses formatPriceInLakhs() from constants/priceRanges.ts (S-08).
 *   Displays "₹3.48L*" — asterisk signals ex-showroom price.
 *   The * footnote copy ("Ex-showroom price") is rendered below the
 *   price in body-sm/ink-tertiary.
 *
 * ACCENT COLOR:
 *   The arrow icon shifts to brand accent color on card hover.
 *   accentColor prop accepts the brand hex from BRANDS (S-08) or
 *   the brands MongoDB collection (DB-03).
 *   Default: ink-primary (#15161A) — neutral if no accent provided.
 *
 * IMAGE STRATEGY:
 *   - Next.js <Image> with fill + objectFit: cover in a 4:3 container
 *   - lazy loading (no priority prop) — cards are below the fold
 *   - blur-up placeholder via blurDataUrl prop
 *   - sizes attr: 33vw desktop / 50vw tablet / 100vw mobile
 *     (matches the 3/2/1 column grid in BikeGrid LP-02)
 *
 * ACCESSIBILITY:
 *   - Entire card is a <Link> wrapping all content
 *   - aria-label on the link: "View [name] — [tagline]"
 *   - Image alt: "[name] — [tagline]"
 *   - Arrow icon aria-hidden (decorative — link label carries context)
 *   - focus-visible: shadow-focus ring on the card border
 *
 * WHY 'use client':
 *   useState for isHovered (arrow color, image scale, card shadow).
 *   onMouseEnter/Leave event handlers.
 */

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { formatPriceInLakhs } from '@/constants/priceRanges'
import type { BikeSummary } from '@/types/bike'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * BikeCardVariant — controls the card size and content density.
 *
 * default → full card (listing pages, search results, BikeGrid)
 *           4:3 image, name + tagline + price, 20px padding
 *
 * compact → smaller card (Related Bikes section on bike detail page)
 *           4:3 image, name + price only (no tagline), 16px padding
 *           Slightly reduced image height for tighter layout
 */
export type BikeCardVariant = 'default' | 'compact'

export interface BikeCardProps {
  /*
   * bike — the BikeSummary data shape (S-07 types/bike.ts).
   * Contains all fields needed to render the card:
   * slug, brandSlug, name, tagline, pricing, heroImageUrl, blurDataUrl.
   */
  bike: BikeSummary

  /*
   * variant — card size/density variant.
   * Default: 'default'
   */
  variant?: BikeCardVariant

  /*
   * accentColor — brand accent hex for arrow icon hover color.
   * Source: BRANDS constant (S-08) or brands MongoDB collection.
   * Default: '#15161A' (ink-primary — neutral fallback).
   */
  accentColor?: string

  /*
   * className — additional CSS classes for layout/grid positioning.
   * Use in BikeGrid for responsive grid item behaviour.
   */
  className?: string

  /*
   * priority — passes Next.js Image priority prop.
   * Set true only for the first card in a listing (LCP candidate).
   * Default: false (lazy load).
   */
  priority?: boolean
}

// ---------------------------------------------------------------------------
// Default blur placeholder
// ---------------------------------------------------------------------------

const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// BikeCard Component
// ---------------------------------------------------------------------------

export default function BikeCard({
  bike,
  variant = 'default',
  accentColor = '#15161A',
  className = '',
  priority = false,
}: BikeCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isCompact = variant === 'compact'

  /*
   * Build the bike detail page URL.
   * Pattern: /bikes/[brandSlug]/[slug]
   * Example: /bikes/royal-enfield/gt-650
   */
  const href = `/bikes/${bike.brandSlug}/${bike.slug}`

  /*
   * Format the ex-showroom price using the utility from S-08.
   * Example: 348000 → "₹3.48L"
   * Appended with * to signal ex-showroom pricing.
   */
  const formattedPrice = formatPriceInLakhs(bike.pricing.exShowroom)

  /*
   * Dynamic hover styles.
   *
   * Card: shadow-md on hover (0 4px 12px rgba(15,16,20,0.08))
   * Image: scale 1.03 on hover (400ms transition-card-hover)
   * Arrow: accent color on hover, ink-tertiary at rest
   */
  const cardShadow = isHovered
    ? '0 4px 12px rgba(15,16,20,0.08)'
    : '0 1px 2px rgba(15,16,20,0.04)'

  const arrowColor = isHovered
    ? accentColor
    : 'var(--color-ink-tertiary)'

  const imageScale = isHovered ? 'scale(1.03)' : 'scale(1)'

  /*
   * Content padding — default: 20px, compact: 16px.
   */
  const contentPadding = isCompact ? '16px' : '20px'

  return (
    <>
      <style>{`
        /*
         * Card focus-visible — shadow-focus ring around the card border.
         * Uses the accent-adaptive --shadow-focus CSS variable from D-01.
         * Replaces the default browser outline for a premium look.
         */
        .bike-card:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
        }

        /*
         * Image container overflow: hidden is set inline.
         * The scale transform on the inner image div must not be
         * clipped by a parent with overflow: visible.
         */
      `}</style>

      {/*
       * Card outer wrapper — <Link> makes the entire card clickable.
       * display: block so the link fills the grid cell.
       * position: relative for the arrow icon positioning.
       *
       * MPD: "Entire card is the click target; arrow is a visual cue,
       * not the only hit area."
       */}
      <Link
        href={href}
        aria-label={`View ${bike.name}${bike.tagline ? ` — ${bike.tagline}` : ''}`}
        className={`bike-card ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        style={{
          display: 'block',
          textDecoration: 'none',
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-hairline)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: cardShadow,
          transition:
            'box-shadow 400ms cubic-bezier(0.4,0,0.2,1)',
          cursor: 'pointer',
          /*
           * position: relative allows the arrow icon to be positioned
           * in the bottom-right of the card content area.
           */
          position: 'relative',
        }}
      >
        {/* ── Image area — 4:3 aspect ratio ─────────────────── */}
        {/*
         * The outer div sets the 4:3 aspect ratio container.
         * overflow: hidden clips the scale transform on hover.
         * position: relative is required for Next.js Image fill mode.
         */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            /*
             * 4:3 aspect ratio: paddingBottom 75% = 3/4 × 100%.
             * Using paddingBottom instead of aspect-ratio property
             * ensures compatibility with older WebViews and provides
             * a stable layout before the image loads (no CLS).
             */
            paddingBottom: '75%',
            overflow: 'hidden',
            backgroundColor: 'var(--color-surface-sunken)',
          }}
        >
          {/*
           * Image scale wrapper — the transform is applied to this div
           * (not the <Image> directly) to avoid interfering with
           * Next.js Image's internal positioning.
           * Transition: 400ms per MPD Section 6 card hover animation.
           */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: imageScale,
              transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <Image
              src={bike.heroImageUrl}
              alt={`${bike.name}${bike.tagline ? ` — ${bike.tagline}` : ''}`}
              fill
              priority={priority}
              sizes={
                isCompact
                  ? '(max-width: 768px) 50vw, 25vw'
                  : '(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw'
              }
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              placeholder={bike.blurDataUrl ? 'blur' : 'empty'}
              blurDataURL={bike.blurDataUrl ?? DEFAULT_BLUR}
            />
          </div>
        </div>

        {/* ── Content area ───────────────────────────────────── */}
        <div
          style={{
            padding: contentPadding,
            /*
             * position: relative so the arrow icon can be absolutely
             * positioned in the bottom-right of the content area.
             */
            position: 'relative',
          }}
        >

          {/* ── Bike name — display-md ─────────────────────── */}
          {/*
           * display-md: 32px desktop / 24px mobile per MPD type scale.
           * clamp() provides smooth scaling between breakpoints.
           * font-display (Plus Jakarta Sans) for the engineered feel.
           * Letter spacing: tight (-0.01em) at display sizes.
           */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isCompact
                ? 'clamp(16px, 2.5vw, 20px)'
                : 'clamp(20px, 2.8vw, 32px)',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink-primary)',
              margin: '0 0 6px',
              /*
               * Truncate very long model names — max 2 lines.
               * Prevents cards from having unequal heights in the grid.
               */
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              /*
               * Ensure the arrow icon doesn't overlap long names —
               * paddingRight reserves space for the arrow.
               */
              paddingRight: '28px',
            }}
          >
            {bike.name}
          </h2>

          {/* ── Tagline — body-sm / ink-secondary (default only) ── */}
          {/*
           * Hidden in compact variant — saves vertical space for
           * the Related Bikes section where vertical space is limited.
           * MPD LP-01: compact has "no tagline displayed."
           */}
          {!isCompact && bike.tagline && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                lineHeight: 1.5,
                color: 'var(--color-ink-secondary)',
                margin: '0 0 12px',
                /*
                 * Single line truncation — taglines are short by design
                 * but truncation prevents overflow on very long values.
                 */
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: '28px',
              }}
            >
              {bike.tagline}
            </p>
          )}

          {/* ── Price — data-md (monospace) ────────────────── */}
          {/*
           * data-md: 15px mono / 14px mobile per MPD type scale.
           * Monospace (JetBrains Mono) reinforces "engineered precision."
           * The asterisk (*) signals ex-showroom pricing.
           * "Ex-showroom" label below in body-sm/ink-tertiary.
           */}
          <div
            style={{
              marginTop: isCompact ? '6px' : '0',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: isCompact ? '13px' : '15px',
                fontWeight: 500,
                lineHeight: 1.4,
                color: 'var(--color-ink-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {formattedPrice}
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-ink-tertiary)',
                  marginLeft: '2px',
                  fontWeight: 400,
                }}
              >
                *
              </span>
            </span>

            {/*
             * Ex-showroom footnote — only in default variant.
             * Compact card omits this to keep the layout tight.
             */}
            {!isCompact && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: 'var(--color-ink-tertiary)',
                  margin: '2px 0 0',
                  lineHeight: 1.4,
                }}
              >
                Ex-showroom price
              </p>
            )}
          </div>

          {/* ── Navigation arrow — bottom-right ───────────── */}
          {/*
           * Positioned absolutely in the bottom-right of the content area.
           * ink-tertiary at rest → accent color on card hover.
           * MPD LP-01: "nav arrow icon (bottom-right, accent on hover)."
           * aria-hidden: the card's aria-label already describes the
           * navigation destination — the arrow is purely decorative.
           */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: contentPadding,
              right: contentPadding,
              color: arrowColor,
              transition: 'color 280ms cubic-bezier(0.4,0,0.2,1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="arrow-right"
              size={isCompact ? 14 : 16}
              strokeWidth={1.75}
            />
          </div>
        </div>
      </Link>
    </>
  )
}