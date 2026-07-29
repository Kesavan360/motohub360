/*
 * POST /api/admin/upload — Authenticated Cloudinary media upload endpoint.
 *
 * MPD Task A-07:
 *   "Media upload (Cloudinary) — upload endpoint + UI component."
 *
 * A-07.2 scope:
 *   This route is the only path by which media assets enter Cloudinary
 *   in MotoHub360. It validates the request, uploads the file, validates
 *   image dimensions post-upload (with Cloudinary rollback on failure),
 *   generates a blur-up placeholder for images, and returns the result.
 *
 * ── REQUEST ──────────────────────────────────────────────────────────────
 *
 *   Method:       POST
 *   Auth:         iron-session admin cookie (motohub360-admin-session)
 *   Content-Type: multipart/form-data
 *
 *   Form fields:
 *     file       (File)   — the asset to upload (image or video)
 *     intent     (string) — CloudinaryUploadIntent ('bike_hero' | 'bike_gallery' |
 *                           'bike_360' | 'brand_logo')
 *     brandSlug  (string) — the brand's URL slug (e.g. 'royal-enfield')
 *     slug       (string) — the bike's URL slug (e.g. 'gt-650');
 *                           for brand_logo intent, pass brandSlug for both fields
 *     index      (string) — 1-based gallery position; required when intent='bike_gallery'
 *
 * ── RESPONSE (success — 200) ─────────────────────────────────────────────
 *
 *   {
 *     ok: true,
 *     result: CloudinaryUploadResult,
 *     blurDataUrl?: string   // base64 JPEG data URI; images only; absent if generation fails
 *   }
 *
 * ── RESPONSE (errors) ────────────────────────────────────────────────────
 *
 *   401 { error: 'Unauthorized...' }           — no valid admin session
 *   400 { error: '...' }                       — validation failure
 *   413 { error: '...' }                       — file too large
 *   502 { error: '...', details?: string }     — Cloudinary API failure
 *   500 { error: '...', details?: string }     — unexpected internal error
 *   (details field only present in development)
 *
 * ── UPLOAD FLOW ──────────────────────────────────────────────────────────
 *
 *   1.  Auth check — getAdminSession() → 401 if absent
 *   2.  Cloudinary config validation — validateCloudinaryConfig() → 500 if missing
 *   3.  Parse multipart/form-data → 400 on malformed body
 *   4.  Validate intent, brandSlug, slug, index
 *   5.  Resolve UPLOAD_CONSTRAINTS for the intent
 *   6.  Validate MIME type against constraints.acceptedMimeTypes → 400
 *   7.  Validate file.size against constraints.maxBytes → 413
 *   8.  Convert File → base64 data URI (Buffer.from(arrayBuffer).toString('base64'))
 *   9.  Generate public_id via getPublicId()
 *  10.  Upload to Cloudinary via cld.uploader.upload(dataUri, options) → 502 on failure
 *  11.  Post-upload dimension validation (images only):
 *         If width < minWidth or height < minHeight:
 *           cld.uploader.destroy() → rollback (non-fatal if destroy fails)
 *           return 400 with dimension requirement details
 *  12.  Generate blur data URL (images only, non-fatal):
 *         buildBlurDataUrl() → fetch → base64 encode
 *         If fetch fails, proceed without blurDataUrl (not fatal)
 *  13.  Return 200 with result + blurDataUrl
 *
 * ── AUTHENTICATION ────────────────────────────────────────────────────────
 *
 *   A-04 middleware guards /admin/* PAGE routes at the Edge.
 *   It does NOT protect /api/admin/* routes (different matcher scope).
 *   This route handles its own auth using getAdminSession() from A-05.
 *   Returns 401 JSON — never redirects (this is an API, not a page).
 *
 * ── WHY BASE64 DATA URI FOR UPLOAD ───────────────────────────────────────
 *
 *   Cloudinary's SDK accepts three input types:
 *     1. File system path — unreliable in serverless (no persistent disk)
 *     2. Remote URL      — requires Cloudinary to fetch from an external URL
 *     3. Base64 data URI — reliable in any runtime, always in memory
 *
 *   Base64 adds ~33% size overhead vs raw bytes. At MotoHub360's file size
 *   limits (8MB hero images → ~11MB base64), this is acceptable for a
 *   low-frequency admin operation that runs a handful of times per day.
 *
 * ── WHY NOT uploader.upload_stream() ─────────────────────────────────────
 *
 *   upload_stream() requires a Node.js Readable stream. Next.js App Router
 *   route handlers use the Web Streams API (WHATWG ReadableStream), not
 *   Node.js streams. Converting between them is non-trivial and introduces
 *   runtime compatibility risks across Next.js versions. The base64 approach
 *   is simpler, more portable, and correct for the upload frequencies
 *   MotoHub360 targets (founder adding bikes manually, not bulk ingestion).
 *
 * ── VERCEL BODY SIZE LIMITS ──────────────────────────────────────────────
 *
 *   Vercel serverless functions default to a 4.5MB request body limit.
 *   For bike_360 video uploads (up to 50MB), add to vercel.json:
 *
 *   {
 *     "functions": {
 *       "src/app/api/admin/upload/route.ts": {
 *         "maxDuration": 60,
 *         "memory": 1024
 *       }
 *     }
 *   }
 *
 *   And configure the Vercel project settings to allow larger bodies.
 *   This is a deployment concern handled in Phase 12 (DEP).
 *   The route implementation is correct regardless of this limit.
 *
 * ── CLOUDINARY ROLLBACK ───────────────────────────────────────────────────
 *
 *   If post-upload dimension validation fails, the asset is deleted from
 *   Cloudinary via uploader.destroy() before returning the 400 error.
 *   This prevents orphaned assets accumulating in the cloud.
 *
 *   If destroy() itself fails (network error, race condition), the orphaned
 *   asset is logged in development but does not affect the error response.
 *   Cloudinary storage for a single failed upload is negligible.
 */

