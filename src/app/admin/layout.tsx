/*
 * admin/layout.tsx — Admin panel shell layout.
 *
 * MPD Task L-10:
 *   "Admin shell: renders AdminSidebar + {children} in a two-column
 *   layout. Imports admin.css (separate from public styles). Auth check
 *   placeholder (wired up in Phase 9)."
 *
 * MPD Section 5.5, Admin Dashboard:
 *   "Deliberately, visually distinct from the public site — signaling
 *   'you are in the workshop, not the showroom.'"
 *
 * MPD Section 8, Technical Architecture — Admin Panel:
 *   "All /admin/* routes are dynamically rendered (no caching) —
 *   an admin must always see live data."
 *   "The admin layout (admin/layout.tsx) performs a server-side auth
 *   check on every request. If the session is invalid, it redirects
 *   to /admin/login before any page renders."
 *
 * NEXT.JS APP ROUTER CONVENTION:
 *   This layout.tsx applies to all routes under /admin/* automatically.
 *   It wraps every admin page (dashboard, bike list, add/edit forms,
 *   login) with the AdminSidebar and main content shell.
 *
 * AUTH CHECK PLACEHOLDER:
 *   Per MPD L-10: "Auth check placeholder (wired up in Phase 9)."
 *   The real auth check (reading iron-session cookie, redirecting to
 *   /admin/login if invalid) is implemented in A-04 (middleware.ts)
 *   and A-05 (withAdminAuth). This layout contains a clearly marked
 *   placeholder comment at the auth check location so Phase 9 tasks
 *   know exactly where to integrate.
 *
 * DYNAMIC RENDERING:
 *   export const dynamic = 'force-dynamic' ensures this layout and all
 *   admin pages beneath it are never statically generated or cached.
 *   Admins must always see live MongoDB data, not a stale cached page.
 *
 * LAYOUT STRUCTURE:
 *   Desktop (≥ 1024px):
 *     Fixed AdminSidebar (240px) on the left.
 *     Main content area fills the remainder with paddingLeft = 240px.
 *
 *   Mobile/Tablet (< 1024px):
 *     AdminSidebar renders as a fixed top bar (56px).
 *     Main content area has paddingTop = 56px.
 *
 * ADMIN.CSS:
 *   Imported here — applies only to /admin/* routes.
 *   Not imported in the root layout.tsx (public pages never load it).
 *   admin.css contains admin-specific overrides: dense table styles,
 *   form field resets, admin typography adjustments.
 *   The file is created here with initial content (not empty).
 *
 * SERVER COMPONENT:
 *   This layout is a Server Component — no 'use client' directive.
 *   AdminSidebar is 'use client' (usePathname + useState) and is
 *   imported here — Next.js handles the client boundary automatically.
 *   The layout itself needs no client-side hooks.
 *
 * METADATA:
 *   Admin pages share a base title suffix "| MotoHub360 Admin".
 *   Individual admin pages override the title via their own metadata
 *   exports (e.g. "Bikes | MotoHub360 Admin").
 */

import type { Metadata } from 'next'
import AdminSidebar, {
  SIDEBAR_WIDTH,
  TOP_BAR_HEIGHT,
  DESKTOP_BREAKPOINT,
} from '@/components/layout/AdminSidebar'
import '@/styles/admin.css'

// ---------------------------------------------------------------------------
// Dynamic rendering — never cache admin routes
// ---------------------------------------------------------------------------

/*
 * force-dynamic — disables static generation for all /admin/* routes.
 * Every request to an admin page hits the server fresh.
 * This is mandatory because admin pages display live MongoDB data
 * (bike list, publish status) that must never be stale.
 */
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/*
 * Base metadata for all admin pages.
 * Individual pages override `title` via their own metadata export.
 * robots: noindex — admin pages must never appear in search results.
 */
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
// AdminLayout Props
// ---------------------------------------------------------------------------

interface AdminLayoutProps {
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// AdminLayout Component
// ---------------------------------------------------------------------------

export default function AdminLayout({ children }: AdminLayoutProps) {
  /*
   * AUTH CHECK PLACEHOLDER — A-04 / A-05
   *
   * In Phase 9, this location receives the server-side session check:
   *
   *   const session = await getIronSession(cookies(), sessionOptions)
   *   if (!session.admin) {
   *     redirect('/admin/login')
   *   }
   *
   * The redirect() call from 'next/navigation' throws a special Next.js
   * error that is caught by the App Router framework and handled as
   * a 307 redirect — no HTML is rendered for the admin page.
   *
   * middleware.ts (A-04) also guards /admin/* at the Edge before this
   * layout renders. The layout-level check is a belt-and-suspenders
   * defence for cases where middleware is bypassed (e.g. direct API calls).
   *
   * DO NOT remove this comment — it marks the integration point for A-04.
   */

  return (
    /*
     * Outer wrapper — full viewport height, flex column on mobile,
     * flex row on desktop (sidebar left + content right).
     *
     * min-h-screen ensures the background covers the full viewport
     * even on short-content admin pages (e.g. settings).
     */
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface-base)',
        position: 'relative',
      }}
    >
      {/*
       * AdminSidebar — renders the fixed left sidebar (desktop)
       * or fixed top bar (mobile/tablet).
       * Self-contained: manages its own positioning and z-index.
       */}
      <AdminSidebar />

      {/*
       * Main content wrapper — offset to avoid overlap with the sidebar.
       *
       * Desktop: paddingLeft = SIDEBAR_WIDTH (240px) pushes content
       *   clear of the fixed sidebar.
       *
       * Mobile: paddingTop = TOP_BAR_HEIGHT (56px) pushes content
       *   below the fixed top bar.
       *
       * The CSS class 'admin-content-area' applies responsive overrides
       * via the scoped style block below — inline styles alone cannot
       * express media queries.
       */}
      <div className="admin-content-area">
        {/*
         * Inner content shell — max-width, padding, background.
         *
         * No max-width on the wrapper div itself — the admin panel
         * uses full available width. Individual page sections
         * (tables, forms) constrain their own widths as needed.
         *
         * Background: surface-base (#FAFAF9) — the admin content area
         * is light, contrasting with the dark sidebar.
         */}
        <main
          id="admin-main-content"
          role="main"
          aria-label="Admin content"
          style={{
            minHeight: '100vh',
            width: '100%',
          }}
        >
          {/*
           * {children} — the active admin page renders here.
           * Examples:
           *   /admin          → admin/page.tsx (dashboard)
           *   /admin/bikes    → admin/bikes/page.tsx
           *   /admin/bikes/new → admin/bikes/new/page.tsx
           */}
          {children}
        </main>
      </div>

      {/*
       * Responsive layout styles — scoped to the admin layout.
       *
       * Desktop (≥ DESKTOP_BREAKPOINT): sidebar is 240px fixed left.
       *   Content area uses paddingLeft to clear the sidebar.
       *
       * Mobile (< DESKTOP_BREAKPOINT): top bar is 56px fixed top.
       *   Content area uses paddingTop to clear the top bar.
       *   No left padding needed — sidebar is hidden.
       *
       * These media queries cannot be expressed as inline styles,
       * which is why a scoped style block is used rather than
       * a 'use client' component with window.innerWidth.
       */}
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