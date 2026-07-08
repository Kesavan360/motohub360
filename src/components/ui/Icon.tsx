'use client'

/*
 * Icon — Inline SVG icon lookup component.
 *
 * MPD Section 6, Icons:
 *   Style: thin-stroke (1.5px), geometric, rounded line-caps —
 *   automotive instrument-cluster feel, not playful/rounded-filled.
 *   Sizing: 16px (inline/body), 20px (buttons/nav, default),
 *           24px (feature cards), 32px (empty states).
 *   Color: ink-secondary by default, shifts to brand accent on
 *   hover/active/selected — applied via className from the parent.
 *
 * MPD Task D-08:
 *   "A component that accepts an icon name string and renders the
 *   corresponding SVG inline. Build the lookup map for the icon set."
 *
 * MPD Component Library:
 *   Icon | Accepts icon name string, size prop
 *
 * USAGE:
 *   <Icon name="search" />
 *   <Icon name="arrow-right" size={16} />
 *   <Icon name="heart" size={24} strokeWidth={1.5} className="text-accent" />
 *   <Icon name="share" title="Share this bike" />
 *
 * ACCESSIBILITY:
 *   - No title prop → aria-hidden="true" (decorative, parent provides context)
 *   - title prop present → role="img" + aria-label={title} (standalone icon)
 *
 * ALL PATHS:
 *   Pure geometric SVG paths drawn on a 24×24 viewBox.
 *   strokeLinecap="round" and strokeLinejoin="round" on all paths.
 *   fill="none" on all icons — stroke-only per Design System direction.
 *   stroke="currentColor" — color controlled entirely by CSS color property.
 *   strokeWidth is a prop (default 1.75) so callers can adjust weight.
 */

import { forwardRef, type SVGProps } from 'react'

// ---------------------------------------------------------------------------
// IconName — strongly typed union of all available icon identifiers.
// Add new icon names here when new icons are added to ICON_PATHS below.
// ---------------------------------------------------------------------------

export type IconName =
  | 'search'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-up'
  | 'share'
  | 'download'
  | 'heart'
  | 'heart-filled'
  | 'menu'
  | 'close'
  | 'filter'
  | 'play'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'check'
  | 'clock'
  | 'rotate-360'
  | 'image'
  | 'video'
  | 'eye'
  | 'upload'
  | 'link-external'
  | 'info'
  | 'warning'
  | 'motorcycle'

// ---------------------------------------------------------------------------
// IconProps
// ---------------------------------------------------------------------------

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /*
   * name — icon identifier. Must be a valid IconName.
   * TypeScript will error if an unrecognised name is passed.
   */
  name: IconName

  /*
   * size — width and height in px. Applied to both dimensions.
   * Default: 20 — matches buttons/nav usage per MPD Section 6.
   *
   * Recommended values per MPD:
   *   16 — inline/body text
   *   20 — buttons, nav (default)
   *   24 — feature cards
   *   32 — empty states
   */
  size?: number

  /*
   * strokeWidth — SVG stroke weight.
   * Default: 1.75 — slightly heavier than the MPD's 1.5px spec so
   * icons remain crisp at smaller sizes on high-density displays.
   * Pass 1.5 for large display contexts (size ≥ 24).
   */
  strokeWidth?: number

  /*
   * title — accessible label for standalone icons.
   * When provided: role="img" + aria-label={title}.
   * When absent: aria-hidden="true" (decorative — parent provides context).
   */
  title?: string

  /*
   * className — Tailwind classes for color, margin, etc.
   * The icon uses currentColor so text-* classes control the stroke color.
   * Example: className="text-ink-secondary" or className="text-accent"
   */
  className?: string
}

// ---------------------------------------------------------------------------
// ICON_PATHS — SVG path data keyed by IconName.
//
// All paths drawn on a 24×24 viewBox.
// Each value is a render function that receives strokeWidth so individual
// paths can reference it where needed (e.g. polylines, circles).
// ---------------------------------------------------------------------------

type PathRenderer = (strokeWidth: number) => React.ReactNode

