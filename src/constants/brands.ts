/*
 * brands.ts — Static brand definitions and accent color map.
 *
 * Single source of truth for all brand slugs, display names,
 * and Design System accent colors across MotoHub360.
 *
 * Consumed by:
 *   - useAccentColor hook (B-02) — sets --color-accent CSS variable on mount
 *   - BrandLogoChip component (H-02) — hover accent color
 *   - Brand listing page (LP-04) — generateStaticParams() slug list
 *   - BikeFormBasic admin form (A-08) — fallback before DB brands load
 *   - FilterBar (LP-03) — brand filter options
 *
 * WHY a static file AND a database collection?
 * The brands MongoDB collection (DB-03) stores dynamic data: logo URLs,
 * descriptions, and admin-managed content. This static file stores
 * design-system values (accent colors) and slugs that must be available
 * instantly — before any MongoDB call resolves — particularly for the
 * useAccentColor hook which runs synchronously on mount to prevent
 * a flash of the wrong accent color on bike detail pages.
 *
 * Accent colors are copied exactly from MPD Section 6, Design System,
 * Color Palette, Per-brand accent tokens table. Do not modify these
 * without updating the Design System document.
 */

import type { BrandAccentMap } from '@/types/brand'

// ---------------------------------------------------------------------------
// Brand Definition Shape
// ---------------------------------------------------------------------------

export interface BrandDefinition {
  /*
   * slug — URL segment and database reference key.
   * Must be lowercase, hyphenated, URL-safe.
   * Matches brandSlug field in Bike documents.
   * Used in: /brands/[brand] route, /bikes/[brand]/[model] route.
   */
  slug: string

  /*
   * name — full display name of the brand.
   * Shown in: brand page header, BikeCard brand label, admin dropdowns.
   */
  name: string

  /*
   * accentColor — hex color from MPD Section 6 Design System.
   * Applied via --color-accent CSS custom property on bike detail pages.
   * Used at max 5–8% surface coverage per MPD design rules.
   * Never used as a full background — only for accents, highlights, rings.
   */
  accentColor: string

  /*
   * defaultMetaDescription — fallback meta description for brand pages.
   * Used by generateMetadata() in P-01 when no DB description exists.
   */
  defaultMetaDescription: string
}

// ---------------------------------------------------------------------------
// Brand Definitions
// Initial curated selection per MPD Section 3 — expandable as catalog grows.
// Accent colors are exact values from MPD Section 6 Design System table.
// ---------------------------------------------------------------------------

export const BRANDS: BrandDefinition[] = [
  {
    slug: 'royal-enfield',
    name: 'Royal Enfield',
    /*
     * #7A2E2E — Refined brick red.
     * Mood: Heritage, warmth.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#7A2E2E',
    defaultMetaDescription:
      'Explore all Royal Enfield motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
  {
    slug: 'ktm',
    name: 'KTM',
    /*
     * #FF6A00 — Controlled orange.
     * Mood: Energy, performance.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#FF6A00',
    defaultMetaDescription:
      'Explore all KTM motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
  {
    slug: 'yamaha',
    name: 'Yamaha',
    /*
     * #1B3A8A — Deep blue.
     * Mood: Precision, trust.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#1B3A8A',
    defaultMetaDescription:
      'Explore all Yamaha motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
  {
    slug: 'honda',
    name: 'Honda',
    /*
     * #C8102E — Muted red.
     * Mood: Reliability, sport.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#C8102E',
    defaultMetaDescription:
      'Explore all Honda motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
  {
    slug: 'tvs',
    name: 'TVS',
    /*
     * #0E7C7B — Teal.
     * Mood: Modern, youthful.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#0E7C7B',
    defaultMetaDescription:
      'Explore all TVS motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
  {
    slug: 'bajaj',
    name: 'Bajaj',
    /*
     * #1F2937 — Graphite.
     * Mood: Bold, urban.
     * Source: MPD Section 6, Per-brand accent tokens.
     */
    accentColor: '#1F2937',
    defaultMetaDescription:
      'Explore all Bajaj motorcycles available in India. Compare models, prices, colours, and specifications on MotoHub360.',
  },
]

