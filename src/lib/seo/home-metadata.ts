/*
 * home-metadata.ts — SEO metadata contract for the Home page (/).
 *
 * MPD Task P-01:
 *   The Home route is a Client Component (H-06); metadata is exported from
 *   the Server Component wrapper in app/page.tsx using these constants.
 */

import type { Metadata } from 'next'
import { absoluteUrl, getSiteUrl } from '@/lib/seo/site-url'

export const HOME_PAGE_TITLE =
  'MotoHub360 — Motorcycle Prices, Specs & Colours in India'

export const HOME_PAGE_DESCRIPTION =
  'Discover motorcycles in India. Search by brand, category, or price range. ' +
  'Compare specs, colours, and ex-showroom prices on MotoHub360.'

export function buildHomeMetadata(): Metadata {
  const siteUrl = getSiteUrl()
  const canonical = absoluteUrl('/')

  return {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
    openGraph: {
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      url: siteUrl ? canonical : '/',
      type: 'website',
      siteName: 'MotoHub360',
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
    },
    alternates: {
      canonical: siteUrl ? canonical : '/',
    },
  }
}
