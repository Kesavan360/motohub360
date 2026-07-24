/*
 * BikeFeaturesList — Grouped features checklist for the bike detail page.
 *
 * MPD Task B-06:
 *   "Features checklist with icons. Groups: Safety, Performance,
 *   Technology, Lighting. Present features: accent-color check.
 *   Absent features: muted dash. Riding modes shown as individual chips."
 *
 * MPD Section 5.3, Bike Detail Page — Below the fold:
 *   "Features list: a grouped checklist of the bike's notable features.
 *   Each feature shows a check (present, accent color) or dash (absent,
 *   muted). Four groups: Safety, Performance, Technology, Lighting.
 *   Riding modes shown as labelled chips below the groups."
 *
 * COMPONENT TYPE: Server Component (no 'use client').
 *   BikeFeaturesList is purely presentational — props in, HTML out.
 *   No state, no event handlers, no browser APIs. Zero JS bundle cost.
 *
 * FEATURE GROUPS:
 *
 *   Safety
 *     — ABS (anti-lock braking system)
 *     — Dual-Channel ABS (independent front + rear ABS)
 *     — Traction Control
 *     — Slipper / Assist Clutch
 *
 *   Performance
 *     — Quickshifter (clutchless upshifts)
 *     — Auto-Blipper (clutchless downshifts / heel-toe)
 *     — Cruise Control
 *
 *   Technology
 *     — TFT Instrument Cluster
 *     — Bluetooth Connectivity
 *     — Navigation
 *     — USB Charging Port
 *
 *   Lighting
 *     — Full LED Lighting
 *
 * PRESENT vs ABSENT:
 *   ALL features in each group are shown (not just present ones).
 *   This gives the user a complete picture without scrolling elsewhere.
 *
 *   Present: accent-color filled check circle + full-opacity label.
 *   Absent:  surface-sunken dashed circle + ink-tertiary label.
 *
 *   "Present" means the boolean field is true on the bike document.
 *   "Absent" means the field is false, null, or undefined.
 *
 *   Rationale for showing absent features:
 *   A user comparing two bikes benefits from seeing "no ABS" as an
 *   explicit data point rather than inferring it from the absence of
 *   a chip. Premium motorcycle sites (Honda, KTM) consistently show
 *   full feature grids rather than present-only lists.
 *
 * RIDING MODES:
 *   Shown separately below the groups as individual labelled chips.
 *   Each mode (e.g. "Eco", "City", "Sport", "Rain") is a pill chip
 *   with the brand accent color dot.
 *   Hidden when ridingModes is empty or undefined.
 *
 * DUAL-CHANNEL ABS LOGIC:
 *   If dualChannelAbs is true → show "Dual-Channel ABS" as present,
 *   show basic "ABS" as implicitly present (can't have dual without single).
 *   If abs is true but dualChannelAbs is false → show "ABS" present,
 *   "Dual-Channel ABS" absent.
 *   If abs is false → both shown as absent.
 *
 * EMPTY STATE:
 *   If all feature fields are false/empty AND ridingModes is empty,
 *   the component returns null. The page.tsx guard prevents the
 *   "Features" section label from rendering an empty section.
 *
 * LAYOUT:
 *   Feature groups: CSS grid, 4 columns desktop → 2 tablet → 1 mobile.
 *   Each group is a card (surface-raised, hairline border, r-md).
 *   Feature rows within a group: each row is icon + label.
 *   Riding modes: horizontal flex-wrap row of pill chips.
 *
 * ACCESSIBILITY:
 *   Uses <ul> / <li> for feature lists — semantically a list of features.
 *   Check icon has aria-hidden; the feature name carries the accessible text.
 *   Present/absent state is conveyed by the label itself in screen-reader
 *   context — no reliance on color alone (check vs dash icons also differ).
 *   role="region" + aria-label on the outer container.
 */

