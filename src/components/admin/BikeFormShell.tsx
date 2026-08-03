'use client'

/*
 * BikeFormShell — Multi-section motorcycle creation and editing form container.
 *
 * MPD Tasks A-08 through A-12:
 *   "BikeForm components: basic info (A-08), specs (A-09), pricing (A-10),
 *   gallery/media (A-11), SEO (A-12)."
 *
 * A-08.2 scope — SHELL ONLY:
 *   1. BikeFormValues state management (full form across all 5 sections)
 *   2. Tab navigation with validity indicators (check / error badge)
 *   3. Section validation on tab switch and submission
 *   4. POST /api/bikes (create) → redirect to /admin/bikes/[slug]/edit
 *      PUT /api/bikes/[id] (edit) → success message, stays on page
 *   5. Sticky action bar: Prev · Section N of 5 · Next / Save Bike
 *   6. Section content rendered as informational stubs
 *
 *   Real section components slot in as implemented:
 *     basic:   BikeFormBasic   → A-08.3
 *     specs:   BikeFormSpecs   → A-09
 *     pricing: BikeFormPricing → A-10
 *     gallery: BikeFormGallery → A-11
 *     seo:     BikeFormSEO     → A-12
 *
 * SECTION UPDATE PATTERN:
 *   Each section component will receive:
 *     values:   its BikeFormValues slice (e.g. values.basic)
 *     errors:   its BikeFormErrors slice (e.g. errors.basic)
 *     onChange: a stable callback to update its slice
 *   The shell merges section updates into the full BikeFormValues via
 *   a dedicated update callback per section (updateBasic, updateSpecs…).
 *
 * VALIDATION FLOW:
 *   On tab switch / Next:  validate the section being left
 *   On submit:             validateAllSections() — validate every section
 *   Tabs show:             check icon (valid), error count badge (has errors),
 *                          nothing (not yet visited)
 *
 * SUBMIT FLOW — CREATE:
 *   validateAllSections → buildSubmitPayload → POST /api/bikes
 *   → 201: router.push(`/admin/bikes/${newBike.slug}/edit`)
 *   → err: setSubmitError
 *
 * SUBMIT FLOW — EDIT:
 *   validateAllSections → buildSubmitPayload → PUT /api/bikes/${initialData._id}
 *   → 200: setSubmitSuccess (4s auto-dismiss)
 *   → err: setSubmitError
 *
 * WHY 'use client':
 *   useState  (values, activeSection, errors, validatedSections, isSub…)
 *   useCallback (section updaters, navigation, validateSection, submit)
 *   useRouter  (post-create redirect)
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import BikeFormBasic from '@/components/admin/BikeFormBasic'
import BikeFormSpecifications from '@/components/admin/BikeFormSpecifications'
import {
  BIKE_FORM_SECTIONS,
  BIKE_FORM_SECTION_LABELS,
  DEFAULT_FORM_VALUES,
  type BikeFormMode,
  type BikeFormValues,
  type BikeFormSectionKey,
  type BikeFormErrors,
  type BikeFormInitialData,
  type BikeFormBasicValues,
  type BikeFormSpecValues,
  type BikeFormPricingValues,
  type BikeFormGalleryValues,
  type BikeFormSEOValues,
} from '@/types/bike-form'
import {
  validateBasicValues,
  validateSpecValues,
  validatePricingValues,
  validateGalleryValues,
  validateSEOValues,
  validateAllSections,
  buildSubmitPayload,
  bikeToFormValues,
} from '@/lib/bike-form-validation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeFormShellProps {
  /*
   * mode — 'create' or 'edit'.
   * 'create': no initialData; form starts from DEFAULT_FORM_VALUES.
   * 'edit':   initialData present; form seeded via bikeToFormValues().
   */
  mode: BikeFormMode

  /*
   * initialData — serialised bike document from the Server Component.
   * Required when mode='edit'. Ignored when mode='create'.
   */
  initialData?: BikeFormInitialData
}

