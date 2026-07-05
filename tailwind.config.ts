import type { Config } from 'tailwindcss'

/*
 * MotoHub360 — Tailwind CSS Configuration
 *
 * Maps the approved Design System (MPD Section 6) to Tailwind utility classes.
 *
 * ARCHITECTURE — two-layer token system:
 *
 *   Layer 1 — Tailwind config (this file, S-09):
 *     Registers token NAMES as Tailwind utility classes.
 *     Color and font tokens reference CSS custom properties (var(--...))
 *     so they resolve at runtime, not at build time.
 *
 *   Layer 2 — CSS custom properties (globals.css, D-01 + D-02):
 *     Defines the actual VALUES of those CSS custom properties.
 *     When D-01 sets --color-surface-base: #FAFAF9, every component
 *     using bg-surface-base automatically gets the correct color.
 *
 * This separation means the design tokens can be adjusted in one place
 * (globals.css) without touching component code or this config file.
 *
 * TAILWIND v3 vs v4:
 *   This config file is compatible with both Tailwind v3 and v4.
 *   In Tailwind v4, this file is auto-detected in the project root.
 *   If classes are not applying in v4, add @config "./tailwind.config.ts"
 *   to the top of src/app/globals.css (after the @import directive).
 *   The content array is included for v3 compatibility — v4 auto-detects
 *   template files so the array is ignored but harmless.
 */

