/*
 * Add New Bike — /admin/bikes/new
 *
 * A-07.5 update:
 *   Updated stub message to explain the two-step workflow now that
 *   the edit page (A-07.5) exists:
 *     1. Create bike via POST /api/bikes (using API directly or A-08 form)
 *     2. Upload media via /admin/bikes/[slug]/edit (A-07.5 — live now)
 *
 * A-08 replaces this stub with the full multi-step BikeForm.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Add New Bike',
}

export default async function AdminBikesNewPage() {
  await requireAdminSession()

  return (
    <>
      <div className="admin-page-header">
        <div>
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
      </div>

      <div className="admin-page-content">
        <div
          style={{
            maxWidth: '520px',
            padding: '28px 24px',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '10px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--color-ink-primary)',
              margin: '0 0 8px',
              letterSpacing: '-0.01em',
            }}
          >
            Bike Form — A-08
          </p>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-ink-secondary)',
              margin: '0 0 16px',
              lineHeight: 1.65,
            }}
          >
            The full multi-step create form (basic info, specs, pricing,
            gallery, SEO) is implemented in tasks A-08 through A-12.
          </p>

          {/*
           * Workflow card — explains the current two-step approach
           * using the POST API + the live edit page (A-07.5).
           */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 10px',
              }}
            >
              Current workflow (pre-A-08)
            </p>

            <ol
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-ink-secondary)',
                margin: 0,
                paddingLeft: '18px',
                lineHeight: 1.8,
              }}
            >
              <li>
                Create the bike via{' '}
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    backgroundColor: 'var(--color-surface-raised)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border-hairline)',
                  }}
                >
                  POST /api/bikes
                </code>
                {' '}with minimum fields (slug, brandSlug, name, heroImageUrl)
              </li>
              <li>
                Navigate to{' '}
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    backgroundColor: 'var(--color-surface-raised)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border-hairline)',
                  }}
                >
                  /admin/bikes/[slug]/edit
                </code>
                {' '}to upload media (hero image, gallery, 360° video)
              </li>
              <li>
                Use{' '}
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    backgroundColor: 'var(--color-surface-raised)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border-hairline)',
                  }}
                >
                  PUT /api/bikes/[id]/publish
                </code>
                {' '}when ready to make the bike visible on the public site
              </li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href="/admin/bikes"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '36px',
                padding: '0 16px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-ink-secondary)',
                backgroundColor: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              ← Back to Bikes
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}