/*
 * BikeApiResponse — shape returned by POST /api/bikes and PUT /api/bikes/[id].
 * Only the fields the shell needs after submission.
 */
interface BikeApiResponse {
  _id?:   string
  slug?:  string
  name?:  string
  error?: string
}

// ---------------------------------------------------------------------------
// Pure helpers (no hooks — safe at module scope)
// ---------------------------------------------------------------------------

/*
 * countSectionErrors — returns the number of validation errors in a section.
 * Used to render the error count badge on each tab.
 *
 * specs is nested (engine + dimensions sub-objects), so we sum both.
 */
function countSectionErrors(
  errors: BikeFormErrors,
  section: BikeFormSectionKey,
): number {
  switch (section) {
    case 'basic':
      return Object.keys(errors.basic ?? {}).length
    case 'specs':
      return (
        Object.keys(errors.specs?.engine     ?? {}).length +
        Object.keys(errors.specs?.dimensions ?? {}).length
      )
    case 'pricing':
      return Object.keys(errors.pricing ?? {}).length
    case 'gallery':
      return Object.keys(errors.gallery ?? {}).length
    case 'seo':
      return Object.keys(errors.seo ?? {}).length
  }
}

/*
 * hasSectionErrors — returns true when a section has at least one error.
 * Used to navigate to the first broken section on submit.
 */
function hasSectionErrors(
  errors: BikeFormErrors,
  section: BikeFormSectionKey,
): boolean {
  return countSectionErrors(errors, section) > 0
}

// ---------------------------------------------------------------------------
// SectionStub — placeholder rendered until the real section component exists
// ---------------------------------------------------------------------------

interface SectionStubProps {
  sectionKey:      BikeFormSectionKey
  implementedIn:   string
  description:     string
  fields:          string[]
}

function SectionStub({
  sectionKey,
  implementedIn,
  description,
  fields,
}: SectionStubProps) {
  return (
    <div
      style={{
        border: '1.5px dashed var(--color-border-hairline)',
        borderRadius: '10px',
        backgroundColor: 'var(--color-surface-sunken)',
        padding: '32px 24px',
      }}
    >
      {/* Section heading */}
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--color-ink-primary)',
          letterSpacing: '-0.01em',
          margin: '0 0 6px',
        }}
      >
        {BIKE_FORM_SECTION_LABELS[sectionKey]}
      </p>

      {/* Description */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-ink-secondary)',
          margin: '0 0 20px',
          lineHeight: 1.6,
          maxWidth: '520px',
        }}
      >
        {description}
      </p>

      {/* Fields list */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '24px',
        }}
      >
        {fields.map((field) => (
          <span
            key={field}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '26px',
              padding: '0 10px',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--color-ink-secondary)',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '999px',
            }}
          >
            {field}
          </span>
        ))}
      </div>

      {/* Implementation note */}
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
          style={{ color: 'var(--color-ink-tertiary)', flexShrink: 0 }}
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
            {implementedIn}
          </span>
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SECTION_STUBS — configuration for each section stub
// ---------------------------------------------------------------------------

/*
 * Static config for each section's stub display.
 * Kept outside the component to avoid recreation on every render.
 * Replace with the real section component import in A-08.3 through A-12.
 */
const SECTION_STUBS: Record<
  BikeFormSectionKey,
  Omit<SectionStubProps, 'sectionKey'>
