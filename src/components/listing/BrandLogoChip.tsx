'use client'

/*
 * BrandLogoChip — Circular brand logo chip for the Home page brand grid.
 *
 * MPD Task H-02:
 *   "Circular r-full chip, monochrome brand logo at center,
 *   surface-sunken background. On hover: brand accent color appears
 *   (via --color-accent CSS variable set inline), shadow-md lift.
 *   Links to /brands/[brand]."
 *
 * MPD Section 5.1, Home Page:
 *   "Browse by Brand section — official brand logos displayed in a
 *   clean grid (Royal Enfield, Yamaha, KTM, Honda, TVS, Bajaj, etc.),
 *   each linking to that brand's listing page."
 *
 * MPD High-Fidelity UI, Home Page:
 *   "Browse by Brand, presented as a clean horizontal row (wraps on
 *   mobile) of circular r-full logo chips on surface-sunken, monochrome
 *   by default, gaining their brand accent color and a subtle lift on
 *   hover."
 *
 * MPD Component Library:
 *   BrandLogoChip | Default, Selected (hover = accent color appears)
 *
 * DESIGN:
 *   Rest state:
 *     - Background: surface-sunken (#F2F1EF)
 *     - Border: 1px border-hairline
 *     - Logo: rendered in ink-secondary (monochrome) via CSS filter
 *     - Shadow: none
 *     - Border radius: r-full (999px) — perfect circle
 *     - Size: 80px × 80px desktop / 68px × 68px mobile
 *
 *   Hover state:
 *     - Background: surface-raised (#FFFFFF)
 *     - Logo: brand accent color appears (filter removed, logo natural)
 *     - Shadow: shadow-md lift
 *     - Scale: 1.04 — gentle lift
 *     - Transition: 280ms premium ease
 *
 * LOGO RENDERING:
 *   Two logo strategies supported:
 *
 *   1. logoUrl (Cloudinary URL) — renders a Next.js <Image> from the
 *      brands MongoDB collection. Used when a brand has been added to
 *      the DB with an uploaded logo (post-DB-03).
 *
 *   2. fallback initials — when no logoUrl is available (pre-DB phase),
 *      renders the brand's initial letter(s) in the Display typeface.
 *      Used during development before Cloudinary logos are uploaded.
 *
 *   The monochrome effect at rest is achieved via CSS grayscale filter
 *   on the <img>/<Image> element. On hover, the filter is removed to
 *   reveal the natural logo color.
 *
 * WHY 'use client':
 *   useState for isHovered (hover state for shadow + scale + filter).
 *   onMouseEnter / onMouseLeave event handlers.
 *   CSS hover via state rather than :hover pseudo-class so the accent
 *   color can be applied as an inline style (CSS variables cannot be
 *   set via :hover in a style tag).
 *
 * USAGE (Home page H-06):
 *   <BrandLogoChip
 *     slug="royal-enfield"
 *     name="Royal Enfield"
 *     accentColor="#7A2E2E"
 *   />
 *
 *   <BrandLogoChip
 *     slug="ktm"
 *     name="KTM"
 *     accentColor="#FF6A00"
 *     logoUrl="https://res.cloudinary.com/.../ktm-logo.svg"
 *   />
 */

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandLogoChipProps {
  /*
   * slug — brand URL segment. Used to build the /brands/[brand] href.
   * Must match the brand slug in MongoDB and constants/brands.ts.
   * Example: 'royal-enfield', 'ktm', 'yamaha'
   */
  slug: string

  /*
   * name — brand display name.
   * Used for: aria-label, alt text, fallback initials.
   * Example: 'Royal Enfield', 'KTM', 'Yamaha'
   */
  name: string

  /*
   * accentColor — hex color from the Design System brand accent table.
   * Applied as background tint on hover.
   * Source: BRANDS constant (S-08) or brands MongoDB collection (DB-03).
   * Example: '#7A2E2E' for Royal Enfield, '#FF6A00' for KTM.
   */
  accentColor: string

  /*
   * logoUrl — Cloudinary URL for the official brand logo image.
   * Optional: if absent, fallback initials are rendered.
   * Available after DB-03 (Brand Mongoose model) and admin setup.
   * Example: 'https://res.cloudinary.com/motohub360/image/upload/brands/ktm.svg'
   */
  logoUrl?: string

  /*
   * size — chip diameter in px for the desktop layout.
   * Default: 80
   * Mobile size is always size - 12px (applied via CSS).
   */
  size?: number

  /*
   * className — additional CSS classes for outer container.
   * Use for grid gap management from the parent layout.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Helper — brand initials
// ---------------------------------------------------------------------------

/*
 * getBrandInitials — generates 1–2 character fallback initials.
 *
 * Strategy:
 *   Single word brand (e.g. "KTM", "Yamaha") → first 2 characters.
 *   Multi-word brand (e.g. "Royal Enfield") → first letter of each word,
 *   up to 2 letters (e.g. "RE").
 *   Uppercased always.
 */
function getBrandInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// BrandLogoChip Component
// ---------------------------------------------------------------------------

export default function BrandLogoChip({
  slug,
  name,
  accentColor,
  logoUrl,
  size = 80,
  className = '',
}: BrandLogoChipProps) {
  const [isHovered, setIsHovered] = useState(false)

  const initials = getBrandInitials(name)
  const href = `/brands/${slug}`

  /*
   * Dynamic styles based on hover state.
   *
   * Rest: surface-sunken bg, no shadow, monochrome logo (grayscale filter).
   * Hover: surface-raised bg, shadow-md, accent bg tint, natural logo color,
   *        scale 1.04 lift.
   *
   * The accent color appears as a very subtle background tint at 8% opacity
   * on hover — not as the full background color. This keeps the chip
   * clean and premium while hinting at the brand identity.
   * Per MPD: "accent color used at max 5–8% surface coverage per page."
   */
  const chipBackground = isHovered
    ? `color-mix(in srgb, ${accentColor} 8%, var(--color-surface-raised))`
    : 'var(--color-surface-sunken)'

  const chipShadow = isHovered
    ? '0 4px 12px rgba(15,16,20,0.08)'
    : 'none'

  const chipScale = isHovered ? 'scale(1.04)' : 'scale(1)'

  const chipBorderColor = isHovered
    ? `color-mix(in srgb, ${accentColor} 20%, var(--color-border-hairline))`
    : 'var(--color-border-hairline)'

  /*
   * Logo filter — grayscale at rest (monochrome), none on hover.
   * Transition: 280ms for smooth colour reveal.
   * Only applied when logoUrl is present (no filter on text initials).
   */
  const logoFilter = logoUrl
    ? isHovered
      ? 'none'
      : 'grayscale(100%) opacity(0.6)'
    : 'none'

  return (
    <Link
      href={href}
      aria-label={`Browse ${name} motorcycles`}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        /*
         * The link wraps both the chip circle and the brand name label
         * below it. The entire area is the click target.
         */
      }}
    >
      {/*
       * Chip circle — the main visual element.
       * Fixed size (size prop × size prop), perfectly round (r-full).
       */}
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '999px',
          backgroundColor: chipBackground,
          border: `1px solid ${chipBorderColor}`,
          boxShadow: chipShadow,
          transform: chipScale,
          transition:
            'background-color 280ms cubic-bezier(0.4,0,0.2,1), ' +
            'box-shadow 280ms cubic-bezier(0.4,0,0.2,1), ' +
            'transform 280ms cubic-bezier(0.4,0,0.2,1), ' +
            'border-color 280ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {logoUrl ? (
          /*
           * Logo image — rendered via Next.js Image for optimisation.
           * fill + objectFit: contain keeps the logo proportional
           * within the circular container.
           * Padding: 20% of chip size creates breathing room around the logo.
           */
          <div
            style={{
              position: 'relative',
              width: `${size * 0.55}px`,
              height: `${size * 0.55}px`,
              transition: 'filter 280ms cubic-bezier(0.4,0,0.2,1)',
              filter: logoFilter,
            }}
          >
            <Image
              src={logoUrl}
              alt={`${name} logo`}
              fill
              style={{ objectFit: 'contain' }}
              sizes={`${size}px`}
            />
          </div>
        ) : (
          /*
           * Fallback initials — used pre-DB or when logoUrl is absent.
           * Display typeface, sized proportionally to the chip.
           * Color: ink-secondary at rest → accent on hover.
           */
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: `${size * 0.28}px`,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: isHovered
                ? accentColor
                : 'var(--color-ink-secondary)',
              transition: 'color 280ms cubic-bezier(0.4,0,0.2,1)',
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/*
       * Brand name label — below the chip circle.
       * body-sm (13px), ink-secondary at rest, ink-primary on hover.
       * Centered, no wrapping — short brand names only.
       */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: isHovered ? 500 : 400,
          color: isHovered
            ? 'var(--color-ink-primary)'
            : 'var(--color-ink-secondary)',
          transition:
            'color 280ms cubic-bezier(0.4,0,0.2,1), ' +
            'font-weight 0ms',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}
      >
        {name}
      </span>
    </Link>
  )
}