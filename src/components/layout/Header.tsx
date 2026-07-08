'use client'

/*
 * Header — Site-wide primary navigation header.
 *
 * MPD Task L-02:
 *   "MotoHub logo (text or SVG), navigation links (Brands, Categories),
 *   compact search icon that expands SearchBarCompact on click
 *   (wire up later in Phase 6 — leave as placeholder click for now).
 *   Responsive: hamburger menu icon on mobile."
 *
 * MPD Section 6, Desktop Design Rules:
 *   "Sticky header on scroll (compact version with logo + search icon
 *   that expands to full search bar on click) — not the bottom action bar."
 *   Note: Sticky behaviour is implemented in L-03 (HeaderCompact) and
 *   L-04 (useStickyHeader). This component is the default/full state only.
 *
 * MPD Component Library:
 *   Header/Nav | Default (top of page)
 *
 * SEARCH ICON:
 *   The search icon onClick is a placeholder in L-02.
 *   It is wired to SearchBarCompact (SR-04) in Phase 6.
 *   A console.log is used to confirm the click registers during testing.
 *
 * MOBILE:
 *   Hamburger icon (menu) opens a full-width overlay drawer.
 *   Drawer contains the same nav links as the desktop header.
 *   Close icon dismisses the drawer.
 *   Drawer closes automatically on route change via usePathname.
 *
 * WHY 'use client':
 *   Mobile menu open/close state requires useState.
 *   usePathname (route change close) requires a client hook.
 *   The search icon click handler requires an event handler.
 *
 * DESIGN:
 *   Background: surface-raised (#FFFFFF) with a hairline border-bottom.
 *   Height: 64px desktop / 56px mobile.
 *   Max content width: 1440px, centered.
 *   Logo: display typeface, 20px, weight 600.
 *   Nav links: Ghost style (no fill, ink-secondary, ink-primary on hover).
 *   Right actions: Icon buttons (search, hamburger).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import { BRANDS } from '@/constants/brands'
import { CATEGORIES } from '@/constants/categories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavLink {
  label: string
  href: string
}

// ---------------------------------------------------------------------------
// Navigation data
// ---------------------------------------------------------------------------

/*
 * Primary nav links — desktop inline, mobile drawer list.
 * Brands and Categories are the only top-level nav items per MPD.
 * Individual brand/category pages are discovered via these hub pages.
 */
const PRIMARY_NAV: NavLink[] = [
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/category/cruiser' },
]

/*
 * Mobile drawer nav — expanded set showing brand + category quick links.
 * Provides immediate access to popular destinations without an extra tap.
 */
const MOBILE_BRAND_LINKS: NavLink[] = BRANDS.map((brand) => ({
  label: brand.name,
  href: `/brands/${brand.slug}`,
}))

const MOBILE_CATEGORY_LINKS: NavLink[] = CATEGORIES.map((cat) => ({
  label: cat.label,
  href: `/category/${cat.slug}`,
}))

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/*
 * HeaderLogo — MotoHub360 wordmark.
 * Matches the footer logo style for brand consistency.
 * Links to the Home page.
 */
function HeaderLogo() {
  return (
    <Link
      href="/"
      aria-label="MotoHub360 — Go to homepage"
      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--color-ink-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        MotoHub
        <span style={{ color: 'var(--color-ink-tertiary)' }}>360</span>
      </span>
    </Link>
  )
}

/*
 * DesktopNav — horizontal nav link row shown on desktop.
 * Uses Ghost button visual style: no fill, ink-secondary text,
 * ink-primary on hover, per MPD Section 6, Buttons.
 */
function DesktopNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="Primary navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {PRIMARY_NAV.map((link) => {
        const isActive = currentPath.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className="header-nav-link"
            aria-current={isActive ? 'page' : undefined}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              fontWeight: isActive ? 500 : 400,
              color: isActive
                ? 'var(--color-ink-primary)'
                : 'var(--color-ink-secondary)',
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              transition: 'color 280ms cubic-bezier(0.4,0,0.2,1)',
              display: 'inline-block',
            }}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

/*
 * MobileDrawer — full-height overlay menu for mobile.
 * Slides in from the right when the hamburger is tapped.
 * Contains brand and category quick links for immediate access.
 *
 * Trap focus is not implemented in L-02 — added in Q-04 (accessibility pass).
 */
