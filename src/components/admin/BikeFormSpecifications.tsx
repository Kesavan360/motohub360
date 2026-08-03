'use client'

/*
 * BikeFormSpecifications — Specifications section of the BikeForm.
 *
 * MPD Task A-08.4:
 *   "Specifications: Engine CC, Mileage, Power, Torque, Transmission,
 *   Fuel Tank Capacity, Seat Height, Ground Clearance, Kerb Weight.
 *   Controlled inputs, updateSpecs callback, local blur validation,
 *   parent validation compatibility."
 *
 * FIELDS IMPLEMENTED (nine quick-entry fields):
 *   Engine group:
 *     displacement   — Engine CC       e.g. "648 cc"
 *     maxPower       — Power           e.g. "47 bhp @ 7,150 rpm"
 *     maxTorque      — Torque          e.g. "52 Nm @ 5,250 rpm"
 *     transmission   — Transmission   e.g. "6-Speed, Constant Mesh"
 *
 *   Dimensions group:
 *     fuelCapacity    — Fuel Tank      e.g. "13.7 litres"
 *     seatHeight      — Seat Height    e.g. "790 mm"
 *     groundClearance — Ground Clear.  e.g. "174 mm"
 *     kerbWeight      — Kerb Weight    e.g. "202 kg"
 *
 * FIELD FORMAT:
 *   All nine fields are plain strings — values are entered by the admin
 *   including units (e.g. "648 cc", "47 bhp @ 7,150 rpm").
 *   No numeric parsing or unit enforcement is applied at the field level.
 *   This matches the existing BikeSpecTable (B-05) display approach:
 *   "Displacement: 648 cc" reads exactly what the admin typed.
 *
 *   Validation is max-length only (FIELD_LIMITS.SPEC_FIELD_MAX = 200 chars).
 *
 * PLACEHOLDER CONVENTION:
 *   Each placeholder shows a real-world Royal Enfield GT 650 value so the
 *   admin understands the expected format for that field.
 *
 * RELATIONSHIP TO BikeFormValues:
 *   This component operates on values.specs (BikeFormSpecValues).
 *   The parent BikeFormShell passes:
 *     values={values.specs}       — current spec state
 *     errors={errors.specs}       — parent validation errors
 *     onChange={updateSpecs}      — updates values.specs in the shell
 *
 *   onChange fires on every keystroke (same contract as BikeFormBasic).
 *   Validation fires on blur per field.
 *
 * FEATURES SECTION:
 *   Feature toggles (ABS, TFT, Bluetooth, etc.) and Riding Modes are
 *   part of BikeFormSpecValues.features but are intentionally NOT rendered
 *   in this component.
 *
 *   Rationale: The nine quick-entry text fields and the boolean toggles
 *   are visually and functionally distinct. Mixing both in one section
 *   would make the form dense and hard to scan. The features sub-section
 *   is rendered as an informational stub beneath the nine fields and will
 *   be implemented in A-09 as a separate concerns.
 *
 * WHY 'use client':
 *   useState (localErrors)
 *   useCallback (field handlers, blur handlers)
 *   Event handlers (onChange, onBlur)
 */

import { useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import { validateSpecTextField, FIELD_LIMITS } from '@/lib/bike-form-validation'
import type {
  BikeFormSpecValues,
  BikeFormSpecEngineValues,
  BikeFormSpecDimensionValues,
  FieldErrors,
} from '@/types/bike-form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * The errors shape for the specs section mirrors BikeFormErrors['specs']:
 * nested engine and dimensions sub-objects.
 */
interface SpecsSectionErrors {
  engine?:     FieldErrors<BikeFormSpecEngineValues>
  dimensions?: FieldErrors<BikeFormSpecDimensionValues>
}

export interface BikeFormSpecificationsProps {
  /*
   * values — the current spec state from BikeFormShell (values.specs).
   * Contains engine, dimensions, and features sub-objects.
   */
  values: BikeFormSpecValues

  /*
   * errors — parent validation errors for this section.
   * Merged with local blur errors before rendering.
   */
  errors?: SpecsSectionErrors

  /*
   * onChange — called on every field change with the updated BikeFormSpecValues.
   * BikeFormShell wires this to updateSpecs().
   */
  onChange: (values: BikeFormSpecValues) => void

  /*
   * disabled — when true all inputs are read-only and inert.
   */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// SpecField — definition for each rendered specification field
// ---------------------------------------------------------------------------

/*
 * SpecFieldDef — static definition for one text specification field.
 * Centralised here to keep the render loop declarative and DRY.
 *
 * group:       'engine' | 'dimensions' — which sub-object holds this field
 * key:         the field name within that sub-object
 * label:       human-readable label shown above the input
 * placeholder: example value using real GT 650 data
 * hint:        optional short guidance shown below the input
 */
interface SpecFieldDef {
  group:       'engine' | 'dimensions'
  key:         keyof BikeFormSpecEngineValues | keyof BikeFormSpecDimensionValues
  label:       string
  placeholder: string
  hint?:       string
}

/*
 * SPEC_FIELDS — ordered list of all nine quick-entry specification fields.
 *
 * Divided into two visual groups:
 *   ENGINE GROUP  — performance and drivetrain specs
 *   CHASSIS GROUP — physical dimensions
 *
 * Placeholders use Royal Enfield GT 650 real-world values so the admin
 * can see the exact format expected without consulting external documentation.
 */
const ENGINE_FIELDS: SpecFieldDef[] = [
  {
    group:       'engine',
    key:         'displacement',
    label:       'Engine CC',
    placeholder: '648 cc',
    hint:        'Total engine displacement including unit, e.g. 648 cc',
  },
  {
    group: 'engine',
    key: 'mileage',
    label: 'Mileage',
    placeholder: '25 kmpl',
    hint: 'Claimed mileage including unit, e.g. 25 kmpl',
  },
  {
    group:       'engine',
    key:         'maxPower',
    label:       'Power',
    placeholder: '47 bhp @ 7,150 rpm',
    hint:        'Peak power output with RPM, e.g. 47 bhp @ 7,150 rpm',
  },
  {
    group:       'engine',
    key:         'maxTorque',
    label:       'Torque',
    placeholder: '52 Nm @ 5,250 rpm',
    hint:        'Peak torque with RPM, e.g. 52 Nm @ 5,250 rpm',
  },
  {
    group:       'engine',
    key:         'transmission',
    label:       'Transmission',
    placeholder: '6-Speed, Constant Mesh',
    hint:        'Gearbox type and speed count',
  },
]

const DIMENSION_FIELDS: SpecFieldDef[] = [
  {
    group:       'dimensions',
    key:         'fuelCapacity',
    label:       'Fuel Tank Capacity',
    placeholder: '13.7 litres',
    hint:        'Full tank capacity including unit, e.g. 13.7 litres',
  },
  {
    group:       'dimensions',
    key:         'seatHeight',
    label:       'Seat Height',
    placeholder: '790 mm',
    hint:        'Seat height from ground to top of seat, e.g. 790 mm',
  },
  {
    group:       'dimensions',
    key:         'groundClearance',
    label:       'Ground Clearance',
    placeholder: '174 mm',
    hint:        'Minimum clearance from ground, e.g. 174 mm',
  },
  {
    group:       'dimensions',
    key:         'kerbWeight',
    label:       'Kerb Weight',
    placeholder: '202 kg',
    hint:        'Weight with full fluids, no rider, e.g. 202 kg',
  },
]

// ---------------------------------------------------------------------------
// FieldLabel — label component (matches BikeFormBasic's FieldLabel exactly)
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor: string
  label:   string
}

function FieldLabel({ htmlFor, label }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="admin-label"
      style={{ display: 'block', marginBottom: '6px' }}
    >
      {label}
    </label>
  )
}

// ---------------------------------------------------------------------------
// FieldError — error message component (identical to BikeFormBasic)
// ---------------------------------------------------------------------------

interface FieldErrorProps {
  id:      string
  message: string | undefined
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null

  return (
    <p
      id={id}
      role="alert"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        color: '#C8102E',
        margin: '5px 0 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: '1px' }}
      >
        <Icon name="warning" size={12} strokeWidth={1.75} />
      </span>
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------
// SpecTextField — single text spec field with label, input, hint, error
// ---------------------------------------------------------------------------

interface SpecTextFieldProps {
  fieldDef:    SpecFieldDef
  value:       string
  errorId:     string
  error:       string | undefined
  disabled:    boolean
  onChange:    (value: string) => void
  onBlur:      () => void
}

function SpecTextField({
  fieldDef,
  value,
  errorId,
  error,
  disabled,
  onChange,
  onBlur,
}: SpecTextFieldProps) {
  /*
   * inputId — derived from the field's group and key to guarantee uniqueness
   * across all spec fields. Format: bfs-{group}-{key}
   * e.g. bfs-engine-displacement, bfs-dimensions-seatHeight
   */
  const inputId = `bfs-${fieldDef.group}-${String(fieldDef.key)}`

  return (
    <div>
      <FieldLabel htmlFor={inputId} label={fieldDef.label} />

      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={fieldDef.placeholder}
        maxLength={FIELD_LIMITS.SPEC_FIELD_MAX}
        className="admin-input"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          ...(error && { borderColor: '#C8102E' }),
        }}
        aria-describedby={[
          fieldDef.hint ? `${inputId}-hint` : '',
          error         ? errorId          : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        aria-invalid={!!error}
        autoComplete="off"
        spellCheck={false}
      />

      {fieldDef.hint && !error && (
        <p
          id={`${inputId}-hint`}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-ink-tertiary)',
            margin: '5px 0 0',
            lineHeight: 1.5,
          }}
        >
          {fieldDef.hint}
        </p>
      )}

