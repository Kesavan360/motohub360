/*
 * cloudinary.ts — Cloudinary SDK configuration and URL utility functions.
 *
 * MPD Task A-07:
 *   "Media upload (Cloudinary) — upload endpoint + UI component."
 *
 * A-07.1 scope:
 *   This file provides:
 *     1. getCloudinary()         — configured Cloudinary v2 SDK instance
 *     2. validateCloudinaryConfig() — runtime env var validation
 *     3. buildCloudinaryImageUrl()  — optimised image delivery URL builder
 *     4. buildCloudinaryVideoUrl()  — optimised video delivery URL builder
 *     5. buildBlurDataUrl()         — tiny placeholder URL for Next.js blur-up
 *     6. getPublicId()              — generate a public_id from bike/brand data
 *
 * CLOUDINARY SDK VERSION:
 *   MotoHub360 uses Cloudinary Node.js SDK v2 ('cloudinary' package).
 *   v2 uses { v2 as cloudinary } named import — not the v1 default import.
 *   All upload, transformation, and management APIs are on the v2 object.
 *
 * SINGLETON PATTERN:
 *   getCloudinary() follows the same lazy-singleton pattern as connectDB()
 *   from src/lib/db/mongodb.ts. The Cloudinary SDK is a global singleton —
 *   calling cloudinary.config() multiple times is safe (it's idempotent),
 *   but the guard prevents redundant environment variable reads on every call.
 *
 * SERVER-ONLY:
 *   This module imports the Cloudinary Node.js SDK and reads server-only
 *   environment variables (CLOUDINARY_API_SECRET).
 *   NEVER import this in 'use client' components.
 *   Import only in:
 *     - Route Handlers (A-07.2 upload API route)
 *     - Server Components
 *     - Server Actions (future phase)
 *     - Scripts (scripts/seed.ts)
 *
 * URL UTILITY FUNCTIONS:
 *   buildCloudinaryImageUrl() and buildCloudinaryVideoUrl() do NOT require
 *   the API secret — they only need NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   to construct delivery URLs. However, they are placed in this server-only
 *   file because they are primarily used in Server Components (BikeSpecTable,
 *   BikeFeaturesList, BikeGallery rendering).
 *
 *   If URL construction is needed in a Client Component, extract these
 *   utilities to a separate 'src/lib/cloudinary-url.ts' file that only
 *   reads NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (no API secret required).
 *
 * CLOUDINARY URL FORMAT:
 *   Delivery URLs follow this pattern:
 *   https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/v{version}/{public_id}.{format}
 *
 *   With f_auto + q_auto (always applied by MotoHub360):
 *   https://res.cloudinary.com/motohub360/image/upload/f_auto,q_auto,w_1200/v1234/motohub360/bikes/heroes/gt-650-hero
 *
 *   Note: the public_id includes the folder path. Format (.jpg/.webp) is
 *   omitted from the URL when f_auto is applied — Cloudinary adds it.
 */

import { v2 as cloudinary } from 'cloudinary'
import type {
  CloudinaryImageOptions,
  CloudinaryVideoOptions,
  CloudinaryUploadIntent,
  CloudinaryFolderPath,
} from '@/types/cloudinary'
import {
  CLOUDINARY_FOLDERS,
} from '@/types/cloudinary'

// ---------------------------------------------------------------------------
// Singleton guard
// ---------------------------------------------------------------------------

/*
 * _configured — tracks whether cloudinary.config() has been called.
 * Prevents redundant configuration calls on every getCloudinary() invocation.
 * Module-level variable (not exported) — treated as a private singleton flag.
 */
let _configured = false

// ---------------------------------------------------------------------------
// validateCloudinaryConfig
// ---------------------------------------------------------------------------

/*
 * validateCloudinaryConfig — validates all required Cloudinary environment
 * variables at runtime.
 *
 * Called by getCloudinary() before passing values to cloudinary.config().
 * Throws a descriptive Error if any required variable is missing or empty,
 * giving the developer a clear message rather than a cryptic Cloudinary
 * SDK error.
 *
 * WHEN TO CALL DIRECTLY:
 *   The upload API route (A-07.2) calls getCloudinary() which calls
 *   this internally. You do not need to call it separately.
 *   It is exported for use in startup health-check scripts or tests
 *   that want to verify environment configuration without performing
 *   an actual upload.
 */
