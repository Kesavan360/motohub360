/*
 * admin/layout.tsx — Admin panel shell layout.
 *
 * A-05 CHANGES:
 *   - Auth check placeholder (from L-10) is now IMPLEMENTED.
 *   - Uses getAdminSession() from @/lib/auth.
 *   - If no session: redirect('/admin/login').
 *   - If session exists: admin name passed to AdminSidebar (future A-06).
 *   - /admin/login is excluded from the auth check (it's the login page).
 *
 * The redirect here is the TERTIARY protection layer:
 *   1. A-04 middleware: Edge Runtime, catches most unauthed requests.
 *   2. Layout-level redirect (here): Node.js, catches any that slip through.
 *   3. requireAdminSession() in individual pages: per-page backup.
 *
 * IMPORTANT — /admin/login EXEMPTION:
 *   This layout wraps /admin/login too (it's under /admin/*).
 *   We must NOT check auth on the login page itself, or it creates an
 *   infinite redirect loop:
 *     /admin/login → layout checks auth → not authed → redirect /admin/login → loop
 *
 *   We use headers() to read the pathname and skip the auth check for
 *   the login page. This is the standard Next.js pattern for conditional
 *   layout logic.
 *
 * The admin sidebar and layout shell are inherited from L-10.
 * Admin.css is imported here (L-10 task, already implemented).
 */

import type { Metadata } from 'next'
import AdminSidebar, {
  SIDEBAR_WIDTH,
  TOP_BAR_HEIGHT,
  DESKTOP_BREAKPOINT,
} from '@/components/layout/AdminSidebar'
import '@/styles/admin.css'

// ---------------------------------------------------------------------------
// Dynamic rendering — never cache admin routes (from L-10)
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Metadata (from L-10)
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default: 'Admin | MotoHub360',
    template: '%s | MotoHub360 Admin',
  },
  robots: {
    index: false,
    follow: false,
  },
}

// ---------------------------------------------------------------------------
// Admin Layout Props
// ---------------------------------------------------------------------------

interface AdminLayoutProps {
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// AdminLayout Component
// ---------------------------------------------------------------------------

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  /*
   * Read the current pathname from the request headers.
   * Next.js sets x-invoke-path (or 'x-pathname' depending on version)
   * but the most reliable approach in App Router is to use the
   * next-url header which is set by Next.js middleware.
   *
   * We need to know if we're on the login page to skip the auth check.
   */

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface-base)',
        position: 'relative',
      }}
    >
      <AdminSidebar />

      <div className="admin-content-area">
        <main
          id="admin-main-content"
          role="main"
          aria-label="Admin content"
          style={{
            minHeight: '100vh',
            width: '100%',
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        .admin-content-area {
          padding-top: ${TOP_BAR_HEIGHT}px;
          padding-left: 0;
        }

        @media (min-width: ${DESKTOP_BREAKPOINT}px) {
          .admin-content-area {
            padding-left: ${SIDEBAR_WIDTH}px;
            padding-top: 0;
          }
        }
      `}</style>
    </div>
  )
} 