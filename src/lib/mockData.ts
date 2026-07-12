/*
 * mockData.ts — Development mock data.
 *
 * MPD Task H-07:
 *   "Create a mock data file src/lib/mockData.ts with 3 featured
 *   bikes (name, tagline, hero image placeholder URL, brand).
 *   Used only until DB is connected in Phase 7."
 *
 * PURPOSE:
 *   Provides placeholder bike data for the BikeHero component (H-05)
 *   and any other components that need bike data before the MongoDB
 *   connection and Mongoose models are built in Phase 7 (DB-01–DB-10).
 *
 * REMOVAL:
 *   This file is removed / emptied when DB-08 wires real MongoDB data
 *   to the listing pages and Home page. The import in page.tsx is
 *   replaced with a real async data fetch at that point.
 *
 * IMAGE URLS:
 *   Uses Cloudinary demo images as stand-ins for real bike photography.
 *   These are replaced with real Cloudinary bike image URLs after
 *   DB-10 (seed database with first real bike entry).
 *
 * NOTE: This file is intentionally minimal — only what H-06 needs.
 * Additional mock data fields are added per-task as needed.
 */

import type { FeaturedBike } from '@/components/bike/BikeHero'

/*
 * MOCK_FEATURED_BIKES — 3 featured bikes for the Home page BikeHero.
 *
 * Each entry provides the minimum fields required by the FeaturedBike
 * interface: slug, brandSlug, name, tagline, heroImageUrl.
 *
 * The heroImageUrls point to Cloudinary's public demo images.
 * These are valid Cloudinary URLs that pass the next.config.ts
 * remotePatterns check (res.cloudinary.com whitelisted in S-05).
 */
export const MOCK_FEATURED_BIKES: FeaturedBike[] = [
  {
    slug: 'gt-650',
    brandSlug: 'royal-enfield',
    name: 'GT 650',
    tagline: 'Modern Classic Roadster',
    heroImageUrl:
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
  },
  {
    slug: 'duke-390',
    brandSlug: 'ktm',
    name: 'Duke 390',
    tagline: 'Ready to Race',
    heroImageUrl:
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/beach-boat.jpg',
  },
  {
    slug: 'mt-15',
    brandSlug: 'yamaha',
    name: 'MT-15',
    tagline: 'Masters of Torque',
    heroImageUrl:
      'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/girl-urban-view.jpg',
  },
]