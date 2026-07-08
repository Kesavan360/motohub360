'use client'

/*
 * Button — Universal button primitive.
 *
 * MPD Section 6, Buttons:
 *   Five variants: Primary, Accent, Secondary, Ghost, Icon
 *   Sizing: 48px desktop / 44px mobile / 24px horizontal padding
 *   States: hover (4% darken + 1px shadow), active (scale 0.98),
 *           disabled (ink-tertiary, no fill), focus (shadow-focus ring)
 *   Never: gradients, 3D shadow buttons
 *
 * MPD Component Library:
 *   Button | Primary, Accent, Secondary, Ghost, Icon
 *
 * Note on MPD variant naming vs extended requirements:
 *   The MPD defines: Primary, Accent, Secondary, Ghost, Icon.
 *   This implementation adds:
 *     - 'destructive' (admin delete actions — A-06, A-07)
 *     - 'link'        (inline text navigation — breadcrumb, "View all")
 *   These additions are consistent with the MPD design language
 *   and required by admin panel tasks A-06 and A-07.
 *
 * USAGE:
 *   <Button variant="primary">Save</Button>
 *   <Button variant="accent" size="lg">Publish</Button>
 *   <Button variant="ghost" leftIcon="arrow-right">View all</Button>
 *   <Button variant="icon" aria-label="Share"><Icon name="share" /></Button>
 *   <Button variant="primary" loading>Saving...</Button>
 *   <Button variant="secondary" fullWidth>Filter</Button>
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * ButtonVariant — visual style of the button.
 *
 * primary     → ink-primary fill, white text — main confirm actions
 * accent      → --color-accent fill, white text — bike-page CTAs
 * secondary   → border-hairline outline, transparent fill — filters
 * ghost       → no border, no fill, ink-secondary text — nav links
 * icon        → circular 40×40, surface-sunken fill — save/share/download
 * destructive → red-toned fill — admin delete actions
 * link        → no chrome, accent-colored underline on hover
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'ghost'
  | 'icon'
  | 'destructive'
  | 'link'

/*
 * ButtonSize — height and padding scale.
 *
 * sm → 36px height / 16px horizontal padding
 * md → 44px height / 24px horizontal padding (mobile default per MPD)
 * lg → 48px height / 24px horizontal padding (desktop default per MPD)
 *
 * The icon variant ignores size height in favour of fixed 40×40px.
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /*
   * variant — visual style. Default: 'primary'
   */
  variant?: ButtonVariant

  /*
   * size — height and padding scale. Default: 'md'
   */
  size?: ButtonSize

  /*
   * loading — shows a spinner and disables interaction.
   * The button text is still rendered (preserves button width)
   * but reduced to 40% opacity while the spinner overlays it.
   * Default: false
   */
  loading?: boolean

  /*
   * fullWidth — stretches button to 100% container width.
   * Default: false
   */
  fullWidth?: boolean

  /*
   * leftIcon — ReactNode rendered to the left of children.
   * Use the Icon component (D-08) or any inline SVG.
   * Example: leftIcon={<Icon name="arrow-right" size={16} />}
   */
  leftIcon?: ReactNode

  /*
   * rightIcon — ReactNode rendered to the right of children.
   */
  rightIcon?: ReactNode

  /*
   * children — button label content.
   * Required for all variants except 'icon' (which uses aria-label).
   */
  children?: ReactNode
}

// ---------------------------------------------------------------------------
// Style configuration
// All values use Design System tokens from D-01 / S-09.
// Inline styles are used where Tailwind dynamic class purging would
// remove the class. Static variant classes are safe to use with Tailwind.
// ---------------------------------------------------------------------------

/*
 * Base classes shared across all variants.
 * - inline-flex + items-center + justify-center: consistent label alignment
 * - gap-2: 8px icon-to-label gap (space-2 from MPD spacing system)
 * - font-body: body typeface for button labels
 * - font-medium: 500 weight — readable at small sizes
 * - tracking-tight: slight tightening for button-sized text
 * - cursor-pointer / cursor-not-allowed: UX clarity on state
 * - select-none: prevents accidental text selection on click
 * - transition-premium: 280ms ease from D-04
 * - focus-visible:shadow-focus: accent-adaptive focus ring from D-01
 * - active:scale-98: scale 0.98 on press per MPD
 */
const BASE =
  'inline-flex items-center justify-center gap-2 font-body font-medium ' +
  'tracking-tight select-none cursor-pointer ' +
  'transition-premium ' +
  'focus-visible:outline-none focus-visible:shadow-focus ' +
  'disabled:cursor-not-allowed ' +
  'active:scale-[0.98]'

