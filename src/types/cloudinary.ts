/*
 * cloudinary.ts (types) — TypeScript types for Cloudinary integration.
 *
 * MPD Task A-07:
 *   "Media upload (Cloudinary) — upload endpoint + UI component."
 *
 * A-07.1 scope:
 *   This file defines all TypeScript types used across the Cloudinary
 *   integration:
 *     - A-07.1 (this file): types defined
 *     - A-07.2: CloudinaryUploadResult used in the upload API route
 *     - A-07.3: CloudinaryUploadResult used in the upload UI component
 *     - Phase 8: BikeGallery/BikeColorSelector use CloudinaryImageOptions
 *
 * TYPE SOURCES:
 *   Cloudinary v2's TypeScript definitions are verbose and occasionally
 *   incomplete. MotoHub360 defines its own narrowed types that match
 *   exactly the fields the application uses, derived from:
 *     - Cloudinary Node.js SDK v2 UploadApiResponse type
 *     - Cloudinary Upload API documentation (2024)
 *     - The subset of fields stored in the Bike MongoDB document (DB-02)
 *
 *   The full Cloudinary SDK response type is available via:
 *     import type { UploadApiResponse } from 'cloudinary'
 *   MotoHub360 does not use it directly to avoid tight coupling to the
 *   SDK's internal type definitions.
 *
 * RESOURCE TYPES:
 *   Cloudinary organises assets into resource types:
 *     'image' — photographs, logos, illustrations (.jpg, .png, .webp, .svg)
 *     'video' — videos, 360° spin files (.mp4, .webm, .mov)
 *     'raw'   — arbitrary files (.pdf, .zip — not used in MotoHub360)
 *
 *   MotoHub360 uses 'image' and 'video' only.
 *
 * DELIVERY FORMATS:
 *   Cloudinary auto-selects the optimal delivery format (f_auto) and
 *   compresses automatically (q_auto) when these transformations are
 *   applied at the URL level (built by cloudinary.ts utilities).
 *   The stored public_id never includes a format extension — format
 *   is always determined at delivery time.
 */

// ---------------------------------------------------------------------------
// Cloudinary resource type
// ---------------------------------------------------------------------------

/*
 * CloudinaryResourceType — the Cloudinary asset classification.
 * Maps directly to Cloudinary's resource_type parameter.
 */
export type CloudinaryResourceType = 'image' | 'video' | 'raw'

// ---------------------------------------------------------------------------
// Upload result
// ---------------------------------------------------------------------------

/*
 * CloudinaryUploadResult — the fields MotoHub360 stores after a successful upload.
 *
 * This is a NARROWED subset of Cloudinary's full UploadApiResponse.
 * Only the fields stored in MongoDB (DB-02 IBike.gallery, IBike.heroImageUrl,
 * IBike.video360Url) and used in the application are included.
 *
 * FIELD NOTES:
 *
 * public_id:
 *   Cloudinary's unique asset identifier within a cloud.
 *   Does NOT include the file extension (format is separate).
 *   Used to construct delivery URLs and for deletion.
 *   Example: "motohub360/bikes/heroes/royal-enfield-gt-650-hero"
 *
 * secure_url:
 *   The HTTPS delivery URL for the asset.
 *   This is the URL stored in MongoDB (IBike.heroImageUrl etc.).
 *   It does NOT include any transformations — transformations are applied
 *   at render time by the URL utility functions in cloudinary.ts.
 *   Example: "https://res.cloudinary.com/motohub360/image/upload/v1234/motohub360/..."
 *
 * url:
 *   The HTTP (non-HTTPS) delivery URL. Not used in MotoHub360 — we always
 *   use secure_url. Included for completeness.
 *
 * version:
 *   Numeric version timestamp. Used to bust Cloudinary's CDN cache after
 *   an asset is replaced (same public_id, new image).
 *   Example: 1234567890
 *
 * asset_id:
 *   Cloudinary's internal UUID for the asset. Stable across renames.
 *   Distinct from public_id (which can change if asset is moved/renamed).
 *
 * format:
 *   The format Cloudinary chose to store the original file as.
 *   Example: "jpg", "png", "mp4", "webm"
 *   Note: delivery format may differ (f_auto selects webp for browsers
 *   that support it, even if the stored format is jpg).
 *
 * resource_type:
 *   'image' or 'video'. Used to validate the upload type matches the
 *   intended field (heroImage should be 'image', video360 should be 'video').
 *
 * width, height:
 *   Original pixel dimensions of the uploaded image.
 *   Available for images only — undefined for videos.
 *   Used to validate minimum hero image dimensions (≥ 1200×900).
 *
 * duration:
 *   Video duration in seconds. Available for videos only.
 *   Used to validate 360° spin videos are within acceptable length.
 *
 * bytes:
 *   File size in bytes. Used for upload size validation logging.
 *
 * created_at:
 *   ISO 8601 timestamp of when the asset was uploaded.
 *   Example: "2024-01-15T10:30:00Z"
 *
 * folder:
 *   The Cloudinary folder the asset was uploaded to.
 *   Example: "motohub360/bikes/heroes"
 *   Note: In Cloudinary v2, the folder is encoded in the public_id.
 *   This field may be absent in some response variants — use
 *   public_id parsing to reliably determine the folder.
 *
 * original_filename:
 *   The filename of the original uploaded file, without extension.
 *   Not stored in MongoDB — useful for logging only.
 *   Example: "royal-enfield-gt-650-hero" (from the upload form)
 *
 * etag:
 *   MD5 hash of the asset content. Used for de-duplication detection:
 *   if an admin uploads the same file twice, the etags will match.
 */
