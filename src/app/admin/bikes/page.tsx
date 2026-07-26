/*
 * Admin Bikes List Page — /admin/bikes
 *
 * MPD Task A-06:
 *   "BikeTable — admin bike list at /admin/bikes."
 *
 * MPD Section 5.5, Admin Dashboard:
 *   "Bike list: a simple table of all bikes (draft + published).
 *   Columns: Thumbnail, Name, Brand, Category, Price, Status, Actions."
 *
 * SERVER COMPONENT:
 *   Fetches all bikes from MongoDB and passes them to BikeTable.
 *   BikeTable ('use client') handles the interactive actions.
 *
 * AUTH:
 *   requireAdminSession() from A-05 — redirects to /admin/login if
 *   not authenticated. A-04 middleware already guards this route.
 *
 * DATA:
 *   All bikes (draft + published), sorted by createdAt descending.
 *   No pagination in V1 — admin panel is the founder's tool and
 *   the bike count is small enough for a single table.
 *
 * STAT CARDS:
 *   Total, Published, Draft counts shown above the table.
 *   Consistent with the dashboard stat card style.
 *
 * METADATA:
 *   Title: "Bikes | MotoHub360 Admin" (via admin layout template).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import { requireAdminSession } from '@/lib/auth'
import BikeTable, { type BikeTableRow } from '@/components/admin/BikeTable'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Bikes',
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function AdminBikesPage() {
  /*
   * Auth guard — redirects to /admin/login if no valid session.
   * Belt-and-suspenders: A-04 middleware already guards /admin/*.
   */
  await requireAdminSession()

  /*
   * Fetch all bikes from MongoDB.
   *
   * - No status filter: shows draft + published together
   * - Projection: only fields needed for BikeTable
   * - Sort: newest first (most recently created at top)
   * - .lean(): plain objects, faster than Mongoose documents
   */
  let bikes: BikeTableRow[] = []
  let totalPublished = 0
  let totalDraft = 0
  let fetchError: string | null = null

  try {
    await connectDB()

    const [rawBikes, published, draft] = await Promise.all([
      Bike.find({})
        .select(
          '_id slug brandSlug brandName name tagline category status pricing heroImageUrl publishedAt createdAt',
        )
        .sort({ createdAt: -1 })
        .lean<BikeTableRow[]>(),
      Bike.countDocuments({ status: 'published' }),
      Bike.countDocuments({ status: 'draft' }),
    ])

    /*
     * Serialize Date objects to ISO strings.
     * Dates cannot be passed directly from Server Components to Client
     * Components — they must be serialized to a JSON-compatible format.
     */
    bikes = rawBikes.map((bike) => ({
      ...bike,
      _id: String(bike._id),
      publishedAt: bike.publishedAt ? String(bike.publishedAt) : null,
      createdAt: String(bike.createdAt),
    }))

    totalPublished = published
    totalDraft = draft
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message
        : 'Failed to fetch bikes from the database.'
  }

  const totalBikes = bikes.length

  return (
    <>
      <style>{`
        .bikes-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 640px) {
          .bikes-stat-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
        }
        .bikes-add-btn:hover {
          filter: brightness(1.08);
        }
        .bikes-add-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--color-surface-base),
                      0 0 0 4px #7A2E2E;
          border-radius: 8px;
        }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <h1>Bikes</h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              margin: '4px 0 0',
            }}
          >
            {totalBikes} total
            {totalPublished > 0 && ` · ${totalPublished} published`}
            {totalDraft > 0 && ` · ${totalDraft} draft`}
          </p>
        </div>

        {/*
         * "Add New Bike" button — links to the bike creation form (A-08).
         * Styled to match the admin accent (#7A2E2E).
         */}
        <Link
          href="/admin/bikes/new"
          className="bikes-add-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '40px',
            padding: '0 18px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: '#7A2E2E',
            borderRadius: '8px',
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'filter 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          Add New Bike
        </Link>
      </div>

      {/* ── Page content ────────────────────────────────────────────── */}
      <div className="admin-page-content">

        {/* ── Stat cards ────────────────────────────────────────────── */}
        <div className="bikes-stat-grid" aria-label="Bike statistics">
          {[
            { label: 'Total Bikes', value: totalBikes, accent: '#7A2E2E' },
            { label: 'Published', value: totalPublished, accent: '#166534' },
            { label: 'Drafts', value: totalDraft, accent: 'var(--color-ink-tertiary)' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '10px',
                padding: '16px 20px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '3px',
                  height: '100%',
                  backgroundColor: stat.accent,
                  borderRadius: '10px 0 0 10px',
                }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-tertiary)',
                  margin: '0 0 6px',
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '28px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-ink-primary)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Error state ───────────────────────────────────────────── */}
        {fetchError && (
          <div
            role="alert"
            style={{
              padding: '16px 20px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 500,
                color: '#991B1B',
                margin: 0,
              }}
            >
              Failed to load bikes
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: '#B91C1C',
                margin: '4px 0 0',
              }}
            >
              {fetchError}
            </p>
          </div>
        )}

        {/* ── BikeTable ─────────────────────────────────────────────── */}
        {!fetchError && (
          <BikeTable bikes={bikes} />
        )}

        {/*
         * Footer note — slug + direct API access reminder.
         */}
        {totalBikes > 0 && !fetchError && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              margin: '16px 0 0',
              lineHeight: 1.5,
            }}
          >
            Bike edit forms are implemented in A-08–A-12. Use{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                backgroundColor: 'var(--color-surface-sunken)',
                padding: '1px 5px',
                borderRadius: '4px',
              }}
            >
              PUT /api/bikes/[id]
            </code>{' '}
            to update bike data directly until the forms are ready.
          </p>
        )}
      </div>
    </>
  )
}