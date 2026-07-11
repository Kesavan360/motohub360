'use client'

/*
 * AdminSidebar — Admin panel navigation sidebar.
 *
 * MPD Task L-09:
 *   "Dark sidebar (surface-inverse): MotoHub Admin logo, nav links
 *   (Dashboard, Bikes, Brands, Settings, Logout). Active link:
 *   accent-colored left border. Mobile: collapses to top bar.
 *   Purely presentational — no auth logic yet."
 *
 * MPD Section 5.5, Admin Dashboard:
 *   "Dark sidebar (surface-inverse/text-inverse) on the left
 *   (collapses to a top bar on mobile/tablet admin use) housing
 *   navigation: Dashboard, Bikes, Brands, Media, Settings."
 *
 * MPD Section 6, Design System — Admin:
 *   "Deliberately, visually distinct from the public site — signaling
 *   'you are in the workshop, not the showroom.' Dark sidebar
 *   (surface-inverse/text-inverse) on the left."
 *
 *   "Typography in the admin shifts mostly to body-md/body-sm with
 *   the data/mono type reserved for IDs or price fields — the admin
 *   doesn't need display-xl drama anywhere; it's a workspace."
 *
 * MPD Component Library:
 *   AdminSidebar | Dark, collapses to top bar on mobile
 *
 * AUTH LOGIC:
 *   This component is purely presentational per MPD L-09.
 *   The Logout link renders as a <button> with a placeholder onClick.
 *   Real logout logic (POST /api/auth/logout) is wired in A-03.
 *   The active link detection uses usePathname (client hook) — this
 *   is the only client-side logic present in this component.
 *
 * LAYOUT MODES:
 *   Desktop (≥ 1024px): fixed left sidebar, 240px wide, full height.
 *   Mobile/Tablet (< 1024px): collapses to a horizontal top bar
 *   with icon-only nav links and the MotoHub Admin logo on the left.
 *
 * ACTIVE STATE:
 *   Active nav item: accent-colored (--color-accent) left border 3px,
 *   ink-primary text, surface-sunken background on the link row.
 *   Per MPD: "Active link: accent-colored left border."
 *   Default accent (#15161A ink-primary) is used here since no bike
 *   context sets a brand accent in the admin panel.
 *
 * WHY 'use client':
 *   usePathname() from 'next/navigation' requires a client component.
 *   Mobile top bar toggle state (isTopBarExpanded) requires useState.
 *   Logout onClick placeholder requires an event handler.
 *
 * USAGE (in admin/layout.tsx — L-10):
 *   import AdminSidebar from '@/components/layout/AdminSidebar'
 *
 *   export default function AdminLayout({ children }) {
 *     return (
 *       <div style={{ display: 'flex', minHeight: '100vh' }}>
 *         <AdminSidebar />
 *         <main style={{ flex: 1 }}>{children}</main>
 *       </div>
 *     )
 *   }
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * AdminNavItem — a single navigation item in the sidebar.
 *
 * id      — unique identifier, used as React key.
 * label   — display text in the sidebar nav list.
 * href    — route path, used for active detection and Link href.
 *           null for the Logout item (rendered as button, not Link).
 * icon    — icon name from the Icon component lookup map (D-08).
 * isLogout — when true: render as button (onClick) not Link.
 */
export interface AdminNavItem {
  id: string
  label: string
  href: string | null
  icon: IconName
  isLogout?: boolean
}

/*
 * AdminSidebarProps — props for the AdminSidebar component.
 * Currently empty — sidebar data is internal and nav items
 * are defined as a constant below. Props are typed as an empty
 * interface for forward-compatibility (future: inject nav items).
 */
export interface AdminSidebarProps {
  /*
   * onLogout — optional logout handler.
   * When provided, called on Logout button click.
   * When absent, a console.log placeholder is used (A-03 wires real logic).
   */
  onLogout?: () => void
}

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

/*
 * ADMIN_NAV_ITEMS — ordered list of admin sidebar nav entries.
 *
 * Matches MPD L-09: "Dashboard, Bikes, Brands, Settings, Logout"
 * and MPD Section 5.5: "Dashboard, Bikes, Brands, Media, Settings."
 *
 * Order: Dashboard first (primary), then content management items,
 * then Settings, then Logout (always last — separated visually).
 */
const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: 'eye',
  },
  {
    id: 'bikes',
    label: 'Bikes',
    href: '/admin/bikes',
    icon: 'motorcycle',
  },
  {
    id: 'brands',
    label: 'Brands',
    href: '/admin/brands',
    icon: 'image',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: 'filter',
  },
]

