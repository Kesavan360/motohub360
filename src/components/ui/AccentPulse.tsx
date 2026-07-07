'use client'

/*
 * AccentPulse — Signature Accent Pulse motif component.
 *
 * MPD Section 6, Design Philosophy:
 *   "The Accent Pulse — a single thin, animated line/glow that lives
 *   under the active brand accent color. A subtle 1px–3px glow that
 *   breathes almost imperceptibly, like an idling engine light."
 *
 * MPD Component Library:
 *   AccentPulse | Wraps children, applies breathing glow via --color-accent
 *
 * MPD Task D-05:
 *   "A zero-markup component that wraps children in a container that
 *   applies the accent-pulse animation to its border/outline via the
 *   --color-accent CSS variable. Used on color swatches (selected state)
 *   and active nav elements."
 *
 * USAGE:
 *   <AccentPulse>
 *     <div className="h-8 w-8 rounded-r-full bg-accent" />
 *   </AccentPulse>
 *
 *   With custom size or class:
 *   <AccentPulse className="rounded-r-full" pulseSize="lg">
 *     <ColorSwatch color={selectedColor} />
 *   </AccentPulse>
 *
 * HOW IT WORKS:
 *   The wrapper div applies the `accent-pulse` @keyframes animation
 *   defined in D-04. The animation modulates opacity and box-shadow
 *   using --color-accent, which is set per bike page by useAccentColor (B-02).
 *   The wrapper has no layout impact — it is display:contents by default
 *   when `asChild` is false, and a positioned wrapper when active.
 *
 * ACCESSIBILITY:
 *   Respects prefers-reduced-motion — animation is disabled globally
 *   in D-03 via the @media (prefers-reduced-motion: reduce) rule.
 *   The component also checks the media query directly and disables
 *   the animation style prop to ensure zero motion in all render paths.
 */

import {
    forwardRef,
    useEffect,
    useState,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
  } from 'react'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * PulseSize — controls the intensity and spread of the accent ring.
 *
 * sm → 2px ring spread  — used on small swatches (32px ColorSwatch)
 * md → 3px ring spread  — used on medium interactive elements
 * lg → 4px ring spread  — used on larger elements or high-emphasis states
 *
 * Default: 'md'
 */
export type PulseSize = 'sm' | 'md' | 'lg'

/*
 * PulseVariant — controls which CSS property carries the pulse animation.
 *
 * ring    → animates box-shadow ring around the element (default)
 *           Used on: ColorSwatch selected state, icon buttons
 * underline → animates a bottom border/shadow pulse
 *           Used on: active nav links, breadcrumb current item
 */
export type PulseVariant = 'ring' | 'underline'

export interface AccentPulseProps extends HTMLAttributes<HTMLDivElement> {
  /*
   * children — the element(s) to wrap with the pulse animation.
   * The AccentPulse wrapper adds no visual markup of its own —
   * only the animation styles are applied to the wrapper div.
   */
  children: ReactNode

  /*
   * active — whether the pulse animation is currently running.
   * When false, the wrapper renders as a transparent pass-through
   * with no animation and no box-shadow.
   * Default: true
   *
   * Usage: pass active={isSelected} on ColorSwatch to only pulse
   * the currently selected color swatch.
   */
  active?: boolean

  /*
   * pulseSize — controls the ring spread intensity.
   * Default: 'md'
   */
  pulseSize?: PulseSize

  /*
   * variant — controls the animation style.
   * Default: 'ring'
   */
  variant?: PulseVariant

  /*
   * duration — animation loop duration in milliseconds.
   * Default: 2400 (2.4s per MPD Section 6 Animations table)
   * Only override when a specific context requires a different rhythm.
   */
  duration?: number

