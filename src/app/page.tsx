/*
 * Home Page — /
 *
 * MPD Task P-01:
 *   Server Component wrapper exports Home page SEO metadata.
 *   Interactive UI lives in HomePageClient (H-06).
 */

import { buildHomeMetadata } from '@/lib/seo/home-metadata'
import HomePageClient from './HomePageClient'

export const metadata = buildHomeMetadata()

export default function HomePage() {
  return <HomePageClient />
}
