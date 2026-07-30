'use client'

/*
 * BikeFormBasic — Basic Info section of the BikeForm.
 *
 * MPD Task A-08.3:
 *   "Basic Info: Model Name, URL Slug (auto-generated + async uniqueness
 *   check), Brand (select from BRANDS constant), Category (select from
 *   CATEGORIES constant), Tagline (optional, max 120 chars), Status
 *   (Draft / Published toggle)."
 *
 * FIELDS:
 *   name      — model name (required, 2–100 chars)
 *   slug      — URL slug (required, auto-generated from name, async unique check)
 *   brandSlug — brand select (required, values from BRANDS constant S-08)
 *   category  — category select (required, values from CATEGORIES constant S-08)
 *   tagline   — one-line description (optional, max 120 chars)
 *   status    — 'draft' | 'published' (required, defaults to 'draft')
 *
 * SLUG AUTO-GENERATION:
 *   As the admin types in the Model Name field:
 *     1. generateSlug(name) is called on every keystroke.
 *     2. If the slug field has not been manually edited (slugManualRef = false),
 *        the slug is set to the generated value automatically.
 *     3. Once the admin manually edits the slug field, slugManualRef = true
 *        and the slug is no longer auto-updated from the name.
 *
 *   This mirrors the standard pattern used by Shopify, WordPress, and Webflow
 *   — "auto-generate until the admin takes over."
 *
 * ASYNC SLUG UNIQUENESS CHECK:
 *   After blur on the slug field (or whenever the slug changes via
 *   auto-generation), a GET /api/admin/slug-check?slug=... request is fired
 *   after a 400ms debounce.
 *
 *   States:
 *     idle       — no check running; no result
 *     checking   — debounce timer running or request in flight
 *     available  — slug is available (green indicator)
 *     taken      — slug is already used by another bike (error message)
 *
 *   In edit mode, the current bike's _id is passed as excludeId so the
 *   bike's own slug does not report as taken.
 *
 * VALIDATION:
 *   Field-level: on blur for each field, the relevant validator from
 *   bike-form-validation.ts is called and the error is stored locally.
 *   The parent's `errors` prop contains errors from the last full section
 *   validation (on tab leave or submit). Both are shown; local blur errors
 *   take precedence (more current).
 *
 * onChange CONTRACT:
 *   onChange is called whenever any field value changes (not just on blur).
 *   The parent (BikeFormShell) updates the full BikeFormValues on every
 *   keystroke — this is correct; React's reconciler is fast enough for
 *   admin form usage and avoids stale state on submit.
 *
 * CHARACTER COUNTERS:
 *   Tagline (max 120): live char counter shown next to the label.
 *   Meta fields (A-12): same pattern used there.
 *
 * STATUS TOGGLE:
 *   Not a standard <select> — rendered as two pill buttons (Draft / Published)
 *   so the binary choice is immediately clear without an open dropdown.
 *
 * WHY 'use client':
 *   useState (local field errors, slug check state)
 *   useRef   (slugManualRef, debounce timer)
 *   useEffect (slug auto-generation from name, debounced slug check)
 *   useCallback (handlers)
 *   Event handlers (onChange, onBlur, onClick)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Icon from '@/components/ui/Icon'
import { BRANDS } from '@/constants/brands'
import { CATEGORIES } from '@/constants/categories'
import {
  generateSlug,
  validateName,
  validateSlug,
  validateBrandSlug,
  validateCategory,
  validateTagline,
  FIELD_LIMITS,
} from '@/lib/bike-form-validation'
import type {
  BikeFormBasicValues,
  FieldErrors,
} from '@/types/bike-form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeFormBasicProps {
  /*
   * values — the current Basic Info form values from BikeFormShell.
   */
  values: BikeFormBasicValues

  /*
   * errors — field-level errors from the parent's last section validation.
   * Merged with local blur-level errors; local errors take precedence.
   */
  errors?: FieldErrors<BikeFormBasicValues>

  /*
   * onChange — called on every field change with the updated values object.
   * BikeFormShell merges the returned object into the full BikeFormValues.
   */
  onChange: (values: BikeFormBasicValues) => void

  /*
   * excludeId — the current bike's MongoDB _id (edit mode only).
   * Passed to the slug-check API so the bike's own slug is not reported
   * as taken. Omitted in create mode.
   */
  excludeId?: string

  /*
   * disabled — when true all inputs are read-only and inert.
   * Used while the parent form is submitting.
   */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Slug check state
