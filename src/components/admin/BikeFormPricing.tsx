'use client'

/*
 * BikeFormPricing — Pricing & Colours section of the BikeForm.
 *
 * MPD Task A-08.5:
 *   "Pricing: Ex-showroom Price (required), On-road Price (optional),
 *   EMI Starts From (optional), Trim Variants with name + price (dynamic
 *   add/remove list), Currency (INR), Price Notes (optional).
 *   Controlled inputs, updatePricing callback, blur validation, numeric
 *   validation, mobile responsive, accessible."
 *
 * FIELDS:
 *   exShowroom     — ex-showroom price in INR (required)
 *   onRoad         — estimated on-road price in INR (optional; ≥ exShowroom)
 *   emiStartsFrom  — estimated monthly EMI in INR (optional)
 *   priceVariants  — dynamic list of named trim levels with distinct prices
 *   priceNotes     — free-text pricing note (optional, max 300 chars)
 *
 *   values.colors (BikeFormColorVariant[]) is part of BikeFormPricingValues
 *   but is rendered in the Gallery & Media section (A-11) where image
 *   uploads are handled. Colors are preserved in state and not touched here.
 *
 * PRICE INPUT FORMAT:
 *   All price fields accept Indian-formatted numbers (3,48,000 or 348000).
 *   A visible ₹ prefix communicates currency without a separate Currency
 *   select — INR is the only currency used in MotoHub360.
 *   parsePriceString() in bike-form-validation.ts handles both formats.
 *   inputMode="numeric" on mobile opens the numeric keypad.
 *
 * PRICE VARIANTS:
 *   Dynamic list of trim levels each with a name and a price.
 *   Examples: "Standard — ₹3,48,000", "ABS variant — ₹3,68,000"
 *   The admin can add up to MAX_PRICE_VARIANTS variants and remove any.
 *   Both name and price are required if a variant row exists.
 *   Variants with either field empty are excluded from the API payload.
 *
 * VALIDATION PATTERN:
 *   Same as BikeFormBasic and BikeFormSpecifications:
 *     - Local blur errors (per field) stored in localErrors state.
 *     - Parent errors (from BikeFormShell full section validation) passed via errors prop.
 *     - Merged before render; local errors take precedence.
 *
 * WHY 'use client':
 *   useState (localErrors, localVariantErrors)
 *   useCallback (field change/blur handlers, variant list mutations)
 *   Event handlers (onChange, onBlur, onClick)
 */

import { useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import {
  validateExShowroom,
  validateOnRoad,
  validateEmiStartsFrom,
  validatePriceNotes,
  validatePriceVariantName,
  validatePriceVariantPrice,
  FIELD_LIMITS,
} from '@/lib/bike-form-validation'
import type {
  BikeFormPricingValues,
  BikeFormPriceVariant,
  BikeFormPricingErrors,
} from '@/types/bike-form'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * MAX_PRICE_VARIANTS — maximum number of trim variants allowed.
 * Twelve is generous for even the most complex motorcycle lineup.
 * Prevents the variant list from growing unboundedly.
 */
const MAX_PRICE_VARIANTS = 12

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BikeFormPricingProps {
  /*
   * values — the current pricing state from BikeFormShell (values.pricing).
   */
  values: BikeFormPricingValues

  /*
   * errors — section-level errors from the last full validation pass.
   * Merged with local blur errors before rendering.
   */
  errors?: BikeFormPricingErrors

  /*
   * onChange — fires on every field change with the updated pricing values.
   * BikeFormShell wires this to updatePricing().
   */
  onChange: (values: BikeFormPricingValues) => void

  /*
   * disabled — all inputs are read-only when true (form is submitting).
   */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// FieldLabel — label with optional required indicator
// (matches the pattern established in BikeFormBasic and BikeFormSpecifications)
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor:   string
  label:     string
  required?: boolean
  current?:  number
  max?:      number
}

function FieldLabel({
  htmlFor,
  label,
  required = false,
  current,
  max,
}: FieldLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}
    >
      <label
        htmlFor={htmlFor}
        className="admin-label"
        style={{ margin: 0 }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: '#C8102E', marginLeft: '3px', fontWeight: 400 }}
          >
            *
          </span>
        )}
      </label>

      {max !== undefined && current !== undefined && (
        <span
          aria-live="polite"
          aria-label={`${current} of ${max} characters used`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color:
              current > max
                ? '#C8102E'
                : current > max * 0.85
                ? '#B45309'
                : 'var(--color-ink-tertiary)',
            transition: 'color 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {current} / {max}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldError — inline error message (identical pattern across all BikeForm sections)
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
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
        <Icon name="warning" size={12} strokeWidth={1.75} />
      </span>
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------
// PriceInput — text input with a fixed ₹ prefix and numeric keyboard on mobile
// ---------------------------------------------------------------------------

interface PriceInputProps {
  id:               string
  value:            string
  placeholder:      string
  disabled:         boolean
  hasError:         boolean
  ariaDescribedby?: string
  ariaRequired?:    boolean
  suffix?:          string   // optional text after the input (e.g. "per month")
  onChange:         (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur:           () => void
}

function PriceInput({
  id,
  value,
  placeholder,
  disabled,
  hasError,
  ariaDescribedby,
  ariaRequired,
  suffix,
  onChange,
  onBlur,
}: PriceInputProps) {
  return (
    /*
     * Flex row: [₹ prefix] [input] [optional suffix]
     * The prefix and suffix are purely visual — aria-label on the input
     * communicates the INR context to screen readers.
     */
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
      }}
    >
      {/* ₹ prefix badge */}
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 10px',
          backgroundColor: 'var(--color-surface-sunken)',
          border: '1px solid',
          borderColor: hasError
            ? '#C8102E'
            : 'var(--color-border-hairline)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: 500,
          color: hasError
            ? '#C8102E'
            : 'var(--color-ink-secondary)',
          flexShrink: 0,
          transition: 'border-color 150ms cubic-bezier(0.4,0,0.2,1)',
          userSelect: 'none',
        }}
      >
        ₹
      </div>

      {/* Price input */}
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="off"
        className="admin-input"
        style={{
          flex: 1,
          minWidth: 0,
          borderRadius: suffix ? '0' : '0 8px 8px 0',
          borderLeft: 'none',
          boxSizing: 'border-box',
          ...(hasError && { borderColor: '#C8102E' }),
          ...(suffix && {
            borderRight: 'none',
          }),
        }}
        aria-describedby={ariaDescribedby}
        aria-invalid={hasError}
        aria-required={ariaRequired}
      />

      {/* Optional text suffix (e.g. "per month") */}
      {suffix && (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            backgroundColor: 'var(--color-surface-sunken)',
            border: '1px solid',
            borderColor: hasError
              ? '#C8102E'
              : 'var(--color-border-hairline)',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-ink-tertiary)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {suffix}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BikeFormPricing
// ---------------------------------------------------------------------------

export default function BikeFormPricing({
  values,
  errors,
  onChange,
  disabled = false,
}: BikeFormPricingProps) {

  // ── Local error state ──────────────────────────────────────────────────

  /*
   * localErrors — field-level errors set on individual blur events.
   * Does NOT include variant errors (managed separately in localVariantErrors
   * for clean per-index access).
   */
  const [localErrors, setLocalErrors] = useState<
    Omit<BikeFormPricingErrors, 'priceVariants'>
  >({})

  /*
   * localVariantErrors — per-variant blur errors, indexed by variant position.
   * Sparse: undefined at positions that have not been validated or have no errors.
   */
  const [localVariantErrors, setLocalVariantErrors] = useState<
    Array<{ name?: string; price?: string } | undefined>
  >([])

  // ── Merged errors ──────────────────────────────────────────────────────

  /*
   * Merge parent errors with local blur errors.
   * Local errors (from the most recent blur) take precedence over parent
   * errors (from the last full section validation on tab leave or submit).
   */
  const mergedErrors: Omit<BikeFormPricingErrors, 'priceVariants'> = {
    ...errors,
    ...localErrors,
  }

  /*
   * Per-variant merged errors: parent array merged with local array by index.
   * For each position, local error wins over parent error for the same key.
   */
  const mergedVariantErrors = values.priceVariants.map((_, index) => ({
    ...errors?.priceVariants?.[index],
    ...localVariantErrors[index],
  }))

  // ── Field change handlers ─────────────────────────────────────────────

  /*
   * handleFieldChange — generic handler for the four scalar pricing fields.
   * Fires on every keystroke; parent state is always current.
   * colors is spread unchanged — this section does not touch it.
   */
  const handleFieldChange = useCallback(
    (
      field: 'exShowroom' | 'onRoad' | 'emiStartsFrom' | 'priceNotes',
      value: string,
    ): void => {
      onChange({ ...values, [field]: value })
    },
    [values, onChange],
  )

  // ── Blur handlers for scalar fields ──────────────────────────────────

  const handleExShowroomBlur = useCallback((): void => {
    const err = validateExShowroom(values.exShowroom)
    setLocalErrors((prev) => ({ ...prev, exShowroom: err ?? undefined }))
  }, [values.exShowroom])

  const handleOnRoadBlur = useCallback((): void => {
    /*
     * On-road validation requires the current ex-showroom value for the
     * cross-field "on-road ≥ ex-showroom" check.
     */
    const err = validateOnRoad(values.onRoad, values.exShowroom)
    setLocalErrors((prev) => ({ ...prev, onRoad: err ?? undefined }))
  }, [values.onRoad, values.exShowroom])

  const handleEmiBlur = useCallback((): void => {
    const err = validateEmiStartsFrom(values.emiStartsFrom)
    setLocalErrors((prev) => ({ ...prev, emiStartsFrom: err ?? undefined }))
  }, [values.emiStartsFrom])

  const handleNotesBlur = useCallback((): void => {
    const err = validatePriceNotes(values.priceNotes)
    setLocalErrors((prev) => ({ ...prev, priceNotes: err ?? undefined }))
  }, [values.priceNotes])

  // ── Variant list handlers ─────────────────────────────────────────────

  /*
   * handleAddVariant — appends a blank variant row to the list.
   * Capped at MAX_PRICE_VARIANTS.
   */
  const handleAddVariant = useCallback((): void => {
    if (values.priceVariants.length >= MAX_PRICE_VARIANTS) return
    const blank: BikeFormPriceVariant = { name: '', price: '' }
    onChange({
      ...values,
      priceVariants: [...values.priceVariants, blank],
    })
  }, [values, onChange])

  /*
   * handleRemoveVariant — removes the variant at the given index.
   * Also cleans up the corresponding local error entry.
   */
  const handleRemoveVariant = useCallback(
    (index: number): void => {
      onChange({
        ...values,
        priceVariants: values.priceVariants.filter((_, i) => i !== index),
      })
      setLocalVariantErrors((prev) => {
        const next = [...prev]
        next.splice(index, 1)
        return next
      })
    },
    [values, onChange],
  )

  /*
   * handleVariantFieldChange — updates a single field (name or price) on a
   * specific variant without touching other variants or scalar pricing fields.
   */
  const handleVariantFieldChange = useCallback(
    (
      index: number,
      field: 'name' | 'price',
      value: string,
    ): void => {
      const updated = values.priceVariants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v,
      )
      onChange({ ...values, priceVariants: updated })
    },
    [values, onChange],
  )

  /*
   * handleVariantFieldBlur — validates a single field on a specific variant.
   * Updates localVariantErrors at the variant's index without affecting
   * other positions.
   */
  const handleVariantFieldBlur = useCallback(
    (index: number, field: 'name' | 'price'): void => {
      const variant = values.priceVariants[index]
      if (!variant) return

      const err =
        field === 'name'
          ? validatePriceVariantName(variant.name, index)
          : validatePriceVariantPrice(variant.price, index)

      setLocalVariantErrors((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: err ?? undefined }
        return next
      })
    },
    [values.priceVariants],
  )

  // ── Render ─────────────────────────────────────────────────────────────

  const canAddVariant = values.priceVariants.length < MAX_PRICE_VARIANTS

  return (
    <>
      <style>{`
        /*
         * Section divider — matches the .bfb-divider and .bfs-spec-divider
         * patterns in BikeFormBasic and BikeFormSpecifications.
         */
        .bfp-divider {
          height: 1px;
          background-color: var(--color-border-hairline);
          margin: 24px 0;
        }

        /*
         * Group label — uppercase, muted, matches other sections.
         */
        .bfp-group-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 16px;
        }

        /*
         * Two-column grid for price fields (ex-showroom + on-road side by side).
         * Collapses to one column on mobile (≤ 600px).
         */
        .bfp-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 600px) {
          .bfp-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        /*
         * Variant row — name input, price input, remove button in a flex row.
         * On mobile: name and price stack vertically, remove button right-aligned.
         */
        .bfp-variant-row {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 10px;
          align-items: start;
          padding: 14px;
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        @media (max-width: 600px) {
          .bfp-variant-row {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
          }

          /*
           * On mobile: name occupies the first row (full width minus remove btn),
           * price occupies the second row (full width).
           */
          .bfp-variant-row .bfp-variant-name {
            grid-column: 1;
            grid-row: 1;
          }

          .bfp-variant-row .bfp-variant-remove {
            grid-column: 2;
            grid-row: 1;
            align-self: center;
          }

          .bfp-variant-row .bfp-variant-price {
            grid-column: 1 / -1;
            grid-row: 2;
          }
        }

        /*
         * Variant field sub-label — smaller label inside each variant row.
         */
        .bfp-variant-sub-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          color: var(--color-ink-tertiary);
          display: block;
          margin-bottom: 5px;
        }

        /*
         * Remove variant button — dark semi-transparent circle.
         * Matches the gc-remove pattern from GalleryUploader (A-07.4).
         */
        .bfp-remove-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background-color: var(--color-surface-sunken);
          border: 1px solid var(--color-border-hairline);
          cursor: pointer;
          color: var(--color-ink-tertiary);
          flex-shrink: 0;
          margin-top: 20px;
          transition:
            background-color 150ms cubic-bezier(0.4,0,0.2,1),
            color             150ms cubic-bezier(0.4,0,0.2,1);
        }

        .bfp-remove-btn:hover:not(:disabled) {
          background-color: #FEE2E2;
          color: #C8102E;
          border-color: #FECACA;
        }

        .bfp-remove-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        .bfp-remove-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /*
         * Add variant button — secondary outlined button.
         */
        .bfp-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-ink-secondary);
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          cursor: pointer;
          transition:
            background-color 150ms cubic-bezier(0.4,0,0.2,1),
            color             150ms cubic-bezier(0.4,0,0.2,1);
          user-select: none;
        }

        .bfp-add-btn:hover:not(:disabled) {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-primary);
          border-color: var(--color-ink-tertiary);
        }

        .bfp-add-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        .bfp-add-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /*
         * Empty variants hint — shown when no variants have been added.
         */
        .bfp-variants-empty {
          padding: 16px;
          border: 1.5px dashed var(--color-border-hairline);
          border-radius: 8px;
          text-align: center;
          background-color: var(--color-surface-sunken);
          margin-bottom: 10px;
        }

        /*
         * Price notes textarea.
         */
        .bfp-notes-textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 80px;
          resize: vertical;
        }
      `}</style>

      <div>

        {/* ── Section 1: Core pricing ────────────────────────────── */}
        <section aria-label="Core pricing">
          <p className="bfp-group-label">
            Pricing
            {/*
             * INR badge — communicates that all prices are in Indian Rupees.
             * Not a select input — MotoHub360 is India-only, currency is fixed.
             */}
            <span
              aria-label="Currency: Indian Rupees"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: '8px',
                padding: '1px 7px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.04em',
                color: 'var(--color-ink-tertiary)',
                backgroundColor: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-hairline)',
                borderRadius: '4px',
                textTransform: 'none',
                verticalAlign: 'middle',
              }}
            >
              INR
            </span>
          </p>

          {/* Ex-showroom + On-road in a 2-column grid */}
          <div className="bfp-grid-2" style={{ marginBottom: '16px' }}>

            {/* Ex-showroom Price (required) */}
            <div>
              <FieldLabel
                htmlFor="bfp-exShowroom"
                label="Ex-showroom Price"
                required
              />
              <PriceInput
                id="bfp-exShowroom"
                value={values.exShowroom}
                placeholder="348000"
                disabled={disabled}
                hasError={!!mergedErrors.exShowroom}
                ariaDescribedby={[
                  'bfp-exShowroom-hint',
                  mergedErrors.exShowroom ? 'bfp-exShowroom-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                ariaRequired
                onChange={(e) =>
                  handleFieldChange('exShowroom', e.target.value)
                }
                onBlur={handleExShowroomBlur}
              />
              {!mergedErrors.exShowroom && (
                <p
                  id="bfp-exShowroom-hint"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-ink-tertiary)',
                    margin: '5px 0 0',
                  }}
                >
                  Manufacturer's base price. Accepts commas (3,48,000).
                </p>
              )}
              <FieldError
                id="bfp-exShowroom-error"
                message={mergedErrors.exShowroom}
              />
            </div>

            {/* On-road Price (optional) */}
            <div>
              <FieldLabel
                htmlFor="bfp-onRoad"
                label="On-road Price"
              />
              <PriceInput
                id="bfp-onRoad"
                value={values.onRoad}
                placeholder="410000"
                disabled={disabled}
                hasError={!!mergedErrors.onRoad}
                ariaDescribedby={[
                  'bfp-onRoad-hint',
                  mergedErrors.onRoad ? 'bfp-onRoad-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                onChange={(e) =>
                  handleFieldChange('onRoad', e.target.value)
                }
                onBlur={handleOnRoadBlur}
              />
              {!mergedErrors.onRoad && (
                <p
                  id="bfp-onRoad-hint"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-ink-tertiary)',
                    margin: '5px 0 0',
                  }}
                >
                  Estimated. Includes registration, insurance, road tax.
                </p>
              )}
              <FieldError
                id="bfp-onRoad-error"
                message={mergedErrors.onRoad}
              />
            </div>
          </div>

          {/* EMI Starts From (optional, single column) */}
          <div style={{ maxWidth: '50%' }}>
            <FieldLabel
              htmlFor="bfp-emi"
              label="EMI Starts From"
            />
            <PriceInput
              id="bfp-emi"
              value={values.emiStartsFrom}
              placeholder="3500"
              disabled={disabled}
              hasError={!!mergedErrors.emiStartsFrom}
              suffix="/ month"
              ariaDescribedby={[
                'bfp-emi-hint',
                mergedErrors.emiStartsFrom ? 'bfp-emi-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              onChange={(e) =>
                handleFieldChange('emiStartsFrom', e.target.value)
              }
              onBlur={handleEmiBlur}
            />
            {!mergedErrors.emiStartsFrom && (
              <p
                id="bfp-emi-hint"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--color-ink-tertiary)',
                  margin: '5px 0 0',
                }}
              >
                Indicative monthly EMI. Optional.
              </p>
            )}
            <FieldError
              id="bfp-emi-error"
              message={mergedErrors.emiStartsFrom}
            />
          </div>
        </section>

        <div className="bfp-divider" aria-hidden="true" />

        {/* ── Section 2: Price variants ──────────────────────────── */}
        <section aria-label="Trim level price variants">
          <p className="bfp-group-label">
            Trim Variants
            {values.priceVariants.length > 0 && (
              <span
                aria-label={`${values.priceVariants.length} variants`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginLeft: '8px',
                  minWidth: '20px',
                  height: '18px',
                  padding: '0 6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--color-ink-secondary)',
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: '1px solid var(--color-border-hairline)',
                  borderRadius: '999px',
                  textTransform: 'none',
                  letterSpacing: 0,
                  verticalAlign: 'middle',
                }}
              >
                {values.priceVariants.length}
              </span>
            )}
          </p>

          {/*
           * Empty state — shown when no variants have been added.
           * Not an error — single-price bikes have no variants.
           */}
          {values.priceVariants.length === 0 && (
            <div className="bfp-variants-empty">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--color-ink-tertiary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                No trim variants added.
                <br />
                Add variants if this bike comes in different versions at different prices
                (e.g. Standard vs ABS variant).
              </p>
            </div>
          )}

          {/*
           * Variant rows — one per priceVariants item.
           * Grid layout: [Name input] [Price input] [Remove button]
           */}
          {values.priceVariants.map((variant, index) => {
            const vErr    = mergedVariantErrors[index] ?? {}
            const nameId  = `bfp-variant-name-${index}`
            const priceId = `bfp-variant-price-${index}`

            return (
              <div
                key={index}
                className="bfp-variant-row"
                role="group"
                aria-label={`Trim variant ${index + 1}`}
              >
                {/* Variant Name */}
                <div className="bfp-variant-name">
                  <label
                    htmlFor={nameId}
                    className="bfp-variant-sub-label"
                  >
                    Variant Name
                    <span
                      aria-hidden="true"
                      style={{ color: '#C8102E', marginLeft: '3px' }}
                    >
                      *
                    </span>
                  </label>
                  <input
                    id={nameId}
                    type="text"
                    value={variant.name}
                    placeholder="e.g. ABS variant"
                    disabled={disabled}
                    maxLength={FIELD_LIMITS.VARIANT_NAME_MAX}
                    className="admin-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      ...(vErr.name && { borderColor: '#C8102E' }),
                    }}
                    onChange={(e) =>
                      handleVariantFieldChange(index, 'name', e.target.value)
                    }
                    onBlur={() => handleVariantFieldBlur(index, 'name')}
                    aria-describedby={
                      vErr.name ? `${nameId}-error` : undefined
                    }
                    aria-invalid={!!vErr.name}
                    aria-required="true"
                    autoComplete="off"
                  />
                  <FieldError id={`${nameId}-error`} message={vErr.name} />
                </div>

                {/* Variant Price */}
                <div className="bfp-variant-price">
                  <label
                    htmlFor={priceId}
                    className="bfp-variant-sub-label"
                  >
                    Variant Price
                    <span
                      aria-hidden="true"
                      style={{ color: '#C8102E', marginLeft: '3px' }}
                    >
                      *
                    </span>
                  </label>
                  <PriceInput
                    id={priceId}
                    value={variant.price}
                    placeholder="368000"
                    disabled={disabled}
                    hasError={!!vErr.price}
                    ariaDescribedby={
                      vErr.price ? `${priceId}-error` : undefined
                    }
                    ariaRequired
                    onChange={(e) =>
                      handleVariantFieldChange(index, 'price', e.target.value)
                    }
                    onBlur={() => handleVariantFieldBlur(index, 'price')}
                  />
                  <FieldError
                    id={`${priceId}-error`}
                    message={vErr.price}
                  />
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  className="bfp-remove-btn bfp-variant-remove"
                  onClick={() => handleRemoveVariant(index)}
                  disabled={disabled}
                  aria-label={`Remove variant ${index + 1}${variant.name ? `: ${variant.name}` : ''}`}
                >
                  <Icon name="close" size={12} strokeWidth={2.5} />
                </button>
              </div>
            )
          })}

          {/*
           * Add Variant button.
           * Hidden when the maximum variant count is reached.
           */}
          <div
            style={{
              marginTop: values.priceVariants.length > 0 ? '4px' : '0',
            }}
          >
            {canAddVariant ? (
              <button
                type="button"
                className="bfp-add-btn"
                onClick={handleAddVariant}
                disabled={disabled}
                aria-label="Add a trim level price variant"
              >
                {/*
                 * Plus icon using an inline SVG to avoid dependency
                 * on the Icon component's icon map.
                 */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5"  y1="12" x2="19" y2="12" />
                </svg>
                Add Variant
              </button>
            ) : (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-ink-tertiary)',
                  margin: '4px 0 0',
                }}
              >
                Maximum of {MAX_PRICE_VARIANTS} variants reached.
              </p>
            )}
          </div>
        </section>

        <div className="bfp-divider" aria-hidden="true" />

        {/* ── Section 3: Price Notes ─────────────────────────────── */}
        <section aria-label="Price notes">
          <FieldLabel
            htmlFor="bfp-priceNotes"
            label="Price Notes"
            current={values.priceNotes.length}
            max={FIELD_LIMITS.PRICE_NOTES_MAX}
          />

          {/*
           * Using a <textarea> not an <input> because price notes can be
           * multi-line (e.g. "Ex-showroom Delhi.\nPrices vary by city and
           * applicable taxes."). The textarea is resizable vertically only.
           */}
          <textarea
            id="bfp-priceNotes"
            value={values.priceNotes}
            placeholder={
              'e.g. Ex-showroom price, Delhi. ' +
              'On-road price may vary by city and applicable state taxes.'
            }
            disabled={disabled}
            maxLength={FIELD_LIMITS.PRICE_NOTES_MAX + 10}
            className="admin-input bfp-notes-textarea"
            style={{
              ...(mergedErrors.priceNotes && { borderColor: '#C8102E' }),
            }}
            onChange={(e) =>
              handleFieldChange('priceNotes', e.target.value)
            }
            onBlur={handleNotesBlur}
            aria-describedby={[
              'bfp-priceNotes-hint',
              mergedErrors.priceNotes ? 'bfp-priceNotes-error' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined}
            aria-invalid={!!mergedErrors.priceNotes}
          />

          <p
            id="bfp-priceNotes-hint"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-ink-tertiary)',
              margin: '5px 0 0',
              lineHeight: 1.5,
            }}
          >
            Optional. Shown below the pricing block on the bike detail page.
          </p>

          <FieldError
            id="bfp-priceNotes-error"
            message={mergedErrors.priceNotes}
          />
        </section>
      </div>
    </>
  )
}