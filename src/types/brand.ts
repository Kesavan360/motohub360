/*
 * brand.ts — TypeScript interfaces for the brands MongoDB collection.
 *
 * Maps exactly to MPD Section 9, Collection: brands.
 * Also defines the BrandAccentMap used by useAccentColor hook (B-02)
 * and the constants/brands.ts file (S-08).
 *
 * No logic, no imports, no runtime code.
 *
 * Usage:
 *   import type { Brand, BrandSummary, BrandAccentMap } from '@/types/brand'
 */

// ---------------------------------------------------------------------------
// Primary Brand Interface
// ---------------------------------------------------------------------------

/*
 * Brand — complete document shape as stored in MongoDB.
 *
 * accentColor → hex value from the approved Design System brand accent
 *               table (MPD Section 6). Example: "#7A2E2E" for Royal Enfield.
 *               Used by useAccentColor hook to set --color-accent CSS variable.
 *
 * description → optional brand description shown on brand listing page header.
 *               null when not provided — brand page still renders without it.
 *
 * _id serialised to string (same reason as Bike._id — Mongoose .lean() output).
 */
export interface Brand {
    _id: string
    slug: string               // URL segment e.g. "royal-enfield"
    name: string               // Display name e.g. "Royal Enfield"
    logoUrl: string            // Cloudinary URL for official brand logo
    accentColor: string        // Hex color e.g. "#7A2E2E"
    description: string | null
    createdAt: string          // ISO date string
  }
  
  // ---------------------------------------------------------------------------
  // Derived / Partial Types
  // ---------------------------------------------------------------------------
  
  /*
   * BrandSummary — lightweight shape used in brand logo grids and dropdowns.
   * Used in: BrandLogoChip (H-02), admin Brand select (A-08).
   */
  export interface BrandSummary {
    _id: string
    slug: string
    name: string
    logoUrl: string
    accentColor: string
  }
  
  /*
   * BrandAccentMap — static slug → hex lookup for useAccentColor hook.
   *
   * This type is used by constants/brands.ts (S-08) which provides the
   * static fallback accent map before any MongoDB call is made.
   * The hook (B-02) reads from this map to set --color-accent on mount.
   *
   * Example value:
   *   const BRAND_ACCENT_MAP: BrandAccentMap = {
   *     'royal-enfield': '#7A2E2E',
   *     'ktm': '#FF6A00',
   *   }
   */
  export type BrandAccentMap = Record<string, string>
  
  /*
   * AdminBrand — shape used in admin form brand select.
   * Subset of BrandSummary — only what the dropdown needs.
   * Used in: BikeFormBasic (A-08).
   */
  export interface AdminBrand {
    _id: string
    slug: string
    name: string
  }