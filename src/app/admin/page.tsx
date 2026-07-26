/*
 * Admin Dashboard — /admin
 *
 * A-05 CHANGES:
 *   - Import getAdminSession from @/lib/auth (replaces inline try/catch)
 *   - Session read is now a single clean call
 *   - requireAdminSession() used for belt-and-suspenders protection
 *   - adminSession.name used directly for the greeting
 *
 * All other content from A-04 is unchanged.
 */

import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import Brand from '@/lib/db/models/Brand'
import { requireAdminSession } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sublabel,
  accentColor,
}: {
  label: string
  value: number | string
  sublabel?: string
  accentColor: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-hairline)',
        borderRadius: '10px',
        padding: '20px 24px',
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
          backgroundColor: accentColor,
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
          margin: '0 0 8px',
        }}
      >
        {label}
      </p>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '36px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--color-ink-primary)',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>

      {sublabel && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: 400,
            color: 'var(--color-ink-tertiary)',
            margin: '6px 0 0',
          }}
        >
          {sublabel}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick action card
// ---------------------------------------------------------------------------

function ActionCard({
  title,
  description,
  href,
  accentColor,
}: {
  title: string
  description: string
  href: string
  accentColor: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        backgroundColor: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-hairline)',
        borderRadius: '10px',
        padding: '20px 24px',
        textDecoration: 'none',
        transition:
          'border-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
          'box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
      className="admin-action-card"
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          fontWeight: 600,
          color: accentColor,
          margin: '0 0 4px',
        }}
      >
        {title} →
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: 400,
          color: 'var(--color-ink-secondary)',
          margin: 0,
        }}
      >
        {description}
      </p>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default async function AdminDashboardPage() {
  /*
   * A-05: requireAdminSession() replaces the inline try/catch session read.
   * Returns AdminSessionData or redirects to /admin/login.
   * The A-04 middleware already redirected unauthed requests before this,
   * so this is the belt-and-suspenders page-level check.
   */
  const adminSession = await requireAdminSession()

  /*
   * Fetch bike and brand counts from MongoDB in parallel.
   * Falls back to 0 on any DB error — dashboard still renders.
   */
  let totalBikes = 0
  let publishedBikes = 0
  let draftBikes = 0
  let totalBrands = 0

  try {
    await connectDB()

    const [total, published, brands] = await Promise.all([
      Bike.countDocuments({}),
      Bike.countDocuments({ status: 'published' }),
      Brand.countDocuments({ isActive: true }),
    ])

    totalBikes = total
    publishedBikes = published
    draftBikes = total - published
    totalBrands = brands
  } catch {
    // DB unavailable — show zeros
  }

  const ACCENT = '#7A2E2E'

  return (
    <>
      <style>{`
        .admin-action-card:hover {
          border-color: var(--color-ink-tertiary);
          box-shadow: var(--shadow-sm);
        }
        .admin-action-card:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 10px;
        }
        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .admin-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .admin-stats-grid { grid-template-columns: 1fr; }
          .admin-actions-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
              margin: '4px 0 0',
            }}
          >
            {/*
             * A-05: adminSession.name from requireAdminSession() —
             * no try/catch needed, session is guaranteed here.
             */}
            Welcome back, {adminSession.name}
          </p>
        </div>
      </div>

      <div className="admin-page-content">

        {/* Stats */}
        <div
          style={{ marginBottom: '32px' }}
          aria-label="Site statistics"
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              margin: '0 0 12px',
            }}
          >
            Overview
          </p>

          <div className="admin-stats-grid">
            <StatCard
              label="Total Bikes"
              value={totalBikes}
              sublabel={`${publishedBikes} published`}
              accentColor={ACCENT}
            />
            <StatCard
              label="Published"
              value={publishedBikes}
              sublabel="Live on site"
              accentColor="#166534"
            />
            <StatCard
              label="Drafts"
              value={draftBikes}
              sublabel="Not yet live"
              accentColor="var(--color-ink-tertiary)"
            />
            <StatCard
              label="Brands"
              value={totalBrands}
              sublabel="Active brands"
              accentColor="#1B3A8A"
            />
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              margin: '0 0 12px',
            }}
          >
            Quick Actions
          </p>

          <div className="admin-actions-grid">
            <ActionCard
              title="Add New Bike"
              description="Create a new motorcycle listing"
              href="/admin/bikes/new"
              accentColor={ACCENT}
            />
            <ActionCard
              title="Manage Bikes"
              description="View, edit, publish and delete listings"
              href="/admin/bikes"
              accentColor={ACCENT}
            />
          </div>
        </div>

        {/* V1 status note */}
        <div
          style={{
            marginTop: '32px',
            padding: '16px 20px',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '10px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-ink-secondary)',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            <strong
              style={{
                fontWeight: 600,
                color: 'var(--color-ink-primary)',
              }}
            >
              MotoHub360 Admin Panel — V1
            </strong>
            <br />
            Bike list (A-06), media upload (A-07), and bike forms
            (A-08–A-12) are implemented in the upcoming tasks.
            Use the API routes directly for now:{' '}
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
            </code>
          </p>
        </div>
      </div>
    </>
  )
}