const ICON_PATHS: Record<IconName, PathRenderer> = {

  /* ── Navigation & UI ─────────────────────────────────────────────── */

  search: () => (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" />
    </>
  ),

  'arrow-right': () => (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="14 5 21 12 14 19" />
    </>
  ),

  'arrow-left': () => (
    <>
      <line x1="21" y1="12" x2="3" y2="12" />
      <polyline points="10 19 3 12 10 5" />
    </>
  ),

  'chevron-right': () => (
    <polyline points="9 18 15 12 9 6" />
  ),

  'chevron-left': () => (
    <polyline points="15 18 9 12 15 6" />
  ),

  'chevron-down': () => (
    <polyline points="6 9 12 15 18 9" />
  ),

  'chevron-up': () => (
    <polyline points="18 15 12 9 6 15" />
  ),

  menu: () => (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),

  close: () => (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),

  plus: () => (
    <>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </>
  ),

  check: () => (
    <polyline points="20 6 9 17 4 12" />
  ),

  filter: () => (
    <>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </>
  ),

  /* ── Actions ────────────────────────────────────────────────────── */

  share: () => (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </>
  ),

  download: () => (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),

  upload: () => (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),

  heart: () => (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),

  /*
   * heart-filled — used when a bike is saved (MobileActionBar toggle).
   * Fill is set to currentColor on the path only — not the SVG element.
   */
  'heart-filled': () => (
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill="currentColor"
      stroke="currentColor"
    />
  ),

  play: () => (
    <polygon points="5 3 19 12 5 21 5 3" />
  ),

  edit: () => (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),

  trash: () => (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),

  /* ── Media ──────────────────────────────────────────────────────── */

  'rotate-360': () => (
    <>
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 6l-2 2 2 2" />
      <ellipse cx="12" cy="19" rx="8" ry="2.5" />
      <path d="M4 19c0-1.4 3.6-2.5 8-2.5s8 1.1 8 2.5" />
    </>
  ),

  image: () => (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),

  video: () => (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),

  eye: () => (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  /* ── Time & Status ──────────────────────────────────────────────── */

  clock: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </>
  ),

  info: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),

  warning: () => (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),

  /* ── Links ──────────────────────────────────────────────────────── */

  'link-external': () => (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),

  /* ── Brand-specific ─────────────────────────────────────────────── */

  /*
   * motorcycle — used in empty states and category illustrations.
   * Simplified geometric representation — not a detailed illustration.
   */
  motorcycle: () => (
    <>
      {/* Front wheel */}
      <circle cx="17.5" cy="16.5" r="3.5" />
      {/* Rear wheel */}
      <circle cx="6.5" cy="16.5" r="3.5" />
      {/* Body */}
      <path d="M6.5 16.5h11" />
      <path d="M10 13l2-5h3l2 3" />
      <path d="M8 13h8" />
      {/* Handlebar */}
      <path d="M15 8h3v2" />
      {/* Seat */}
      <path d="M9 13l1-3" />
    </>
  ),
}

// ---------------------------------------------------------------------------
// Icon Component
// ---------------------------------------------------------------------------

const Icon = forwardRef<SVGSVGElement, IconProps>(
  function Icon(
    {
      name,
      size = 20,
      strokeWidth = 1.75,
      className = '',
      title,
      style,
      ...rest
    },
    ref,
  ) {
    const paths = ICON_PATHS[name]

    /*
     * Safety guard — if an unknown icon name is somehow passed at runtime
     * (e.g. from a DB value), render nothing rather than throwing.
     * TypeScript will catch this at compile time, but runtime guard
     * prevents crashes in edge cases.
     */
    if (!paths) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Icon] Unknown icon name: "${name}"`)
      }
      return null
    }

    /*
     * Accessibility:
     *   With title → role="img" + aria-label — standalone meaningful icon.
     *   Without title → aria-hidden="true" — decorative, parent has context.
     */
    const a11yProps = title
      ? { role: 'img' as const, 'aria-label': title }
      : { 'aria-hidden': true as const, focusable: 'false' as const }

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...a11yProps}
        {...rest}
      >
        {/*
         * Optional <title> element for screen readers.
         * Only rendered when title prop is provided.
         * Provides accessible name in SVG context.
         */}
        {title && <title>{title}</title>}
        {paths(strokeWidth)}
      </svg>
    )
  },
)

Icon.displayName = 'Icon'

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default Icon