export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  url: string
  version: number
  asset_id: string
  format: string
  resource_type: CloudinaryResourceType
  width?: number             // images only
  height?: number            // images only
  duration?: number          // videos only, in seconds
  bytes: number
  created_at: string
  folder?: string
  original_filename?: string
  etag: string
}

// ---------------------------------------------------------------------------
// Image transformation options
// ---------------------------------------------------------------------------

/*
 * CloudinaryImageOptions — parameters for building optimised image delivery URLs.
 *
 * Used by buildCloudinaryImageUrl() in src/lib/cloudinary.ts.
 *
 * These options map directly to Cloudinary URL transformation parameters.
 * MotoHub360 uses a small, intentional subset — not the full Cloudinary
 * transformation API — to keep URL construction simple and predictable.
 *
 * ALWAYS APPLIED (in buildCloudinaryImageUrl, regardless of options):
 *   f_auto — auto-select best format (webp for modern browsers, jpg fallback)
 *   q_auto — auto-select optimal quality (Cloudinary's perceptual quality model)
 *
 * These two are non-negotiable — every image served by MotoHub360 uses
 * f_auto + q_auto to ensure optimal file size and format without manual tuning.
 */
export interface CloudinaryImageOptions {
  /*
   * width — resize to this width in pixels.
   * Cloudinary scales proportionally unless height is also specified.
   * Omit to serve the original width (rare — always specify width for
   * web delivery to avoid serving oversized images to small screens).
   */
  width?: number

  /*
   * height — resize to this height in pixels.
   * Combined with width and crop to define the image dimensions precisely.
   */
  height?: number

  /*
   * crop — how to crop/fit the image to the specified dimensions.
   *
   * Common values used in MotoHub360:
   *   'fill'    — fill the exact dimensions, cropping edges if needed.
   *               Used for hero images, thumbnails, gallery images.
   *   'fit'     — fit within the dimensions without cropping.
   *               Used for brand logos (preserve aspect ratio).
   *   'limit'   — like fit, but only downscales (never upscales).
   *               Used for responsive images where max-width matters.
   *   'thumb'   — smart crop using Cloudinary's face/object detection.
   *               Used for admin table thumbnails (40×40px).
   *   'pad'     — fit within dimensions, pad transparent edges.
   *               Used for brand logos on coloured backgrounds.
   *
   * Default: 'fill' (most common for bike photography).
   */
  crop?: 'fill' | 'fit' | 'limit' | 'thumb' | 'pad' | 'scale' | 'crop'

  /*
   * gravity — where to anchor the crop when crop='fill' or 'thumb'.
   *
   * Common values:
   *   'auto'    — Cloudinary auto-detects the most interesting region.
   *               Best for bike photography (keeps the bike in frame).
   *   'center'  — always crop from the center.
   *   'face'    — crop around detected faces (not used for bikes).
   *   'north'   — keep the top of the image.
   *   'south'   — keep the bottom.
   *
   * Default: 'auto' (best for bike photos — Cloudinary detects the subject).
   */
  gravity?: 'auto' | 'center' | 'face' | 'north' | 'south' | 'east' | 'west'

  /*
   * quality — override auto quality (0–100 or 'auto').
   * Rarely needed — q_auto is applied by default.
   * Use only when you need to force a specific quality level
   * (e.g. 'auto:best' for hero images where file size is secondary).
   */
  quality?: number | 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low'