import { NextResponse, type NextRequest } from 'next/server'
import type { UploadApiResponse } from 'cloudinary'
import { getAdminSession } from '@/lib/auth'
import {
  getCloudinary,
  getPublicId,
  buildBlurDataUrl,
  validateCloudinaryConfig,
} from '@/lib/cloudinary'
import {
  UPLOAD_CONSTRAINTS,
  type CloudinaryUploadIntent,
  type CloudinaryUploadResult,
} from '@/types/cloudinary'


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * NO_CACHE — HTTP headers applied to every response from this route.
 * Upload responses must never be cached (they contain fresh URLs and tokens).
 */
const NO_CACHE: Record<string, string> = { 'Cache-Control': 'no-store' }

/*
 * VALID_INTENTS — runtime-checkable array of valid CloudinaryUploadIntent values.
 * Used to validate the `intent` form field before TypeScript assertion.
 *
 * Must stay in sync with the CloudinaryUploadIntent union in types/cloudinary.ts.
 * TypeScript's type system guarantees this at compile time via the assertion below.
 */
const VALID_INTENTS = [
  'bike_hero',
  'bike_gallery',
  'bike_360',
  'brand_logo',
] as const satisfies readonly CloudinaryUploadIntent[]

/*
 * MAX_GALLERY_INDEX — maximum 1-based gallery position accepted.
 * Prevents unreasonably large index values in the public_id.
 * 50 gallery images per bike is far beyond practical use — this is a
 * safety cap, not a designed limit.
 */
const MAX_GALLERY_INDEX = 50

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/*
 * UploadSuccessBody — shape of the 200 response body.
 */
interface UploadSuccessBody {
  ok: true
  result: CloudinaryUploadResult
  blurDataUrl?: string
}

/*
 * UploadErrorBody — shape of all error response bodies.
 * `details` is only included in development to avoid leaking internals.
 */