export function validateCloudinaryConfig(): void {
  const missing: string[] = []

  if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) {
    missing.push('CLOUDINARY_CLOUD_NAME')
  }
  if (!process.env.CLOUDINARY_API_KEY?.trim()) {
    missing.push('CLOUDINARY_API_KEY')
  }
  if (!process.env.CLOUDINARY_API_SECRET?.trim()) {
    missing.push('CLOUDINARY_API_SECRET')
  }

  if (missing.length > 0) {
    throw new Error(
      `[MotoHub360] Missing required Cloudinary environment variable${
        missing.length > 1 ? 's' : ''
      }:\n` +
        missing.map((v) => `  • ${v}`).join('\n') +
        '\n\n' +
        'Add these to .env.local. Obtain values from:\n' +
        'https://console.cloudinary.com → Settings → API Keys',
    )
  }
}

// ---------------------------------------------------------------------------
// getCloudinary — configured Cloudinary v2 singleton
// ---------------------------------------------------------------------------

/*
 * getCloudinary — returns a configured Cloudinary v2 SDK instance.
 *
 * This is the ONLY way to access the Cloudinary SDK in MotoHub360.
 * Never import { v2 as cloudinary } directly in other modules.
 * Always use: const cld = getCloudinary()
 *
 * USAGE (A-07.2 upload route):
 *   import { getCloudinary } from '@/lib/cloudinary'
 *
 *   const cld = getCloudinary()
 *   const result = await cld.uploader.upload(filePath, { ... })
 *
 * CONFIGURATION:
 *   cloud_name:  identifies your Cloudinary account
 *   api_key:     authenticates API requests (public-ish — not alone dangerous)
 *   api_secret:  signs upload and management requests (must stay secret)
 *   secure:      forces HTTPS delivery URLs (always true — never HTTP)
 *
 * WHY NOT CALL cloudinary.config() AT MODULE TOP LEVEL:
 *   Next.js may import this module in contexts where the environment
 *   variables are not yet populated (e.g. during static analysis or
 *   edge runtime compilation). Deferring to getCloudinary() ensures
 *   config() is only called when the module is actually used at request
 *   time, not during build-time module evaluation.
 */
