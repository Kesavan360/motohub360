/*
 * Add New Bike — /admin/bikes/new
 *
 * Stub page — the full BikeForm is implemented in A-08 through A-12.
 * This page exists so the dashboard "Add New Bike" action card and the
 * BikeTable "+" button don't 404.
 *
 * A-08 replaces this stub with the full multi-step bike creation form.
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
              fontWeight: 400,
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
            padding: '32px 24px',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '10px',
            textAlign: 'center',
            maxWidth: '500px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--color-ink-primary)',
              margin: '0 0 8px',
            }}
          >
            Bike Form — Coming Soon
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-ink-secondary)',
              margin: '0 0 8px',
              lineHeight: 1.6,
            }}
          >
            The multi-step bike creation form is implemented in tasks
            A-08 through A-12 (BikeFormBasic, BikeFormSpecs, BikeFormPricing,
            BikeFormGallery, BikeFormSEO).
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-ink-tertiary)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}
          >
            Use{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                backgroundColor: 'var(--color-surface-sunken)',
                padding: '1px 5px',
                borderRadius: '4px',
              }}
            >
              POST /api/bikes
            </code>{' '}
            to add bikes directly until the form is ready.
          </p>
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
    </>
  )
}