interface UploadErrorBody {
  error: string
  details?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * mapUploadResponse — maps Cloudinary's UploadApiResponse to our narrowed
 * CloudinaryUploadResult type.
 *
 * Cloudinary's UploadApiResponse has ~40 fields. We extract only the
 * fields defined in CloudinaryUploadResult (A-07.1) to keep the response
 * payload clean and to avoid sending unexpected data to the client.
 *
 * resource_type is cast via a type guard — the SDK uses a wider string
 * union internally, but we only ever upload 'image' or 'video' assets
 * in MotoHub360. The constraint validation above guarantees correctness.
 */
function mapUploadResponse(raw: UploadApiResponse): CloudinaryUploadResult {
  return {
    public_id:         raw.public_id,
    secure_url:        raw.secure_url,
    url:               raw.url,
    version:           raw.version,
    asset_id:          raw.asset_id,
    format:            raw.format,
    resource_type:     raw.resource_type as CloudinaryUploadResult['resource_type'],
    width:             raw.width,
    height:            raw.height,
    duration:          (raw as Record<string, unknown>).duration as number | undefined,
    bytes:             raw.bytes,
    created_at:        raw.created_at,
    folder:            raw.folder,
    original_filename: raw.original_filename,
    etag:              raw.etag,
  }
}

/*
 * isValidIntent — runtime type guard for CloudinaryUploadIntent.
 * Returns true if the value is one of the valid intent strings.
 */
function isValidIntent(value: unknown): value is CloudinaryUploadIntent {
  return (
    typeof value === 'string' &&
    (VALID_INTENTS as readonly string[]).includes(value)
  )
}

/*
 * devDetails — returns { details: message } only in development.
 * Included in error responses to aid debugging without leaking
 * internals to production clients.
 */
function devDetails(error: unknown): { details: string } | Record<string, never> {
  if (process.env.NODE_ENV !== 'development') {
    return {}
  }
  const message = error instanceof Error ? error.message : String(error)
  return { details: message }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth check ─────────────────────────────────────────────────
  /*
   * getAdminSession() reads the iron-session cookie and returns the admin
   * session data, or null if not authenticated (or any error occurs).
   *
   * This is an API route — we return 401 JSON, never a redirect.
   * A-04 Edge middleware handles page-level auth for /admin/* routes.
   * This route is at /api/admin/upload — a different path prefix —
   * so the middleware does not protect it; we handle auth explicitly.
   */
  let adminEmail = 'unknown'

  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json<UploadErrorBody>(
        { error: 'Unauthorized. Sign in to the admin panel to upload media.' },
        { status: 401, headers: NO_CACHE },
      )
    }

