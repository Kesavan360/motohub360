/*
 * sitemap.ts — Dynamic XML sitemap for indexable public routes.
 *
 * MPD Task P-03:
 *   Exposes canonical absolute URLs for home, listing pages, and published
 *   bike detail pages. Excludes noindex routes (/search), admin routes,
 *   and unpublished bikes.
 *
 * URL rules align with P-01: no trailing slash, absolute URLs via site-url.ts.
 */

import type { MetadataRoute } from 'next'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { absoluteUrl } from '@/lib/seo/site-url'
import { BRAND_SLUGS } from '@/constants/brands'
import { CATEGORY_SLUGS } from '@/constants/categories'
import { PRICE_RANGE_SLUGS } from '@/constants/priceRanges'

/**
 * Adds a sitemap entry when the canonical URL has not been seen yet.
 */
function addEntry(
  entries: MetadataRoute.Sitemap,
  seen: Set<string>,
  path: string,
  lastModified?: Date,
): void {
  const url = absoluteUrl(path)
  if (seen.has(url)) return

  seen.add(url)
  entries.push(lastModified ? { url, lastModified } : { url })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seen = new Set<string>()
  const entries: MetadataRoute.Sitemap = []

  addEntry(entries, seen, '/')
  addEntry(entries, seen, '/brands')

  for (const brand of BRAND_SLUGS) {
    addEntry(entries, seen, `/brands/${brand}`)
  }

  for (const category of CATEGORY_SLUGS) {
    addEntry(entries, seen, `/category/${category}`)
  }

  for (const range of PRICE_RANGE_SLUGS) {
    addEntry(entries, seen, `/price/${range}`)
  }

  try {
    await connectDB()

    const bikes = await Bike.find({ status: 'published' })
      .select('brandSlug slug updatedAt')
      .lean<Array<{ brandSlug: string; slug: string; updatedAt?: Date }>>()

    for (const bike of bikes) {
      const lastModified =
        bike.updatedAt instanceof Date && !Number.isNaN(bike.updatedAt.getTime())
          ? bike.updatedAt
          : undefined

      addEntry(
        entries,
        seen,
        `/bikes/${bike.brandSlug}/${bike.slug}`,
        lastModified,
      )
    }
  } catch {
    /*
     * DB unavailable at build time — return static listing URLs only.
     * Same resilience pattern as generateStaticParams and P-01 redirects.
     */
  }

  return entries
}
