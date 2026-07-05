/*
 * priceRanges.ts — Price range band definitions.
 *
 * Single source of truth for all price filter bands across MotoHub360.
 * Price ranges appear as URL segments (/price/1-2-lakh), filter pills
 * in FilterBar, and query boundaries in the bikes API.
 *
 * Consumed by:
 *   - FilterBar component (LP-03) — price filter dropdown options
 *   - Price listing page (LP-06) — page title + generateStaticParams()
 *   - GET /api/bikes (DB-05) — min/max price filter query
 *   - Price range pills on Home page (H-04)
 *
 * All prices stored and compared in rupees (no lakhs in the DB layer).
 * The lakh conversion only happens at the display layer.
 */

// ---------------------------------------------------------------------------
// Price Range Definition Shape
// ---------------------------------------------------------------------------

export interface PriceRangeDefinition {
    /*
     * slug — URL segment for /price/[range] route.
     * Must be URL-safe (lowercase, hyphens only).
     * Approved slugs from MPD Section 4.
     */
    slug: string
  
    /*
     * label — short display label for filter pills and dropdowns.
     * Uses ₹ symbol and lakh abbreviation for Indian market.
     * Examples: "< ₹1L", "₹1–2L"
     */
    label: string
  
    /*
     * fullLabel — expanded label for page headings and meta titles.
     * Examples: "Under ₹1 Lakh", "₹1 Lakh to ₹2 Lakh"
     */
    fullLabel: string
  
    /*
     * pageTitle — SEO-optimised heading for /price/[range] listing page.
     * Matches the format defined in MPD Section 5.5.
     */
    pageTitle: string
  
    /*
     * metaDescription — default meta description for price listing pages.
     * Used by generateMetadata() in P-01.
     */
    metaDescription: string
  
    /*
     * minPrice — minimum ex-showroom price in rupees (inclusive).
     * 0 for the lowest band (no lower bound).
     */
    minPrice: number
  
    /*
     * maxPrice — maximum ex-showroom price in rupees (inclusive).
     * Infinity for the highest band (no upper bound).
     * Use Number.POSITIVE_INFINITY for the open-ended top tier.
     */
    maxPrice: number
  }
  
  // ---------------------------------------------------------------------------
  // Price Range Definitions
  // Approved bands from MPD Section 4 — exactly 4 ranges.
  // All rupee values in full (not lakhs) for precise DB comparison.
  // 1 lakh = 100,000 rupees
  // ---------------------------------------------------------------------------
  
  export const PRICE_RANGES: PriceRangeDefinition[] = [
    {
      slug: 'under-1-lakh',
      label: '< ₹1L',
      fullLabel: 'Under ₹1 Lakh',
      pageTitle: 'Motorcycles Under ₹1 Lakh in India',
      metaDescription:
        'Find the best motorcycles under ₹1 lakh ex-showroom in India. Explore prices, colours, and specifications on MotoHub360.',
      minPrice: 0,
      maxPrice: 99_999,
    },
    {
      slug: '1-2-lakh',
      label: '₹1–2L',
      fullLabel: '₹1 Lakh to ₹2 Lakh',
      pageTitle: 'Motorcycles Between ₹1 Lakh and ₹2 Lakh in India',
      metaDescription:
        'Explore motorcycles priced between ₹1 lakh and ₹2 lakh ex-showroom in India. Compare variants, colours, and specifications on MotoHub360.',
      minPrice: 1_00_000,
      maxPrice: 1_99_999,
    },
    {
      slug: '2-5-lakh',
      label: '₹2–5L',
      fullLabel: '₹2 Lakh to ₹5 Lakh',
      pageTitle: 'Motorcycles Between ₹2 Lakh and ₹5 Lakh in India',
      metaDescription:
        'Explore motorcycles priced between ₹2 lakh and ₹5 lakh ex-showroom in India. Compare variants, colours, and specifications on MotoHub360.',
      minPrice: 2_00_000,
      maxPrice: 4_99_999,
    },
    {
      slug: 'above-5-lakh',
      label: '₹5L+',
      fullLabel: 'Above ₹5 Lakh',
      pageTitle: 'Motorcycles Above ₹5 Lakh in India',
      metaDescription:
        'Explore premium motorcycles priced above ₹5 lakh ex-showroom in India. Compare variants, colours, and specifications on MotoHub360.',
      minPrice: 5_00_000,
      maxPrice: Number.POSITIVE_INFINITY,
    },
  ]
  
  // ---------------------------------------------------------------------------
  // Derived Lookups
  // ---------------------------------------------------------------------------
  
  /*
   * PRICE_RANGE_MAP — slug-keyed lookup for O(1) access by slug.
   *
   * Usage:
   *   const range = PRICE_RANGE_MAP['1-2-lakh']
   *   // → { slug: '1-2-lakh', minPrice: 100000, maxPrice: 199999, ... }
   *
   * Used in: price listing page to get pageTitle and price boundaries
   * without looping PRICE_RANGES.
   */
  export const PRICE_RANGE_MAP: Record<string, PriceRangeDefinition> =
    PRICE_RANGES.reduce(
      (acc, range) => {
        acc[range.slug] = range
        return acc
      },
      {} as Record<string, PriceRangeDefinition>,
    )
  
  /*
   * PRICE_RANGE_SLUGS — array of all valid price range slugs.
   *
   * Usage:
   *   generateStaticParams() in /price/[range]/page.tsx (LP-06)
   *   returns PRICE_RANGE_SLUGS.map(slug => ({ range: slug }))
   *
   * Also used for runtime validation: PRICE_RANGE_SLUGS.includes(param)
   */
  export const PRICE_RANGE_SLUGS: string[] = PRICE_RANGES.map(
    (range) => range.slug,
  )
  
  /*
   * isValidPriceRange — runtime validation for route params.
   *
   * Usage:
   *   if (!isValidPriceRange(params.range)) notFound()
   *
   * Used in: /price/[range]/page.tsx (LP-06) to return 404
   * when an unrecognised price range slug is requested.
   */
  export function isValidPriceRange(value: string): boolean {
    return PRICE_RANGE_SLUGS.includes(value)
  }
  
  /*
   * getPriceRangeForBike — determines which price band a given price falls into.
   *
   * Usage:
   *   const range = getPriceRangeForBike(348000)
   *   // → { slug: '2-5-lakh', label: '₹2–5L', ... }
   *
   * Used in: bike API filtering logic (DB-05) to tag search results
   * with their price band for filter highlighting in the UI.
   *
   * Returns undefined if no range matches (should not occur if ranges
   * are defined correctly with no gaps — included as a safety measure).
   */
  export function getPriceRangeForBike(
    exShowroomPrice: number,
  ): PriceRangeDefinition | undefined {
    return PRICE_RANGES.find(
      (range) =>
        exShowroomPrice >= range.minPrice && exShowroomPrice <= range.maxPrice,
    )
  }
  
  /*
   * formatPriceInLakhs — converts rupees to a display string in lakhs.
   *
   * Usage:
   *   formatPriceInLakhs(348000)  → "₹3.48L"
   *   formatPriceInLakhs(100000)  → "₹1.00L"
   *   formatPriceInLakhs(2000000) → "₹20.00L"
   *
   * Used in: BikePriceBlock (B-09), BikeCard (LP-01), BikeHero (B-01).
   * Keeps price formatting consistent across all components.
   *
   * Note: "lakh" is the standard Indian price denomination.
   * 1 lakh = 1,00,000 rupees.
   */
  export function formatPriceInLakhs(rupees: number): string {
    const lakhs = rupees / 1_00_000
    return `₹${lakhs.toFixed(2)}L`
  }