// ---------------------------------------------------------------------------
// Derived Lookups
// ---------------------------------------------------------------------------

/*
 * BRAND_MAP — slug-keyed lookup for O(1) access by slug.
 *
 * Usage:
 *   const brand = BRAND_MAP['royal-enfield']
 *   // → { slug: 'royal-enfield', name: 'Royal Enfield', accentColor: '#7A2E2E', ... }
 *
 * Used in: brand listing page to get name and metaDescription
 * without looping BRANDS.
 */
export const BRAND_MAP: Record<string, BrandDefinition> = BRANDS.reduce(
  (acc, brand) => {
    acc[brand.slug] = brand
    return acc
  },
  {} as Record<string, BrandDefinition>,
)

/*
 * BRAND_ACCENT_MAP — slug → accent color lookup.
 * Typed as BrandAccentMap (Record<string, string>) from S-07.
 *
 * This is the specific object consumed by useAccentColor hook (B-02).
 * Kept as a flat map for the fastest possible lookup — the hook
 * runs synchronously on every bike detail page mount.
 *
 * Usage:
 *   import { BRAND_ACCENT_MAP } from '@/constants/brands'
 *   const accent = BRAND_ACCENT_MAP[brandSlug] ?? DEFAULT_ACCENT_COLOR
 *
 * Examples:
 *   BRAND_ACCENT_MAP['royal-enfield'] → '#7A2E2E'
 *   BRAND_ACCENT_MAP['ktm']           → '#FF6A00'
 *   BRAND_ACCENT_MAP['unknown-brand'] → undefined (use fallback)
 */
export const BRAND_ACCENT_MAP: BrandAccentMap = BRANDS.reduce(
  (acc, brand) => {
    acc[brand.slug] = brand.accentColor
    return acc
  },
  {} as BrandAccentMap,
)

/*
 * BRAND_SLUGS — array of all valid brand slugs.
 *
 * Usage:
 *   generateStaticParams() in /brands/[brand]/page.tsx (LP-04)
 *   returns BRAND_SLUGS.map(slug => ({ brand: slug }))
 *
 * Also used for runtime validation: BRAND_SLUGS.includes(param)
 */
export const BRAND_SLUGS: string[] = BRANDS.map((brand) => brand.slug)

/*
 * DEFAULT_ACCENT_COLOR — fallback when a brand slug has no entry.
 *
 * Uses ink-primary from the MotoHub360 Design System base palette.
 * Prevents useAccentColor hook from setting an undefined CSS variable
 * if a new brand is added to MongoDB before BRANDS array is updated.
 *
 * Value: #15161A — MPD Section 6, ink-primary token.
 */
export const DEFAULT_ACCENT_COLOR = '#15161A'

/*
 * isValidBrand — runtime validation for route params.
 *
 * Usage:
 *   if (!isValidBrand(params.brand)) notFound()
 *
 * Used in: /brands/[brand]/page.tsx (LP-04) to return 404
 * when an unrecognised brand slug is requested.
 *
 * Note: this validates against the STATIC list. If a brand exists
 * in MongoDB but not in BRANDS, this returns false. Keep BRANDS
 * in sync with the database brands collection when adding new brands.
 */
export function isValidBrand(value: string): boolean {
  return BRAND_SLUGS.includes(value)
}

/*
 * getBrandAccent — safe accent color lookup with fallback.
 *
 * Usage:
 *   const accent = getBrandAccent('royal-enfield') // '#7A2E2E'
 *   const accent = getBrandAccent('unknown')        // '#15161A' (fallback)
 *
 * Preferred over direct BRAND_ACCENT_MAP access in components
 * because it always returns a valid hex string.
 *
 * Used in: useAccentColor hook (B-02).
 */
export function getBrandAccent(brandSlug: string): string {
  return BRAND_ACCENT_MAP[brandSlug] ?? DEFAULT_ACCENT_COLOR
}