const config: Config = {
  /*
   * CONTENT — template file paths for class detection.
   *
   * Tailwind scans these files for class names and includes only
   * the used classes in the production CSS bundle.
   *
   * Covers all Next.js App Router files under src/:
   *   - src/app/**   → pages, layouts, error/not-found boundaries
   *   - src/components/** → all UI, layout, bike, listing, admin components
   *
   * Note: Tailwind v4 auto-detects these paths. This array is kept for
   * v3 compatibility and explicitness.
   */
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      /*
       * ─────────────────────────────────────────────────────────────────
       * COLORS — MPD Section 6, Color Palette
       * ─────────────────────────────────────────────────────────────────
       *
       * All colors reference CSS custom properties defined in D-01.
       * This means color values live in globals.css, not here.
       *
       * Usage examples:
       *   bg-surface-base       → background: var(--color-surface-base)
       *   text-ink-primary      → color: var(--color-ink-primary)
       *   border-border-hairline → border-color: var(--color-border-hairline)
       *   bg-accent             → background: var(--color-accent)
       *
       * The 'accent' token is dynamic — set per bike page by the
       * useAccentColor hook (B-02) which writes --color-accent on
       * document.documentElement. Every component using bg-accent or
       * text-accent automatically reflects the current bike's brand color.
       *
       * BASE PALETTE (fixed, brand-agnostic):
       */
      colors: {
        /*
         * Surface colors — page backgrounds and elevated surfaces.
         * surface-base:    #FAFAF9 — warm-neutral white, primary page background
         * surface-raised:  #FFFFFF — cards, panels, modals
         * surface-sunken:  #F2F1EF — section breaks, input backgrounds, feature tiles
         * surface-inverse: #0E0F12 — footer, admin sidebar, dark hero overlays
         */
        'surface-base': 'var(--color-surface-base)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-sunken': 'var(--color-surface-sunken)',
        'surface-inverse': 'var(--color-surface-inverse)',

        /*
         * Ink (text) colors — hierarchy from primary to disabled.
         * ink-primary:   #15161A — main text, near-black (not pure black)
         * ink-secondary: #5B5D66 — captions, meta, secondary labels
         * ink-tertiary:  #9A9CA5 — placeholders, disabled states
         * text-inverse:  #F5F5F4 — text on dark (surface-inverse) backgrounds
         */
        'ink-primary': 'var(--color-ink-primary)',
        'ink-secondary': 'var(--color-ink-secondary)',
        'ink-tertiary': 'var(--color-ink-tertiary)',
        'text-inverse': 'var(--color-text-inverse)',

        /*
         * border-hairline: #E4E3E0 — dividers, card outlines, table rules.
         * Used in: BikeCard border, admin table rows, FilterBar pills.
         */
        'border-hairline': 'var(--color-border-hairline)',

        /*
         * accent — dynamic per-bike brand color.
         * Value is set at runtime by useAccentColor hook (B-02).
         * Used at max 5–8% surface coverage per MPD design rules.
         * Default fallback (#15161A = ink-primary) defined in D-01.
         *
         * Per-brand hex values (for reference — stored in constants/brands.ts):
         *   Royal Enfield: #7A2E2E  KTM: #FF6A00  Yamaha: #1B3A8A
         *   Honda: #C8102E         TVS: #0E7C7B   Bajaj: #1F2937
         */
        accent: 'var(--color-accent)',
      },

      /*
       * ─────────────────────────────────────────────────────────────────
       * FONT FAMILIES — MPD Section 6, Typography
       * ─────────────────────────────────────────────────────────────────
       *
       * Three-role type system (automotive-premium register):
       *   Display  → grotesk with engineered precision
       *   Body     → humanist sans with high readability
       *   Mono     → technical figures and spec values
       *
       * Font variables (--font-display, --font-body, --font-mono) are
       * declared in D-02 using @font-face rules for self-hosted woff2 files.
       *
       * Usage examples:
       *   font-display → font-family: var(--font-display), sans-serif
       *   font-body    → font-family: var(--font-body), sans-serif
       *   font-mono    → font-family: var(--font-mono), monospace
       *
       * The fallback stacks (sans-serif, monospace) ensure text renders
       * correctly even before the woff2 files finish loading (D-02 sets
       * font-display: swap so there is no invisible text flash).
       */
      fontFamily: {
        /*
         * Display — bike names, hero headlines, page titles.
         * Direction: Neue Montreal / General Sans family.
         * Semi-condensed at large sizes (display-xl: 72px desktop).
         */
        display: ['var(--font-display)', 'sans-serif'],

        /*
         * Body — descriptions, feature copy, UI labels, all prose.
         * Direction: Inter / Söhne family.
         * High readability at body-md (15px) and body-sm (13px).
         */
        body: ['var(--font-body)', 'sans-serif'],

        /*
         * Mono — spec values, prices, technical figures.
         * Direction: JetBrains Mono / IBM Plex Mono.
         * Used sparingly — reinforces "engineered precision" feel.
         * Applied to: BikePriceBlock, BikeSpecAccordion values, data-md scale.
         */
        mono: ['var(--font-mono)', 'monospace'],
      },

      /*
       * ─────────────────────────────────────────────────────────────────
       * SPACING — MPD Section 6, Spacing System
       * ─────────────────────────────────────────────────────────────────
       *
       * 8px base unit. All spacing values are multiples or derivatives
       * of 8px — nothing is arbitrarily placed.
       *
       * These tokens extend (not replace) Tailwind's default spacing scale.
       * Tailwind's numeric scale (p-4 = 1rem, m-8 = 2rem, etc.) remains
       * fully available alongside these named tokens.
       *
       * Usage examples:
       *   p-space-4     → padding: 24px  (card padding, button padding)
       *   gap-space-3   → gap: 16px     (default component padding)
       *   mt-space-7    → margin-top: 80px (major section breaks)
       *   mb-space-8    → margin-bottom: 120px (hero breathing room)
       *
       * Mobile compression (space-7, space-8) is applied with Tailwind
       * responsive prefixes: lg:mt-space-7 mt-space-6
       * (80px desktop → 48px mobile via space-6)
       */
      spacing: {
        'space-1': '4px',    // Icon-to-label gaps
        'space-2': '8px',    // Tight internal padding
        'space-3': '16px',   // Default component padding
        'space-4': '24px',   // Card padding, button horizontal padding
        'space-5': '32px',   // Section internal spacing
        'space-6': '48px',   // Between related sections + space-7 on mobile
        'space-7': '80px',   // Major section breaks — desktop only
        'space-8': '120px',  // Hero-to-content breathing room — desktop only
      },

      /*
       * ─────────────────────────────────────────────────────────────────
       * BORDER RADIUS — MPD Section 6, Border Radius
       * ─────────────────────────────────────────────────────────────────
       *
       * Prefixed with 'r-' to avoid colliding with Tailwind's default
       * radius scale (sm, md, lg, xl, full).
       *
       * No sharp 0px corners anywhere in MotoHub360 — consistent with
       * the "engineered but warm" premium aesthetic.
       *
       * Usage examples:
       *   rounded-r-sm   → border-radius: 6px   (inputs, small tags, badges)
       *   rounded-r-md   → border-radius: 10px  (feature cards, dropdowns)
       *   rounded-r-lg   → border-radius: 16px  (bike cards, image containers)
       *   rounded-r-xl   → border-radius: 24px  (hero, gallery preview, modals)
       *   rounded-r-full → border-radius: 999px (pills, icon buttons, swatches)
       */
      borderRadius: {
        'r-sm': '6px',    // Inputs, small tags, admin thumbnails, suggestion thumbs
        'r-md': '10px',   // Feature tiles, spec/filter dropdown panels
        'r-lg': '16px',   // Bike cards (BikeCard), image containers in lists
        'r-xl': '24px',   // Hero image container, BikeGallery preview, modals
        'r-full': '999px',// Pills (FilterBar), icon buttons, swatches, brand chips
      },

      /*
       * ─────────────────────────────────────────────────────────────────
       * BOX SHADOWS — MPD Section 6, Shadows
       * ─────────────────────────────────────────────────────────────────
       *
       * Shadows are soft, low-opacity, and used sparingly to suggest a
       * slight physical lift — never heavy or skeuomorphic.
       *
       * The 'sm', 'md', 'lg' keys OVERRIDE Tailwind's defaults for those
       * same names. This is intentional — MotoHub360's shadow scale
       * replaces Tailwind's generic shadows throughout the codebase.
       *
       * Usage examples:
       *   shadow-sm    → 0 1px 2px rgba(15,16,20,0.04)  — card resting state
       *   shadow-md    → 0 4px 12px rgba(15,16,20,0.08) — hover lift, dropdowns
       *   shadow-lg    → 0 12px 32px rgba(15,16,20,0.12)— modals, search panel
       *   shadow-focus → var(--shadow-focus)             — keyboard focus ring
       *
       * shadow-focus references a CSS variable defined in D-01.
       * Its value uses the dynamic --color-accent to produce a 30% opacity
       * accent-colored ring: 0 0 0 3px color-mix(in srgb, var(--color-accent) 30%, transparent)
       * This is the accessibility-critical focus indicator — WCAG 2.1 AA.
       *
       * Base color for shadow RGB values: rgba(15, 16, 20) = #0F1014
       * (close to ink-primary #15161A — gives warm, not cool, shadows)
       */
      boxShadow: {
        sm: '0 1px 2px rgba(15, 16, 20, 0.04)',
        md: '0 4px 12px rgba(15, 16, 20, 0.08)',
        lg: '0 12px 32px rgba(15, 16, 20, 0.12)',
        /*
         * shadow-focus — dynamic accent-colored focus ring.
         * Value defined in D-01 as:
         *   --shadow-focus: 0 0 0 3px color-mix(in srgb, var(--color-accent) 30%, transparent)
         * Referenced here so `shadow-focus` Tailwind class is available.
         * Used on: all focusable interactive elements (buttons, inputs,
         * swatches, nav links) for keyboard accessibility.
         */
        focus: 'var(--shadow-focus)',
      },

      /*
       * ─────────────────────────────────────────────────────────────────
       * TYPOGRAPHY SCALE — MPD Section 6, Type Scale
       * ─────────────────────────────────────────────────────────────────
       *
       * The MPD defines 7 type tokens with desktop and mobile sizes.
       * Tailwind's fontSize config accepts [size, lineHeight] tuples.
       *
       * Desktop sizes are set here. Mobile overrides use Tailwind's
       * responsive prefix pattern (e.g. `text-display-md md:text-display-lg`).
       *
       * All font weights are applied separately via Tailwind's font-weight
       * utilities (font-semibold for 600, font-medium for 500, etc.)
       *
       * Usage examples:
       *   text-display-xl  → 72px / 1.0 line-height  (bike name on hero)
       *   text-display-lg  → 48px / 1.05             (section titles)
       *   text-display-md  → 32px / 1.15             (card titles)
       *   text-body-lg     → 18px / 1.5              (taglines, lead copy)
       *   text-body-md     → 15px / 1.6              (standard body)
       *   text-body-sm     → 13px / 1.5              (captions, meta)
       *   text-data-md     → 15px / 1.4              (prices, spec values)
       *
       * Mobile responsive examples:
       *   text-2xl md:text-display-xl  (40px mobile → 72px desktop)
       *   text-xl  md:text-display-lg  (32px mobile → 48px desktop)
       */
      fontSize: {
        /*
         * display-xl — 72px desktop / 40px mobile
         * Line height: 1.0 (tight — large display text needs tighter leading)
         * Weight: 600 (semibold)
         * Usage: Bike name in BikeHero on detail page
         */
        'display-xl': ['72px', { lineHeight: '1.0' }],

        /*
         * display-lg — 48px desktop / 32px mobile
         * Line height: 1.05
         * Weight: 600
         * Usage: Page/section titles, MotoHub360 wordmark on Home
         */
        'display-lg': ['48px', { lineHeight: '1.05' }],

        /*
         * display-md — 32px desktop / 24px mobile
         * Line height: 1.15
         * Weight: 600
         * Usage: Card titles (BikeCard name), brand page headers, sub-headers
         */
        'display-md': ['32px', { lineHeight: '1.15' }],

        /*
         * body-lg — 18px desktop / 17px mobile
         * Line height: 1.5
         * Weight: 400
         * Usage: Taglines, lead paragraphs, hero positioning copy
         */
        'body-lg': ['18px', { lineHeight: '1.5' }],

        /*
         * body-md — 15px (same desktop and mobile)
         * Line height: 1.6 (generous for readability at small size)
         * Weight: 400
         * Usage: Standard body copy, admin form labels, spec category headers
         */
        'body-md': ['15px', { lineHeight: '1.6' }],

        /*
         * body-sm — 13px (same desktop and mobile)
         * Line height: 1.5
         * Weight: 400 / 500
         * Usage: Captions, meta info, BikeCard tagline, breadcrumb text
         */
        'body-sm': ['13px', { lineHeight: '1.5' }],

        /*
         * data-md — 15px monospace / 14px mobile
         * Line height: 1.4 (tighter — mono type reads better slightly condensed)
         * Weight: 500 (medium — mono font at regular weight can feel too light)
         * Usage: Ex-showroom prices, spec values (requires font-mono class too)
         *
         * In components: combine with font-mono for the full effect:
         *   className="text-data-md font-mono font-medium"
         */
        'data-md': ['15px', { lineHeight: '1.4' }],
      },
    },
  },

  /*
   * PLUGINS
   * No third-party plugins in V1.
   * Custom animation utilities are defined as CSS @keyframes in D-04.
   * If a plugin is needed in future tasks, add it here.
   */
  plugins: [],
}

export default config