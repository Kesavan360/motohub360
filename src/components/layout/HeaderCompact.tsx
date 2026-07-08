'use client'

/*
 * HeaderCompact — Sticky scroll variant of the site header.
 *
 * MPD Task L-03:
 *   "Smaller height, logo only + search icon. Appears after 80px scroll
 *   via useStickyHeader hook. Slides in from top with 240ms ease transition."
 *
 * MPD Section 6, Desktop Design Rules:
 *   "Sticky header on scroll (compact version with logo + search icon
 *   that expands to full search bar on click), not the bottom action bar
 *   (which is mobile-only)."
 *
 * MPD Component Library:
 *   Header/Nav | Compact/Sticky (on scroll)
 *
 * RELATIONSHIP TO L-02 (Header):
 *   - Header (L-02)        → default state, shown at top of page
 *   - HeaderCompact (L-03) → appears after 80px scroll, replaces Header
 *   The swap logic is implemented in the root layout (L-06) using
 *   useStickyHeader (L-04). This component is the visual compact variant only.
 *
 * RELATIONSHIP TO L-04 (useStickyHeader):
 *   HeaderCompact is rendered by L-06 when useStickyHeader returns true.
 *   This component does NOT call useStickyHeader itself — separation of
 *   concerns keeps the component purely presentational.
 *
 * SEARCH ICON:
 *   Placeholder onClick identical to L-02.
 *   Wired to SearchBarCompact (SR-04) in Phase 6.
 *
 * DESIGN DIFFERENCES FROM Header (L-02):
 *   - Height: 48px (vs 64px desktop in L-02)
 *   - Logo only — no desktop nav links visible
 *   - Entrance: slides down from -100% with 240ms ease (MPD spec)
 *   - Background: surface-raised at 0.97 opacity with blur
 *   - Shadow: shadow-md (more pronounced than L-02 hairline border)
 *     to visually separate from content below during scroll.
 *
 * MOBILE:
 *   Same compact behaviour on mobile as desktop — logo + search + hamburger.
 *   Height: 48px on both breakpoints (already compact).
 *   The mobile drawer is the same component as L-02 to avoid duplication.
 *
 * WHY 'use client':
 *   Mobile menu open/close state requires useState.
 *   usePathname (route change close) requires a client hook.
 *   Search and hamburger onClick handlers require event handlers.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
// Mobile drawer data
// Identical to L-02 — same content, same structure.
// ---------------------------------------------------------------------------

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
 * CompactLogo — same wordmark as L-02 HeaderLogo.
 * Defined locally to keep HeaderCompact self-contained and
 * avoid cross-component imports between layout components.
 */
function CompactLogo() {
  return (
    <Link
      href="/"
      aria-label="MotoHub360 — Go to homepage"
      style={{
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
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
 * CompactMobileDrawer — identical in structure to MobileDrawer in L-02.
 * Duplicated here to keep HeaderCompact fully self-contained.
 * If drawer logic grows significantly, extract to a shared
 * MobileDrawer component in a future refactor task.
 */
function CompactMobileDrawer({
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
          <CompactLogo />
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
                      className="compact-drawer-link"
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
                        borderBottom:
                          '1px solid var(--color-border-hairline)',
                        transition:
                          'color 200ms cubic-bezier(0.4,0,0.2,1)',
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
                  className="compact-drawer-link"
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
                    transition:
                      'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
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
                      className="compact-drawer-link"
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
                        borderBottom:
                          '1px solid var(--color-border-hairline)',
                        transition:
                          'color 200ms cubic-bezier(0.4,0,0.2,1)',
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
// HeaderCompact Component
// ---------------------------------------------------------------------------

export default function HeaderCompact() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  /*
   * Close mobile drawer on route change.
   */
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  /*
   * Prevent body scroll when mobile drawer is open.
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
   */
  function handleSearchClick() {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '[HeaderCompact] Search icon clicked — wire to SearchBarCompact in SR-04',
      )
    }
  }

  return (
    <>
      {/* ── Scoped styles ─────────────────────────────────────────── */}
      <style>{`
        .compact-drawer-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .compact-drawer-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
          color: var(--color-ink-primary) !important;
        }

        /*
         * Slide-in entrance animation — MPD L-03:
         * "Slides in from top with 240ms ease transition."
         *
         * Applied to the header element itself.
         * The parent (L-06 root layout) conditionally renders this
         * component when useStickyHeader returns true, triggering
         * the animation on mount.
         */
        @keyframes compact-header-enter {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .compact-header-bar {
          animation: compact-header-enter 240ms cubic-bezier(0.4,0,0.2,1) forwards;
        }

        /* Mobile actions: hidden on desktop */
        @media (min-width: 769px) {
          .compact-mobile-actions {
            display: none !important;
          }
        }

        /* Desktop search: hidden on mobile */
        @media (max-width: 768px) {
          .compact-desktop-search {
            display: none !important;
          }
          .compact-mobile-actions {
            display: flex !important;
          }
          .compact-header-inner {
            padding: 0 20px !important;
          }
        }
      `}</style>

      {/* ── Compact header bar ────────────────────────────────────── */}
      <header
        role="banner"
        aria-label="Site header — compact"
        className="compact-header-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          /*
           * Shadow-md per Design System — more prominent than the
           * hairline border on the default Header. Creates visual
           * separation from scrolled content beneath.
           */
          boxShadow: '0 4px 12px rgba(15,16,20,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255,255,255,0.97)',
        }}
      >
        {/* Inner container — max 1440px, centered */}
        <div
          className="compact-header-inner"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 32px',
            /*
             * Height: 48px — 16px shorter than the default 64px Header.
             * Creates a visually tighter, more minimal feel when
             * the user is scrolled into content.
             */
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* ── Left: Logo ──────────────────────────────────────── */}
          <div style={{ flexShrink: 0 }}>
            <CompactLogo />
          </div>

          {/* ── Right: Desktop search icon ───────────────────────── */}
          <div
            className="compact-desktop-search"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
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

          {/* ── Right: Mobile actions ────────────────────────────── */}
          <div
            className="compact-mobile-actions"
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
              aria-controls="compact-mobile-navigation-drawer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Icon name="menu" size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────────── */}
      <div id="compact-mobile-navigation-drawer">
        <CompactMobileDrawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          currentPath={pathname}
        />
      </div>
    </>
  )
}