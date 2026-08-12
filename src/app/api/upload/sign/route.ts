/*
 * POST /api/upload/sign — Signed Cloudinary upload parameters for direct browser upload.
 *
 * MPD Task A-11:
 *   Returns a Cloudinary upload signature so the admin browser can upload
 *   directly to Cloudinary without sending the file through Next.js.
 *
 * REQUEST:
 *   POST /api/upload/sign
 *   Content-Type: application/json
 *   Body: { folder: string, publicId?: string }
 *
 * RESPONSE (200):
 *   UploadSignResponse — { signature, timestamp, cloudName, apiKey, folder }
 *
 * RESPONSE (errors):
 *   401 { error: '...' } — not authenticated
 *   400 { error: '...' } — validation failure
 *   500 { error: '...' } — Cloudinary misconfiguration or unexpected error
 *
 * AUTH:
 *   Requires a valid admin session via getAdminSession() (A-05).
 *   A-04 middleware does not protect /api/upload/* — auth is enforced here.
 *
 * SECURITY:
 *   CLOUDINARY_API_SECRET is used only server-side to generate the signature.
 *   It is never included in the response body.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth'
import { getCloudinary, validateCloudinaryConfig } from '@/lib/cloudinary'
import type { UploadSignRequest, UploadSignResponse } from '@/types/api'

const NO_CACHE: Record<string, string> = { 'Cache-Control': 'no-store' }

const MOTOHUB360_NAMESPACE = 'motohub360/'

interface SignErrorBody {
  error: string
  details?: string
}

function devDetails(error: unknown): { details: string } | Record<string, never> {
  if (process.env.NODE_ENV !== 'development') {
    return {}
  }
  const message = error instanceof Error ? error.message : String(error)
  return { details: message }
}

function isValidFolder(folder: string): boolean {
  const trimmed = folder.trim()

  if (trimmed.length === 0) {
    return false
  }

  if (!trimmed.startsWith(MOTOHUB360_NAMESPACE)) {
    return false
  }

  if (trimmed.includes('..')) {
    return false
  }

  return true
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth check ───────────────────────────────────────────────
  try {
    const session = await getAdminSession()

    if (!session) {
      return NextResponse.json<SignErrorBody>(
        { error: 'Unauthorized. Sign in to the admin panel to upload media.' },
        { status: 401, headers: NO_CACHE },
      )
    }
  } catch (sessionError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-11] Session read error:', sessionError)
    }

    return NextResponse.json<SignErrorBody>(
      {
        error: 'Failed to read session. Please sign in again.',
        ...devDetails(sessionError),
      },
      { status: 401, headers: NO_CACHE },
    )
  }

  // ── Step 2: Validate Cloudinary configuration ────────────────────────
  try {
    validateCloudinaryConfig()
  } catch (configError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-11] Cloudinary config error:', configError)
    }

    return NextResponse.json<SignErrorBody>(
      {
        error: 'Server misconfiguration: Cloudinary credentials are not set.',
        ...devDetails(configError),
      },
      { status: 500, headers: NO_CACHE },
    )
  }

  // ── Step 3: Parse and validate request body ──────────────────────────
  try {
    let body: unknown

    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json<SignErrorBody>(
        {
          error: 'Request body must be valid JSON.',
          ...devDetails(parseError),
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json<SignErrorBody>(
        { error: 'Request body must be a JSON object.' },
        { status: 400, headers: NO_CACHE },
      )
    }

    const { folder: folderField, publicId: publicIdField } =
      body as UploadSignRequest

    if (typeof folderField !== 'string' || !isValidFolder(folderField)) {
      return NextResponse.json<SignErrorBody>(
        {
          error:
            'Invalid folder. Must be a non-empty string under the motohub360/ namespace ' +
            'with no path traversal (../).',
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    const folder = folderField.trim()

    let publicId: string | undefined

    if (publicIdField !== undefined) {
      if (typeof publicIdField !== 'string' || publicIdField.trim().length === 0) {
        return NextResponse.json<SignErrorBody>(
          { error: 'Invalid publicId. When provided, must be a non-empty string.' },
          { status: 400, headers: NO_CACHE },
        )
      }

      if (publicIdField.includes('..')) {
        return NextResponse.json<SignErrorBody>(
          { error: 'Invalid publicId. Path traversal (../) is not allowed.' },
          { status: 400, headers: NO_CACHE },
        )
      }

      publicId = publicIdField.trim()
    }

    // ── Step 4: Generate signed upload parameters ──────────────────────
    const timestamp = Math.round(Date.now() / 1000)

    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
    }

    if (publicId !== undefined) {
      paramsToSign.public_id = publicId
    }

    const cld = getCloudinary()
    const signature = cld.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!,
    )

    const responseBody: UploadSignResponse = {
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      folder,
    }

    return NextResponse.json(responseBody, {
      status: 200,
      headers: NO_CACHE,
    })
  } catch (unexpectedError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[A-11] Unexpected error in upload sign route:', unexpectedError)
    }

    return NextResponse.json<SignErrorBody>(
      {
        error: 'An unexpected server error occurred. Please try again.',
        ...devDetails(unexpectedError),
      },
      { status: 500, headers: NO_CACHE },
    )
  }
}
