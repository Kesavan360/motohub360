/*
 * bike-json-ld.ts — Structured data builders for the bike detail page.
 *
 * MPD Task P-02:
 *   Vehicle + VideoObject JSON-LD on /bikes/[brandSlug]/[slug].
 *   BreadcrumbList JSON-LD remains in Breadcrumb.tsx (L-05).
 *
 * Uses only fields available on the Bike document — no fabricated dates,
 * durations, or URLs.
 */

import { absoluteUrl } from '@/lib/seo/site-url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimum bike fields required to build P-02 JSON-LD.
 * Accepts lean Mongoose documents from the bike detail page query.
 */
export interface BikeJsonLdInput {
  brandName: string
  name: string
  tagline: string
  heroImageUrl: string
  video360Url?: string
  publishedAt?: Date | string | null
  pricing: {
    exShowroom: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialises a JSON-LD object for safe inline script injection.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
}

/**
 * Returns an ISO 8601 upload date when publishedAt is a genuine timestamp.
 */
function toIsoUploadDate(
  publishedAt: Date | string | null | undefined,
): string | undefined {
  if (publishedAt == null) return undefined

  const date =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt)

  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
}

// ---------------------------------------------------------------------------
// Vehicle JSON-LD
// ---------------------------------------------------------------------------

/**
 * Builds Vehicle schema for a published bike detail page.
 * Always rendered on /bikes/[brandSlug]/[slug].
 */
export function buildVehicleJsonLd(
  bike: BikeJsonLdInput,
  brandSlug: string,
  slug: string,
): string {
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${bike.brandName} ${bike.name}`,
    description: bike.tagline,
    brand: { '@type': 'Brand', name: bike.brandName },
    model: bike.name,
    image: bike.heroImageUrl,
    url: absoluteUrl(`/bikes/${brandSlug}/${slug}`),
    offers: {
      '@type': 'Offer',
      price: bike.pricing.exShowroom,
      priceCurrency: 'INR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: bike.pricing.exShowroom,
        priceCurrency: 'INR',
        name: 'Ex-showroom price',
      },
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'MotoHub360' },
    },
  })
}

// ---------------------------------------------------------------------------
// VideoObject JSON-LD
// ---------------------------------------------------------------------------

/**
 * Builds VideoObject schema when the bike has a 360° spin video URL.
 * Returns null when video360Url is absent — callers skip rendering.
 *
 * contentUrl uses the direct Cloudinary video URL (not embedUrl).
 * thumbnailUrl uses heroImageUrl (same poster as Bike360Viewer).
 * uploadDate uses publishedAt when set on the published bike document.
 */
export function buildVideoObjectJsonLd(
  bike: BikeJsonLdInput,
  brandSlug: string,
  slug: string,
): string | null {
  const videoUrl = bike.video360Url?.trim()
  if (!videoUrl) return null

  const uploadDate = toIsoUploadDate(bike.publishedAt)

  const videoObject: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${bike.brandName} ${bike.name} 360° View`,
    description: bike.tagline,
    contentUrl: videoUrl,
    thumbnailUrl: bike.heroImageUrl,
  }

  if (uploadDate) {
    videoObject.uploadDate = uploadDate
  }

  videoObject.mainEntityOfPage = {
    '@type': 'WebPage',
    '@id': absoluteUrl(`/bikes/${brandSlug}/${slug}`),
  }

  return serializeJsonLd(videoObject)
}
