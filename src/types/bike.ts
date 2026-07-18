/*
 * bike.ts — TypeScript interfaces for the bikes MongoDB collection.
 *
 * Maps exactly to MPD Section 9, Collection: bikes.
 * No logic, no imports, no runtime code.
 * All fields match the Mongoose schema defined in DB-02.
 *
 * Usage:
 *   import type { Bike, BikeSummary, BikeCategory } from '@/types/bike'
 */

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

/*
 * BikeCategory — approved category list from MPD Section 4.
 * Used in: Bike.category, constants/categories.ts, filter params.
 */
export type BikeCategory =
  | 'cruiser'
  | 'sport'
  | 'adventure'
  | 'naked'
  | 'scooter'

/*
 * BikeStatus — controls visibility on the public site.
 * draft   → admin-only, never served to public visitors
 * published → ISR page is live, included in sitemap
 */
export type BikeStatus = 'draft' | 'published'

/*
 * GalleryTag — classifies each gallery image for potential filtering.
 * studio    → clean white/grey background product shots
 * lifestyle → in-context, on-road, environmental shots
 * detail    → close-up of components (engine, instrument cluster, etc.)
 */
export type GalleryTag = 'studio' | 'lifestyle' | 'detail'

// ---------------------------------------------------------------------------
// Nested Object Interfaces
// ---------------------------------------------------------------------------

/*
 * BikeVariant — a trim/variant of the bike (e.g. Standard, Pro).
 * specOverrides contains only the spec fields that differ from the
 * base bike spec — not a full duplicate of the entire spec object.
 * Typed as Partial<BikeSpecs> so only changed fields need to be supplied.
 */
export interface BikeVariant {
  name: string
  exShowroom: number
  /*
   * specOverrides — delta from base specs only.
   * Example: Pro variant may only differ in tyre size and ABS type.
   * Typed as Record<string, string> to allow any spec field key.
   * The Mongoose schema stores this as a plain Object.
   */
  specOverrides: Record<string, string>
}

/*
 * BikeColor — a color option for this bike.
 * heroImageUrl → Cloudinary URL for the hero shot of this color.
 * blurDataUrl  → base64-encoded 20px thumbnail for Next.js blur-up
 *                placeholder (stored in DB, prevents layout shift on load).
 */
export interface BikeColor {
  name: string
  hex: string
  heroImageUrl: string
  blurDataUrl: string
}

/*
 * BikeGalleryImage — one image in the gallery section.
 * altText is mandatory — required for accessibility (WCAG) and SEO.
 */
export interface BikeGalleryImage {
  url: string
  blurDataUrl: string
  tag: GalleryTag
  altText: string
}

/*
 * BikeMedia — embeds and video content.
 * view360Url → null when unavailable; component returns null (no placeholder UI).
 * videoUrls  → array allows multiple walkaround/feature videos.
 */
export interface BikeMedia {
  view360Url: string | null
  videoUrls: string[]
}

/*
 * BikeFeature — one item in the Key Features grid.
 * icon  → string identifier mapped to Icon.tsx lookup (e.g. 'twin-cylinder')
 * label → short display text (e.g. 'Twin Cylinder Engine')
 */
export interface BikeFeature {
  icon: string
  label: string
}

// ---------------------------------------------------------------------------
// Specification Interfaces
// All values are strings — spec values include units (e.g. "648cc", "47.65 PS")
// and sometimes contextual text ("Dual channel" for ABS).
// Nullable fields are specs manufacturers often do not officially publish.
// ---------------------------------------------------------------------------

export interface BikeSpecEngine {
  type: string
  displacement: string       // e.g. "648cc"
  maxPower: string           // e.g. "47.65 PS @ 8500 rpm"
  maxTorque: string          // e.g. "52.3 Nm @ 5250 rpm"
  compression: string        // e.g. "9.5:1"
  fuelSystem: string         // e.g. "Fuel Injection"
  transmission: string       // e.g. "6-Speed"
}

export interface BikeSpecDimensions {
  length: string             // e.g. "2140 mm"
  width: string              // e.g. "789 mm"
  height: string             // e.g. "1024 mm"
  wheelbase: string          // e.g. "1400 mm"
  seatHeight: string         // e.g. "800 mm"
  groundClearance: string    // e.g. "174 mm"
  kerbWeight: string         // e.g. "202 kg"
  fuelTank: string           // e.g. "13 litres"
}

export interface BikeSpecPerformance {
  /*
   * topSpeed is often not officially published by manufacturers.
   * null is stored in DB when unavailable — not shown in UI.
   */
  topSpeed: string | null
  braking: string | null
}

