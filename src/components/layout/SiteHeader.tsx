'use client'

/*
 * SiteHeader — Header swap integration component.
 *
 * MPD Task L-06:
 *   "Render <Header> / <HeaderCompact> (switching via useStickyHeader),
 *   {children}, <Footer>. Add <meta charset>, <meta viewport> for mobile."
 *
 * This component is specifically responsible for the header swap logic —
 * it is the single place in the codebase that decides which header
 * variant is visible at any given scroll position.
 *
 * SEPARATION OF CONCERNS:
 *   useStickyHeader (L-04) → determines WHEN to swap (scroll threshold)
 *   Header (L-02)          → full header — shown at top of page
 *   HeaderCompact (L-03)   → compact header — shown after 80px scroll
 *   SiteHeader (L-06)      → orchestrates the swap between L-02 and L-03
 *
 * WHY A SEPARATE COMPONENT (not inline in layout.tsx):
 *   The root layout.tsx (next task, also L-06 in MPD) is a React Server
 *   Component. Server Components cannot use hooks or client-side state.
 *   useStickyHeader requires useEffect and useState, making it a client
 *   concern. By extracting the swap logic into SiteHeader ('use client'),
 *   the root layout remains a Server Component and only the header
 *   boundary opts into client rendering.
 *
 *   This follows Next.js App Router best practice:
 *   "Move 'use client' to leaf components" — keep the client boundary
 *   as small and low in the tree as possible.
 *
 * ONLY ONE HEADER IS RENDERED AT A TIME:
 *   The component conditionally renders either Header or HeaderCompact
 *   based on isSticky. Both are never in the DOM simultaneously.
 *   This prevents duplicate landmark regions, duplicate IDs, and
 *   duplicate event listeners.
 *
 * ANIMATION PRESERVATION:
 *   HeaderCompact (L-03) applies the compact-header-enter @keyframes
 *   animation on its own mount. Because this component unmounts Header
 *   and mounts HeaderCompact (not shows/hides via CSS), the animation
 *   fires naturally on every transition from non-sticky → sticky.
 *   No additional animation logic is needed here.
 *
 * HYDRATION:
 *   useStickyHeader initialises with isSticky: false — the same value
 *   the server would render. Header (L-02) is always the server-rendered
 *   output. On the client, if the page loads mid-scroll (e.g. browser
 *   back/forward), useStickyHeader reads the real scrollY on mount and
 *   triggers a single state update to show HeaderCompact if needed.
 *   This causes a brief flash of Header → HeaderCompact on page restore,
 *   which is acceptable and consistent with the server-render contract.
 *   No hydration mismatch occurs.
 *
 * THRESHOLD:
 *   80px per MPD L-03: "Appears after 80px scroll via useStickyHeader hook."
 *   The threshold is passed explicitly (not relying on the hook default)
 *   so the value is visible and auditable at the call site.
 *
 * USAGE (in root layout.tsx — next task):
 *   import SiteHeader from '@/components/layout/SiteHeader'
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="en">
 *         <body>
 *           <SiteHeader />
 *           {children}
 *           <Footer />
 *         </body>
 *       </html>
 *     )
 *   }
 */

import { useStickyHeader } from '@/hooks/useStickyHeader'
import Header from '@/components/layout/Header'
import HeaderCompact from '@/components/layout/HeaderCompact'

// ---------------------------------------------------------------------------
// SiteHeader Component
// ---------------------------------------------------------------------------

export default function SiteHeader() {
  /*
   * useStickyHeader — returns { isSticky, scrollY }.
   *
   * threshold: 80 — per MPD L-03 specification.
   * Passed explicitly so the value is visible at the call site.
   *
   * isSticky: false → window.scrollY <= 80 → render Header (L-02)
   * isSticky: true  → window.scrollY >  80 → render HeaderCompact (L-03)
   */
  const { isSticky } = useStickyHeader({ threshold: 80 })

  /*
   * Conditional render — only one header in the DOM at any time.
   *
   * When isSticky transitions false → true:
   *   Header unmounts, HeaderCompact mounts.
   *   HeaderCompact's compact-header-enter animation fires on mount.
   *
   * When isSticky transitions true → false:
   *   HeaderCompact unmounts, Header mounts.
   *   Header renders immediately at its sticky top:0 position.
   *   No exit animation on HeaderCompact — instant removal is correct
   *   because the full Header's appearance signals "back at top" clearly.
   */
  if (isSticky) {
    return <HeaderCompact />
  }

  return <Header />
}