import Icon from '@/components/ui/Icon'
import type { IBikeFeatures } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeFeaturesListProps {
  /*
   * features — the bike's features object from DB-02 IBikeFeatures.
   * All fields are optional booleans or string arrays.
   */
  features: IBikeFeatures

  /*
   * accentColor — brand accent hex for present-feature check icons.
   * Example: '#7A2E2E' (Royal Enfield), '#FF6A00' (KTM).
   */
  accentColor: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/*
 * FeatureItem — one row in a feature group.
 * label: display name.
 * present: whether this bike has the feature.
 */
interface FeatureItem {
  label: string
  present: boolean
}

/*
 * FeatureGroup — a named collection of features.
 * heading: the group title (e.g. "Safety").
 * items: the features in this group.
 */
interface FeatureGroup {
  heading: string
  items: FeatureItem[]
}

// ---------------------------------------------------------------------------
// FeatureRow — single feature row (icon + label)
// ---------------------------------------------------------------------------

function FeatureRow({
  item,
  accentColor,
  isLast,
}: {
  item: FeatureItem
  accentColor: string
  isLast: boolean
}) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderBottom: isLast
          ? 'none'
          : '1px solid var(--color-border-hairline)',
        listStyle: 'none',
      }}
    >
      {/*
       * Status indicator — check circle (present) or dash circle (absent).
       *
       * Present: filled circle in accentColor, white check icon inside.
       * Absent:  surface-sunken circle with dashed border, dash icon.
       *
       * Both are aria-hidden — the feature label carries accessible meaning.
       * Screen readers get the full feature name; sighted users get the icon.
       */}
      {item.present ? (
        <span
          aria-hidden="true"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            backgroundColor: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            name="check"
            size={11}
            strokeWidth={2.5}
            style={{ color: '#FFFFFF' }}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            backgroundColor: 'var(--color-surface-sunken)',
            border: '1.5px dashed var(--color-border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '1.5px',
              backgroundColor: 'var(--color-ink-tertiary)',
              borderRadius: '1px',
              opacity: 0.5,
              display: 'block',
            }}
          />
        </span>
      )}

      {/*
       * Feature label.
       * Present: ink-primary, weight 500.
       * Absent: ink-tertiary, weight 400.
       * Provides color AND weight differentiation — not color alone.
       */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: item.present ? 500 : 400,
          color: item.present
            ? 'var(--color-ink-primary)'
            : 'var(--color-ink-tertiary)',
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        {item.label}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// FeatureGroupCard — a named group of feature rows
// ---------------------------------------------------------------------------

function FeatureGroupCard({
  group,
  accentColor,
}: {
  group: FeatureGroup
  accentColor: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-hairline)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/*
       * Group heading — matches BikeSpecTable section header style
       * for visual consistency across the detail page sections.
       */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '11px 16px 10px',
          borderBottom: '1px solid var(--color-border-hairline)',
          backgroundColor: 'var(--color-surface-sunken)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '3px',
            height: '14px',
            borderRadius: '999px',
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <h3
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-secondary)',
            margin: 0,
          }}
        >
          {group.heading}
        </h3>
      </div>

      {/*
       * Feature list — <ul> is semantically correct for an unordered
       * list of features. Padding/margin reset removes browser defaults.
       */}
      <ul style={{ margin: 0, padding: 0 }}>
        {group.items.map((item, index) => (
          <FeatureRow
            key={item.label}
            item={item}
            accentColor={accentColor}
            isLast={index === group.items.length - 1}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BikeFeaturesList — main component
// ---------------------------------------------------------------------------

export default function BikeFeaturesList({
  features,
  accentColor,
}: BikeFeaturesListProps) {
  // ── Build feature groups ──────────────────────────────────────────────

  /*
   * Dual-Channel ABS special case:
   * If dualChannelAbs is true, basic ABS is implicitly present too.
   */
  const absPresent = features.abs === true || features.dualChannelAbs === true
  const dualAbs = features.dualChannelAbs === true

  const groups: FeatureGroup[] = [
    {
      heading: 'Safety',
      items: [
        { label: 'ABS', present: absPresent },
        { label: 'Dual-Channel ABS', present: dualAbs },
        { label: 'Traction Control', present: features.tractionControl === true },
        { label: 'Slipper / Assist Clutch', present: features.slipAssistClutch === true },
      ],
    },
    {
      heading: 'Performance',
      items: [
        { label: 'Quickshifter', present: features.quickshifter === true },
        { label: 'Auto-Blipper', present: features.autoblipper === true },
        { label: 'Cruise Control', present: features.cruiseControl === true },
      ],
    },
    {
      heading: 'Technology',
      items: [
        { label: 'TFT Instrument Cluster', present: features.tft === true },
        { label: 'Bluetooth Connectivity', present: features.bluetooth === true },
        { label: 'Navigation', present: features.navigation === true },
        { label: 'USB Charging Port', present: features.usbCharging === true },
      ],
    },
    {
      heading: 'Lighting',
      items: [
        { label: 'Full LED Lighting', present: features.ledLights === true },
      ],
    },
  ]

  const ridingModes = Array.isArray(features.ridingModes)
    ? features.ridingModes.filter(
        (m): m is string => typeof m === 'string' && m.trim().length > 0,
      )
    : []

  /*
   * Empty state guard.
   * If every feature is absent AND there are no riding modes,
   * return null — the page.tsx guard will hide the section label too.
   *
   * In practice this only happens for bikes with completely unfilled
   * feature data. The guard prevents an all-absent features grid from
   * being shown (which would look like the bike has nothing).
   */
  const hasAnyPresent =
    groups.some((g) => g.items.some((i) => i.present)) ||
    ridingModes.length > 0

  if (!hasAnyPresent) {
    return null
  }

  return (
    <div
      role="region"
      aria-label="Bike features"
    >
      <style>{`
        /*
         * Feature groups grid.
         * 4 columns desktop → 2 tablet → 1 mobile.
         */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .features-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }

        /*
         * Feature row hover.
         */
        .features-grid li:hover {
          background-color: var(--color-surface-sunken);
        }
      `}</style>

      {/* ── Feature group grid ────────────────────────────────────── */}
      <div className="features-grid">
        {groups.map((group) => (
          <FeatureGroupCard
            key={group.heading}
            group={group}
            accentColor={accentColor}
          />
        ))}
      </div>

      {/* ── Riding modes section ──────────────────────────────────── */}
      {/*
       * Shown only when ridingModes is a non-empty array.
       * Each mode is a pill chip with the accent dot.
       * Consistent with the category pill style from the Home page.
       */}
      {ridingModes.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              margin: '0 0 10px',
            }}
          >
            Riding Modes
            <span
              style={{
                fontWeight: 400,
                letterSpacing: 0,
                textTransform: 'none',
                marginLeft: '8px',
                fontSize: '12px',
              }}
            >
              ({ridingModes.length})
            </span>
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
            role="list"
            aria-label="Available riding modes"
          >
            {ridingModes.map((mode) => (
              <span
                key={mode}
                role="listitem"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '32px',
                  padding: '0 14px 0 10px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-ink-primary)',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-hairline)',
                  borderRadius: '999px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '999px',
                    backgroundColor: accentColor,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                {mode}
              </span>
            ))}
          </div>
        </div>
      )}

      {/*
       * Legend — explains present vs absent indicator.
       * Keeps the UI self-documenting for first-time users.
       */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginTop: '14px',
          flexWrap: 'wrap',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              backgroundColor: accentColor,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
            }}
          >
            Present
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              backgroundColor: 'var(--color-surface-sunken)',
              border: '1.5px dashed var(--color-border-hairline)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 400,
              color: 'var(--color-ink-tertiary)',
            }}
          >
            Not available
          </span>
        </div>
      </div>
    </div>
  )
}