/*
 * Variant style map.
 * Each entry provides Tailwind classes for the visual style.
 * Hover darken is approximated via Tailwind opacity and brightness utilities.
 */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  /*
   * Primary — ink-primary fill, white text.
   * Hover: slight brightness increase to suggest a 4% lighten.
   * Disabled: ink-tertiary text, surface-sunken background.
   */
  primary:
    'bg-ink-primary text-white rounded-r-full ' +
    'hover:brightness-110 hover:shadow-md ' +
    'disabled:bg-surface-sunken disabled:text-ink-tertiary disabled:shadow-none',

  /*
   * Accent — dynamic --color-accent fill, white text.
   * Uses inline style for background (CSS var — Tailwind cannot purge-safe this).
   * Hover: slight brightness increase.
   * Disabled: falls back to surface-sunken / ink-tertiary.
   */
  accent:
    'text-white rounded-r-full ' +
    'hover:brightness-110 hover:shadow-md ' +
    'disabled:bg-surface-sunken disabled:text-ink-tertiary disabled:shadow-none',

  /*
   * Secondary — 1px border-hairline, transparent fill, ink-primary text.
   * Hover: shadow-md lift + ink-primary border darkens to ink-secondary.
   */
  secondary:
    'bg-transparent text-ink-primary rounded-r-full ' +
    'border border-border-hairline ' +
    'hover:shadow-md hover:border-ink-secondary ' +
    'disabled:text-ink-tertiary disabled:border-border-hairline disabled:shadow-none',

  /*
   * Ghost — no border, no fill, ink-secondary text.
   * Hover: ink-primary text (darkens naturally).
   * Used for nav links, breadcrumb, "View all" links.
   */
  ghost:
    'bg-transparent text-ink-secondary rounded-r-sm ' +
    'hover:text-ink-primary ' +
    'disabled:text-ink-tertiary',

  /*
   * Icon — circular 40×40, surface-sunken fill.
   * Size prop is ignored — always 40×40px for tap target compliance.
   * Hover: shadow-md lift.
   * Used for: Save (heart), Share, Download Brochure in MobileActionBar.
   */
  icon:
    'bg-surface-sunken text-ink-secondary rounded-r-full ' +
    '!w-10 !h-10 !p-0 ' +
    'hover:shadow-md hover:text-ink-primary ' +
    'disabled:text-ink-tertiary disabled:shadow-none',

  /*
   * Destructive — red-toned fill for admin delete actions.
   * Uses a fixed destructive red consistent with the neutral premium palette.
   * Only used in admin panel contexts (A-06, A-07).
   */
  destructive:
    'bg-[#C8102E] text-white rounded-r-full ' +
    'hover:brightness-110 hover:shadow-md ' +
    'disabled:bg-surface-sunken disabled:text-ink-tertiary disabled:shadow-none',

  /*
   * Link — no chrome, text only, accent underline on hover.
   * Behaves like an anchor visually but submits forms / triggers actions.
   * padding: 0, height: auto — breaks out of the normal size scale.
   */
  link:
    'bg-transparent text-ink-secondary rounded-none ' +
    '!h-auto !px-0 !py-0 ' +
    'hover:text-ink-primary hover:underline ' +
    'underline-offset-4 decoration-1 ' +
    'disabled:text-ink-tertiary disabled:no-underline',
}

/*
 * Size style map.
 * Height and horizontal padding per MPD Section 6.
 * Vertical padding is derived from height — buttons use fixed heights
 * with flex alignment rather than padding-only height.
 */
const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'h-9 px-space-3 text-body-sm',   // 36px height / 16px padding
  md: 'h-11 px-space-4 text-body-md',  // 44px height / 24px padding (mobile)
  lg: 'h-12 px-space-4 text-body-md',  // 48px height / 24px padding (desktop)
}

// ---------------------------------------------------------------------------
// Spinner — inline SVG loading indicator
// Shown when loading={true}. Positioned absolutely over button content.
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        animation: 'spin 0.75s linear infinite',
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      {/* Track */}
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      {/* Indicator — 25% arc */}
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Button Component
// ---------------------------------------------------------------------------

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      type = 'button',
      style,
      ...rest
    },
    ref,
  ) {
    const isDisabled = disabled || loading

    /*
     * Compose class string.
     * Order: base → variant → size → fullWidth → caller className.
     * The icon variant uses !w-10 !h-10 !p-0 overrides so size classes
     * are still included in the string but overridden by specificity.
     */
    const classes = [
      BASE,
      VARIANT_STYLES[variant],
      variant !== 'link' && variant !== 'icon' ? SIZE_STYLES[size] : '',
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    /*
     * Accent variant requires inline background-color using --color-accent
     * because Tailwind cannot safely generate dynamic CSS variable classes.
     * All other inline styles are merged with caller-provided style prop.
     */
    const inlineStyle =
      variant === 'accent'
        ? {
            backgroundColor: 'var(--color-accent)',
            ...style,
          }
        : style

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={classes}
        style={inlineStyle}
        {...rest}
      >
        {/*
         * Loading state: show spinner on the left, dim the label.
         * The label content remains to preserve button width during load.
         */}
        {loading && (
          <span aria-hidden="true">
            <Spinner />
          </span>
        )}

        {/* Left icon — hidden during loading to avoid double-icon appearance */}
        {!loading && leftIcon && (
          <span aria-hidden="true" className="shrink-0">
            {leftIcon}
          </span>
        )}

        {/*
         * Label — dimmed when loading (not hidden, preserves button width).
         * Screen readers still read the label during loading state.
         */}
        {children && (
          <span style={{ opacity: loading ? 0.4 : 1 }}>
            {children}
          </span>
        )}

        {/* Right icon — hidden during loading */}
        {!loading && rightIcon && (
          <span aria-hidden="true" className="shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button