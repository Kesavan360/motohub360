'use client'

/*
 * Header — Site-wide primary navigation header.
 *
 * SR-04 change:
 *   Replace the placeholder handleSearchClick() console.log with
 *   the real <SearchBarCompact /> component.
 *   The search icon button is now rendered by SearchBarCompact itself.
 *
 * All other code is preserved exactly from L-02.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import SearchBarCompact from '@/components/search/SearchBarCompact'
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

const PRIMARY_NAV: NavLink[] = [
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/category/cruiser' },
]

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

function HeaderLogo() {
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

        <div style={{ padding: '24px 20px', flex: 1 }}>
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

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

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

  return (
    <>
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
        @media (min-width: 769px) {
          .header-mobile-actions {
            display: none !important;
          }
        }
      `}</style>

      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          borderBottom: '1px solid var(--color-border-hairline)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.95)',
        }}
      >
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
          {/* Left: Logo */}
          <div style={{ flexShrink: 0 }}>
            <HeaderLogo />
          </div>

          {/* Centre: Desktop navigation */}
          <div className="header-desktop-nav" style={{ flex: 1 }}>
            <DesktopNav currentPath={pathname} />
          </div>

          {/* Right: Desktop search — now SearchBarCompact */}
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
             * SR-04: Replace placeholder handleSearchClick with SearchBarCompact.
             * SearchBarCompact renders its own trigger button (the search icon)
             * and the overlay — no wrapper button needed here.
             */}
            <SearchBarCompact />
          </div>

          {/* Right: Mobile actions — search + hamburger */}
          <div
            className="header-mobile-actions"
            style={{
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            {/*
             * SR-04: SearchBarCompact on mobile opens the full overlay.
             * Same component as desktop — the overlay covers the full screen.
             */}
            <SearchBarCompact />

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

        <style>{`
          @media (max-width: 768px) {
            .header-inner {
              height: 56px !important;
              padding: 0 20px !important;
            }
          }
        `}</style>
      </header>

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