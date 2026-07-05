/*

 * api.ts — TypeScript interfaces for all API route request/response shapes.

 *

 * Defines the contract between the Next.js Route Handlers (server)

 * and the clients that call them (admin forms, search bar, ISR trigger).

 *

 * MPD Section 10 API Rules:

 *   - All responses return { data, error, message } shape consistently.

 *   - Errors always include an HTTP status code and human-readable message.

 *   - Admin-protected routes use withAdminAuth() wrapper (A-05).

 *

 * No logic, no imports, no runtime code.

 *

 * Usage:

 *   import type { ApiResponse, BikeListResponse } from '@/types/api'

 */



import type { Bike, BikeSummary, SearchSuggestion } from '@/types/bike'

import type { Brand, BrandSummary } from '@/types/brand'



// ---------------------------------------------------------------------------

// Base Response Shape

// ---------------------------------------------------------------------------



/*

 * ApiResponse<T> — the universal envelope for all API responses.

 *

 * data    → the payload on success; null on error.

 * error   → error code string on failure; null on success.

 *           Use a short machine-readable code (e.g. 'NOT_FOUND', 'UNAUTHORISED').

 * message → human-readable description for both success and error states.

 *           Shown to the admin in form error/success UI.

 *

 * Example success:

 *   { data: bike, error: null, message: 'Bike published successfully.' }

 *

 * Example error:

 *   { data: null, error: 'NOT_FOUND', message: 'No bike found with slug gt-650.' }

 */

export interface ApiResponse<T = unknown> {

  data: T | null

  error: string | null

  message: string

}



/*

 * ApiError — shape returned when an API route throws unexpectedly.

 * Used in catch blocks to return a consistent error structure.

 */

export interface ApiError {

  error: string

  message: string

  statusCode: number

}



// ---------------------------------------------------------------------------

// Bike API — /api/bikes

// ---------------------------------------------------------------------------



/*

 * BikeListResponse — GET /api/bikes

 * Returns paginated list of bikes with optional filters.

 * Used in: admin BikeTable (A-06, A-07) and listing page data fetch (DB-08).

 */

export interface BikeListResponse {

  bikes: BikeSummary[]

  total: number              // Total matching documents (for pagination)

  page: number

  pageSize: number

}



/*

 * BikeDetailResponse — GET /api/bikes/[id]

 * Returns the full bike document.

 * Used in: bike detail page server component (B-12), admin edit form (A-12).

 */

export type BikeDetailResponse = Bike



/*

 * BikeCreateRequest — POST /api/bikes body shape.

 * Omits _id (MongoDB generates), createdAt/updatedAt (Mongoose timestamps).

 * Used in: admin Add Bike form submit (A-12).

 */

export type BikeCreateRequest = Omit<Bike, '_id' | 'createdAt' | 'updatedAt'>



/*

 * BikeUpdateRequest — PUT /api/bikes/[id] body shape.

 * All fields optional — only changed fields need to be sent.

 * Used in: admin Edit Bike form submit (A-12).

 */

 export type BikeUpdateRequest = Partial<

  Omit<Bike, '_id' | 'createdAt' | 'updatedAt'>

>                                                                                                                                                     /* 

 * BikePublishResponse — POST /api/bikes/[id]/publish

 * Returns the updated bike document after publish.

 * The publishedAt field is now set.

 * Used in: admin Publish button handler (A-12).

 */

export interface BikePublishResponse {

  bike: Bike

  revalidated: boolean       // true when ISR revalidatePath() succeeded

  publicUrl: string          // e.g. "https://motohub360.in/bikes/royal-enfield/gt-650"

}



/*

 * BikeListQueryParams — query string params accepted by GET /api/bikes.

 * Used in: admin BikeTable filter (A-07) and listing page data fetch (DB-08).

 */

export interface BikeListQueryParams {

  brand?: string             // Filter by brandSlug

  category?: string          // Filter by BikeCategory

  status?: 'draft' | 'published' | 'all'

  page?: number

  pageSize?: number

  sort?: 'name' | 'createdAt' | 'updatedAt' | 'exShowroom'

