import mongoose from 'mongoose'

/**
 * OBJECT_ID_REGEX — matches a valid MongoDB ObjectId (24 hex characters).
 */
export const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

/**
 * buildBikeQuery — builds a Mongoose filter for a single bike lookup.
 *
 * If id matches ObjectId format → query by _id.
 * Otherwise → query by slug.
 *
 * Returns null if id is empty.
 */
export function buildBikeQuery(
  id: string,
): { _id: mongoose.Types.ObjectId } | { slug: string } | null {
  const trimmed = id.trim()

  if (OBJECT_ID_REGEX.test(trimmed)) {
    return { _id: new mongoose.Types.ObjectId(trimmed) }
  }

  if (trimmed.length > 0) {
    return { slug: trimmed.toLowerCase() }
  }

  return null
}
