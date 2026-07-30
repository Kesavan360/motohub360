/*
 * Admin Bike Edit Page — /admin/bikes/[slug]/edit
 *
 * MPD Task A-07.5:
 *   "Connect upload components to admin pages — final integration."
 *
 * SERVER COMPONENT:
 *   1. requireAdminSession() — auth guard (A-05 HOC)
 *   2. connectDB() + Bike.findOne({ slug }) — fetch bike by URL slug
 *   3. Serialize: ObjectId → string, undefined arrays normalized
 *   4. Render: page header + BikeEditMediaClient (Client Component)
 *
 * THIS PAGE — A-07.5 SCOPE:
 *   Media editing only: hero image, gallery, 360° video.
 *   Basic info (name, brand, category, specs, pricing, SEO) is added
 *   as additional form sections in A-08 through A-12.
 *
 * ROUTE:
 *   /admin/bikes/[slug]/edit
 *   [slug] = the bike's URL slug (e.g. 'gt-650'), NOT the brandSlug.
 *   MongoDB query: Bike.findOne({ slug }) — looks up by the slug field.
 *   Note: same slug field used in public bike detail page (/bikes/[brandSlug]/[slug]).
 *
 * LINK SOURCE:
 *   The "Edit" button in BikeTable (A-06) links to this URL.
 *   Before A-07.5, the Edit button linked to a non-existent page (404).
 *   A-07.5 resolves that — every Edit button now reaches this page.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { requireAdminSession } from '@/lib/auth'
import BikeEditMediaClient, {
  type SerializedBikeForEdit,
} from '@/components/admin/BikeEditMediaClient'

// ---------------------------------------------------------------------------
// Route param types
// ---------------------------------------------------------------------------

interface EditPageParams {
  params: Promise<{ slug: string }>
}

// ---------------------------------------------------------------------------
// Internal DB result shape
// ---------------------------------------------------------------------------

/*
 * IBikeMediaFields — the fields selected from MongoDB for this page.
 * Typed locally to avoid importing the full Mongoose document type.
 */
interface IBikeMediaFields {
  _id: unknown
  slug: string
  brandSlug: string
  name: string
  heroImageUrl: string
  blurDataUrl?: string
  gallery: Array<{
    url: string
    blurDataUrl?: string
    publicId?: string
  }>
  video360Url?: string
  status: 'draft' | 'published'
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: EditPageParams): Promise<Metadata> {
  const { slug } = await params

  try {
    await connectDB()

    const bike = await Bike.findOne({ slug })
      .select('name')
      .lean<{ name: string }>()

    return {
      title: bike ? `Edit Media — ${bike.name}` : 'Edit Bike',
    }
  } catch {
    return { title: 'Edit Bike' }
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function AdminBikeEditPage({
  params,
}: EditPageParams) {

  // ── Auth ───────────────────────────────────────────────────────────────
  await requireAdminSession()

  const { slug } = await params

  // ── DB fetch ───────────────────────────────────────────────────────────

  await connectDB()

  const bike = await Bike.findOne({ slug })
    .select(
      '_id slug brandSlug name heroImageUrl blurDataUrl gallery video360Url status',
    )
    .lean<IBikeMediaFields>()

  if (!bike) {
    notFound()
  }

  // ── Serialize ──────────────────────────────────────────────────────────

  /*
   * Convert MongoDB ObjectId (_id) to a plain string.
   * Convert undefined gallery to an empty array.
   * All other fields are already JSON-serializable from .lean().
   */
  const serialized: SerializedBikeForEdit = {
    _id:          String(bike._id),
    slug:         bike.slug,
    brandSlug:    bike.brandSlug,
    name:         bike.name,
    heroImageUrl: bike.heroImageUrl,
    blurDataUrl:  bike.blurDataUrl,
    gallery:      (bike.gallery ?? []).map((g) => ({
      url:         g.url,
      blurDataUrl: g.blurDataUrl,
      publicId:    g.publicId,
    })),
    video360Url:  bike.video360Url,
    status:       bike.status,
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* Breadcrumb link hover */
        .edit-breadcrumb-link:hover {
          color: var(--color-ink-primary) !important;
        }

        /* Header action button hover */
        .edit-action-btn:hover {
          background-color: var(--color-surface-sunken) !important;
          color: var(--color-ink-primary) !important;
        }

        .edit-action-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 8px;
        }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div style={{ minWidth: 0 }}>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ marginBottom: '6px' }}>
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <li>
                <Link
                  href="/admin/bikes"
                  className="edit-breadcrumb-link"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-ink-tertiary)',
                    textDecoration: 'none',
                    transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  Bikes
                </Link>
              </li>

              <li
                aria-hidden="true"
                style={{ color: 'var(--color-ink-tertiary)', fontSize: '11px' }}
              >
                ›
              </li>

              <li>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-ink-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '180px',
                    display: 'inline-block',
                  }}
                >
                  {bike.name}
                </span>
              </li>

              <li
                aria-hidden="true"
                style={{ color: 'var(--color-ink-tertiary)', fontSize: '11px' }}
              >
                ›
              </li>

              <li>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  Edit Media
                </span>
              </li>
            </ol>
          </nav>

          {/* Title + subtitle */}
          <h1>{bike.name}</h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-ink-tertiary)',
              margin: '4px 0 0',
            }}
          >
            Hero image · Gallery · 360° video
          </p>
        </div>

        {/* Header action buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/*
           * "View page" — opens the public bike detail page in a new tab.
           * Only meaningful when the bike is published.
           */}
          {bike.status === 'published' && (
            <Link
              href={`/bikes/${bike.brandSlug}/${bike.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="edit-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '36px',
                padding: '0 14px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--color-ink-secondary)',
                backgroundColor: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition:
                  'background-color 150ms cubic-bezier(0.4,0,0.2,1), ' +
                  'color 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              View page ↗
            </Link>
          )}

          {/* Back to bike list */}
          <Link
            href="/admin/bikes"
            className="edit-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '36px',
              padding: '0 14px',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '8px',
              textDecoration: 'none',
              transition:
                'background-color 150ms cubic-bezier(0.4,0,0.2,1), ' +
                'color 150ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="admin-page-content">

        {/*
         * A-07.5 scope indicator — displayed at the top of the page so it
         * is clear that only media editing is available here.
         * Removed once A-08–A-12 implement the full BikeForm sections.
         */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 500, color: 'var(--color-ink-secondary)' }}>
              Media editing only.
            </span>
            {' '}
            Basic info, specs, pricing, and SEO fields are added in A-08–A-12.
            {' '}
            Status:{' '}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                color: bike.status === 'published'
                  ? '#166534'
                  : 'var(--color-ink-tertiary)',
                textTransform: 'uppercase',
              }}
            >
              {bike.status}
            </span>
          </p>
        </div>

        {/*
         * BikeEditMediaClient — the Client Component containing all upload
         * sections and the Save Media button.
         */}
        <BikeEditMediaClient bike={serialized} />
      </div>
    </>
  )
}