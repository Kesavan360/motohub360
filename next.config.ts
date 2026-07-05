import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * TRAILING SLASH — MPD Section 4 URL Rules
   *
   * All public URLs are canonical without a trailing slash.
   * e.g. /bikes/royal-enfield/gt-650 — not /bikes/royal-enfield/gt-650/
   *
   * This prevents duplicate URL indexing in Google, which would split
   * ranking signals across two versions of the same page.
   * Enforced here so every ISR-generated page, sitemap entry, and
   * internal link is canonical from the start.
   */
  trailingSlash: false,

  /*
   * IMAGE OPTIMISATION — MPD Section 14 Image Strategy
   *
   * Next.js blocks all external image domains by default for security.
   * Cloudinary is whitelisted here so the <Image> component can load
   * bike photos, gallery images, brand logos, and OG images from Cloudinary CDN.
   *
   * remotePatterns is preferred over the deprecated `domains` array —
   * it allows per-hostname, per-protocol, and per-pathname control.
   *
   * res.cloudinary.com — standard image delivery hostname
   * images.cloudinary.com — alternative Cloudinary delivery hostname
   *   (some Cloudinary accounts and transformations use this)
   *
   * Both are whitelisted to ensure all Cloudinary URL formats work
   * regardless of how the admin configures upload presets.
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.cloudinary.com',
        pathname: '/**',
      },
    ],
  },

  /*
   * REDIRECTS — MPD Section 4 URL Rules + P-01
   *
   * 301 permanent redirects enforce canonical URL patterns.
   * The redirect rules for variant URL formats (e.g. /bikes/royalenfield/gt650
   * → /bikes/royal-enfield/gt-650) are added in task P-01 when SEO
   * architecture is implemented.
   *
   * The async function structure is established here so P-01 can add
   * rules without modifying the config shape.
   *
   * Return value: empty array = no active redirects yet.
   */
  async redirects() {
    return [
      // P-01: SEO canonical redirects added here
    ]
  },
}

export default nextConfig