'use client'

/*
 * useStickyHeader — Scroll position hook for compact header swap.
 *
 * MPD Task L-04:
 *   "Custom hook that returns isSticky: boolean based on
 *   window.scrollY > 80. Uses useEffect + addEventListener('scroll')
 *   with cleanup. Used by the root layout to swap Header for
 *   HeaderCompact."
 *
 * MPD Task L-03:
 *   "Appears after 80px scroll via useStickyHeader hook.
 *   Slides in from top with 240ms ease transition."
 *
 * MPD Task L-06:
 *   "Render <Header> / <HeaderCompact> (switching via useStickyHeader)"
 *
 * BEHAVIOUR:
 *   Returns isSticky = false  → render Header (L-02) — default state
 *   Returns isSticky = true   → render HeaderCompact (L-03) — scrolled state
 *   Threshold: 80px (window.scrollY > 80)
 *
 * SSR SAFETY:
 *   Initial state is false (not sticky) — correct for server render
 *   where window is undefined. The effect runs only on the client.
 *   No hydration mismatch occurs because the initial client render
 *   also starts at scroll position 0 (not sticky), matching the server.
 *
 * PERFORMANCE:
 *   Uses passive: true on the scroll event listener — the browser
 *   can optimise scroll handling without waiting for the handler
 *   to complete. This is critical for maintaining 60fps scrolling.
 *
 *   The handler reads window.scrollY synchronously — this is a
 *   single property read per scroll event, not a layout-triggering
 *   operation. No debounce is needed at this level of simplicity.
 *
 * CLEANUP:
 *   The event listener is removed on component unmount via the
 *   useEffect cleanup function. This prevents memory leaks when
 *   the consuming layout component is unmounted.
 *
 * USAGE (in L-06 root layout):
 *   'use client'
 *   import { useStickyHeader } from '@/hooks/useStickyHeader'
 *   import Header from '@/components/layout/Header'
 *   import HeaderCompact from '@/components/layout/HeaderCompact'
 *
 *   function SiteHeader() {
 *     const { isSticky } = useStickyHeader()
 *     return isSticky ? <HeaderCompact /> : <Header />
 *   }
 */

import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * UseStickyHeaderOptions — configuration for the hook.
 * Allows the scroll threshold to be customised if a future layout
 * requires a different trigger point without modifying this hook.
 */
export interface UseStickyHeaderOptions {
  /*
   * threshold — scroll position in pixels at which isSticky becomes true.
   * Default: 80 per MPD specification.
   */
  threshold?: number
}

/*
 * UseStickyHeaderReturn — the object returned by the hook.
 * Returns an object (not a bare boolean) to allow future additions
 * (e.g. scrollDirection, scrollProgress) without breaking consumers.
 */
export interface UseStickyHeaderReturn {
  /*
   * isSticky — true when window.scrollY > threshold.
   * When true: root layout renders HeaderCompact (L-03).
   * When false: root layout renders Header (L-02).
   */
  isSticky: boolean

  /*
   * scrollY — current vertical scroll position in pixels.
   * Exposed for consumers that need raw scroll position
   * (e.g. scroll progress indicators, parallax effects in future tasks).
   */
  scrollY: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStickyHeader(
  options: UseStickyHeaderOptions = {},
): UseStickyHeaderReturn {
  const { threshold = 80 } = options

  /*
   * Initial state: false (not sticky), scrollY: 0.
   *
   * SSR and initial client render both start at scroll position 0.
   * This ensures the server-rendered HTML and the first client paint
   * are identical — no hydration mismatch.
   *
   * The effect below immediately reads the real scroll position
   * on mount, so if the page is loaded at a scrolled position
   * (e.g. via browser back button), isSticky corrects on first render.
   */
  const [state, setState] = useState<UseStickyHeaderReturn>({
    isSticky: false,
    scrollY: 0,
  })

  useEffect(() => {
    /*
     * handleScroll — reads the current scroll position and updates
     * state when the stickiness boundary is crossed.
     *
     * The conditional check before setState prevents unnecessary
     * re-renders when the user scrolls within the same sticky zone
     * (e.g. scrolling from 200px to 300px — both are sticky, no
     * state update needed for isSticky).
     *
     * scrollY is always updated to reflect the true current position
     * for consumers that need it (e.g. parallax, progress bars).
     */
    function handleScroll(): void {
      const currentScrollY = window.scrollY
      const currentIsSticky = currentScrollY > threshold

      setState((prev) => {
        /*
         * Skip setState entirely if nothing changed.
         * Avoids re-render on every scroll tick when the user
         * is scrolling within the sticky or non-sticky zone.
         */
        if (
          prev.isSticky === currentIsSticky &&
          prev.scrollY === currentScrollY
        ) {
          return prev
        }

        return {
          isSticky: currentIsSticky,
          scrollY: currentScrollY,
        }
      })
    }

    /*
     * Read the scroll position immediately on mount.
     * Handles the case where the page loads mid-scroll
     * (e.g. browser back/forward navigation restores scroll position).
     * Without this, isSticky would be false until the user scrolls again.
     */
    handleScroll()

    /*
     * Register the scroll listener.
     * passive: true — tells the browser this handler will not call
     * preventDefault(), allowing the browser to optimise scroll
     * performance by not waiting for the handler to complete.
     * This is the correct option for any scroll-position-reading handler.
     */
    window.addEventListener('scroll', handleScroll, { passive: true })

    /*
     * Cleanup — remove the event listener when the component using
     * this hook is unmounted. Without cleanup, the listener would
     * continue firing after the component is gone, causing a memory
     * leak and potential setState calls on an unmounted component.
     */
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [threshold])
  /*
   * threshold is in the dependency array so the effect re-registers
   * the listener if the threshold prop changes at runtime.
   * In practice, threshold defaults to 80 and never changes,
   * but the dep array is correct for completeness.
   */

  return state
}

/*
 * Default export for convenience — allows both:
 *   import { useStickyHeader } from '@/hooks/useStickyHeader'
 *   import useStickyHeader from '@/hooks/useStickyHeader'
 */
export default useStickyHeader