/*
 * LOGOUT_ITEM — separated from ADMIN_NAV_ITEMS because it renders
 * as a <button> (not a <Link>) and sits visually apart at the bottom.
 */
const LOGOUT_ITEM: AdminNavItem = {
  id: 'logout',
  label: 'Logout',
  href: null,
  icon: 'close',
  isLogout: true,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * SIDEBAR_WIDTH — desktop sidebar width in px.
 * Fixed across the admin panel. The main content area in L-10 will
 * use paddingLeft or marginLeft equal to this value.
 */
export const SIDEBAR_WIDTH = 240

/*
 * TOP_BAR_HEIGHT — mobile/tablet top bar height in px.
 * Used by admin/layout.tsx (L-10) to set paddingTop on the main
 * content area when the sidebar collapses to a top bar.
 */
export const TOP_BAR_HEIGHT = 56

/*
 * DESKTOP_BREAKPOINT — minimum viewport width for the sidebar layout.
 * Below this: top bar mode. At or above: sidebar mode.
 */
export const DESKTOP_BREAKPOINT = 1024

// ---------------------------------------------------------------------------
// NavLink sub-component — shared between sidebar and top bar
// ---------------------------------------------------------------------------

interface NavLinkItemProps {
  item: AdminNavItem
  isActive: boolean
  isSidebar: boolean
  onLogout: () => void
}

function NavLinkItem({
  item,
  isActive,
  isSidebar,
  onLogout,
}: NavLinkItemProps) {
  /*
   * Shared base style for both sidebar rows and top bar icon buttons.
   * Active state: accent left border (sidebar only) + muted background.
   * Inactive state: transparent background, ink-tertiary icon/text.
   */

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isSidebar ? '12px' : '0',

    padding: isSidebar ? '10px 20px' : '0',
    justifyContent: isSidebar ? 'flex-start' : 'center',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: isActive
      ? 'rgba(255,255,255,0.06)'
      : 'transparent',
    color: isActive
      ? 'var(--color-text-inverse)'
      : 'rgba(245,245,244,0.5)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    fontWeight: isActive ? 500 : 400,
    textDecoration: 'none',
    /*
     * Left border accent — sidebar mode only, active state.
     * 3px solid --color-accent per MPD L-09 spec.
     * In top bar mode (isSidebar: false), no left border is applied.
     */
    borderLeft: isSidebar
      ? isActive
        ? '3px solid var(--color-accent)'
        : '3px solid transparent'
      : 'none',
    /*
     * Compensate for the 3px left border so text alignment stays
     * consistent between active and inactive items in sidebar mode.
     * Without this, non-active items shift left by 3px.
     */
    paddingLeft: isSidebar ? (isActive ? '17px' : '17px') : '0',
    transition:
      'background-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
      'color 200ms cubic-bezier(0.4,0,0.2,1)',
    /*
     * Top bar items: fixed square tap target (44×44px minimum).
     */
    height: isSidebar ? 'auto' : `${TOP_BAR_HEIGHT}px`,
    width: isSidebar ? '100%' : '44px',
    minWidth: isSidebar ? 'auto' : '44px',
    borderRadius: isSidebar ? '0' : '0',
    position: 'relative' as const,
  }

  const iconColor = isActive
    ? 'var(--color-text-inverse)'
    : 'rgba(245,245,244,0.5)'

  const content = (
    <>
      <span
        style={{ color: iconColor, flexShrink: 0, display: 'flex' }}
        aria-hidden="true"
      >
        <Icon name={item.icon} size={18} strokeWidth={1.5} />
      </span>
      {isSidebar && (
        <span style={{ lineHeight: 1.4 }}>{item.label}</span>
      )}
    </>
  )

  if (item.isLogout) {
    return (
      <button
        type="button"
        onClick={onLogout}
        aria-label="Log out of admin panel"
        className="admin-nav-item"
        style={baseStyle}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={item.href!}
      aria-current={isActive ? 'page' : undefined}
      aria-label={!isSidebar ? item.label : undefined}
      className="admin-nav-item"
      style={baseStyle}
    >
      {content}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// AdminSidebar Component
// ---------------------------------------------------------------------------

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const pathname = usePathname()

  /*
   * Mobile top bar: whether the nav label row is expanded.
   * On mobile, the top bar shows icon-only nav items.
   * This state is not used visually in V1 (top bar is always icon-only)
   * but is included as a hook point for a future expandable mobile menu.
   */
  const [_isExpanded, _setIsExpanded] = useState(false)

  /*
   * isActive — determines which nav item is highlighted.
   *
   * Dashboard: exact match on /admin only (avoid matching /admin/bikes etc.)
   * All others: startsWith match so /admin/bikes/new matches the Bikes item.
   */
  function isActive(item: AdminNavItem): boolean {
    if (!item.href) return false
    if (item.href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(item.href)
  }

  /*
   * handleLogout — placeholder until A-03 wires real auth logout.
   * Calls the optional onLogout prop if provided, otherwise logs.
   */
  function handleLogout(): void {
    if (onLogout) {
      onLogout()
      return
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[AdminSidebar] Logout clicked — wire to /api/auth/logout in A-03',
      )
    }
  }

  return (
    <>
      {/* ── Scoped styles ─────────────────────────────────────────── */}
      <style>{`
        .admin-nav-item:hover {
          background-color: rgba(255,255,255,0.06) !important;
          color: var(--color-text-inverse) !important;
        }
        .admin-nav-item:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px rgba(245,245,244,0.4);
        }

        /* Desktop sidebar — visible on screens ≥ 1024px */
        .admin-sidebar-desktop {
          display: flex;
        }
        .admin-topbar-mobile {
          display: none;
        }

        @media (max-width: 1023px) {
          .admin-sidebar-desktop {
            display: none !important;
          }
          .admin-topbar-mobile {
            display: flex !important;
          }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ───────────────────────────────────────── */}
      {/*
       * Fixed left sidebar, full viewport height.
       * Width: 240px (SIDEBAR_WIDTH constant).
       * Background: surface-inverse (#0E0F12).
       * z-index: 20 — above page content, below modals.
       */}
      <aside
        className="admin-sidebar-desktop"
        aria-label="Admin navigation"
        role="navigation"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${SIDEBAR_WIDTH}px`,
          backgroundColor: 'var(--color-surface-inverse)',
          zIndex: 20,
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* ── Sidebar logo ─────────────────────────────────────── */}
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <Link
            href="/admin"
            aria-label="MotoHub360 Admin — Dashboard"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--color-text-inverse)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              MotoHub
              <span style={{ opacity: 0.4 }}>360</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(245,245,244,0.4)',
                marginTop: '2px',
              }}
            >
              Admin Panel
            </div>
          </Link>
        </div>

        {/* ── Primary nav items ─────────────────────────────────── */}
        <nav
          aria-label="Admin primary navigation"
          style={{ flex: 1, paddingTop: '8px' }}
        >
          <ul
            role="list"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            {ADMIN_NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <NavLinkItem
                  item={item}
                  isActive={isActive(item)}
                  isSidebar={true}
                  onLogout={handleLogout}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Sidebar footer: Logout ────────────────────────────── */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '8px',
            paddingTop: '8px',
            flexShrink: 0,
          }}
        >
          <NavLinkItem
            item={LOGOUT_ITEM}
            isActive={false}
            isSidebar={true}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* ── MOBILE / TABLET TOP BAR ───────────────────────────────── */}
      {/*
       * Horizontal top bar for viewports < 1024px.
       * Contains: Admin logo text on the left, icon-only nav on the right.
       * Height: 56px (TOP_BAR_HEIGHT constant).
       * Background: surface-inverse — matches sidebar for visual continuity.
       * position: fixed — stays at top while admin content scrolls.
       *
       * Icon-only (no labels) because the top bar is narrow and
       * the admin panel is primarily a desktop tool. Aria-labels
       * on each icon button provide screen reader context.
       */}
      <header
        className="admin-topbar-mobile"
        aria-label="Admin navigation"
        role="banner"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${TOP_BAR_HEIGHT}px`,
          backgroundColor: 'var(--color-surface-inverse)',
          zIndex: 20,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Mobile logo */}
        <Link
          href="/admin"
          aria-label="MotoHub360 Admin — Dashboard"
          style={{ textDecoration: 'none' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-inverse)',
              letterSpacing: '-0.01em',
            }}
          >
            MotoHub
            <span style={{ opacity: 0.4 }}>360</span>
          </span>
        </Link>

        {/* Mobile icon nav */}
        <nav aria-label="Admin mobile navigation">
          <ul
            role="list"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0',
            }}
          >
            {ADMIN_NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <NavLinkItem
                  item={item}
                  isActive={isActive(item)}
                  isSidebar={false}
                  onLogout={handleLogout}
                />
              </li>
            ))}
            <li>
              <NavLinkItem
                item={LOGOUT_ITEM}
                isActive={false}
                isSidebar={false}
                onLogout={handleLogout}
              />
            </li>
          </ul>
        </nav>
      </header>
    </>
  )
}