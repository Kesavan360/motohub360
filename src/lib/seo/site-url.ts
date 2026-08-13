/*
 * site-url.ts — Shared site URL helper for P-01 SEO metadata.
 *
 * MPD Task P-01:
 *   Centralises NEXT_PUBLIC_SITE_URL normalisation so generateMetadata()
 *   exports and JSON-LD builders resolve identical absolute URLs.
 *
 * Safe in Server Components, Route Handlers, and next.config.ts (Node.js).
 */

/**
 * Returns the public site origin without a trailing slash.
 * Falls back to an empty string when the env var is unset (local dev).
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
}

/**
 * Builds an absolute URL for a site path.
 * Path must start with "/" (e.g. "/bikes/royal-enfield/gt-650").
 */
export function absoluteUrl(path: string): string {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return path
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}