  /*
   * radius — corner radius for rounded images (px or 'max' for circle).
   * Used for admin thumbnail generation (40px rounded squares).
   * Example: radius: 6 → r_6 in URL
   */
  radius?: number | 'max'

  /*
   * blur — blur effect strength (1–2000).
   * Used to generate the blur-up placeholder (blurDataUrl).
   * Typically: blur: 1000 with width: 20 for a tiny blurred placeholder.
   */
  blur?: number

  /*
   * effect — Cloudinary effect string.
   * Used sparingly in MotoHub360:
   *   'grayscale' — for brand logo monochrome effect in BrandLogoChip.
   *                 (Applied via CSS filter at render time, not URL — so
   *                  this option is reserved for future server-side use.)
   */
  effect?: string
}

// ---------------------------------------------------------------------------
// Video transformation options
// ---------------------------------------------------------------------------

/*
 * CloudinaryVideoOptions — parameters for building optimised video delivery URLs.
 *
 * Used by buildCloudinaryVideoUrl() in src/lib/cloudinary.ts.
 *
 * MotoHub360 uses this for 360° spin videos (Bike360Viewer, B-04).
 * Spin videos are short (~10–30 seconds), looping, muted — the primary
 * concern is file size and cross-browser format compatibility.
 */
export interface CloudinaryVideoOptions {
  /*
   * width — resize video to this width.
   * MotoHub360 standard for 360° videos: 1280px (1280×720 at 16:9).
   */
  width?: number

  /*
   * quality — video quality.
   * 'auto' lets Cloudinary choose optimal bitrate per resolution.
   * Recommended for all videos — reduces file size without visual loss.
   */
  quality?: number | 'auto'

  /*
   * format — video delivery format.
   * 'auto' selects mp4 or webm based on browser Accept header.
   * webm is ~20% smaller than mp4 for the same quality.
   * Not always available as a URL param in Cloudinary — typically
   * applied via f_auto in the transformation chain.
   */
  format?: 'mp4' | 'webm' | 'auto'
}

// ---------------------------------------------------------------------------
// Folder paths
// ---------------------------------------------------------------------------

/*
 * CloudinaryFolder — enumeration of MotoHub360's Cloudinary folder paths.
 *
 * Used by the upload API route (A-07.2) as the `folder` parameter
 * in Cloudinary upload options. Keeping these as typed constants
 * prevents typos in folder paths across the codebase.
 *
 * FOLDER STRUCTURE:
 *   motohub360/
 *   ├── bikes/
 *   │   ├── heroes/    ← one per bike — the primary motorcycle image
 *   │   ├── gallery/   ← multiple per bike — additional angles/details
 *   │   └── 360/       ← one per bike — the 360° spin video file
 *   └── brands/
 *       └── logos/     ← one per brand — SVG or PNG logo
 *
 * WHY A CONST OBJECT INSTEAD OF AN ENUM:
 *   TypeScript string enums compile to objects and can cause issues with
 *   `as const` patterns. A const object with string values is simpler,
 *   tree-shakeable, and the values remain strings at runtime (no enum
 *   remapping overhead). The CloudinaryFolderPath type provides the
 *   union type for type safety.
 */
export const CLOUDINARY_FOLDERS = {
  BIKE_HEROES:   'motohub360/bikes/heroes',
  BIKE_GALLERY:  'motohub360/bikes/gallery',
  BIKE_360:      'motohub360/bikes/360',
  BRAND_LOGOS:   'motohub360/brands/logos',
} as const

/*
 * CloudinaryFolderPath — union type of valid Cloudinary folder paths.
 * Derived from CLOUDINARY_FOLDERS values for type safety.
 * Import this when a function parameter should only accept valid folders.
 */
export type CloudinaryFolderPath =
  (typeof CLOUDINARY_FOLDERS)[keyof typeof CLOUDINARY_FOLDERS]

// ---------------------------------------------------------------------------
// Upload intent
// ---------------------------------------------------------------------------

/*
 * CloudinaryUploadIntent — describes WHAT is being uploaded.
 *
 * Used by the upload API route (A-07.2) to:
 *   1. Determine which Cloudinary folder to upload to.
 *   2. Determine the resource_type (image vs video).
 *   3. Apply intent-specific validation (min dimensions, max file size).
 *   4. Generate the public_id with the correct naming convention.
 *
 * INTENT → FOLDER MAPPING:
 *   'bike_hero'    → CLOUDINARY_FOLDERS.BIKE_HEROES   (resource: 'image')
 *   'bike_gallery' → CLOUDINARY_FOLDERS.BIKE_GALLERY  (resource: 'image')
 *   'bike_360'     → CLOUDINARY_FOLDERS.BIKE_360      (resource: 'video')
 *   'brand_logo'   → CLOUDINARY_FOLDERS.BRAND_LOGOS   (resource: 'image')
 */