export interface BikeSpecBrakes {
  front: string              // e.g. "320 mm disc"
  rear: string               // e.g. "240 mm disc"
  abs: string                // e.g. "Dual channel ABS"
}

export interface BikeSpecSuspension {
  front: string              // e.g. "41 mm telescopic forks, 110 mm travel"
  rear: string               // e.g. "Twin shock absorbers, 88 mm travel"
}

export interface BikeSpecElectronics {
  abs: string
  tractionControl: string | null
  ridingModes: string | null
  instrumentation: string    // e.g. "Semi-digital instrument console"
}

export interface BikeSpecTyres {
  front: string              // e.g. "100/90-19"
  rear: string               // e.g. "130/70-18"
}

/*
 * BikeSpecs — complete specification object.
 * Groups all spec sub-interfaces into one nested structure.
 * Matches the MongoDB document shape in DB-02.
 */
export interface BikeSpecs {
  engine: BikeSpecEngine
  dimensions: BikeSpecDimensions
  performance: BikeSpecPerformance
  brakes: BikeSpecBrakes
  suspension: BikeSpecSuspension
  electronics: BikeSpecElectronics
  tyres: BikeSpecTyres
}

/*
 * BikeSEO — per-page SEO metadata stored in MongoDB.
 * Admin fills this in the BikeFormSEO component (A-12).
 * generateMetadata() reads from this object in P-01.
 */
export interface BikeSEO {
  metaTitle: string
  metaDescription: string
  ogImageUrl: string         // Cloudinary 1200×630px image
  keywords: string[]         // Reference only — not rendered as meta keywords tag
}

// ---------------------------------------------------------------------------
// Primary Bike Interface
// ---------------------------------------------------------------------------

/*
 * Bike — the complete document shape as stored in MongoDB.
 *
 * _id is typed as string here (not ObjectId) because Mongoose serialises
 * ObjectId to string when documents are returned as plain JS objects
 * via .lean() or JSON serialisation in Server Components.
 *
 * publishedAt is null for drafts and set to a Date string on publish.
 * createdAt/updatedAt are managed automatically by Mongoose timestamps.
 */
export interface Bike {
  _id: string
  slug: string               // URL segment e.g. "gt-650"
  brandSlug: string          // References brands.slug e.g. "royal-enfield"
  name: string               // Display name e.g. "GT 650"
  tagline: string            // One-line positioning e.g. "Modern Classic Roadster"
  category: BikeCategory
  status: BikeStatus

  pricing: {
    exShowroom: number       // Base variant price in rupees
    onRoad: number | null    // Reserved for V2 — stored as null in V1
  }

  variants: BikeVariant[]
  colors: BikeColor[]
  gallery: BikeGalleryImage[]
  media: BikeMedia
  features: BikeFeature[]
  specs: BikeSpecs
  seo: BikeSEO

  publishedAt: string | null  // ISO date string or null
  createdAt: string           // ISO date string
  updatedAt: string           // ISO date string
}

// ---------------------------------------------------------------------------
// Derived / Partial Types
// ---------------------------------------------------------------------------

/*
 * BikeSummary — lightweight shape used in listing grids and search results.
 * Contains only the fields needed to render a BikeCard component.
 * Avoids fetching the full spec object for listing pages — performance.
 *
 * Used in: BikeCard, BikeGrid, SearchSuggestions, RelatedBikes.
 */
export interface BikeSummary {
  _id: string
  slug: string
  brandSlug: string
  name: string
  tagline: string
  category: BikeCategory
  status: BikeStatus
  pricing: {
    exShowroom: number
  }
  /*
   * heroImageUrl and blurDataUrl sourced from colors[0] (default color).
   * Flattened here to avoid passing the full colors array to listing components.
   */
  heroImageUrl: string
  blurDataUrl: string
}

/*
 * SearchSuggestion — minimal shape returned by /api/search/suggest.
 * Six fields only — keeps the API response payload small.
 * Used in: SearchSuggestions component (SR-02).
 */
export interface SearchSuggestion {
  type: 'bike'
  slug: string
  label: string
  brandSlug: string
  brandName: string
  accentColor?: string
  heroImageUrl: string
}

/*
 * BikeFormData — shape of the admin Add/Edit bike form state.
 * Omits _id, createdAt, updatedAt (server-generated).
 * Used in: BikeFormBasic, BikeFormSpecs, BikeFormMedia, BikeFormSEO (A-08 to A-12).
 */
export type BikeFormData = Omit<Bike, '_id' | 'createdAt' | 'updatedAt'>