> = {
  basic: {
    implementedIn: 'A-08.3',
    description:
      'Model name, URL slug, brand, category, one-line tagline, ' +
      'and publish status. Required for bike creation.',
    fields: [
      'Model Name',
      'URL Slug',
      'Brand',
      'Category',
      'Tagline',
      'Status (Draft / Published)',
    ],
  },
  specs: {
    implementedIn: 'A-09',
    description:
      'Engine and performance specifications, physical dimensions, ' +
      'and boolean feature toggles with riding modes.',
    fields: [
      'Displacement', 'Engine Type', 'Max Power', 'Max Torque',
      'Fuel System', 'Cooling', 'Transmission', 'Clutch',
      'Starting System', 'Emission Standard',
      'Kerb Weight', 'Fuel Capacity', 'Seat Height', 'Ground Clearance',
      'Wheelbase', 'Overall Length', 'Overall Width', 'Overall Height',
      'ABS', 'Dual-Channel ABS', 'TFT', 'Bluetooth', 'USB Charging',
      'Full LED', 'Slipper Clutch', 'Quickshifter', 'Traction Control',
      'Auto-Blipper', 'Cruise Control', 'Navigation', 'Riding Modes',
    ],
  },
  pricing: {
    implementedIn: 'A-10',
    description:
      'Ex-showroom and estimated on-road pricing in Indian Rupees, ' +
      'plus colour variants with hex swatches and optional variant images.',
    fields: [
      'Ex-Showroom Price (₹)',
      'On-Road Price (₹, optional)',
      'Colour Name',
      'Colour Hex Code',
      'Variant Image URL (optional)',
    ],
  },
  gallery: {
    implementedIn: 'A-11',
    description:
      'Hero image upload, gallery image management, and 360° spin video — ' +
      'wired to MediaUploader (A-07.3) and GalleryUploader (A-07.4).',
    fields: [
      'Hero Image (required, min 1200 × 900px)',
      'Gallery Images (optional, up to 10)',
      '360° Spin Video (optional, MP4/WEBM/MOV)',
    ],
  },
  seo: {
    implementedIn: 'A-12',
    description:
      'Optional SEO overrides. Auto-generated from the bike name and brand ' +
      'when left empty — only fill in when you need custom copy.',
    fields: [
      'Meta Title (max 60 chars)',
      'Meta Description (max 160 chars)',
      'Open Graph Image URL',
    ],
  },
}

// ---------------------------------------------------------------------------
// BikeFormShell — main component
// ---------------------------------------------------------------------------

