/*
 * categories.ts — Motorcycle category definitions.
 *
 * Single source of truth for all category slugs, display labels,
 * and page copy across MotoHub360.
 *
 * Consumed by:
 *   - FilterBar component (LP-03) — dropdown options
 *   - Category listing page (LP-05) — page title + generateStaticParams()
 *   - BikeFormBasic admin form (A-08) — category select dropdown
 *   - Bike model (DB-02) — enum validation
 *   - constants/brands.ts — no dependency, listed for context
 *
 * The BikeCategory type (S-07) is the TypeScript contract.
 * This file provides the runtime data that matches that type.
 */

import type { BikeCategory } from '@/types/bike'

// ---------------------------------------------------------------------------
// Category Definition Shape
// ---------------------------------------------------------------------------

export interface CategoryDefinition {
  /*
   * slug — URL segment and database enum value.
   * Must match BikeCategory union type exactly.
   * Used in: /category/[category] route, filter query params, DB enum.
   */
  slug: BikeCategory

  /*
   * label — short display name shown in filter pills and dropdowns.
   * Examples: "Cruiser", "Sport", "Adventure"
   */
  label: string

  /*
   * pluralLabel — used in page headings where plural form differs.
   * Examples: "Cruiser Motorcycles", "Naked Bikes"
   */
  pluralLabel: string

  /*
   * pageTitle — full SEO-optimised page heading for /category/[category].
   * Matches the format defined in MPD Section 5.5.
   */
  pageTitle: string

  /*
   * metaDescription — default meta description for category listing pages.
   * Used by generateMetadata() in P-01 when no custom description is set.
   */
  metaDescription: string
}

// ---------------------------------------------------------------------------
// Category Definitions
// Approved list from MPD Section 4 — exactly 5 categories, no additions.
// ---------------------------------------------------------------------------

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: 'cruiser',
    label: 'Cruiser',
    pluralLabel: 'Cruiser Motorcycles',
    pageTitle: 'Cruiser Motorcycles in India',
    metaDescription:
      'Explore the best cruiser motorcycles available in India. Compare prices, colours, variants, and full specifications on MotoHub360.',
  },
  {
    slug: 'sport',
    label: 'Sport',
    pluralLabel: 'Sport Motorcycles',
    pageTitle: 'Sport Motorcycles in India',
    metaDescription:
      'Explore the best sport motorcycles available in India. Compare prices, colours, variants, and full specifications on MotoHub360.',
  },
  {
    slug: 'adventure',
    label: 'Adventure',
    pluralLabel: 'Adventure Motorcycles',
    pageTitle: 'Adventure Motorcycles in India',
    metaDescription:
      'Explore the best adventure motorcycles available in India. Compare prices, colours, variants, and full specifications on MotoHub360.',
  },
  {
    slug: 'naked',
    label: 'Naked',
    pluralLabel: 'Naked Bikes',
    pageTitle: 'Naked Motorcycles in India',
    metaDescription:
      'Explore the best naked motorcycles available in India. Compare prices, colours, variants, and full specifications on MotoHub360.',
  },
  {
    slug: 'scooter',
    label: 'Scooter',
    pluralLabel: 'Scooters',
    pageTitle: 'Scooters in India',
    metaDescription:
      'Explore the best scooters available in India. Compare prices, colours, variants, and full specifications on MotoHub360.',
  },
]

// ---------------------------------------------------------------------------
// Derived Lookups
// ---------------------------------------------------------------------------

/*
 * CATEGORY_MAP — slug-keyed lookup for O(1) access by slug.
 *
 * Usage:
 *   const def = CATEGORY_MAP['cruiser']
 *   // → { slug: 'cruiser', label: 'Cruiser', ... }
 *
 * Used in: category listing page to get pageTitle without looping CATEGORIES.
 */
export const CATEGORY_MAP: Record<BikeCategory, CategoryDefinition> =
  CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.slug] = cat
      return acc
    },
    {} as Record<BikeCategory, CategoryDefinition>,
  )

/*
 * CATEGORY_SLUGS — array of all valid category slugs.
 *
 * Usage:
 *   generateStaticParams() in /category/[category]/page.tsx (LP-05)
 *   returns CATEGORY_SLUGS.map(slug => ({ category: slug }))
 *
 * Also used for runtime validation: CATEGORY_SLUGS.includes(param)
 */
export const CATEGORY_SLUGS: BikeCategory[] = CATEGORIES.map(
  (cat) => cat.slug,
)

/*
 * isValidCategory — type guard for route param validation.
 *
 * Usage:
 *   if (!isValidCategory(params.category)) notFound()
 *
 * Used in: /category/[category]/page.tsx (LP-05) to return 404
 * when an invalid category slug is requested.
 */
export function isValidCategory(value: string): value is BikeCategory {
  return CATEGORY_SLUGS.includes(value as BikeCategory)
}