function MobileDrawer({
  isOpen,
  onClose,
  currentPath,
}: {
  isOpen: boolean
  onClose: () => void
  currentPath: string
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(14,15,18,0.6)',
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 240ms cubic-bezier(0.4,0,0.2,1)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '300px',
          maxWidth: '85vw',
          backgroundColor: 'var(--color-surface-raised)',
          zIndex: 50,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border-hairline)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--color-surface-raised)',
            zIndex: 1,
          }}
        >
          <HeaderLogo />
          <Button
            variant="icon"
            size="md"
            aria-label="Close navigation menu"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </Button>
        </div>

        {/* Drawer content */}
        <div style={{ padding: '24px 20px', flex: 1 }}>

          {/* Brands section */}
          <div style={{ marginBottom: '32px' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                marginBottom: '12px',
                margin: '0 0 12px',
              }}
            >
              Brands
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {MOBILE_BRAND_LINKS.map((link) => {
                const isActive = currentPath === link.href
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className="mobile-drawer-link"
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-body)',
                        fontSize: '16px',
                        fontWeight: isActive ? 500 : 400,
                        color: isActive
                          ? 'var(--color-ink-primary)'
                          : 'var(--color-ink-secondary)',
                        textDecoration: 'none',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--color-border-hairline)',
                        transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
              <li>
                <Link
                  href="/brands"
                  onClick={onClose}
                  className="mobile-drawer-link"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-accent)',
                    textDecoration: 'none',
                    padding: '12px 0 0',
                    transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  All brands
                  <Icon name="arrow-right" size={14} />
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories section */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 12px',
              }}
            >
              Categories
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {MOBILE_CATEGORY_LINKS.map((link) => {
                const isActive = currentPath === link.href
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className="mobile-drawer-link"
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-body)',
                        fontSize: '16px',
                        fontWeight: isActive ? 500 : 400,
                        color: isActive
                          ? 'var(--color-ink-primary)'
                          : 'var(--color-ink-secondary)',
                        textDecoration: 'none',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--color-border-hairline)',
                        transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Drawer footer */}
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid var(--color-border-hairline)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              margin: 0,
              maxWidth: 'none',
            }}
          >
            India&apos;s premium motorcycle showcase.
          </p>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Header Component
// ---------------------------------------------------------------------------

export default function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  /*
   * Close mobile drawer on route change.
   * When the user taps a link inside the drawer, Next.js navigates
   * and pathname changes — this effect closes the drawer cleanly.
   */
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  /*
   * Prevent body scroll when mobile drawer is open.
   * Restores scroll on close or unmount.
   */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  /*
   * Search icon click handler — placeholder for SR-04.
   * SearchBarCompact expand logic is wired in Phase 6.
   */
  function handleSearchClick() {
    /*
     * SR-04: Replace this with SearchBarCompact.open() or
     * equivalent state setter when SearchBarCompact is built.
     */
    if (process.env.NODE_ENV === 'development') {
      console.log('[Header] Search icon clicked — wire to SearchBarCompact in SR-04')
    }
  }

  return (
    <>
      {/* ── Scoped styles ─────────────────────────────────────────── */}
      <style>{`
        .header-nav-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .header-nav-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          color: var(--color-ink-primary) !important;
        }
        .mobile-drawer-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .mobile-drawer-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
          color: var(--color-ink-primary) !important;
        }

        /* Hide desktop nav on mobile */
        @media (max-width: 768px) {
          .header-desktop-nav {
            display: none !important;
          }
          .header-desktop-search {
            display: none !important;
          }
          .header-mobile-actions {
            display: flex !important;
          }
        }

        /* Hide mobile hamburger on desktop */
        @media (min-width: 769px) {
          .header-mobile-actions {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Header bar ────────────────────────────────────────────── */}
      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          borderBottom: '1px solid var(--color-border-hairline)',
          /*
           * Subtle backdrop blur — adds premium depth when content
           * scrolls behind the header.
           */
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          /*
           * Semi-transparent background works with backdrop-filter.
           * Full opacity is maintained via rgba with 0.95 alpha —
           * content remains readable while blur creates depth.
           */
          backgroundColor: 'rgba(255,255,255,0.95)',
        }}
      >
        {/* Inner container — max 1440px centered */}
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 32px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
          className="header-inner"
        >
          {/* ── Left: Logo ──────────────────────────────────────── */}
          <div style={{ flexShrink: 0 }}>
            <HeaderLogo />
          </div>

          {/* ── Centre: Desktop navigation ──────────────────────── */}
          <div className="header-desktop-nav" style={{ flex: 1 }}>
            <DesktopNav currentPath={pathname} />
          </div>

          {/* ── Right: Desktop actions (search) ─────────────────── */}
          <div
            className="header-desktop-search"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/*
             * Search icon button — placeholder until SR-04.
             * Will expand SearchBarCompact overlay on click.
             */}
            <Button
              variant="icon"
              size="md"
              aria-label="Open search"
              onClick={handleSearchClick}
              title="Search motorcycles"
            >
              <Icon name="search" size={18} />
            </Button>
          </div>

          {/* ── Right: Mobile actions (search + hamburger) ────────── */}
          <div
            className="header-mobile-actions"
            style={{
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <Button
              variant="icon"
              size="md"
              aria-label="Open search"
              onClick={handleSearchClick}
            >
              <Icon name="search" size={18} />
            </Button>

            <Button
              variant="icon"
              size="md"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Icon name="menu" size={18} />
            </Button>
          </div>
        </div>

        {/*
         * Mobile header height adjustment.
         * 64px desktop → 56px mobile for tighter proportions.
         */}
        <style>{`
          @media (max-width: 768px) {
            .header-inner {
              height: 56px !important;
              padding: 0 20px !important;
            }
          }
        `}</style>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────────── */}
      <div id="mobile-navigation-drawer">
        <MobileDrawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          currentPath={pathname}
        />
      </div>
    </>
  )
}