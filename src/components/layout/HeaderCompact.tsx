'use client'

/*
 * HeaderCompact — Sticky scroll variant of the site header.
 *
 * SR-04 change:
 *   Replace the placeholder handleSearchClick() console.log with
 *   the real <SearchBarCompact /> component.
 *
 * All other code is preserved exactly from L-03.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
// Mobile drawer data
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
        .compact-drawer-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .compact-drawer-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
          color: var(--color-ink-primary) !important;
        }

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

        @media (min-width: 769px) {
          .compact-mobile-actions {
            display: none !important;
          }
        }

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
          boxShadow: '0 4px 12px rgba(15,16,20,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255,255,255,0.97)',
        }}
      >
        <div
          className="compact-header-inner"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 32px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Left: Logo */}
          <div style={{ flexShrink: 0 }}>
            <CompactLogo />
          </div>

          {/* Right: Desktop search — SearchBarCompact */}
          <div
            className="compact-desktop-search"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {/*
             * SR-04: Replace placeholder handleSearchClick with SearchBarCompact.
             */}
            <SearchBarCompact />
          </div>

          {/* Right: Mobile actions */}
          <div
            className="compact-mobile-actions"
            style={{
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            {/*
             * SR-04: SearchBarCompact on mobile.
             */}
            <SearchBarCompact />

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