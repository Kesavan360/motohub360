/*
 * Add New Bike — /admin/bikes/new
 *
 * A-08.2 update:
 *   Replaces the pre-A-08 workflow stub with BikeFormShell in create mode.
 *   The full multi-step form (basic info, specs, pricing, gallery, SEO)
 *   is available — sections show informational stubs until A-08.3–A-12
 *   implement the real field components.
 *
 * SERVER COMPONENT:
 *   Auth guard via requireAdminSession() (A-05).
 *   No DB fetch needed — BikeFormShell starts from DEFAULT_FORM_VALUES.
 *
 * AFTER FORM SUBMISSION:
 *   BikeFormShell POSTs to /api/bikes and redirects the admin to
 *   /admin/bikes/[slug]/edit (A-07.5) where media can be uploaded.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminSession } from '@/lib/auth'
import BikeFormShell from '@/components/admin/BikeFormShell'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Add New Bike',
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function AdminBikesNewPage() {
  await requireAdminSession()

  return (
    <>
      <style>{`
        /* Breadcrumb link hover */
        .new-back-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .new-back-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
        }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
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
              }}
            >
              <li>
                <Link
                  href="/admin/bikes"
                  className="new-back-link"
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
                style={{
                  color: 'var(--color-ink-tertiary)',
                  fontSize: '11px',
                }}
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
                  Add New Bike
                </span>
              </li>
            </ol>
          </nav>

          {/* Title + subtitle */}
          <h1>Add New Bike</h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-ink-tertiary)',
              margin: '4px 0 0',
            }}
          >
            Create a new motorcycle listing
          </p>
        </div>

        {/* Back link */}
        <Link
          href="/admin/bikes"
          className="new-back-link"
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
            flexShrink: 0,
            transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          ← Back
        </Link>
      </div>

      {/* ── Form content ─────────────────────────────────────────────── */}
      <div className="admin-page-content">

        {/*
         * Section stubs note — informational banner shown until all
         * sections are implemented (A-08.3 through A-12).
         * Remove this banner once A-12 is complete and all sections
         * have real form fields.
         */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '8px',
            marginBottom: '20px',
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
            <span
              style={{
                fontWeight: 500,
                color: 'var(--color-ink-secondary)',
              }}
            >
              Form shell active — section fields implemented progressively.
            </span>
            {' '}
            Basic Info (A-08.3) · Specs (A-09) · Pricing (A-10) · Gallery (A-11) · SEO (A-12).
          </p>
        </div>

        {/*
         * BikeFormShell in create mode.
         * - Starts from DEFAULT_FORM_VALUES
         * - Renders section stubs until A-08.3+ implement real fields
         * - On submit: POST /api/bikes → redirect to /admin/bikes/[slug]/edit
         */}
        <BikeFormShell mode="create" />
      </div>
    </>
  )
}