      <FieldError id={errorId} message={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// BikeFormSpecifications
// ---------------------------------------------------------------------------

export default function BikeFormSpecifications({
  values,
  errors,
  onChange,
  disabled = false,
}: BikeFormSpecificationsProps) {

  // ── Local validation state ─────────────────────────────────────────────

  /*
   * localErrors — mirroring the nested specs error shape.
   * Populated on each field's blur event.
   * Merged with parent errors before rendering (local wins).
   */
  const [localErrors, setLocalErrors] = useState<SpecsSectionErrors>({})

  // ── Merged errors ──────────────────────────────────────────────────────

  /*
   * Deep-merge parent errors with local blur errors.
   * Local errors take precedence (they reflect the latest input).
   *
   * Each sub-object (engine, dimensions) is merged independently.
   */
  const mergedErrors: SpecsSectionErrors = {
    engine: {
      ...errors?.engine,
      ...localErrors.engine,
    },
    dimensions: {
      ...errors?.dimensions,
      ...localErrors.dimensions,
    },
  }

  // ── Field value reader ─────────────────────────────────────────────────

  /*
   * getValue — reads the current value for a field by group and key.
   * Avoids repetitive values.engine[key] / values.dimensions[key] spread.
   */
  function getValue(
    group: 'engine' | 'dimensions',
    key: keyof BikeFormSpecEngineValues | keyof BikeFormSpecDimensionValues,
  ): string {
    if (group === 'engine') {
      return values.engine[key as keyof BikeFormSpecEngineValues]
    }
    return values.dimensions[key as keyof BikeFormSpecDimensionValues]
  }

  // ── Field change handler ───────────────────────────────────────────────

  /*
   * handleFieldChange — updates a single spec field and calls onChange
   * with the full updated BikeFormSpecValues.
   *
   * Creates a new object for the affected sub-group (engine or dimensions)
   * while preserving the other sub-groups and the features object unchanged.
   */
  const handleFieldChange = useCallback(
    (
      group: 'engine' | 'dimensions',
      key: keyof BikeFormSpecEngineValues | keyof BikeFormSpecDimensionValues,
      value: string,
    ): void => {
      if (group === 'engine') {
        onChange({
          ...values,
          engine: {
            ...values.engine,
            [key]: value,
          },
        })
      } else {
        onChange({
          ...values,
          dimensions: {
            ...values.dimensions,
            [key]: value,
          },
        })
      }
    },
    [values, onChange],
  )

  // ── Field blur handler ─────────────────────────────────────────────────

  /*
   * handleFieldBlur — validates a single spec field on blur.
   *
   * Calls validateSpecTextField() (from A-08.1) with the field's current
   * value and label, then stores the result in the correct sub-object
   * of localErrors.
   *
   * Setting error to undefined (not the key to '') removes the error key
   * from the object when the field becomes valid — keeps errors clean.
   */
  const handleFieldBlur = useCallback(
    (
      group: 'engine' | 'dimensions',
      key: keyof BikeFormSpecEngineValues | keyof BikeFormSpecDimensionValues,
      label: string,
    ): void => {
      const value = getValue(group, key)
      const err   = validateSpecTextField(value, label)

      if (group === 'engine') {
        setLocalErrors((prev) => ({
          ...prev,
          engine: {
            ...prev.engine,
            [key]: err ?? undefined,
          },
        }))
      } else {
        setLocalErrors((prev) => ({
          ...prev,
          dimensions: {
            ...prev.dimensions,
            [key]: err ?? undefined,
          },
        }))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values],
  )

  // ── Error reader ───────────────────────────────────────────────────────

  /*
   * getError — reads the merged error for a field by group and key.
   * Returns undefined when the field has no error.
   */
  function getError(
    group: 'engine' | 'dimensions',
    key: keyof BikeFormSpecEngineValues | keyof BikeFormSpecDimensionValues,
  ): string | undefined {
    if (group === 'engine') {
      return mergedErrors.engine?.[key as keyof BikeFormSpecEngineValues]
    }
    return mergedErrors.dimensions?.[key as keyof BikeFormSpecDimensionValues]
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Two-column grid for specification fields on desktop.
         * Collapses to single column on mobile (≤ 600px).
         * Matches the two-column layout used in BikeFormBasic's brand+category row.
         */
        .bfs-spec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media (max-width: 600px) {
          .bfs-spec-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        /*
         * Section divider — identical to BikeFormBasic's .bfb-divider.
         */
        .bfs-spec-divider {
          height: 1px;
          background-color: var(--color-border-hairline);
          margin: 24px 0;
        }

        /*
         * Section heading within the specs form.
         * Matches the admin panel's uppercase label convention.
         */
        .bfs-spec-group-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 16px;
        }

        /*
         * Features stub — informational card for the not-yet-implemented
         * feature toggles sub-section.
         */
        .bfs-spec-features-stub {
          border: 1.5px dashed var(--color-border-hairline);
          border-radius: 10px;
          background-color: var(--color-surface-sunken);
          padding: 20px;
        }
      `}</style>

      <div>

        {/* ── Engine & Performance ──────────────────────────────── */}
        <section aria-label="Engine and performance specifications">
          <p className="bfs-spec-group-label">
            Engine &amp; Performance
          </p>

          <div className="bfs-spec-grid">
            {ENGINE_FIELDS.map((fieldDef) => {
              const key     = fieldDef.key as keyof BikeFormSpecEngineValues
              const errorId = `bfs-${fieldDef.group}-${String(key)}-error`

              return (
                <SpecTextField
                  key={String(key)}
                  fieldDef={fieldDef}
                  value={getValue(fieldDef.group, key)}
                  errorId={errorId}
                  error={getError(fieldDef.group, key)}
                  disabled={disabled}
                  onChange={(value) =>
                    handleFieldChange(fieldDef.group, key, value)
                  }
                  onBlur={() =>
                    handleFieldBlur(fieldDef.group, key, fieldDef.label)
                  }
                />
              )
            })}
          </div>
        </section>

        <div className="bfs-spec-divider" aria-hidden="true" />

        {/* ── Dimensions & Capacity ─────────────────────────────── */}
        <section aria-label="Dimensions and capacity specifications">
          <p className="bfs-spec-group-label">
            Dimensions &amp; Capacity
          </p>

          <div className="bfs-spec-grid">
            {DIMENSION_FIELDS.map((fieldDef) => {
              const key     = fieldDef.key as keyof BikeFormSpecDimensionValues
              const errorId = `bfs-${fieldDef.group}-${String(key)}-error`

              return (
                <SpecTextField
                  key={String(key)}
                  fieldDef={fieldDef}
                  value={getValue(fieldDef.group, key)}
                  errorId={errorId}
                  error={getError(fieldDef.group, key)}
                  disabled={disabled}
                  onChange={(value) =>
                    handleFieldChange(fieldDef.group, key, value)
                  }
                  onBlur={() =>
                    handleFieldBlur(fieldDef.group, key, fieldDef.label)
                  }
                />
              )
            })}
          </div>
        </section>

        <div className="bfs-spec-divider" aria-hidden="true" />

        {/* ── Feature Toggles — stub until A-09 ────────────────── */}
        {/*
         * ABS, TFT, Bluetooth, Riding Modes, and all other boolean
         * feature toggles live in values.specs.features.
         *
         * They are rendered here as an informational stub because:
         *   1. The field count (13 booleans + ridingModes array) warrants
         *      its own layout attention.
         *   2. A-09 implements the full features sub-section with toggle
         *      switches and the riding modes tag input.
         *
         * The stub is rendered inside this component (not in BikeFormShell)
         * because it is semantically part of the Specifications section.
         */}
        <section aria-label="Feature toggles — coming in A-09">
          <p className="bfs-spec-group-label">
            Features &amp; Technology
          </p>

          <div className="bfs-spec-features-stub">
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-ink-primary)',
                margin: '0 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              Feature toggles
            </p>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-ink-secondary)',
                margin: '0 0 16px',
                lineHeight: 1.6,
                maxWidth: '480px',
              }}
            >
              ABS, Dual-Channel ABS, Slipper Clutch, Traction Control,
              Quickshifter, Auto-Blipper, Cruise Control, TFT Display,
              Bluetooth, Navigation, USB Charging, Full LED, and Riding Modes.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '16px',
              }}
            >
              {[
                'ABS', 'Dual-Channel ABS', 'Slipper Clutch',
                'Traction Control', 'Quickshifter', 'Auto-Blipper',
                'Cruise Control', 'TFT Display', 'Bluetooth',
                'Navigation', 'USB Charging', 'Full LED', 'Riding Modes',
              ].map((feature) => (
                <span
                  key={feature}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '26px',
                    padding: '0 10px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-ink-secondary)',
                    backgroundColor: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-hairline)',
                    borderRadius: '999px',
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '6px',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  color: 'var(--color-ink-tertiary)',
                  flexShrink: 0,
                }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-ink-tertiary)',
                }}
              >
                Implemented in{' '}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-ink-secondary)',
                  }}
                >
                  A-09
                </span>
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}