export default function BikeFormShell({
  mode,
  initialData,
}: BikeFormShellProps) {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────

  /*
   * values — the complete form state across all five sections.
   * Seeded from bikeToFormValues(initialData) in edit mode, or
   * DEFAULT_FORM_VALUES in create mode.
   */
  const [values, setValues] = useState<BikeFormValues>(() =>
    initialData ? bikeToFormValues(initialData) : DEFAULT_FORM_VALUES,
  )

  /*
   * activeSection — which section tab is currently visible.
   * Navigation: tab click, handleNext, handlePrev.
   */
  const [activeSection, setActiveSection] =
    useState<BikeFormSectionKey>('basic')

  /*
   * errors — validation errors per section.
   * Only sections with errors have keys here.
   * Empty object → all validated sections are valid.
   */
  const [errors, setErrors] = useState<BikeFormErrors>({})

  /*
   * validatedSections — tracks which sections have been visited
   * and had their validators run at least once.
   * Used to show validity indicators only for visited sections.
   */
  const [validatedSections, setValidatedSections] = useState<
    Set<BikeFormSectionKey>
  >(new Set())

  const [isSubmitting,  setIsSubmitting]  = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // ── Derived state ──────────────────────────────────────────────────────

  const activeSectionIndex = BIKE_FORM_SECTIONS.indexOf(activeSection)
  const isFirstSection     = activeSectionIndex === 0
  const isLastSection      = activeSectionIndex === BIKE_FORM_SECTIONS.length - 1

  // ── Section validation ─────────────────────────────────────────────────

  /*
   * validateSection — validates a single section and updates errors state.
   *
   * Marks the section as validated (adds to validatedSections) so the
   * tab validity indicator becomes visible.
   *
   * Returns true if the section is valid (no errors).
   *
   * Called:
   *   - On tab click (validates the section being LEFT)
   *   - On Next (validates the section being LEFT)
   *   - From handleSubmit (via validateAllSections — a separate path)
   */
  const validateSection = useCallback(
    (section: BikeFormSectionKey, currentValues: BikeFormValues): boolean => {
      setValidatedSections((prev) => new Set([...prev, section]))

      switch (section) {
        case 'basic': {
          const e = validateBasicValues(currentValues.basic)
          const hasErrors = Object.keys(e).length > 0
          setErrors((prev) => ({
            ...prev,
            basic: hasErrors ? e : undefined,
          }))
          return !hasErrors
        }
        case 'specs': {
          const e = validateSpecValues(currentValues.specs)
          const hasErrors = Object.keys(e).length > 0
          setErrors((prev) => ({
            ...prev,
            specs: hasErrors ? e : undefined,
          }))
          return !hasErrors
        }
        case 'pricing': {
          const e = validatePricingValues(currentValues.pricing)
          const hasErrors = Object.keys(e).length > 0
          setErrors((prev) => ({
            ...prev,
            pricing: hasErrors ? e : undefined,
          }))
          return !hasErrors
        }
        case 'gallery': {
          const e = validateGalleryValues(currentValues.gallery)
          const hasErrors = Object.keys(e).length > 0
          setErrors((prev) => ({
            ...prev,
            gallery: hasErrors ? e : undefined,
          }))
          return !hasErrors
        }
        case 'seo': {
          const e = validateSEOValues(currentValues.seo)
          const hasErrors = Object.keys(e).length > 0
          setErrors((prev) => ({
            ...prev,
            seo: hasErrors ? e : undefined,
          }))
          return !hasErrors
        }
      }
    },
    [],
  )

  // ── Section update callbacks ──────────────────────────────────────────

  /*
   * One stable update callback per section.
   * Each real section component (A-08.3+) receives its updater.
   * The shell merges the new slice into the full BikeFormValues.
   *
   * These callbacks are stable (empty deps array) so they do not cause
   * unnecessary re-renders in memoised section components.
   */
  const updateBasic = useCallback((v: BikeFormBasicValues): void => {
    setValues((prev) => ({ ...prev, basic: v }))
  }, [])

  const updateSpecs = useCallback((v: BikeFormSpecValues): void => {
    setValues((prev) => ({ ...prev, specs: v }))
  }, [])

  const updatePricing = useCallback((v: BikeFormPricingValues): void => {
    setValues((prev) => ({ ...prev, pricing: v }))
  }, [])

  const updateGallery = useCallback((v: BikeFormGalleryValues): void => {
    setValues((prev) => ({ ...prev, gallery: v }))
  }, [])

  const updateSEO = useCallback((v: BikeFormSEOValues): void => {
    setValues((prev) => ({ ...prev, seo: v }))
  }, [])

  /*
   * NOTE for A-08.3 through A-12:
   *   When implementing each section component, pass the updater like:
   *
   *   // In renderSection() 'basic' case:
   *   <BikeFormBasic
   *     values={values.basic}
   *     errors={errors.basic}
   *     onChange={updateBasic}
   *   />
   *
   *   The shell does NOT re-validate on every keystroke.
   *   Re-validation happens only on tab leave and submit.
   */

  // ── Navigation ────────────────────────────────────────────────────────

  /*
   * handleTabClick — navigates to the clicked section.
   * Validates the current section before leaving it.
   */
  const handleTabClick = useCallback(
    (target: BikeFormSectionKey): void => {
      if (target === activeSection) return
      validateSection(activeSection, values)
      setActiveSection(target)
      setSubmitError(null)
      setSubmitSuccess(false)
    },
    [activeSection, values, validateSection],
  )

  /*
   * handleNext — advances to the next section.
   * Validates the current section before leaving.
   */
  const handleNext = useCallback((): void => {
    validateSection(activeSection, values)
    const nextIndex = activeSectionIndex + 1
    if (nextIndex < BIKE_FORM_SECTIONS.length) {
      setActiveSection(BIKE_FORM_SECTIONS[nextIndex])
      setSubmitError(null)
    }
  }, [activeSection, activeSectionIndex, values, validateSection])

  /*
   * handlePrev — returns to the previous section.
   * Does NOT validate (the admin is moving backwards to fix something).
   */
  const handlePrev = useCallback((): void => {
    const prevIndex = activeSectionIndex - 1
    if (prevIndex >= 0) {
      setActiveSection(BIKE_FORM_SECTIONS[prevIndex])
      setSubmitError(null)
      setSubmitSuccess(false)
    }
  }, [activeSectionIndex])

  // ── Submit ────────────────────────────────────────────────────────────

  /*
   * handleSubmit — validates all sections and posts to the API.
   *
   * Validation:
   *   validateAllSections() runs every section validator and returns
   *   the complete BikeFormErrors object. If any section has errors,
   *   all sections are marked as validated (so error badges appear on
   *   all tabs), the first broken section is activated, and a summary
   *   error message is shown in the action bar.
   *
   * Submission:
   *   buildSubmitPayload() converts BikeFormValues to BikeFormSubmitPayload
   *   (strings → numbers for pricing, empty optionals omitted, etc.).
   *
   * After submission:
   *   Create mode: router.push to the new bike's edit page.
   *   Edit mode:   success message auto-dismissed after 4 seconds.
   */
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (isSubmitting) return

    setSubmitError(null)
    setSubmitSuccess(false)

    // ── Validate all sections ───────────────────────────────────────
    const allErrors = validateAllSections(values)

    // Mark every section as validated (shows badges on all tabs)
    setValidatedSections(new Set<BikeFormSectionKey>([...BIKE_FORM_SECTIONS]))
    setErrors(allErrors)

    if (Object.keys(allErrors).length > 0) {
      /*
       * Navigate to the first section that has errors so the admin
       * can see what needs fixing immediately.
       */
      const firstError = BIKE_FORM_SECTIONS.find((s) =>
        hasSectionErrors(allErrors, s),
      )
      if (firstError) {
        setActiveSection(firstError)
      }

      setSubmitError(
        'Please fix the errors in the highlighted sections before saving.',
      )
      return
    }

    // ── Build payload and submit ────────────────────────────────────
    setIsSubmitting(true)

    const payload = buildSubmitPayload(values)

    try {
      const isCreate = mode === 'create'
      const url      = isCreate
        ? '/api/bikes'
        : `/api/bikes/${initialData!._id}`

      const response = await fetch(url, {
        method:  isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const data = await response.json() as BikeApiResponse

      if (!response.ok) {
        throw new Error(
          data.error ??
            `Save failed — server returned ${response.status}.`,
        )
      }

      if (isCreate) {
        /*
         * Redirect to the edit page for the newly created bike.
         * The edit page (A-07.5) already handles media uploads.
         * After A-08.3–A-12 are complete, the edit page will render
         * BikeFormShell in edit mode with all sections.
         */
        if (!data.slug) {
          throw new Error(
            'Bike was created but the server did not return a slug. ' +
            'Check /admin/bikes and navigate to the new entry manually.',
          )
        }
        router.push(`/admin/bikes/${data.slug}/edit`)
        return
      }

      /*
       * Edit mode — show success message, auto-dismiss after 4 seconds.
       */
      setSubmitSuccess(true)

      const timer = setTimeout(() => setSubmitSuccess(false), 4000)
      /*
       * NOTE: The timer is not cleaned up if the component unmounts.
       * For a sticky admin page this is acceptable — the worst case
       * is calling setState on an unmounted component, which React 18
       * no longer warns about. If strict cleanup is required in future,
       * wrap in useEffect with a ref.
       */
      void timer
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Save failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, values, mode, initialData, router])

  // ── Section content ───────────────────────────────────────────────────

  /*
   * renderSection — renders the active section's content.
   *
   * A-08.2: all sections render informational SectionStub placeholders.
   * A-08.3: replace 'basic' case with <BikeFormBasic ... />.
   * A-09:   replace 'specs' case.
   * A-10:   replace 'pricing' case.
   * A-11:   replace 'gallery' case.
   * A-12:   replace 'seo' case.
   */
  function renderSection(): React.ReactNode {
    if (activeSection === 'basic') {
      return (
        <BikeFormBasic
          values={values.basic}
          errors={errors.basic}
          onChange={updateBasic}
          excludeId={initialData?._id}
          disabled={isSubmitting}
        />
      )
    }
  
    if (activeSection === 'specs') {
      return (
        <BikeFormSpecifications
          values={values.specs}
          errors={errors.specs}
          onChange={updateSpecs}
          disabled={isSubmitting}
        />
      )
    }
    const stub = SECTION_STUBS[activeSection]

    return (
      <SectionStub
        sectionKey={activeSection}
        implementedIn={stub.implementedIn}
        description={stub.description}
        fields={stub.fields}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* ── Tab bar ─────────────────────────────────────────────── */

        /*
         * Horizontally scrollable on mobile — the 5 tabs may not fit
         * on narrow screens. Hidden scrollbar for cleanliness.
         */
        .bfs-tabs {
          display: flex;
          border-bottom: 1px solid var(--color-border-hairline);
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          gap: 0;
          flex-shrink: 0;
          margin-bottom: 24px;
        }

        .bfs-tabs::-webkit-scrollbar {
          display: none;
        }

        /* ── Individual tab ──────────────────────────────────────── */

        .bfs-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 16px;
          height: 44px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-tertiary);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition:
            color 150ms cubic-bezier(0.4,0,0.2,1),
            border-color 150ms cubic-bezier(0.4,0,0.2,1);
          position: relative;
          margin-bottom: -1px;
        }

        .bfs-tab:hover {
          color: var(--color-ink-primary);
        }

        .bfs-tab:focus-visible {
          outline: none;
          box-shadow: inset var(--shadow-focus);
        }

        /* Active tab — accent underline + ink-primary text */
        .bfs-tab--active {
          color: var(--color-ink-primary) !important;
          font-weight: 600;
          border-bottom-color: #7A2E2E;
        }

        /* ── Tab validity badges ─────────────────────────────────── */

        .bfs-tab-check {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background-color: #166534;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          flex-shrink: 0;
        }

        .bfs-tab-error {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background-color: #C8102E;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          color: #FFFFFF;
          flex-shrink: 0;
        }

        /* ── Section content area ────────────────────────────────── */

        .bfs-section {
          min-height: 280px;
        }

        /* ── Sticky action bar ───────────────────────────────────── */

        /*
         * Sticky at the bottom of the scrollable page content.
         * z-index 10 keeps it above section content but below overlays.
         */
        .bfs-action-bar {
          position: sticky;
          bottom: 0;
          z-index: 10;
          background-color: var(--color-surface-raised);
          border-top: 1px solid var(--color-border-hairline);
          padding: 12px 0;
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* ── Navigation buttons ──────────────────────────────────── */

        .bfs-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 36px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-ink-secondary);
          background-color: var(--color-surface-sunken);
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
          transition:
            color 150ms cubic-bezier(0.4,0,0.2,1),
            background-color 150ms cubic-bezier(0.4,0,0.2,1);
          user-select: none;
        }

        .bfs-nav-btn:hover:not(:disabled) {
          color: var(--color-ink-primary);
          background-color: var(--color-surface-sunken);
          border-color: var(--color-ink-tertiary);
        }

        .bfs-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .bfs-nav-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /* ── Save / Submit button ────────────────────────────────── */

        .bfs-submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 20px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: #FFFFFF;
          background-color: #7A2E2E;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
          transition: filter 150ms cubic-bezier(0.4,0,0.2,1);
          user-select: none;
        }

        .bfs-submit-btn:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .bfs-submit-btn:active:not(:disabled) {
          filter: brightness(0.92);
        }

        .bfs-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bfs-submit-btn:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 2px var(--color-surface-base),
            0 0 0 4px #7A2E2E;
          border-radius: 8px;
        }

        /* ── Submit spinner ──────────────────────────────────────── */

        @keyframes bfs-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bfs-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #FFFFFF;
          border-radius: 999px;
          animation: bfs-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* ── Next button (secondary style) ──────────────────────── */

        .bfs-next-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 36px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-ink-primary);
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
          transition:
            background-color 150ms cubic-bezier(0.4,0,0.2,1),
            border-color 150ms cubic-bezier(0.4,0,0.2,1);
          user-select: none;
        }

        .bfs-next-btn:hover {
          background-color: var(--color-surface-sunken);
          border-color: var(--color-ink-tertiary);
        }

        .bfs-next-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }
      `}</style>

      {/* ── Tab navigation ──────────────────────────────────────── */}
      <nav
        aria-label="BikeForm section navigation"
        role="tablist"
      >
        <div className="bfs-tabs">
          {BIKE_FORM_SECTIONS.map((section) => {
            const isActive        = section === activeSection
            const wasValidated    = validatedSections.has(section)
            const errorCount      = countSectionErrors(errors, section)
            const isValid         = wasValidated && errorCount === 0
            const hasErrors       = wasValidated && errorCount > 0

            return (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`bfs-panel-${section}`}
                id={`bfs-tab-${section}`}
                className={`bfs-tab${isActive ? ' bfs-tab--active' : ''}`}
                onClick={() => handleTabClick(section)}
              >
                {BIKE_FORM_SECTION_LABELS[section]}

                {/*
                 * Validity indicator — only shown for sections that have
                 * been visited (validated) at least once.
                 *
                 * Valid:      green check circle
                 * Has errors: red pill with error count
                 * Not visited: nothing
                 */}
                {isValid && (
                  <span
                    className="bfs-tab-check"
                    aria-label={`${BIKE_FORM_SECTION_LABELS[section]} — valid`}
                  >
                    <Icon name="check" size={9} strokeWidth={3} />
                  </span>
                )}

                {hasErrors && (
                  <span
                    className="bfs-tab-error"
                    aria-label={`${BIKE_FORM_SECTION_LABELS[section]} — ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                  >
                    {errorCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Section content panel ────────────────────────────────── */}
      <div
        id={`bfs-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`bfs-tab-${activeSection}`}
        className="bfs-section"
      >
        {renderSection()}
      </div>

      {/* ── Sticky action bar ────────────────────────────────────── */}
      <div className="bfs-action-bar">

        {/* Left — Prev button */}
        <button
          type="button"
          className="bfs-nav-btn"
          onClick={handlePrev}
          disabled={isFirstSection || isSubmitting}
          aria-label="Go to previous section"
        >
          ← Prev
        </button>

        {/* Centre — status messages */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {/* Section counter */}
          <p
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-ink-tertiary)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {BIKE_FORM_SECTION_LABELS[activeSection]}
            {' · '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              {activeSectionIndex + 1} of {BIKE_FORM_SECTIONS.length}
            </span>
          </p>

          {/* Submit error */}
          {submitError && (
            <p
              role="alert"
              aria-live="assertive"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: '#C8102E',
                margin: 0,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Icon name="warning" size={12} strokeWidth={1.75} />
              {submitError}
            </p>
          )}

          {/* Submit success */}
          {submitSuccess && !submitError && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 500,
                color: '#166534',
                margin: 0,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Icon name="check" size={12} strokeWidth={2.5} />
              Saved successfully.
            </p>
          )}
        </div>

        {/* Right — Next or Submit */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {!isLastSection ? (
            /*
             * Next — shown on all sections except the last.
             * Validates the current section before advancing.
             */
            <button
              type="button"
              className="bfs-next-btn"
              onClick={handleNext}
              disabled={isSubmitting}
              aria-label="Validate and go to next section"
            >
              Next →
            </button>
          ) : (
            /*
             * Save Bike — shown on the last section (SEO).
             * Validates all sections and submits.
             */
            <button
              type="button"
              className="bfs-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              aria-label={
                isSubmitting
                  ? 'Saving bike…'
                  : mode === 'create'
                  ? 'Save new bike to database'
                  : 'Save changes to bike'
              }
            >
              {isSubmitting ? (
                <>
                  <span className="bfs-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="check" size={14} strokeWidth={2.5} />
                  {mode === 'create' ? 'Save Bike' : 'Save Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}