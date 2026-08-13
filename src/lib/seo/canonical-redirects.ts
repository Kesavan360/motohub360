/*
 * canonical-redirects.ts — 301 redirect rules for MPD Section 4 URL Rules.
 *
 * MPD Task P-01:
 *   Enforces canonical URL patterns by redirecting compact / legacy variants
 *   (e.g. /bikes/royalenfield/gt650 → /bikes/royal-enfield/gt-650).
 *
 * Used by next.config.ts redirects() at build time.
 *
 * STATIC RULES (constants):
 *   - Brand listing:  /brands/royalenfield → /brands/royal-enfield
 *   - Bike brand seg: /bikes/royalenfield/:slug → /bikes/royal-enfield/:slug
 *
 * DYNAMIC RULES (MongoDB at build time, best-effort):
 *   - Full bike paths where brandSlug and/or slug lose hyphens when compacted.
 *   - Skipped silently when the database is unavailable during build.
 */

import { BRAND_SLUGS } from '../../constants/brands'
import { CATEGORIES } from '../../constants/categories'
import { PRICE_RANGES } from '../../constants/priceRanges'

export interface CanonicalRedirect {
  source: string
  destination: string
  statusCode: 301
}

function compactSlug(slug: string): string {
  return slug.replace(/-/g, '')
}

function addRedirect(
  redirects: CanonicalRedirect[],
  seen: Set<string>,
  source: string,
  destination: string,
): void {
  if (source === destination || seen.has(source)) return
  seen.add(source)
  redirects.push({ source, destination, statusCode: 301 })
}

/**
 * Builds redirect rules from static MPD Section 4 slug constants.
 * No database connection required.
 */
export function buildStaticCanonicalRedirects(): CanonicalRedirect[] {
  const redirects: CanonicalRedirect[] = []
  const seen = new Set<string>()

  for (const slug of BRAND_SLUGS) {
    const compact = compactSlug(slug)
    if (compact === slug) continue

    addRedirect(redirects, seen, `/brands/${compact}`, `/brands/${slug}`)
    addRedirect(
      redirects,
      seen,
      `/bikes/${compact}/:slug`,
      `/bikes/${slug}/:slug`,
    )
  }

  for (const category of CATEGORIES) {
    const compact = compactSlug(category.slug)
    if (compact === category.slug) continue

    addRedirect(redirects, seen, `/category/${compact}`, `/category/${category.slug}`)
  }

  for (const range of PRICE_RANGES) {
    const compact = compactSlug(range.slug)
    if (compact === range.slug) continue

    addRedirect(redirects, seen, `/price/${compact}`, `/price/${range.slug}`)
  }

  return redirects
}

/**
 * Builds per-bike redirects for compact slug variants.
 * Returns an empty array when MongoDB is unavailable (build resilience).
 */
export async function buildBikeCanonicalRedirects(): Promise<CanonicalRedirect[]> {
  try {
    const { default: connectDB } = await import('../db/mongodb')
    const { default: Bike } = await import('../db/models/Bike')

    await connectDB()

    const bikes = await Bike.find({ status: 'published' })
      .select('brandSlug slug')
      .lean<Array<{ brandSlug: string; slug: string }>>()

    const redirects: CanonicalRedirect[] = []
    const seen = new Set<string>()

    for (const bike of bikes) {
      const compactBrand = compactSlug(bike.brandSlug)
      const compactBike = compactSlug(bike.slug)

      if (compactBrand === bike.brandSlug && compactBike === bike.slug) {
        continue
      }

      const source = `/bikes/${compactBrand}/${compactBike}`
      const destination = `/bikes/${bike.brandSlug}/${bike.slug}`
      addRedirect(redirects, seen, source, destination)
    }

    return redirects
  } catch {
    return []
  }
}

/**
 * Full redirect list for next.config.ts — static rules plus DB-backed bike rules.
 */
export async function getCanonicalRedirects(): Promise<CanonicalRedirect[]> {
  const [staticRedirects, bikeRedirects] = await Promise.all([
    Promise.resolve(buildStaticCanonicalRedirects()),
    buildBikeCanonicalRedirects(),
  ])

  return [...staticRedirects, ...bikeRedirects]
}