export type CloudinaryUploadIntent =
  | 'bike_hero'
  | 'bike_gallery'
  | 'bike_360'
  | 'brand_logo'

// ---------------------------------------------------------------------------
// Upload constraints
// ---------------------------------------------------------------------------

/*
 * CloudinaryUploadConstraints — validation rules per upload intent.
 *
 * Used by the upload API route (A-07.2) to reject invalid files
 * before sending them to Cloudinary, saving API quota and bandwidth.
 *
 * All file sizes are in bytes.
 * All dimensions are in pixels.
 */
export interface CloudinaryUploadConstraints {
  /*
   * maxBytes — maximum file size in bytes.
   * Cloudinary's free tier limit is 10MB per file — MotoHub360
   * enforces stricter limits per intent to keep the site fast.
   */
  maxBytes: number

  /*
   * acceptedMimeTypes — array of allowed MIME types.
   * The upload API rejects files with MIME types not in this list
   * before reading the file content.
   */
  acceptedMimeTypes: string[]

  /*
   * minWidth, minHeight — minimum image dimensions (images only).
   * Hero images must be at least 1200×900 for quality rendering at
   * 16:9 on high-density displays.
   * Brand logos must be at least 200×200 for readable display.
   */
  minWidth?: number
  minHeight?: number

  /*
   * resourceType — Cloudinary resource_type for this intent.
   * 'image' for photos and logos, 'video' for 360° spin videos.
   */
  resourceType: CloudinaryResourceType
}

/*
 * UPLOAD_CONSTRAINTS — validation rules per CloudinaryUploadIntent.
 *
 * Used as: UPLOAD_CONSTRAINTS['bike_hero']
 * Returns a CloudinaryUploadConstraints object for that intent.
 */
export const UPLOAD_CONSTRAINTS: Record<
  CloudinaryUploadIntent,
  CloudinaryUploadConstraints
> = {
  bike_hero: {
    maxBytes: 8 * 1024 * 1024,           // 8 MB
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    minWidth: 1200,
    minHeight: 900,
    resourceType: 'image',
  },

  bike_gallery: {
    maxBytes: 6 * 1024 * 1024,           // 6 MB
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    minWidth: 800,
    minHeight: 600,
    resourceType: 'image',
  },

  bike_360: {
    maxBytes: 50 * 1024 * 1024,          // 50 MB — videos are larger
    acceptedMimeTypes: [
      'video/mp4',
      'video/webm',
      'video/quicktime',                  // .mov from iPhone/GoPro
    ],
    /*
     * No minWidth/minHeight for videos — Cloudinary validates video
     * dimensions differently and 360° spin videos have varying aspect
     * ratios depending on the capture rig.
     */
    resourceType: 'video',
  },

  brand_logo: {
    maxBytes: 2 * 1024 * 1024,           // 2 MB
    acceptedMimeTypes: [
      'image/svg+xml',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    minWidth: 200,
    minHeight: 200,
    resourceType: 'image',
  },
}

// ---------------------------------------------------------------------------
// Blur data URL config
// ---------------------------------------------------------------------------

/*
 * BLUR_PLACEHOLDER_CONFIG — dimensions for blur-up placeholder generation.
 *
 * When a bike image is uploaded (A-07.2), the upload route also fetches a
 * tiny blurred version of the image and stores it as blurDataUrl in MongoDB.
 * This is the low-quality placeholder shown while the full image loads
 * (Next.js Image placeholder="blur" prop in BikeGallery, BikeHero, etc.).
 *
 * GENERATION:
 *   Cloudinary URL with: w_20, h_20, e_blur:1000, q_1, f_jpg
 *   This produces a ~200-byte base64 string — tiny enough to inline.
 *
 * WHY 20×20:
 *   Next.js Image requires blurDataURL to be a low-quality image.
 *   20×20 is small enough that the base64 string fits in a MongoDB
 *   document without needing separate storage, yet large enough for
 *   the browser to display a recognisable blurred preview.
 */
export const BLUR_PLACEHOLDER_CONFIG = {
  width: 20,
  height: 20,
  blur: 1000,
  quality: 1,
  format: 'jpg',
} as const