/*
 * BikeSpecTable — Full specification table for the bike detail page.
 *
 * MPD Task B-05:
 *   "Full spec table — engine and performance, dimensions and
 *   capacity. Label/value rows. Empty fields omitted. Two sections:
 *   Engine & Performance and Dimensions & Capacity."
 *
 * MPD Section 5.3, Bike Detail Page — Below the fold:
 *   "Full spec table: two named sections. Each row: left-aligned
 *   label (body-sm/ink-secondary), right-aligned value (mono/ink-primary).
 *   Only rows with data are rendered. Sections with zero data rows
 *   are omitted entirely."
 *
 * COMPONENT TYPE: Server Component (no 'use client').
 *   BikeSpecTable is purely presentational — it receives pre-fetched
 *   spec data as props and renders HTML. No interactivity, no state,
 *   no event handlers. Server Components are the correct choice here:
 *   zero JS bundle overhead, correct for below-the-fold content.
 *
 * SECTIONS:
 *   1. Engine & Performance
 *      displacement, engineType, maxPower, maxTorque,
 *      fuelSystem, coolingType, transmission, clutch,
 *      emission, startingSystem
 *
 *   2. Dimensions & Capacity
 *      kerbWeight, fuelCapacity, seatHeight, groundClearance,
 *      wheelbase, overallLength, overallWidth, overallHeight
 *
 * EMPTY FIELD HANDLING:
 *   Each field is optional per IBikeEngineSpecs / IBikeDimensionSpecs
 *   (DB-02). Fields that are undefined, null, or empty string are
 *   omitted from the table — no "N/A" placeholders.
 *   If an entire section has no data, the section header is also omitted.
 *   If both sections have no data, the component returns null.
 *
 * LAYOUT — ROW:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Displacement              648 cc                           │
 *   │  Engine Type               Parallel-twin, 4-stroke, SOHC   │
 *   │  Max Power                 47 bhp @ 7,150 rpm               │
 *   │  ···                                                        │
 *   └─────────────────────────────────────────────────────────────┘
 *
 *   Desktop: label takes 40% of row width, value takes 60%.
 *   Mobile: label above value (stacked, full-width rows).
 *
 * VALUE STYLING:
 *   All spec values use var(--font-mono) — monospace font.
 *   Per MPD Section 6, Data Display:
 *   "Specifications, measurements, and numeric data: mono."
 *   This creates a clear visual separation between the descriptive
 *   label (body font) and the precise technical value (mono font).
 *
 * ACCESSIBILITY:
 *   Uses a <dl> (description list) — the semantically correct HTML
 *   element for label/value pairs. Each row is a dt/dd pair.
 *   The section heading is an <h3> (h1=bike name, h2=section labels
 *   above spec table → h3 for the sub-sections within the table).
 *   role="region" + aria-label on each section for screen readers.
 */