    /*
     * Capture admin email for audit logging.
     * Used in the success log at the end of the route.
     */
    adminEmail = session.email
  } catch (sessionError) {
    /*
     * Session read failure — treat as unauthenticated.
     * This can occur if SESSION_SECRET is misconfigured.
     */
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-07.2] Session read error:', sessionError)
    }

    return NextResponse.json<UploadErrorBody>(
      {
        error: 'Failed to read session. Please sign in again.',
        ...devDetails(sessionError),
      },
      { status: 401, headers: NO_CACHE },
    )
  }

  // ── Step 2: Validate Cloudinary configuration ──────────────────────────
  /*
   * validateCloudinaryConfig() throws if CLOUDINARY_CLOUD_NAME,
   * CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET are missing.
   *
   * This check is outside the main try/catch so misconfiguration
   * surfaces as a 500 with a clear error message in development,
   * rather than an opaque Cloudinary SDK error.
   *
   * Wrapped in its own try/catch so we can return JSON (not throw
   * an unhandled exception that Next.js catches with a generic 500 page).
   */
  try {
    validateCloudinaryConfig()
  } catch (configError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-07.2] Cloudinary config error:', configError)
    }

    return NextResponse.json<UploadErrorBody>(
      {
        error: 'Server misconfiguration: Cloudinary credentials are not set.',
        ...devDetails(configError),
      },
      { status: 500, headers: NO_CACHE },
    )
  }

  // ── Main handler ───────────────────────────────────────────────────────
  try {

    // ── Step 3: Parse multipart/form-data ────────────────────────────────
    /*
     * request.formData() parses multipart/form-data.
     * Throws if the Content-Type is wrong or the body is malformed.
     * We catch and return 400 with a descriptive error message.
     */
    let formData: FormData

    try {
      formData = await request.formData()
    } catch (parseError) {
      return NextResponse.json<UploadErrorBody>(
        {
          error:
            'Request body could not be parsed. ' +
            'Ensure Content-Type is multipart/form-data and the body is well-formed.',
          ...devDetails(parseError),
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    // ── Step 4: Extract form fields ───────────────────────────────────────

    const fileField     = formData.get('file')
    const intentField   = formData.get('intent')
    const brandSlugField = formData.get('brandSlug')
    const slugField     = formData.get('slug')
    const indexField    = formData.get('index')

    // ── Step 4a: file ─────────────────────────────────────────────────────
    /*
     * formData.get('file') returns a File object when the client sends
     * a file field, or a string for text fields.
     * We validate it is a File (not a plain string) and has content.
     */
    if (!(fileField instanceof File)) {
      return NextResponse.json<UploadErrorBody>(
        { error: 'Missing required field: file. Send a file via multipart/form-data.' },
        { status: 400, headers: NO_CACHE },
      )
    }

    if (fileField.size === 0) {
      return NextResponse.json<UploadErrorBody>(
        { error: 'File is empty (0 bytes). Please select a valid file.' },
        { status: 400, headers: NO_CACHE },
      )
    }

    const file = fileField

    // ── Step 4b: intent ───────────────────────────────────────────────────
    /*
     * Validate the intent string at runtime before TypeScript assertion.
     * isValidIntent() checks against VALID_INTENTS at runtime, providing
     * a clear error message before any processing occurs.
     */
    if (!isValidIntent(intentField)) {
      return NextResponse.json<UploadErrorBody>(
        {
          error:
            `Invalid or missing upload intent. ` +
            `Expected one of: ${VALID_INTENTS.join(', ')}. ` +
            `Received: ${intentField === null ? 'null' : JSON.stringify(intentField)}.`,
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    const intent: CloudinaryUploadIntent = intentField

    // ── Step 4c: brandSlug ────────────────────────────────────────────────
    /*
     * brandSlug is required for all intents.
     * It forms part of the Cloudinary public_id and identifies which
     * brand's assets are being uploaded.
     */
    if (
      typeof brandSlugField !== 'string' ||
      brandSlugField.trim().length === 0
    ) {
      return NextResponse.json<UploadErrorBody>(
        {
          error:
            'Missing required field: brandSlug. ' +
            'Provide the brand\'s URL slug (e.g. "royal-enfield").',
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    const brandSlug = brandSlugField.trim()

    // ── Step 4d: slug ─────────────────────────────────────────────────────
    /*
     * slug is required for all intents.
     * For bike assets: the bike's URL slug (e.g. 'gt-650').
     * For brand_logo: pass the same value as brandSlug (bike slug unused).
     * This keeps the API contract consistent across all intents.
     */
    if (
      typeof slugField !== 'string' ||
      slugField.trim().length === 0
    ) {
      return NextResponse.json<UploadErrorBody>(
        {
          error:
            'Missing required field: slug. ' +
            'Provide the bike\'s URL slug (e.g. "gt-650"), ' +
            'or the brand slug again for brand_logo uploads.',
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    const slug = slugField.trim()

    // ── Step 4e: index (gallery only) ─────────────────────────────────────
    /*
     * index is only required for bike_gallery uploads.
     * It determines the filename suffix (gallery-1, gallery-2, …) in the
     * Cloudinary public_id, allowing multiple gallery images per bike
     * without overwriting each other.
     *
     * For all other intents, index is ignored even if provided.
     */
    let galleryIndex: number | undefined

    if (intent === 'bike_gallery') {
      if (indexField === null || String(indexField).trim() === '') {
        return NextResponse.json<UploadErrorBody>(
          {
            error:
              'Missing required field: index for bike_gallery uploads. ' +
              'Provide a 1-based integer (e.g. "1" for the first gallery image).',
          },
          { status: 400, headers: NO_CACHE },
        )
      }

      const parsed = parseInt(String(indexField).trim(), 10)

      if (isNaN(parsed) || parsed < 1 || parsed > MAX_GALLERY_INDEX) {
        return NextResponse.json<UploadErrorBody>(
          {
            error:
              `Invalid index value: ${JSON.stringify(String(indexField))}. ` +
              `Must be a positive integer between 1 and ${MAX_GALLERY_INDEX}.`,
          },
          { status: 400, headers: NO_CACHE },
        )
      }

      galleryIndex = parsed
    }

    // ── Step 5: Get upload constraints for this intent ────────────────────
    /*
     * UPLOAD_CONSTRAINTS is keyed by CloudinaryUploadIntent.
     * The intent has been validated — this lookup is always safe.
     */
    const constraints = UPLOAD_CONSTRAINTS[intent]

    // ── Step 6: Validate MIME type ────────────────────────────────────────
    /*
     * file.type is set by the browser based on the file extension and
     * OS file type detection. It is lowercase in modern browsers.
     *
     * We lowercase it defensively before comparison.
     * An empty file.type is rejected — Cloudinary would infer the type
     * but we require explicit MIME validation at the API boundary.
     */
    const fileMimeType = file.type.toLowerCase()

    if (
      fileMimeType.length === 0 ||
      !constraints.acceptedMimeTypes.includes(fileMimeType)
    ) {
      return NextResponse.json<UploadErrorBody>(
        {
          error:
            `File type not accepted for ${intent} uploads. ` +
            `Accepted MIME types: ${constraints.acceptedMimeTypes.join(', ')}. ` +
            `Received: ${fileMimeType.length > 0 ? fileMimeType : '(empty — no MIME type detected)'}.`,
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    // ── Step 7: Validate file size ────────────────────────────────────────
    /*
     * file.size is in bytes (integer).
     * Return 413 (Payload Too Large) when the file exceeds the intent's
     * maxBytes limit.
     *
     * We format the error in MB for human readability:
     *   maxBytes for bike_hero = 8388608 → "8MB"
     *   file.size for a 9MB file = 9437184 → "9.00MB"
     */
    if (file.size > constraints.maxBytes) {
      const maxMB   = (constraints.maxBytes / (1024 * 1024)).toFixed(0)
      const fileMB  = (file.size / (1024 * 1024)).toFixed(2)

      return NextResponse.json<UploadErrorBody>(
        {
          error:
            `File too large for ${intent} uploads. ` +
            `Maximum: ${maxMB}MB. ` +
            `Received: ${fileMB}MB (${file.size.toLocaleString()} bytes).`,
        },
        { status: 413, headers: NO_CACHE },
      )
    }

    // ── Step 8: Convert File to base64 data URI ───────────────────────────
    /*
     * Cloudinary's uploader.upload() accepts a base64 data URI.
     * We read the entire file into memory as an ArrayBuffer, convert to
     * a Node.js Buffer, base64-encode it, and prepend the data URI prefix.
     *
     * Format: data:{mimeType};base64,{base64EncodedContent}
     * Example: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...
     *
     * Memory note: the largest allowed file (bike_360, 50MB) produces
     * a ~67MB base64 string. Vercel's serverless function limit is 1GB
     * memory — this is well within bounds for admin operations.
     */
    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)
    const base64      = buffer.toString('base64')
    const dataUri     = `data:${file.type};base64,${base64}`

    // ── Step 9: Generate Cloudinary public_id ────────────────────────────
    /*
     * getPublicId() from src/lib/cloudinary.ts builds a deterministic
     * public_id that encodes the folder path and asset identity.
     *
     * Examples:
     *   bike_hero:    motohub360/bikes/heroes/royal-enfield-gt-650-hero
     *   bike_gallery: motohub360/bikes/gallery/royal-enfield-gt-650-gallery-1
     *   bike_360:     motohub360/bikes/360/royal-enfield-gt-650-360
     *   brand_logo:   motohub360/brands/logos/royal-enfield-logo
     *
     * We pass galleryIndex (undefined for non-gallery intents — getPublicId
     * ignores it when undefined).
     */
    const publicId = getPublicId(intent, brandSlug, slug, galleryIndex)

    // ── Step 10: Upload to Cloudinary ─────────────────────────────────────
    /*
     * cld.uploader.upload() is async — it uploads the file to Cloudinary
     * and returns the full UploadApiResponse when successful.
     *
     * Options:
     *   public_id      — our deterministic asset identifier including folder path
     *   resource_type  — 'image' or 'video' per the intent's constraints
     *   overwrite      — true: replacing an existing asset (same public_id) is allowed.
     *                    This is intentional — the admin can re-upload a better photo.
     *                    For gallery images, the index prevents unintended overwrites.
     *   use_filename   — false: always use our public_id, never infer from the filename
     *   unique_filename — false: don't append a random suffix (our id IS unique)
     *
     * Error handling:
     *   Cloudinary throws on: auth failure, network error, invalid image data,
     *   exceeded account quota, or any API-level rejection.
     *   We catch all of these and return 502 (Bad Gateway — upstream failure).
     */
    const cld = getCloudinary()
    let uploadResult: CloudinaryUploadResult

    try {
      const rawResult: UploadApiResponse = await cld.uploader.upload(dataUri, {
        public_id:       publicId,
        resource_type:   constraints.resourceType,
        overwrite:       true,
        use_filename:    false,
        unique_filename: false,
      })

      /*
       * Map the verbose UploadApiResponse to our clean CloudinaryUploadResult.
       * We pick only the fields defined in types/cloudinary.ts — nothing more.
       */
      uploadResult = mapUploadResponse(rawResult)
    } catch (uploadError) {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `[A-07.2] Cloudinary upload failed — intent: ${intent}, publicId: ${publicId}`,
          uploadError,
        )
      }

      return NextResponse.json<UploadErrorBody>(
        {
          error:
            'Upload to Cloudinary failed. Check your Cloudinary credentials ' +
            'and ensure your account has sufficient quota.',
          ...devDetails(uploadError),
        },
        { status: 502, headers: NO_CACHE },
      )
    }

    // ── Step 11: Post-upload dimension validation (images only) ───────────
    /*
     * Cloudinary returns width and height in the UploadApiResponse for images.
     * We validate them AFTER upload because there is no reliable way to check
     * image dimensions from the raw file bytes without additional dependencies.
     *
     * If dimensions are below the minimum for this intent, we:
     *   1. Delete the uploaded asset from Cloudinary (rollback).
     *   2. Return 400 with a human-readable error describing the requirement.
     *
     * The rollback ensures no orphaned under-sized assets remain in Cloudinary.
     *
     * Rollback failure is non-fatal: the error is logged in development but
     * does not affect the 400 response the client receives. The orphaned asset
     * is negligible in storage cost and can be cleaned up manually.
     */
    if (constraints.resourceType === 'image') {
      const { minWidth, minHeight } = constraints

      const widthTooSmall =
        minWidth !== undefined &&
        uploadResult.width !== undefined &&
        uploadResult.width < minWidth

      const heightTooSmall =
        minHeight !== undefined &&
        uploadResult.height !== undefined &&
        uploadResult.height < minHeight

      if (widthTooSmall || heightTooSmall) {
        /*
         * Rollback — delete the non-conforming asset from Cloudinary.
         */
        try {
          await cld.uploader.destroy(uploadResult.public_id, {
            resource_type: constraints.resourceType,
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[A-07.2] Rolled back ${uploadResult.public_id} ` +
              `(dimensions ${uploadResult.width}×${uploadResult.height} ` +
              `below minimum ${minWidth}×${minHeight})`,
            )
          }
        } catch (destroyError) {
          /*
           * Rollback failed — log the orphaned asset ID for manual cleanup.
           * Do not let rollback failure change the 400 response.
           */
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[A-07.2] Cloudinary rollback failed for ${uploadResult.public_id}. ` +
              'Orphaned asset may need manual deletion.',
              destroyError,
            )
          }
        }

        /*
         * Build a human-readable error message with both the requirement
         * and what was actually received — helps the admin understand what
         * resolution to use when re-shooting or re-exporting.
         */
        const requirementParts: string[] = []
        if (minWidth)  requirementParts.push(`width ≥ ${minWidth}px`)
        if (minHeight) requirementParts.push(`height ≥ ${minHeight}px`)

        const actualParts: string[] = []
        if (uploadResult.width)  actualParts.push(`width ${uploadResult.width}px`)
        if (uploadResult.height) actualParts.push(`height ${uploadResult.height}px`)

        return NextResponse.json<UploadErrorBody>(
          {
            error:
              `Image dimensions too small for ${intent} uploads. ` +
              `Required: ${requirementParts.join(', ')}. ` +
              `Uploaded: ${actualParts.join(', ')}.`,
          },
          { status: 400, headers: NO_CACHE },
        )
      }
    }

    // ── Step 12: Generate blur data URL (images only, non-fatal) ──────────
    /*
     * blurDataUrl is the tiny base64-encoded JPEG placeholder stored in MongoDB
     * as IBike.blurDataUrl or IBike.gallery[n].blurDataUrl.
     *
     * Used by Next.js Image placeholder="blur" to display a low-quality image
     * preview while the full-resolution image loads. See BikeHero, BikeGallery,
     * BikeColorSelector, BikeCard — all use this for a smooth load experience.
     *
     * GENERATION:
     *   1. buildBlurDataUrl() from src/lib/cloudinary.ts builds a Cloudinary
     *      URL with transformations: w_20,h_20,c_fill,e_blur:1000,q_1,f_jpg
     *      This produces a 20×20px heavily blurred JPEG — approximately 200 bytes.
     *   2. We fetch that URL from Cloudinary's CDN.
     *   3. Convert the response body to a base64 string.
     *   4. Prepend the data URI prefix: "data:image/jpeg;base64,..."
     *
     * NON-FATAL:
     *   If fetch() fails (CDN propagation delay, network error), we proceed
     *   without blurDataUrl. The upload has already succeeded.
     *   BikeCard and other components render without blur if the field is absent —
     *   they use placeholder="empty" (no blur) as the fallback.
     *
     *   The admin can re-upload or manually generate the blurDataUrl later.
     *   The absence of blurDataUrl is not a data integrity issue.
     *
     * TIMING:
     *   Cloudinary CDN propagation is near-instant for small transformed images.
     *   The blur URL fetches within 200–500ms of the upload completing.
     *   We set no explicit timeout — Next.js route timeout handles extreme cases.
     */
    let blurDataUrl: string | undefined

    if (constraints.resourceType === 'image') {
      try {
        const blurUrl = buildBlurDataUrl(uploadResult.secure_url)
        const blurResponse = await fetch(blurUrl)

        if (blurResponse.ok) {
          const blurArrayBuffer = await blurResponse.arrayBuffer()
          const blurBuffer = Buffer.from(blurArrayBuffer)
          const blurBase64 = blurBuffer.toString('base64')
          blurDataUrl = `data:image/jpeg;base64,${blurBase64}`
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[A-07.2] Blur URL fetch returned ${blurResponse.status} for ${uploadResult.public_id}. ` +
              'Upload succeeded — blurDataUrl will be absent from response.',
            )
          }
        }
      } catch (blurError) {
        /*
         * Network error, DNS failure, or any fetch exception.
         * Log and continue — upload success is not affected.
         */
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[A-07.2] blurDataUrl generation failed for ${uploadResult.public_id}. ` +
            'Upload succeeded — blurDataUrl will be absent from response.',
            blurError,
          )
        }
      }
    }

    // ── Step 13: Audit log (development only) ────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      const sizeMB  = (uploadResult.bytes / (1024 * 1024)).toFixed(2)
      const dims =
        uploadResult.width && uploadResult.height
          ? ` | ${uploadResult.width}×${uploadResult.height}px`
          : uploadResult.duration
          ? ` | ${uploadResult.duration.toFixed(1)}s video`
          : ''

      console.log(
        `[A-07.2] ✓ Upload success\n` +
        `  intent:     ${intent}\n` +
        `  public_id:  ${uploadResult.public_id}\n` +
        `  format:     ${uploadResult.format}${dims}\n` +
        `  size:       ${sizeMB}MB\n` +
        `  blur:       ${blurDataUrl ? `${blurDataUrl.length} chars` : 'not generated'}\n` +
        `  by:         ${adminEmail}`,
      )
    }

    // ── Step 14: Return success response ──────────────────────────────────
    /*
     * The response body includes:
     *   ok:          true — signals success to the client
     *   result:      the CloudinaryUploadResult — the client stores
     *                result.secure_url as heroImageUrl / gallery URL / video360Url
     *   blurDataUrl: the base64 JPEG placeholder — stored as blurDataUrl in MongoDB.
     *                Omitted from the response (not spread) if generation failed.
     *
     * The client (A-07.3 upload UI, or a direct API call) extracts these values
     * and includes them in a subsequent PUT /api/bikes/[id] request to update
     * the bike document with the new media URLs.
     */
    const responseBody: UploadSuccessBody = {
      ok: true,
      result: uploadResult,
      ...(blurDataUrl !== undefined && { blurDataUrl }),
    }

    return NextResponse.json(responseBody, {
      status: 200,
      headers: NO_CACHE,
    })

  } catch (unexpectedError) {
    /*
     * Outer catch — handles any error not caught by the specific try/catch
     * blocks above. This should never trigger in practice but prevents
     * Next.js from serving a generic HTML error page for API routes.
     */
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-07.2] Unexpected error in upload route:', unexpectedError)
    }

    return NextResponse.json<UploadErrorBody>(
      {
        error: 'An unexpected server error occurred. Please try again.',
        ...devDetails(unexpectedError),
      },
      { status: 500, headers: NO_CACHE },
    )
  }
}