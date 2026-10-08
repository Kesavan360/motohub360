/*
 * Home Page — /
 *
 * MPD Task P-01:
 *   Server Component wrapper exports Home page SEO metadata.
 *   Interactive UI lives in HomePageClient (H-06).
 *
 * HP-FIX-01:
 *   Featured bikes are loaded from MongoDB instead of mock data.
 */

import { buildHomeMetadata } from '@/lib/seo/home-metadata'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import type { FeaturedBike } from '@/components/bike/BikeHero'
import HomePageClient from './HomePageClient'

export const metadata = buildHomeMetadata()

export default async function HomePage() {
  let featuredBikes: FeaturedBike[] = []

  try {
    await connectDB()

    const bikes = await Bike.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(5)
      .lean()

    featuredBikes = bikes.map((bike) => ({
      slug: bike.slug,
      brandSlug: bike.brandSlug,
      name: bike.name,
      tagline: bike.tagline,
      heroImageUrl: bike.heroImageUrl,
      blurDataUrl: bike.blurDataUrl,
    }))
  } catch {
    featuredBikes = []
  }

  return <HomePageClient featuredBikes={featuredBikes} />
}