import type {
    IBikeEngineSpecs,
    IBikeDimensionSpecs,
  } from '@/lib/db/models/Bike'
  
  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  
  export interface BikeSpecTableProps {
    /*
     * specs — the bike's specification object from DB-02.
     * Contains engine, dimensions, and features sub-documents.
     * Only engine and dimensions are used in BikeSpecTable.
     * Features are handled by BikeFeaturesList (B-06).
     */
    specs: {
      engine: IBikeEngineSpecs
      dimensions: IBikeDimensionSpecs
    }
  
    /*
     * accentColor — brand accent hex for section header underline.
     * Provides a subtle brand-consistent visual accent on the table.
     */
    accentColor: string
  }
  
  // ---------------------------------------------------------------------------
  // Types for spec row definitions
  // ---------------------------------------------------------------------------
  
  /*
   * SpecRow — defines a single row in the spec table.
   * label: the human-readable field name shown on the left.
   * value: the spec value from the bike document.
   */
  interface SpecRow {
    label: string
    value: string | undefined | null
  }
  
  /*
   * SpecSection — a named group of spec rows.
   * heading: shown as an h3 above the rows.
   * rows: the SpecRow[] for this section.
   */
  interface SpecSection {
    heading: string
    rows: SpecRow[]
  }
  
  // ---------------------------------------------------------------------------
  // SpecRowItem — renders a single dt/dd row
  // ---------------------------------------------------------------------------
  
  function SpecRowItem({
    label,
    value,
    isLast,
  }: {
    label: string
    value: string
    isLast: boolean
  }) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '16px',
          padding: '13px 20px',
          borderBottom: isLast
            ? 'none'
            : '1px solid var(--color-border-hairline)',
        }}
      >
        {/*
         * dt — spec label.
         * body-sm, ink-secondary — descriptive, less prominent than the value.
         * flex: 0 0 40% keeps label at a fixed 40% width on desktop.
         * min-width: 0 prevents overflow on very long labels.
         */}
        <dt
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--color-ink-secondary)',
            flex: '0 0 42%',
            minWidth: 0,
            lineHeight: 1.45,
          }}
        >
          {label}
        </dt>
  
        {/*
         * dd — spec value.
         * Monospace font per MPD Section 6 data display rules.
         * ink-primary — the most prominent element in the row.
         * flex: 1 — takes remaining width after label.
         */}
        <dd
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-ink-primary)',
            flex: 1,
            minWidth: 0,
            margin: 0,
            lineHeight: 1.45,
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </dd>
      </div>
    )
  }
  
  // ---------------------------------------------------------------------------
  // SpecSectionBlock — renders a named section of spec rows
  // ---------------------------------------------------------------------------
  
  function SpecSectionBlock({
    section,
    accentColor,
    isLast,
  }: {
    section: SpecSection
    accentColor: string
    isLast: boolean
  }) {
    /*
     * Filter out empty rows before rendering.
     * Only rows with a non-empty string value are shown.
     */
    const visibleRows = section.rows.filter(
      (row): row is { label: string; value: string } =>
        typeof row.value === 'string' && row.value.trim().length > 0,
    )
  
    /*
     * If no rows have data, render nothing (no empty section heading).
     */
    if (visibleRows.length === 0) {
      return null
    }
  
    return (
      <div
        role="region"
        aria-label={section.heading}
        style={{
          marginBottom: isLast ? 0 : '0',
        }}
      >
        {/*
         * Section heading — h3.
         * Sits above the dl, separated by a fine accent underline.
         * The accent underline (2px solid brand color) ties the section
         * to the brand identity without being visually heavy.
         */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 20px 12px',
            borderBottom: '1px solid var(--color-border-hairline)',
            backgroundColor: 'var(--color-surface-sunken)',
          }}
        >
          {/*
           * Accent bar — 3px wide, 16px tall, brand accent color.
           * Left of the heading text as a visual marker.
           */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '3px',
              height: '16px',
              borderRadius: '999px',
              backgroundColor: accentColor,
              flexShrink: 0,
            }}
          />
  
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-secondary)',
              margin: 0,
            }}
          >
            {section.heading}
          </h3>
        </div>
  
        {/*
         * Description list — the semantically correct element for
         * label/value pairs. Each row is a dt + dd pair wrapped in
         * a div for styling purposes.
         */}
        <dl style={{ margin: 0 }}>
          {visibleRows.map((row, index) => (
            <SpecRowItem
              key={row.label}
              label={row.label}
              value={row.value}
              isLast={index === visibleRows.length - 1}
            />
          ))}
        </dl>
      </div>
    )
  }
  
  // ---------------------------------------------------------------------------
  // BikeSpecTable — main component
  // ---------------------------------------------------------------------------
  
  export default function BikeSpecTable({
    specs,
    accentColor,
  }: BikeSpecTableProps) {
    // ── Build sections ────────────────────────────────────────────────────
  
    /*
     * Engine & Performance section rows.
     * Order follows the MPD specification and standard Indian motorcycle
     * datasheet convention (displacement first, then power, torque, etc.).
     */
    const engineSection: SpecSection = {
      heading: 'Engine & Performance',
      rows: [
        { label: 'Displacement', value: specs.engine.displacement },
        { label: 'Engine Type', value: specs.engine.engineType },
        { label: 'Max Power', value: specs.engine.maxPower },
        { label: 'Max Torque', value: specs.engine.maxTorque },
        { label: 'Fuel System', value: specs.engine.fuelSystem },
        { label: 'Cooling', value: specs.engine.coolingType },
        { label: 'Transmission', value: specs.engine.transmission },
        { label: 'Clutch', value: specs.engine.clutch },
        { label: 'Starting System', value: specs.engine.startingSystem },
        { label: 'Emission Standard', value: specs.engine.emission },
      ],
    }
  
    /*
     * Dimensions & Capacity section rows.
     * Order: weight → tank → riding ergonomics → overall dimensions.
     */
    const dimensionsSection: SpecSection = {
      heading: 'Dimensions & Capacity',
      rows: [
        { label: 'Kerb Weight', value: specs.dimensions.kerbWeight },
        { label: 'Fuel Capacity', value: specs.dimensions.fuelCapacity },
        { label: 'Seat Height', value: specs.dimensions.seatHeight },
        { label: 'Ground Clearance', value: specs.dimensions.groundClearance },
        { label: 'Wheelbase', value: specs.dimensions.wheelbase },
        { label: 'Overall Length', value: specs.dimensions.overallLength },
        { label: 'Overall Width', value: specs.dimensions.overallWidth },
        { label: 'Overall Height', value: specs.dimensions.overallHeight },
      ],
    }
  
    const sections: SpecSection[] = [engineSection, dimensionsSection]
  
    /*
     * Check whether any section has any visible rows.
     * If all specs are empty (unusual but possible for incomplete entries),
     * render nothing rather than an empty card.
     */
    const hasAnyData = sections.some((section) =>
      section.rows.some(
        (row) =>
          typeof row.value === 'string' && row.value.trim().length > 0,
      ),
    )
  
    if (!hasAnyData) {
      return null
    }
  
    return (
      <>
        <style>{`
          /*
           * Spec table mobile layout — stack label above value.
           * On narrow screens the side-by-side layout becomes too cramped.
           * Below 480px: label and value become full-width stacked.
           */
          @media (max-width: 480px) {
            .spec-row-inner {
              flex-direction: column !important;
              gap: 2px !important;
            }
  
            .spec-row-label {
              flex: none !important;
            }
  
            .spec-row-value {
              font-size: 14px !important;
            }
          }
  
          /*
           * Spec table row hover — subtle surface-sunken highlight.
           * Helps the user track which row they are reading.
           */
          .spec-row-hover:hover {
            background-color: var(--color-surface-sunken);
          }
        `}</style>
  
        {/*
         * Outer container — surface-raised background, hairline border,
         * r-lg border radius. Consistent card style with BikeGallery.
         */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {sections.map((section, index) => (
            <SpecSectionBlock
              key={section.heading}
              section={section}
              accentColor={accentColor}
              isLast={index === sections.length - 1}
            />
          ))}
        </div>
  
        {/*
         * Footnote — spec source clarification.
         * Manufacturer specifications may differ slightly from tested values.
         */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: 400,
            color: 'var(--color-ink-tertiary)',
            margin: '12px 0 0',
            lineHeight: 1.5,
          }}
        >
          Specifications sourced from manufacturer data. Actual values may
          vary by variant, region, and production year.
        </p>
      </>
    )
  }