  order?: 'asc' | 'desc'

}



// ---------------------------------------------------------------------------

// Brand API — /api/brands

// ---------------------------------------------------------------------------



/*

 * BrandListResponse — GET /api/brands

 * Returns all brands. No pagination — brand count is small and grows slowly.

 * Used in: admin BikeFormBasic brand select (A-08), Home brand logo grid (H-02).

 */

export interface BrandListResponse {

  brands: BrandSummary[]

}



/*

 * BrandCreateRequest — POST /api/brands body shape.

 * Used in: future admin brand management (not in V1 UI but API exists).

 */

export type BrandCreateRequest = Omit<Brand, '_id' | 'createdAt'>



// ---------------------------------------------------------------------------

// Search API — /api/search/suggest

// ---------------------------------------------------------------------------



/*

 * SearchSuggestResponse — GET /api/search/suggest?q=[query]

 * Returns top 6 suggestions. Cached at Edge for 60 seconds (MPD Section 15).

 * Used in: SearchSuggestions component (SR-02), useSearch hook (SR-01).

 */

export interface SearchSuggestResponse {

  suggestions: SearchSuggestion[]

  query: string              // Echo back the query for client-side highlight logic

}



/*

 * SearchResultsResponse — used by /search page (SSR).

 * Returns up to 24 results with total count.

 * Used in: search results page server component (SR-06).

 */

export interface SearchResultsResponse {

  bikes: BikeSummary[]

  total: number

  query: string

}



// ---------------------------------------------------------------------------

// Upload API — /api/upload/sign

// ---------------------------------------------------------------------------



/*

 * UploadSignRequest — POST /api/upload/sign body shape.

 * Tells the server what kind of upload to sign.

 * Used in: BikeFormMedia (A-09), BikeFormSEO (A-12).

 */

export interface UploadSignRequest {

  folder: string             // Cloudinary folder e.g. "motohub360/bikes/gt-650"

  publicId?: string          // Optional — set for replacing existing images

}



/*

 * UploadSignResponse — response from /api/upload/sign.

 * The admin form uses these values to upload directly to Cloudinary.

 * The file never passes through the Next.js server (MPD Section 16).

 */

export interface UploadSignResponse {

  signature: string

  timestamp: number

  cloudName: string

  apiKey: string

  folder: string

}



// ---------------------------------------------------------------------------

// Auth API — /api/auth/login + /api/auth/logout

// ---------------------------------------------------------------------------



/*

 * LoginRequest — POST /api/auth/login body shape.

 * Used in: admin login page form (A-01).

 */

export interface LoginRequest {

  email: string

  password: string

}



/*

 * LoginResponse — response from /api/auth/login on success.

 * The session cookie is set as an HttpOnly header — not in this body.

 * Used in: admin login page redirect logic (A-01).

 */

export interface LoginResponse {

  email: string

  loggedInAt: string         // ISO date string

}



// ---------------------------------------------------------------------------

// Revalidate API — /api/revalidate

// ---------------------------------------------------------------------------



/*

 * RevalidateRequest — POST /api/revalidate body shape.

 * Sent by the admin publish flow after saving to MongoDB.

 * The REVALIDATE_SECRET is passed as a request header, not in the body.

 * Used in: lib/revalidate.ts (called from DB-07).

 */

export interface RevalidateRequest {

  path: string               // e.g. "/bikes/royal-enfield/gt-650"

}



/*

 * RevalidateResponse — response from /api/revalidate.

 * Used in: admin publish success state (A-12).

 */

export interface RevalidateResponse {

  revalidated: boolean

  path: string

}



// ---------------------------------------------------------------------------

// Pagination Helper

// ---------------------------------------------------------------------------



/*

 * PaginationMeta — reusable pagination metadata shape.

 * Attached to any list response that supports pagination.

 * Used in: admin BikeTable (A-07).

 */

export interface PaginationMeta {

  total: number

  page: number

  pageSize: number

  totalPages: number

  hasNextPage: boolean

  hasPreviousPage: boolean

}