// ---------------------------------------------------------------------------

type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

const SLUG_CHECK_DEBOUNCE_MS = 400

// ---------------------------------------------------------------------------
// FieldLabel — label + optional character counter + optional required marker
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
            style={{
              color: '#C8102E',
              marginLeft: '3px',
              fontWeight: 400,
            }}
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
            color: current > max
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
// FieldError — inline error message below an input
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
// BikeFormBasic
// ---------------------------------------------------------------------------

export default function BikeFormBasic({
  values,
  errors,
  onChange,
  excludeId,
  disabled = false,
}: BikeFormBasicProps) {

  // ── Local validation state ─────────────────────────────────────────────

  /*
   * localErrors — field errors set on each field's blur event.
   * Merged with the parent's `errors` prop before rendering.
   * Local errors win (they reflect the latest input) when both exist.
   */
  const [localErrors, setLocalErrors] = useState<
    FieldErrors<BikeFormBasicValues>
  >({})

  // ── Slug uniqueness check state ───────────────────────────────────────

  const [slugStatus, setSlugStatus] = useState<SlugCheckStatus>('idle')

  // ── Refs ─────────────────────────────────────────────────────────────

  /*
   * slugManualRef — tracks whether the admin has manually edited the slug.
   * false: slug is auto-generated from the name.
   * true:  slug is under manual control; name changes do not affect it.
   *
   * A ref (not state) because changing it does not need to trigger a render.
   */
  const slugManualRef = useRef(false)

  /*
   * slugCheckTimerRef — handle for the debounce timer.
   * Cleared and reset whenever the slug value changes.
   */
  const slugCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
   * latestSlugRef — tracks the slug value at the time the check request
   * was fired. Used to discard stale responses when the slug changes
   * faster than the API responds.
   */
  const latestSlugRef = useRef<string>('')

  // ── Derived values ────────────────────────────────────────────────────

  /*
   * Merged errors: parent errors are shown unless a local blur error
   * exists for the same field (local error is more recent).
   */
  const mergedErrors: FieldErrors<BikeFormBasicValues> = {
    ...errors,
    ...localErrors,
  }

  // ── Slug uniqueness check ─────────────────────────────────────────────

  /*
   * runSlugCheck — fires the slug-check API request.
   * Called by the useEffect after the debounce period.
   *
   * Compares the slug at call time to latestSlugRef before updating state
   * to discard stale responses from slower network requests.
   */
  const runSlugCheck = useCallback(
    async (slug: string): Promise<void> => {
      if (!slug || validateSlug(slug) !== null) {
        /*
         * Don't check if the slug has a format error —
         * the format error is already shown; no need for an availability
         * check that would be meaningless for an invalid format.
         */
        setSlugStatus('idle')
        return
      }

      setSlugStatus('checking')
      latestSlugRef.current = slug

      try {
        const params = new URLSearchParams({ slug })
        if (excludeId) params.set('excludeId', excludeId)
      
        const response = await fetch(
          `/api/admin/slug-check?${params.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        )
      
        /*
         * Discard the response if the slug changed while waiting.
         */
        if (latestSlugRef.current !== slug) return
      
        if (!response.ok) {
          setSlugStatus('error')
          return
        }
      
        const data = await response.json() as { available: boolean }
      
        if (data.available) {
          setSlugStatus('available')
      
          setLocalErrors(prev => ({
            ...prev,
            slug: undefined,
          }))
        } else {
          setSlugStatus('taken')
      
          setLocalErrors(prev => ({
            ...prev,
            slug: 'This slug is already used by another bike.',
          }))
        }
      
      } catch {
        /*
         * Network error or JSON parse failure.
         * Only update state if this response is still relevant.
         */
        if (latestSlugRef.current === slug) {
          setSlugStatus('error')
        }
      }
    },
    [excludeId],
  )

  /*
   * Debounce the slug uniqueness check.
   *
   * Fires 400ms after the slug value stops changing.
   * Clears previous timer before setting a new one.
   *
   * Only runs when values.slug has a valid format — format errors are
   * caught by validateSlug() inside runSlugCheck().
   *
   * Cleanup: clears the timer when the component unmounts or slug changes.
   */
  useEffect(() => {
    if (slugCheckTimerRef.current) {
      clearTimeout(slugCheckTimerRef.current)
    }

    /*
     * Reset slug status immediately when the slug changes so the
     * "available" / "taken" indicator does not show stale information
     * while the debounce timer is running.
     */
    setSlugStatus('idle')

    if (!values.slug) return

    slugCheckTimerRef.current = setTimeout(() => {
      void runSlugCheck(values.slug)
    }, SLUG_CHECK_DEBOUNCE_MS)

    return () => {
      if (slugCheckTimerRef.current) {
        clearTimeout(slugCheckTimerRef.current)
      }
    }
  }, [values.slug, runSlugCheck])

  // ── Field change handlers ─────────────────────────────────────────────

  /*
   * handleNameChange — updates the name field and auto-generates the slug
   * if the admin has not manually edited it.
   */
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const name = e.target.value
      const next: BikeFormBasicValues = { ...values, name }

      if (!slugManualRef.current) {
        next.slug = generateSlug(name)
      }

      onChange(next)
    },
    [values, onChange],
  )

  /*
   * handleSlugChange — updates the slug field and marks it as manually
   * edited so future name changes do not overwrite the admin's input.
   *
   * Enforces lowercase + safe characters on every keystroke:
   * replaces anything that is not [a-z0-9-] with an empty string.
   * This prevents the admin from entering invalid characters that would
   * then be flagged by the validator on blur.
   */
  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      slugManualRef.current = true

      /*
       * Sanitise on input — strip uppercase and invalid chars.
       * This does NOT enforce the full SLUG_REGEX (consecutive hyphens,
       * leading/trailing hyphens) — those are validated on blur.
       * Real-time stripping of those cases would make it impossible to
       * type "gt-650" (the hyphen would be stripped mid-typing).
       */
      const raw      = e.target.value
      const sanitised = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')

      onChange({ ...values, slug: sanitised })
    },
    [values, onChange],
  )

  /*
   * handleFieldChange — generic handler for select and text fields
   * that do not require special treatment.
   */
  const handleFieldChange = useCallback(
    (
      field: keyof BikeFormBasicValues,
      value: string,
    ): void => {
      onChange({ ...values, [field]: value })
    },
    [values, onChange],
  )

  /*
   * handleStatusChange — toggles between 'draft' and 'published'.
   */
  const handleStatusChange = useCallback(
    (status: 'draft' | 'published'): void => {
      onChange({ ...values, status })
    },
    [values, onChange],
  )

  // ── Field blur handlers ───────────────────────────────────────────────

  /*
   * handleNameBlur — validates the name field on blur.
   */
  const handleNameBlur = useCallback((): void => {
    const err = validateName(values.name)
    setLocalErrors((prev) => ({
      ...prev,
      name: err ?? undefined,
    }))
  }, [values.name])

  /*
   * handleSlugBlur — validates the slug format on blur.
   * The async uniqueness check is already running via the useEffect.
   */
  const handleSlugBlur = useCallback((): void => {
    const err = validateSlug(values.slug)
    setLocalErrors((prev) => ({
      ...prev,
      slug: err ?? undefined,
    }))
  }, [values.slug])

  /*
   * handleBrandBlur — validates the brand selection on blur.
   */
  const handleBrandBlur = useCallback((): void => {
    const err = validateBrandSlug(values.brandSlug)
    setLocalErrors((prev) => ({
      ...prev,
      brandSlug: err ?? undefined,
    }))
  }, [values.brandSlug])

  /*
   * handleCategoryBlur — validates the category selection on blur.
   */
  const handleCategoryBlur = useCallback((): void => {
    const err = validateCategory(values.category)
    setLocalErrors((prev) => ({
      ...prev,
      category: err ?? undefined,
    }))
  }, [values.category])

  /*
   * handleTaglineBlur — validates the tagline on blur.
   */
  const handleTaglineBlur = useCallback((): void => {
    const err = validateTagline(values.tagline)
    setLocalErrors((prev) => ({
      ...prev,
      tagline: err ?? undefined,
    }))
  }, [values.tagline])

  // ── Slug status UI helpers ────────────────────────────────────────────

  /*
   * renderSlugStatusIndicator — shows the async check result below the
   * slug input. Only shown when the slug has a valid format.
   *
   * checking  → spinning indicator
   * available → green "Slug is available" message
   * taken     → red error (distinct from format errors in mergedErrors.slug)
   * error     → muted "Could not verify" message
   * idle      → nothing
   */
  function renderSlugStatusIndicator(): React.ReactNode {
    if (mergedErrors.slug) {
      /*
       * Format error takes visual priority — don't show availability
       * alongside a format error since the slug will not be checked
       * for an invalid format.
       */
      return null
    }

    switch (slugStatus) {
      case 'checking':
        return (
          <p
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              margin: '5px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span
              aria-hidden="true"
              className="bfb-slug-spinner"
              style={{
                width: '10px',
                height: '10px',
                border: '1.5px solid var(--color-border-hairline)',
                borderTopColor: 'var(--color-ink-tertiary)',
                borderRadius: '999px',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            Checking availability…
          </p>
        )

      case 'available':
        return (
          <p
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: '#166534',
              margin: '5px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Icon name="check" size={12} strokeWidth={2.5} />
            Slug is available.
          </p>
        )

      case 'taken':
        return (
          <p
            role="alert"
            aria-live="polite"
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
            This slug is already used by another bike.
            Choose a different slug or append a suffix (e.g.{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              -{values.brandSlug || 'brand'}
            </code>
            ).
          </p>
        )

      case 'error':
        return (
          <p
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              margin: '5px 0 0',
            }}
          >
            Could not verify slug availability. Check your connection.
          </p>
        )

      case 'idle':
      default:
        return null
    }
  }

  // ── Shared input style ─────────────────────────────────────────────────

  /*
   * inputStyle — base style for text and select inputs.
   * Matches the admin-input class from admin.css but applied inline
   * so we can conditionally add error border colour.
   *
   * Using admin-input class directly for the input elements — the class
   * applies base padding, border, border-radius, and font.
   * Error state adds a red border override.
   */
  function inputStyle(hasError: boolean): React.CSSProperties {
    return hasError
      ? { width: '100%', borderColor: '#C8102E', boxSizing: 'border-box' }
      : { width: '100%', boxSizing: 'border-box' }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Slug spinner animation.
         */
        @keyframes bfb-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bfb-slug-spinner {
          animation: bfb-spin 0.8s linear infinite;
        }

        /*
         * Status pill buttons (Draft / Published).
         */
        .bfb-status-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 0 16px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1px solid var(--color-border-hairline);
          cursor: pointer;
          transition:
            background-color 150ms cubic-bezier(0.4,0,0.2,1),
            border-color     150ms cubic-bezier(0.4,0,0.2,1),
            color             150ms cubic-bezier(0.4,0,0.2,1);
          user-select: none;
          flex: 1;
          justify-content: center;
        }

        .bfb-status-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /* Draft — inactive */
        .bfb-status-btn--draft-off {
          background-color: var(--color-surface-raised);
          color: var(--color-ink-tertiary);
        }

        .bfb-status-btn--draft-off:hover:not(:disabled) {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-secondary);
        }

        /* Draft — active */
        .bfb-status-btn--draft-on {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-primary);
          border-color: var(--color-ink-secondary);
          font-weight: 600;
        }

        /* Published — inactive */
        .bfb-status-btn--published-off {
          background-color: var(--color-surface-raised);
          color: var(--color-ink-tertiary);
        }

        .bfb-status-btn--published-off:hover:not(:disabled) {
          background-color: rgba(22,101,52,0.06);
          color: #166534;
          border-color: #166534;
        }

        /* Published — active */
        .bfb-status-btn--published-on {
          background-color: rgba(22,101,52,0.08);
          color: #166534;
          border-color: #166534;
          font-weight: 600;
        }

        .bfb-status-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /*
         * Slug preview — shown below the slug input.
         * Displays the full public URL the slug will produce.
         */
        .bfb-slug-preview {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-tertiary);
          margin: 5px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bfb-slug-preview-accent {
          color: var(--color-ink-secondary);
        }

        /*
         * Section divider — subtle separator between field groups.
         */
        .bfb-divider {
          height: 1px;
          background-color: var(--color-border-hairline);
          margin: 24px 0;
        }

        /*
         * Input with trailing icon (slug field).
         * Position: relative on the wrapper, absolute on the icon.
         */
        .bfb-input-wrap {
          position: relative;
          width: 100%;
        }

        .bfb-input-trailing-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        /*
         * Two-column grid for brand + category selects on desktop.
         */
        .bfb-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 600px) {
          .bfb-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div>

        {/* ── Field group: Name + Slug ─────────────────────────── */}
        <section
          aria-label="Bike identity"
          style={{ marginBottom: '24px' }}
        >

          {/* Model Name */}
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel
              htmlFor="bfb-name"
              label="Model Name"
              required
            />

            <input
              id="bfb-name"
              type="text"
              value={values.name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              disabled={disabled}
              placeholder="e.g. GT 650"
              maxLength={FIELD_LIMITS.TAGLINE_MAX}
              className="admin-input"
              style={inputStyle(!!mergedErrors.name)}
              aria-describedby={
                mergedErrors.name ? 'bfb-name-error' : undefined
              }
              aria-required="true"
              aria-invalid={!!mergedErrors.name}
              autoComplete="off"
              spellCheck={false}
            />

            <FieldError id="bfb-name-error" message={mergedErrors.name} />
          </div>

          {/* URL Slug */}
          <div>
            <FieldLabel
              htmlFor="bfb-slug"
              label="URL Slug"
              required
            />

            {/* Input with trailing status icon */}
            <div className="bfb-input-wrap">
              <input
                id="bfb-slug"
                type="text"
                value={values.slug}
                onChange={handleSlugChange}
                onBlur={handleSlugBlur}
                disabled={disabled}
                placeholder="e.g. gt-650"
                maxLength={FIELD_LIMITS.SLUG_MAX}
                className="admin-input"
                style={{
                  ...inputStyle(!!mergedErrors.slug || slugStatus === 'taken'),
                  /*
                   * Extra right padding so trailing icon never overlaps text.
                   */
                  paddingRight: '36px',
                }}
                aria-describedby={
                  [
                    mergedErrors.slug ? 'bfb-slug-error' : '',
                    'bfb-slug-preview',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                aria-required="true"
                aria-invalid={
                  !!mergedErrors.slug || slugStatus === 'taken'
                }
                autoComplete="off"
                spellCheck={false}
              />

              {/* Trailing icon: spinner / check / warning */}
              <div className="bfb-input-trailing-icon">
                {slugStatus === 'checking' && (
                  <span
                    aria-hidden="true"
                    className="bfb-slug-spinner"
                    style={{
                      width: '13px',
                      height: '13px',
                      border: '1.5px solid var(--color-border-hairline)',
                      borderTopColor: 'var(--color-ink-tertiary)',
                      borderRadius: '999px',
                      display: 'inline-block',
                    }}
                  />
                )}

                {slugStatus === 'available' && !mergedErrors.slug && (
                  <Icon
                    name="check"
                    size={14}
                    strokeWidth={2.5}
                    style={{ color: '#166534' }}
                  />
                )}

                {(slugStatus === 'taken' || !!mergedErrors.slug) && (
                  <Icon
                    name="warning"
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: '#C8102E' }}
                  />
                )}
              </div>
            </div>

            {/* Slug public URL preview */}
            {values.slug && !mergedErrors.slug && (
              <p
                id="bfb-slug-preview"
                className="bfb-slug-preview"
                aria-label={`Public URL: /bikes/${values.brandSlug || '[brand]'}/${values.slug}`}
              >
                <span style={{ opacity: 0.5 }}>
                  {`/bikes/${values.brandSlug || '[brand]'}/`}
                </span>
                <span className="bfb-slug-preview-accent">
                  {values.slug}
                </span>
              </p>
            )}

            {/* Format error */}
            <FieldError id="bfb-slug-error" message={mergedErrors.slug} />

            {/* Async availability result */}
            {renderSlugStatusIndicator()}

            {/* Auto-generate hint — shown when slug is auto-generated */}
            {!slugManualRef.current && values.name && !mergedErrors.slug && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--color-ink-tertiary)',
                  margin: '5px 0 0',
                }}
              >
                Auto-generated from model name. Edit above to customise.
              </p>
            )}
          </div>
        </section>

        <div className="bfb-divider" aria-hidden="true" />

        {/* ── Field group: Brand + Category ───────────────────── */}
        <section
          aria-label="Brand and category"
          style={{ marginBottom: '24px' }}
        >
          <div className="bfb-grid-2">

            {/* Brand */}
            <div>
              <FieldLabel
                htmlFor="bfb-brand"
                label="Brand"
                required
              />

              <select
                id="bfb-brand"
                value={values.brandSlug}
                onChange={(e) =>
                  handleFieldChange('brandSlug', e.target.value)
                }
                onBlur={handleBrandBlur}
                disabled={disabled}
                className="admin-input"
                style={inputStyle(!!mergedErrors.brandSlug)}
                aria-describedby={
                  mergedErrors.brandSlug ? 'bfb-brand-error' : undefined
                }
                aria-required="true"
                aria-invalid={!!mergedErrors.brandSlug}
              >
                <option value="">Select brand…</option>
                {BRANDS.map((brand) => (
                  <option key={brand.slug} value={brand.slug}>
                    {brand.name}
                  </option>
                ))}
              </select>

              <FieldError
                id="bfb-brand-error"
                message={mergedErrors.brandSlug}
              />
            </div>

            {/* Category */}
            <div>
              <FieldLabel
                htmlFor="bfb-category"
                label="Category"
                required
              />

              <select
                id="bfb-category"
                value={values.category}
                onChange={(e) =>
                  handleFieldChange('category', e.target.value)
                }
                onBlur={handleCategoryBlur}
                disabled={disabled}
                className="admin-input"
                style={inputStyle(!!mergedErrors.category)}
                aria-describedby={
                  mergedErrors.category ? 'bfb-category-error' : undefined
                }
                aria-required="true"
                aria-invalid={!!mergedErrors.category}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <FieldError
                id="bfb-category-error"
                message={mergedErrors.category}
              />
            </div>
          </div>
        </section>

        <div className="bfb-divider" aria-hidden="true" />

        {/* ── Field group: Tagline ──────────────────────────────── */}
        <section
          aria-label="Tagline"
          style={{ marginBottom: '24px' }}
        >
          <FieldLabel
            htmlFor="bfb-tagline"
            label="Tagline"
            current={values.tagline.length}
            max={FIELD_LIMITS.TAGLINE_MAX}
          />

          <input
            id="bfb-tagline"
            type="text"
            value={values.tagline}
            onChange={(e) =>
              handleFieldChange('tagline', e.target.value)
            }
            onBlur={handleTaglineBlur}
            disabled={disabled}
            placeholder="e.g. Modern Classic Roadster"
            maxLength={FIELD_LIMITS.TAGLINE_MAX + 10}
            className="admin-input"
            style={inputStyle(!!mergedErrors.tagline)}
            aria-describedby={[
              'bfb-tagline-hint',
              mergedErrors.tagline ? 'bfb-tagline-error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={!!mergedErrors.tagline}
            autoComplete="off"
          />

          <p
            id="bfb-tagline-hint"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-ink-tertiary)',
              margin: '5px 0 0',
            }}
          >
            One short line shown below the bike name on the detail page.
            Optional.
          </p>

          <FieldError
            id="bfb-tagline-error"
            message={mergedErrors.tagline}
          />
        </section>

        <div className="bfb-divider" aria-hidden="true" />

        {/* ── Field group: Status ───────────────────────────────── */}
        <section aria-label="Publish status">
          <FieldLabel
            htmlFor="bfb-status"
            label="Status"
            required
          />

          {/*
           * Two pill buttons — Draft and Published.
           * role="radiogroup" + role="radio" for correct screen-reader
           * semantics (binary choice, not a standard checkbox).
           */}
          <div
            id="bfb-status"
            role="radiogroup"
            aria-label="Publish status"
            aria-required="true"
            style={{
              display: 'flex',
              gap: '8px',
              maxWidth: '360px',
            }}
          >
            {/* Draft button */}
            <button
              type="button"
              role="radio"
              aria-checked={values.status === 'draft'}
              disabled={disabled}
              className={`bfb-status-btn ${
                values.status === 'draft'
                  ? 'bfb-status-btn--draft-on'
                  : 'bfb-status-btn--draft-off'
              }`}
              onClick={() => handleStatusChange('draft')}
            >
              {values.status === 'draft' && (
                <Icon
                  name="check"
                  size={12}
                  strokeWidth={2.5}
                  style={{ flexShrink: 0 }}
                />
              )}
              Draft
            </button>

            {/* Published button */}
            <button
              type="button"
              role="radio"
              aria-checked={values.status === 'published'}
              disabled={disabled}
              className={`bfb-status-btn ${
                values.status === 'published'
                  ? 'bfb-status-btn--published-on'
                  : 'bfb-status-btn--published-off'
              }`}
              onClick={() => handleStatusChange('published')}
            >
              {values.status === 'published' && (
                <Icon
                  name="check"
                  size={12}
                  strokeWidth={2.5}
                  style={{ flexShrink: 0 }}
                />
              )}
              Published
            </button>
          </div>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-ink-tertiary)',
              margin: '8px 0 0',
              lineHeight: 1.5,
            }}
          >
            {values.status === 'published'
              ? 'This bike will be visible on the public site immediately after saving.'
              : 'Draft bikes are not visible on the public site. Publish when ready.'}
          </p>
        </section>
      </div>
    </>
  )
}