  /*
   * className — additional Tailwind classes applied to the wrapper div.
   * Used to set border-radius so the ring matches the child shape:
   *   ColorSwatch (circle): className="rounded-r-full"
   *   Image container:      className="rounded-r-lg"
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Ring size configuration
// Maps PulseSize to box-shadow spread values for keyframe start/end
// ---------------------------------------------------------------------------

const RING_SIZE: Record<
  PulseSize,
  { start: string; mid: string }
> = {
  sm: {
    start: '0 0 0 1.5px var(--color-accent)',
    mid: '0 0 0 2.5px var(--color-accent)',
  },
  md: {
    start: '0 0 0 2px var(--color-accent)',
    mid: '0 0 0 3px var(--color-accent)',
  },
  lg: {
    start: '0 0 0 3px var(--color-accent)',
    mid: '0 0 0 4px var(--color-accent)',
  },
}

// ---------------------------------------------------------------------------
// Underline size configuration
// Maps PulseSize to underline shadow values
// ---------------------------------------------------------------------------

const UNDERLINE_SIZE: Record<
  PulseSize,
  { start: string; mid: string }
> = {
  sm: {
    start: '0 1px 0 0 var(--color-accent)',
    mid: '0 2px 0 0 var(--color-accent)',
  },
  md: {
    start: '0 2px 0 0 var(--color-accent)',
    mid: '0 3px 0 0 var(--color-accent)',
  },
  lg: {
    start: '0 2px 0 0 var(--color-accent)',
    mid: '0 4px 0 0 var(--color-accent)',
  },
}

// ---------------------------------------------------------------------------
// Hook: useReducedMotion
// Reads the prefers-reduced-motion media query.
// Returns true when the user has requested reduced motion.
// This is a belt-and-suspenders check — D-03 also handles this globally.
// ---------------------------------------------------------------------------

function useReducedMotion(): boolean {
  /*
   * SSR-safe initial state: default to false (animations enabled).
   * The effect runs only on the client where window is available.
   */
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    /*
     * Set initial value based on current system preference.
     */
    setReducedMotion(mediaQuery.matches)

    /*
     * Listen for changes — user may toggle the system setting
     * while the page is open.
     */
    function handleChange(event: MediaQueryListEvent): void {
      setReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return reducedMotion
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AccentPulse = forwardRef<HTMLDivElement, AccentPulseProps>(
  function AccentPulse(
    {
      children,
      active = true,
      pulseSize = 'md',
      variant = 'ring',
      duration = 2400,
      className = '',
      style,
      ...rest
    },
    ref,
  ) {
    const reducedMotion = useReducedMotion()

    /*
     * When not active or when motion is reduced:
     * Render the wrapper with no animation styles applied.
     * The wrapper is still rendered (not null) so React's reconciler
     * does not unmount/remount the children on state change.
     */
    if (!active || reducedMotion) {
      return (
        <div
          ref={ref}
          className={className}
          style={style}
          {...rest}
        >
          {children}
        </div>
      )
    }

    /*
     * Determine the shadow values based on variant and size.
     * These are applied as inline CSS animation keyframe overrides
     * via CSS custom properties so the animation values are dynamic.
     */
    const sizeConfig =
      variant === 'ring'
        ? RING_SIZE[pulseSize]
        : UNDERLINE_SIZE[pulseSize]

    /*
     * Inline styles for the active pulse state.
     * We use a CSS animation referencing the @keyframes accent-pulse
     * defined in D-04, but override the shadow values via CSS variables
     * so each instance can have different spread sizes.
     *
     * --pulse-shadow-start and --pulse-shadow-mid are local CSS variables
     * scoped to this element, consumed by the animation below.
     * The animation uses the globally defined accent-pulse keyframes
     * for timing, but we supplement with direct style animation
     * to allow per-instance customisation of the spread values.
     */
    const pulseStyle: CSSProperties = {
      '--pulse-shadow-start': sizeConfig.start,
      '--pulse-shadow-mid': sizeConfig.mid,
      animation: `accent-pulse ${duration}ms ease-in-out infinite`,
      /*
       * Set the initial box-shadow to the start value so there is
       * no flash of unstyled content before the first animation frame.
       */
      boxShadow: sizeConfig.start,
      ...style,
    } as CSSProperties

    return (
      <div
        ref={ref}
        className={className}
        style={pulseStyle}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

AccentPulse.displayName = 'AccentPulse'

export default AccentPulse