'use client'

/*
 * useScrollReveal — IntersectionObserver scroll reveal hook.
 *
 * MPD Task H-09:
 *   "Custom hook wrapping IntersectionObserver. Accepts a ref and
 *   returns isVisible: boolean. Sets once: true — animation fires
 *   once per element, not every time it re-enters the viewport."
 *
 * MPD Task H-08:
 *   "Add fade-slide-up animation to Brand logo section, Category
 *   pills, and Price pills sections — triggered as they scroll into
 *   viewport using IntersectionObserver in a useScrollReveal hook.
 *   Stagger delay 60ms between brand logo chips."
 *
 * MPD Section 6, Animations:
 *   "Scroll reveal — Sections fade + 16px slide-up as they enter
 *   viewport, staggered slightly for grouped elements (e.g. feature
 *   icons). 400ms, triggered once per element."
 *
 * BEHAVIOUR:
 *   1. The consuming component adds className="will-animate" to
 *      the element (defined in D-04 globals.css).
 *   2. This hook observes the element via IntersectionObserver.
 *   3. When the element enters the viewport, isVisible becomes true.
 *   4. The consuming component adds className="is-visible" when
 *      isVisible is true, triggering the fade-slide-up animation.
 *   5. The observer disconnects after the first intersection (once: true).
 *      The element stays visible — it never re-animates on scroll.
 *
 * SSR SAFETY:
 *   IntersectionObserver is not available on the server.
 *   Initial state: isVisible = false (hidden).
 *   The effect only runs on the client — no hydration mismatch
 *   because the server also renders with isVisible = false
 *   (will-animate class applied, element invisible until JS runs).
 *
 * REDUCED MOTION:
 *   When prefers-reduced-motion is set, the hook still sets isVisible
 *   to true (content becomes visible) but the CSS animation in D-03
 *   globally disables the animation-duration — content appears
 *   instantly without motion. No additional logic needed here.
 *
 * USAGE — single element:
 *   const { ref, isVisible } = useScrollReveal()
 *   <div ref={ref} className={`will-animate${isVisible ? ' is-visible' : ''}`}>
 *     content
 *   </div>
 *
 * USAGE — with custom threshold and margin:
 *   const { ref, isVisible } = useScrollReveal({
 *     threshold: 0.2,       // 20% of element must be visible
 *     rootMargin: '-50px',  // trigger 50px before element reaches viewport
 *   })
 *
 * WHY 'use client':
 *   useEffect and useRef require the client environment.
 *   IntersectionObserver is a browser API.
 */

import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseScrollRevealOptions {
  /*
   * threshold — fraction of the element that must be visible
   * before isVisible becomes true.
   * Range: 0.0 (any pixel visible) to 1.0 (fully visible).
   * Default: 0.1 — triggers when 10% of the element is in view.
   * This ensures the animation starts when the element is just
   * entering the viewport, not when it is fully visible.
   */
  threshold?: number

  /*
   * rootMargin — margin around the root (viewport) for intersection.
   * Negative values shrink the intersection area (trigger later).
   * Positive values expand it (trigger earlier).
   * Default: '0px 0px -40px 0px' — triggers 40px before the element
   * reaches the bottom of the viewport. Creates a comfortable
   * reveal that feels like content is "arriving" as the user scrolls.
   * CSS margin syntax: top right bottom left.
   */
  rootMargin?: string

  /*
   * once — whether the animation fires only once.
   * Default: true — per MPD H-09 "fires once per element".
   * Set false only for elements that should re-animate on every
   * viewport entry (not used in MotoHub360 V1).
   */
  once?: boolean
}

export interface UseScrollRevealReturn {
  /*
   * ref — attach to the DOM element to observe.
   * Must be a RefObject<Element | null> — compatible with all
   * HTML element types via the generic parameter.
   */
  ref: React.RefObject<HTMLElement | null>

  /*
   * isVisible — true when the element has entered the viewport.
   * When once=true (default): stays true after first intersection.
   * Use this to conditionally add the 'is-visible' class.
   */
  isVisible: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScrollReveal(
  options: UseScrollRevealOptions = {},
): UseScrollRevealReturn {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -40px 0px',
    once = true,
  } = options

  const ref = useRef<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    /*
     * SSR guard — IntersectionObserver is not available server-side.
     * Also guards against environments where it may not be supported.
     */
    if (typeof IntersectionObserver === 'undefined') {
      /*
       * Fallback: make all elements visible immediately.
       * Ensures content is accessible even without IntersectionObserver.
       */
      setIsVisible(true)
      return
    }

    const element = ref.current

    /*
     * Guard: if no element is attached, do nothing.
     * This can happen if the component unmounts before the effect runs.
     */
    if (!element) {
      return
    }

    /*
     * Create the IntersectionObserver instance.
     *
     * callback — fires when the element's intersection ratio changes.
     * entry.isIntersecting — true when the element is in view
     * at or above the threshold.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (entry.isIntersecting) {
          setIsVisible(true)

          /*
           * once=true: disconnect after first intersection.
           * The element stays visible — observer is no longer needed.
           * This is the most performant approach — the observer
           * is garbage-collected after the first reveal.
           */
          if (once) {
            observer.disconnect()
          }
        } else if (!once) {
          /*
           * once=false: reset visibility when element leaves viewport.
           * Not used in V1 but supported for forward-compatibility.
           */
          setIsVisible(false)
        }
      },
      {
        threshold,
        rootMargin,
        /*
         * root: null — use the viewport as the intersection root.
         * This is the standard behaviour for scroll-reveal effects.
         */
        root: null,
      },
    )

    observer.observe(element)

    /*
     * Cleanup — disconnect the observer when the component unmounts
     * or when the effect dependencies change.
     * Prevents memory leaks and stale observer references.
     */
    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, once])

  return { ref, isVisible }
}

/*
 * Default export for convenience.
 * Allows both:
 *   import { useScrollReveal } from '@/hooks/useScrollReveal'
 *   import useScrollReveal from '@/hooks/useScrollReveal'
 */
export default useScrollReveal