export function getCloudinary(): typeof cloudinary {
  if (!_configured) {
    validateCloudinaryConfig()

    cloudinary.config({
      cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
      api_key:     process.env.CLOUDINARY_API_KEY,
      api_secret:  process.env.CLOUDINARY_API_SECRET,
      /*
       * secure: true — all delivery URLs use HTTPS (res.cloudinary.com).
       * Never allow HTTP delivery — mixed content warnings would break
       * the site on HTTPS production domains.
       */
      secure: true,
    })

    _configured = true

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[MotoHub360] Cloudinary configured — cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`,
      )
    }
  }

  return cloudinary
}

// ---------------------------------------------------------------------------
// buildCloudinaryImageUrl — optimised image delivery URL
// ---------------------------------------------------------------------------

/*
 * buildCloudinaryImageUrl — constructs a Cloudinary image delivery URL
 * with MotoHub360's standard transformations applied.
 *
 * ALWAYS APPLIED:
 *   f_auto  — deliver in the best format for the requesting browser
 *             (webp for Chrome/Edge/Firefox, jpg for older Safari/IE)
 *   q_auto  — let Cloudinary's perceptual quality model choose the
 *             optimal quality level (usually 75–85% jpeg equivalent)
 *
 * These two are non-negotiable. Every image served by MotoHub360 uses
 * f_auto + q_auto. They reduce average image weight by 30–50% without
 * any visible quality loss.
 *
 * USAGE EXAMPLES:
 *
 *   // Hero image at 1440px wide (full-width desktop)
 *   buildCloudinaryImageUrl(bike.heroImageUrl, { width: 1440, crop: 'fill', gravity: 'auto' })
 *   // → https://res.cloudinary.com/{cloud}/image/upload/f_auto,q_auto,w_1440,c_fill,g_auto/v.../...
 *
 *   // Gallery thumbnail at 400×300 (4:3)
 *   buildCloudinaryImageUrl(url, { width: 400, height: 300, crop: 'fill', gravity: 'auto' })
 *
 *   // Brand logo at 160px, preserve aspect ratio
 *   buildCloudinaryImageUrl(url, { width: 160, crop: 'fit' })
 *
 *   // Admin table thumbnail (40×40px rounded)
 *   buildCloudinaryImageUrl(url, { width: 40, height: 40, crop: 'thumb', gravity: 'auto', radius: 6 })
 *
 * PARAMETERS:
 *   sourceUrl — the Cloudinary secure_url stored in MongoDB.
 *               Must be a valid Cloudinary URL (res.cloudinary.com).
 *               Returns the sourceUrl unchanged if it is not a Cloudinary URL
 *               (safety: non-Cloudinary URLs are sometimes present in dev data).
 *
 *   options — CloudinaryImageOptions transformation parameters.
 *
 * RETURNS:
 *   A Cloudinary delivery URL string with the specified transformations.
 *   Always HTTPS.
 *
 * IMPLEMENTATION NOTE:
 *   This function uses string manipulation to insert transformations into
 *   the Cloudinary URL rather than the SDK's cloudinary.url() method.
 *   Reason: cloudinary.url() requires the configured SDK instance (API key etc.),
 *   but URL construction only needs the cloud_name — which is NEXT_PUBLIC
 *   and safe for client-side use.
 *   The string approach is simpler, avoids SDK dependency for URL building,
 *   and is the standard pattern used by Cloudinary's Next.js integration.
 *
 *   Format of a Cloudinary URL:
 *   https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transforms}/v{version}/{public_id}
 *
 *   We insert transformations between "/upload/" and the rest of the URL.
 */
export function buildCloudinaryImageUrl(
  sourceUrl: string,
  options: CloudinaryImageOptions = {},
): string {
  /*
   * Safety check — only transform valid Cloudinary URLs.
   * Non-Cloudinary URLs (Cloudinary demo images, external URLs used in
   * dev/seed data) are returned unchanged.
   */
  if (!sourceUrl.includes('res.cloudinary.com')) {
    return sourceUrl
  }

  /*
   * Build the transformation string.
   * Order matters in Cloudinary: resize/crop → effects → format/quality.
   * f_auto and q_auto always go last for correct chaining.
   */
  const parts: string[] = []

  // ── Dimensions + crop ─────────────────────────────────────────────────
  if (options.width)     parts.push(`w_${options.width}`)
  if (options.height)    parts.push(`h_${options.height}`)
  if (options.crop)      parts.push(`c_${options.crop}`)
  if (options.gravity)   parts.push(`g_${options.gravity}`)

  // ── Visual effects ─────────────────────────────────────────────────────
  if (options.blur)      parts.push(`e_blur:${options.blur}`)
  if (options.effect)    parts.push(`e_${options.effect}`)
  if (options.radius)    parts.push(`r_${options.radius}`)

  // ── Quality override ───────────────────────────────────────────────────
  if (options.quality !== undefined) {
    parts.push(`q_${options.quality}`)
  } else {
    /*
     * Default quality: q_auto — always applied unless the caller
     * explicitly overrides with options.quality.
     * Cloudinary's q_auto is equivalent to ~75-85% JPEG quality
     * for most images, with intelligent scene-specific adjustments.
     */
    parts.push('q_auto')
  }

  // ── Format — always last ───────────────────────────────────────────────
  /*
   * f_auto — always applied. Delivers webp to supporting browsers,
   * jpg/png as fallback. This transformation must be last in the chain
   * so Cloudinary can assess the full transformation output before
   * choosing the optimal delivery format.
   */
  parts.push('f_auto')

  const transformation = parts.join(',')

  /*
   * Insert transformations into the Cloudinary URL.
   * Cloudinary URLs have "/upload/" as a fixed segment.
   * We replace it with "/upload/{transformation}/" to chain transforms.
   *
   * Input:  https://res.cloudinary.com/cloud/image/upload/v1234/path/file
   * Output: https://res.cloudinary.com/cloud/image/upload/f_auto,q_auto,w_1440/v1234/path/file
   */
  return sourceUrl.replace('/upload/', `/upload/${transformation}/`)
}

// ---------------------------------------------------------------------------
// buildCloudinaryVideoUrl — optimised video delivery URL
// ---------------------------------------------------------------------------

/*
 * buildCloudinaryVideoUrl — constructs a Cloudinary video delivery URL
 * with MotoHub360's standard video transformations applied.
 *
 * ALWAYS APPLIED:
 *   f_auto — deliver mp4 or webm based on browser Accept header.
 *            webm is ~20% smaller than mp4 for equivalent quality.
 *   q_auto — Cloudinary's video quality model (bitrate optimisation).
 *
 * USAGE:
 *   // 360° spin video at 1280px width
 *   buildCloudinaryVideoUrl(bike.video360Url, { width: 1280 })
 *
 * PARAMETERS:
 *   sourceUrl — the Cloudinary video secure_url stored in MongoDB.
 *   options   — CloudinaryVideoOptions transformation parameters.
 *
 * RETURNS:
 *   A Cloudinary video delivery URL string. Always HTTPS.
 *
 * NOTE:
 *   Cloudinary video URLs use '/video/upload/' not '/image/upload/'.
 *   f_auto on video delivers mp4 by default with webm as an alternative
 *   (served based on browser capabilities via Cloudinary's adaptive format).
 */
export function buildCloudinaryVideoUrl(
  sourceUrl: string,
  options: CloudinaryVideoOptions = {},
): string {
  if (!sourceUrl.includes('res.cloudinary.com')) {
    return sourceUrl
  }

  const parts: string[] = []

  if (options.width)    parts.push(`w_${options.width}`)

  // Quality
  if (options.quality !== undefined) {
    parts.push(`q_${options.quality}`)
  } else {
    parts.push('q_auto')
  }

  // Format always last
  parts.push('f_auto')

  const transformation = parts.join(',')

  return sourceUrl.replace('/upload/', `/upload/${transformation}/`)
}

// ---------------------------------------------------------------------------
// buildBlurDataUrl — tiny blur-up placeholder
// ---------------------------------------------------------------------------

/*
 * buildBlurDataUrl — builds the Cloudinary URL for a blur-up placeholder.
 *
 * MotoHub360 stores a blurDataUrl in MongoDB for every bike image.
 * This URL produces a 20×20px blurred JPEG that Next.js Image uses as
 * the placeholder before the full image loads (placeholder="blur").
 *
 * The blur-up effect is achieved by:
 *   w_20,h_20   — resize to tiny 20×20px
 *   e_blur:1000 — apply heavy blur (Cloudinary effect, 0–2000 scale)
 *   q_1         — minimum quality (we want tiny file size)
 *   f_jpg       — force JPEG format (base64-compatible, no alpha needed)
 *
 * WHEN IS THIS CALLED:
 *   The upload API route (A-07.2) calls buildBlurDataUrl() immediately
 *   after a successful image upload, fetches the result as base64,
 *   and stores it alongside the secure_url in MongoDB.
 *
 *   Example stored value in MongoDB:
 *   "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
 *
 * USAGE (A-07.2 upload route):
 *   const blurUrl = buildBlurDataUrl(uploadResult.secure_url)
 *   const response = await fetch(blurUrl)
 *   const buffer = await response.arrayBuffer()
 *   const base64 = Buffer.from(buffer).toString('base64')
 *   const blurDataUrl = `data:image/jpeg;base64,${base64}`
 *
 * WHY JPEG SPECIFICALLY:
 *   Next.js Image's placeholder="blur" requires the blurDataURL to be a
 *   valid data URI. JPEG has no alpha channel (no transparency) which is
 *   correct for bike photography. PNG would produce larger base64 strings.
 */
export function buildBlurDataUrl(sourceUrl: string): string {
  if (!sourceUrl.includes('res.cloudinary.com')) {
    return sourceUrl
  }

  /*
   * Transformation chain for blur placeholder:
   *   w_20,h_20,c_fill  — resize to 20×20, fill crop
   *   e_blur:1000        — heavy blur effect
   *   q_1                — minimum quality (file size priority)
   *   f_jpg              — JPEG output (no alpha, smallest for solid images)
   */
  const transformation = 'w_20,h_20,c_fill,e_blur:1000,q_1,f_jpg'

  return sourceUrl.replace('/upload/', `/upload/${transformation}/`)
}

// ---------------------------------------------------------------------------
// getPublicId — generate a Cloudinary public_id
// ---------------------------------------------------------------------------

/*
 * getPublicId — generates a Cloudinary public_id for a new upload.
 *
 * CLOUDINARY public_id RULES:
 *   - Must be unique within the cloud (Cloudinary overwrites on conflict)
 *   - Can include slashes (treated as folder separators in legacy mode)
 *   - Should use lowercase, hyphens, no spaces or special characters
 *   - The folder is encoded in the public_id path
 *
 * NAMING CONVENTION:
 *   {folder}/{brandSlug}-{slug}-{intent}[-{index}]
 *
 *   Examples:
 *   motohub360/bikes/heroes/royal-enfield-gt-650-hero
 *   motohub360/bikes/gallery/royal-enfield-gt-650-gallery-1
 *   motohub360/bikes/gallery/royal-enfield-gt-650-gallery-2
 *   motohub360/bikes/360/royal-enfield-gt-650-360
 *   motohub360/brands/logos/royal-enfield-logo
 *
 * PARAMETERS:
 *   intent    — what type of asset this is (CloudinaryUploadIntent)
 *   brandSlug — the brand's URL slug (e.g. 'royal-enfield')
 *   slug      — the bike's URL slug (e.g. 'gt-650') or brand slug for logos
 *   index     — for gallery images, the 1-based position in the gallery.
 *               Omit for hero, 360°, and logo assets.
 *
 * OVERWRITE BEHAVIOUR:
 *   If an asset with the same public_id already exists in Cloudinary,
 *   uploading with the same public_id will OVERWRITE it (when the upload
 *   API route passes overwrite: true). This is the desired behaviour for
 *   hero image replacement — the admin can re-upload a better photo.
 *
 *   For gallery images, the index prevents overwrites:
 *   index=1 always refers to the first gallery image,
 *   a new gallery image would use index=N+1.
 */
export function getPublicId(
  intent: CloudinaryUploadIntent,
  brandSlug: string,
  slug: string,
  index?: number,
): string {
  const sanitise = (s: string): string =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')  // replace non-alphanumeric with hyphen
      .replace(/-+/g, '-')            // collapse consecutive hyphens
      .replace(/^-|-$/g, '')          // strip leading/trailing hyphens

  const safeBrand = sanitise(brandSlug)
  const safeSlug  = sanitise(slug)

  /*
   * Map intent to folder and filename suffix.
   */
  const intentConfig: Record<
    CloudinaryUploadIntent,
    { folder: CloudinaryFolderPath; suffix: string }
  > = {
    bike_hero:    { folder: CLOUDINARY_FOLDERS.BIKE_HEROES,  suffix: 'hero' },
    bike_gallery: { folder: CLOUDINARY_FOLDERS.BIKE_GALLERY, suffix: 'gallery' },
    bike_360:     { folder: CLOUDINARY_FOLDERS.BIKE_360,     suffix: '360' },
    brand_logo:   { folder: CLOUDINARY_FOLDERS.BRAND_LOGOS,  suffix: 'logo' },
  }

  const { folder, suffix } = intentConfig[intent]

  /*
   * Construct the public_id.
   * Format: {folder}/{brandSlug}-{slug}-{suffix}[-{index}]
   *
   * Gallery images include the 1-based index to allow multiple
   * images per bike without overwriting each other.
   *
   * For brand logos, the slug IS the brandSlug (no bike slug needed).
   * Pass the same value for both brandSlug and slug when intent='brand_logo'.
   * The intent config will use the folder correctly.
   */
  const base =
    intent === 'brand_logo'
      ? `${safeBrand}-${suffix}`
      : `${safeBrand}-${safeSlug}-${suffix}`

  const filename =
    intent === 'bike_gallery' && index !== undefined
      ? `${base}-${index}`
      : base

  return `${folder}/${filename}`
}