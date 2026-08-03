/*
 * bike-form-validation.ts — Validation functions and utilities for the
 * MotoHub360 BikeForm system.
 *
 * MPD Tasks A-08 through A-12:
 *   "BikeForm components: basic info, specs, pricing, gallery, SEO."
 *
 * A-08.1 scope:
 *   Pure validation functions, the slug generator, the price parser,
 *   the submit payload builder, and the edit-mode form seeder.
 *
 * FUNCTION CATEGORIES:
 *   1. Utilities         — generateSlug, parsePriceString, isValidUrl, isValidHex
 *   2. Field validators  — each returns string | null (error or null = valid)
 *   3. Section validators — call field validators, return FieldErrors<T>
 *   4. Payload builder   — buildSubmitPayload: BikeFormValues → BikeFormSubmitPayload
 *   5. Edit seeder       — bikeToFormValues: BikeFormInitialData → BikeFormValues
 *
 * VALIDATION DESIGN:
 *   - All functions are pure (no side effects, no API calls, no DB reads).
 *   - Field validators return string | null:
 *       null   = field is valid
 *       string = human-readable error message shown below the input
 *   - Section validators return FieldErrors<T>:
 *       {}               = section is valid (no errors)
 *       { name: '...' } = name field has an error
 *   - Slug UNIQUENESS (async — requires a DB call) is NOT validated here.
 *     A-08.2 will add a debounced async slug check via the /api/bikes route.
 *     This file validates only slug FORMAT (client-side, synchronous).
 *
 * SERVER / CLIENT SAFE:
 *   This module imports only:
 *     - @/types/bike-form  (pure TypeScript — no runtime deps)
 *     - @/constants/brands (JSON-equivalent const export)
 *     - @/constants/categories (JSON-equivalent const export)
 *   No Node.js dependencies. Safe to import in both Server and Client Components.
 */

import type {
    BikeFormBasicValues,
    BikeFormColorVariant,
    BikeFormErrors,
    BikeFormGalleryValues,
    BikeFormInitialData,
    BikeFormPricingValues,
    BikeFormSEOValues,
    BikeFormSectionKey,
    BikeFormSectionValidity,
    BikeFormSpecDimensionValues,
    BikeFormSpecEngineValues,
    BikeFormSpecFeatureValues,
    BikeFormSpecValues,
    BikeFormSubmitPayload,
    BikeFormValues,
    FieldErrors,
  } from '@/types/bike-form'
  import {
    DEFAULT_FORM_VALUES,
  } from '@/types/bike-form'
  import { BRANDS } from '@/constants/brands'
  import { CATEGORIES } from '@/constants/categories'
  
  // ---------------------------------------------------------------------------
  // Field length constraints
  // ---------------------------------------------------------------------------
  
  /*
   * These constants are used in both validators and UI hint text.
   * Exported so form components can display "X / MAX characters" counters.
   */
  export const FIELD_LIMITS = {
    NAME_MIN:            2,
    NAME_MAX:            100,
    SLUG_MIN:            2,
    SLUG_MAX:            80,
    TAGLINE_MAX:         120,
    SPEC_FIELD_MAX:      200,   // engine / dimension spec strings
    COLOR_NAME_MIN:      1,
    COLOR_NAME_MAX:      50,
    META_TITLE_MAX:      60,
    META_DESCRIPTION_MAX: 160,
    PRICE_MIN:           10_000,        // ₹10,000 — below this is unrealistic
    PRICE_MAX:           100_000_000,   // ₹10 crore — above this is unrealistic
  } as const
  
  /*
   * SLUG_REGEX — validates URL slug format.
   *
   * Pattern: one or more lowercase alphanumeric characters, optionally
   * followed by groups of (hyphen + one or more alphanumeric characters).
   *
   * Valid:   "gt-650", "cbr-650r", "himalayan-450", "duke-390", "mt-15"
   * Invalid: "GT-650" (uppercase), "-gt-650" (leading hyphen),
   *          "gt--650" (consecutive hyphens), "gt-650-" (trailing hyphen),
   *          "gt 650" (space)
   */
  const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
  
  /*
   * HEX_REGEX — validates a 6-digit CSS hex colour including the # prefix.
   * Valid: "#7A2E2E", "#FF6A00", "#1a1a1a"
   * Invalid: "7A2E2E" (missing #), "#7A2E2" (5 digits), "#GG0000" (invalid chars)
   */
  const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/
  
  /*
   * URL_REGEX — simple URL validation for optional URL fields (ogImageUrl).
   * Accepts http:// and https:// URLs.
   * Not RFC-3986 compliant — just enough to catch obvious errors.
   */
  const URL_REGEX = /^https?:\/\/.+\..+/
  
  // ---------------------------------------------------------------------------
  // 1. Utilities
  // ---------------------------------------------------------------------------
  
  /*
   * generateSlug — converts a motorcycle model name into a URL-safe slug.
   *
   * ALGORITHM:
   *   1. Lowercase
   *   2. Trim leading/trailing whitespace
   *   3. Replace non-alphanumeric characters with spaces
   *   4. Collapse multiple spaces into a single space
   *   5. Convert spaces to hyphens
   *   6. Collapse multiple hyphens (from step 3→5)
   *   7. Strip remaining leading/trailing hyphens
   *
   * EXAMPLES:
   *   "GT 650"                         → "gt-650"
   *   "CBR 650R"                       → "cbr-650r"
   *   "Himalayan 450 (Battle Green)"   → "himalayan-450-battle-green"
   *   "MT-15 Version 2.0"              → "mt-15-version-2-0"
   *   "Super Meteor 650"               → "super-meteor-650"
   *   "  Pulsar NS200  "               → "pulsar-ns200"
   *
   * USAGE:
   *   Called in the BikeFormBasic name input's onChange handler (A-08.2)
   *   to auto-populate the slug field while the admin types the name.
   *   The admin can then manually edit the generated slug if needed.
   */
  export function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, ' ')  // non-alphanumeric → space
      .replace(/\s+/g, ' ')           // collapse multiple spaces
      .trim()                          // trim again (space may have been added at edges)
      .replace(/\s/g, '-')             // spaces → hyphens
      .replace(/-+/g, '-')             // collapse consecutive hyphens
      .replace(/^-|-$/g, '')           // strip leading/trailing hyphens
  }
  
  /*
   * parsePriceString — converts a price string to a number.
   *
   * Handles Indian number formatting (commas) and currency symbols.
   *
   * Returns null if the input cannot be parsed as a positive integer.
   *
   * EXAMPLES:
   *   "348000"    → 348000
   *   "3,48,000"  → 348000   (Indian comma formatting)
   *   "₹3,48,000" → 348000   (with rupee symbol)
   *   "3.48 L"    → null     (lakh notation not parsed — admin should enter raw INR)
   *   "abc"       → null
   *   ""          → null
   *   "0"         → null     (zero is not a valid price)
   *   "-100"      → null     (negative prices invalid)
   */
  export function parsePriceString(value: string): number | null {
    if (!value.trim()) return null
  
    /*
     * Strip: Indian commas, rupee symbol, spaces, periods used as thousands separators.
     * We do NOT strip periods used as decimal points — parseFloat would be needed
     * for that. All motorcycle prices in India are integers in INR.
     */
    const cleaned = value.replace(/[,\s₹]/g, '')
    const parsed  = parseInt(cleaned, 10)
  
    if (isNaN(parsed) || parsed <= 0) return null
  
    return parsed
  }
  
  /*
   * isValidUrl — basic URL format check.
   * Returns true for http:// or https:// URLs.
   * Used for optional URL fields (ogImageUrl).
   */
  export function isValidUrl(value: string): boolean {
    return URL_REGEX.test(value)
  }
  
  /*
   * isValidHex — validates a 6-digit CSS hex colour string.
   * Returns true for "#RRGGBB" format (case-insensitive).
   */
  export function isValidHex(value: string): boolean {
    return HEX_REGEX.test(value)
  }
  
  /*
   * omitEmpty — removes keys with empty string values from an object.
   *
   * Used in buildSubmitPayload() to strip unfilled optional spec fields
   * before sending to the API, keeping the MongoDB document clean.
   *
   * Input:  { displacement: '648 cc', engineType: '', maxPower: '47 bhp' }
   * Output: { displacement: '648 cc', maxPower: '47 bhp' }
   */
  function omitEmpty<T extends Record<string, string | undefined>>(
    obj: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => typeof v === 'string' && v.trim().length > 0),
    ) as Partial<T>
  }
  
  // ---------------------------------------------------------------------------
  // 2. Field validators
  // ---------------------------------------------------------------------------
  
  /*
   * All field validators follow this contract:
   *   - Accepts the raw field value (string, boolean, or array as appropriate)
   *   - Returns null if the field is valid
   *   - Returns a human-readable error string if invalid
   *   - Does NOT throw
   *
   * Error strings are displayed directly in the form UI below the relevant input.
   * They should be concise, specific, and actionable.
   */
  
  /*
   * validateName — validates the bike model name.
   *
   * Required. 2–100 characters.
   * Leading/trailing spaces are trimmed before length check (UI trims on submit).
   * No special character restrictions — model names can contain digits,
   * slashes, parentheses, etc. ("CBR 650R", "Himalayan 450 (Battle Green)").
   */
  export function validateName(value: string): string | null {
    const trimmed = value.trim()
  
    if (trimmed.length === 0) {
      return 'Model name is required.'
    }
  
    if (trimmed.length < FIELD_LIMITS.NAME_MIN) {
      return `Model name must be at least ${FIELD_LIMITS.NAME_MIN} characters.`
    }
  
    if (trimmed.length > FIELD_LIMITS.NAME_MAX) {
      return `Model name must be ${FIELD_LIMITS.NAME_MAX} characters or fewer.`
    }
  
    return null
  }
  
  /*
   * validateSlug — validates the URL slug FORMAT (not uniqueness).
   *
   * Required. 2–80 characters.
   * Must match SLUG_REGEX: lowercase alphanumeric + hyphens,
   * no leading/trailing/consecutive hyphens.
   *
   * UNIQUENESS is not checked here — that requires an async DB call.
   * A-08.2 (BikeFormBasic component) adds a debounced uniqueness check.
   */
  export function validateSlug(value: string): string | null {
    if (!value.trim()) {
      return 'URL slug is required.'
    }
  
    if (value.length < FIELD_LIMITS.SLUG_MIN) {
      return `Slug must be at least ${FIELD_LIMITS.SLUG_MIN} characters.`
    }
  
    if (value.length > FIELD_LIMITS.SLUG_MAX) {
      return `Slug must be ${FIELD_LIMITS.SLUG_MAX} characters or fewer.`
    }
  
    if (!SLUG_REGEX.test(value)) {
      return (
        'Slug must contain only lowercase letters (a–z), numbers (0–9), ' +
        'and single hyphens (not at the start or end).'
      )
    }
  
    return null
  }
  
  /*
   * validateBrandSlug — validates that the selected brand is in the BRANDS constant.
   *
   * Required. The admin selects from a <select> populated with BRANDS —
   * this validator catches edge cases where an invalid value is submitted.
   */
  export function validateBrandSlug(value: string): string | null {
    if (!value.trim()) {
      return 'Brand is required. Select a brand from the list.'
    }
  
    const isKnown = BRANDS.some((b) => b.slug === value)
    if (!isKnown) {
      return `"${value}" is not a recognised brand. Select from the available options.`
    }
  
    return null
  }
  
  /*
   * validateCategory — validates that the selected category is in CATEGORIES.
   *
   * Required. Same pattern as validateBrandSlug.
   */
  export function validateCategory(value: string): string | null {
    if (!value.trim()) {
      return 'Category is required. Select a category from the list.'
    }
  
    const isKnown = CATEGORIES.some((c) => c.slug === value)
    if (!isKnown) {
      return `"${value}" is not a recognised category. Select from the available options.`
    }
  
    return null
  }
  
  /*
   * validateTagline — validates the optional one-line tagline.
   *
   * Optional. Max 120 characters.
   * No minimum length — a tagline can be omitted by leaving it empty.
   */
  export function validateTagline(value: string): string | null {
    if (value.length > FIELD_LIMITS.TAGLINE_MAX) {
      return `Tagline must be ${FIELD_LIMITS.TAGLINE_MAX} characters or fewer (currently ${value.length}).`
    }
    return null
  }
  
  /*
   * validateSpecTextField — validates a single optional spec text field.
   *
   * All engine and dimension fields share the same max-length constraint.
   * Label is included in the error message so the admin knows which field failed.
   */
  export function validateSpecTextField(
    value: string,
    label: string,
  ): string | null {
    if (value.length > FIELD_LIMITS.SPEC_FIELD_MAX) {
      return `${label} must be ${FIELD_LIMITS.SPEC_FIELD_MAX} characters or fewer.`
    }
    return null
  }
  
  /*
   * validateExShowroom — validates the ex-showroom price field.
   *
   * Required. Must be a parseable positive integer in PRICE_MIN–PRICE_MAX range.
   * Accepts Indian comma formatting ("3,48,000").
   */
  export function validateExShowroom(value: string): string | null {
    if (!value.trim()) {
      return 'Ex-showroom price is required.'
    }
  
    const parsed = parsePriceString(value)
  
    if (parsed === null) {
      return 'Enter a valid price in INR (e.g. 348000 or 3,48,000).'
    }
  
    if (parsed < FIELD_LIMITS.PRICE_MIN) {
      return `Price must be at least ₹${FIELD_LIMITS.PRICE_MIN.toLocaleString('en-IN')}.`
    }
  
    if (parsed > FIELD_LIMITS.PRICE_MAX) {
      return `Price must be ₹${FIELD_LIMITS.PRICE_MAX.toLocaleString('en-IN')} or less.`
    }
  
    return null
  }
  
  /*
   * validateOnRoad — validates the optional on-road price.
   *
   * Optional — empty string returns null.
   * When provided: must be parseable and must be >= exShowroom.
   * If exShowroom is invalid, only format is checked (no comparison).
   */
  export function validateOnRoad(
    onRoadValue: string,
    exShowroomValue: string,
  ): string | null {
    if (!onRoadValue.trim()) return null
  
    const onRoad = parsePriceString(onRoadValue)
  
    if (onRoad === null) {
      return 'Enter a valid on-road price in INR (e.g. 410000 or 4,10,000).'
    }
  
    if (onRoad > FIELD_LIMITS.PRICE_MAX) {
      return `On-road price must be ₹${FIELD_LIMITS.PRICE_MAX.toLocaleString('en-IN')} or less.`
    }
  
    /*
     * Cross-field validation: on-road should be >= ex-showroom.
     * Only validates if exShowroom itself is valid (not null).
     */
    const exShowroom = parsePriceString(exShowroomValue)
    if (exShowroom !== null && onRoad < exShowroom) {
      return 'On-road price must be greater than or equal to the ex-showroom price.'
    }
  
    return null
  }
  
  /*
   * validateColorVariant — validates a single colour variant.
   *
   * Returns an object of field-level errors for the variant.
   * Empty object = variant is valid.
   */
  export function validateColorVariant(
    variant: BikeFormColorVariant,
    index: number,
  ): { name?: string; hex?: string } {
    const errors: { name?: string; hex?: string } = {}
    const label = `Colour ${index + 1}`
  
    if (!variant.name.trim()) {
      errors.name = `${label}: colour name is required.`
    } else if (variant.name.length > FIELD_LIMITS.COLOR_NAME_MAX) {
      errors.name = `${label}: name must be ${FIELD_LIMITS.COLOR_NAME_MAX} characters or fewer.`
    }
  
    if (!variant.hex.trim()) {
      errors.hex = `${label}: hex colour code is required.`
    } else if (!isValidHex(variant.hex)) {
      errors.hex = `${label}: enter a valid 6-digit hex code (e.g. #7A2E2E).`
    }
  
    return errors
  }
  
  /*
   * validateHeroImageUrl — validates that a hero image URL has been set.
   *
   * The URL itself is not format-validated here — it was set by MediaUploader
   * (A-07.3) which only accepts valid Cloudinary URLs. We just check it's non-empty.
   */
  export function validateHeroImageUrl(value: string): string | null {
    if (!value.trim()) {
      return (
        'A hero image is required. ' +
        'Upload one via the Gallery & Media section or the Media edit page.'
      )
    }
    return null
  }
  
  /*
   * validateMetaTitle — validates the optional SEO meta title.
   *
   * Optional. Max 60 characters (Google truncates at ~60).
   * Empty string is valid (auto-generated from bike name + brand).
   */
  export function validateMetaTitle(value: string): string | null {
    if (value.length > FIELD_LIMITS.META_TITLE_MAX) {
      return (
        `Meta title must be ${FIELD_LIMITS.META_TITLE_MAX} characters or fewer ` +
        `(currently ${value.length}).`
      )
    }
    return null
  }
  
  /*
   * validateMetaDescription — validates the optional SEO meta description.
   *
   * Optional. Max 160 characters (Google truncates at ~155–160).
   */
  export function validateMetaDescription(value: string): string | null {
    if (value.length > FIELD_LIMITS.META_DESCRIPTION_MAX) {
      return (
        `Meta description must be ${FIELD_LIMITS.META_DESCRIPTION_MAX} characters or fewer ` +
        `(currently ${value.length}).`
      )
    }
    return null
  }
  
  /*
   * validateOgImageUrl — validates the optional Open Graph image URL.
   *
   * Optional. If provided, must look like a URL.
   */
  export function validateOgImageUrl(value: string): string | null {
    if (value.trim() && !isValidUrl(value)) {
      return 'Enter a valid URL starting with http:// or https://.'
    }
    return null
  }
  
  // ---------------------------------------------------------------------------
  // 3. Section validators
  // ---------------------------------------------------------------------------
  
  /*
   * validateBasicValues — validates the complete Basic Info section.
   *
   * Returns an empty object ({}) when all fields are valid.
   * Called on blur of each field and on "Next" / submit click.
   */
  export function validateBasicValues(
    values: BikeFormBasicValues,
  ): FieldErrors<BikeFormBasicValues> {
    const errors: FieldErrors<BikeFormBasicValues> = {}
  
    const name = validateName(values.name)
    if (name) errors.name = name
  
    const slug = validateSlug(values.slug)
    if (slug) errors.slug = slug
  
    const brandSlug = validateBrandSlug(values.brandSlug)
    if (brandSlug) errors.brandSlug = brandSlug
  
    const category = validateCategory(values.category)
    if (category) errors.category = category
  
    const tagline = validateTagline(values.tagline)
    if (tagline) errors.tagline = tagline
  
    /*
     * status: 'draft' | 'published' — enforced by TypeScript.
     * No runtime validation needed — the form uses a controlled <select>
     * with only valid options.
     */
  
    return errors
  }
  
  /*
   * validateSpecEngineValues — validates engine spec fields.
   * All optional — only max-length is checked.
   */
  export function validateSpecEngineValues(
    values: BikeFormSpecEngineValues,
  ): FieldErrors<BikeFormSpecEngineValues> {
    const errors: FieldErrors<BikeFormSpecEngineValues> = {}
  
    const engineFields: Array<[keyof BikeFormSpecEngineValues, string]> = [
      ['displacement',   'Displacement'],
      ['engineType',     'Engine type'],
      ['maxPower',       'Max power'],
      ['maxTorque',      'Max torque'],
      ['fuelSystem',     'Fuel system'],
      ['coolingType',    'Cooling'],
      ['transmission',   'Transmission'],
      ['mileage',        'Mileage'],
      ['clutch',         'Clutch'],
      ['startingSystem', 'Starting system'],
      ['emission',       'Emission standard'],
    ]
  
    for (const [field, label] of engineFields) {
      const err = validateSpecTextField(values[field], label)
      if (err) errors[field] = err
    }
  
    return errors
  }
  
  /*
   * validateSpecDimensionValues — validates dimension spec fields.
   * All optional — only max-length is checked.
   */
  export function validateSpecDimensionValues(
    values: BikeFormSpecDimensionValues,
  ): FieldErrors<BikeFormSpecDimensionValues> {
    const errors: FieldErrors<BikeFormSpecDimensionValues> = {}
  
    const dimensionFields: Array<[keyof BikeFormSpecDimensionValues, string]> = [
      ['kerbWeight',      'Kerb weight'],
      ['fuelCapacity',    'Fuel capacity'],
      ['seatHeight',      'Seat height'],
      ['groundClearance', 'Ground clearance'],
      ['wheelbase',       'Wheelbase'],
      ['overallLength',   'Overall length'],
      ['overallWidth',    'Overall width'],
      ['overallHeight',   'Overall height'],
    ]
  
    for (const [field, label] of dimensionFields) {
      const err = validateSpecTextField(values[field], label)
      if (err) errors[field] = err
    }
  
    return errors
  }
  
  /*
   * validateSpecValues — validates the complete Specs section.
   * Features section (booleans + string array) has no validation rules.
   */
  export function validateSpecValues(values: BikeFormSpecValues): {
    engine?:     FieldErrors<BikeFormSpecEngineValues>
    dimensions?: FieldErrors<BikeFormSpecDimensionValues>
  } {
    const result: {
      engine?:     FieldErrors<BikeFormSpecEngineValues>
      dimensions?: FieldErrors<BikeFormSpecDimensionValues>
    } = {}
  
    const engineErrors = validateSpecEngineValues(values.engine)
    if (Object.keys(engineErrors).length > 0) result.engine = engineErrors
  
    const dimensionErrors = validateSpecDimensionValues(values.dimensions)
    if (Object.keys(dimensionErrors).length > 0) result.dimensions = dimensionErrors
  
    return result
  }
  
  /*
   * validatePricingValues — validates the Pricing section.
   *
   * Returns errors only for exShowroom and onRoad.
   * Color variant errors are tracked separately (per-variant) in the
   * BikeFormPricing component (A-10) to enable inline per-variant display.
   */
  export function validatePricingValues(
    values: BikeFormPricingValues,
  ): FieldErrors<Pick<BikeFormPricingValues, 'exShowroom' | 'onRoad'>> {
    const errors: FieldErrors<Pick<BikeFormPricingValues, 'exShowroom' | 'onRoad'>> = {}
  
    const exShowroom = validateExShowroom(values.exShowroom)
    if (exShowroom) errors.exShowroom = exShowroom
  
    const onRoad = validateOnRoad(values.onRoad, values.exShowroom)
    if (onRoad) errors.onRoad = onRoad
  
    return errors
  }
  
  /*
   * validateGalleryValues — validates the Gallery section.
   * Currently only heroImageUrl is required.
   */
  export function validateGalleryValues(
    values: BikeFormGalleryValues,
  ): FieldErrors<Pick<BikeFormGalleryValues, 'heroImageUrl'>> {
    const errors: FieldErrors<Pick<BikeFormGalleryValues, 'heroImageUrl'>> = {}
  
    const hero = validateHeroImageUrl(values.heroImageUrl)
    if (hero) errors.heroImageUrl = hero
  
    return errors
  }
  
  /*
   * validateSEOValues — validates the SEO section.
   * All fields are optional — only max-length constraints.
   */
  export function validateSEOValues(
    values: BikeFormSEOValues,
  ): FieldErrors<BikeFormSEOValues> {
    const errors: FieldErrors<BikeFormSEOValues> = {}
  
    const metaTitle = validateMetaTitle(values.metaTitle)
    if (metaTitle) errors.metaTitle = metaTitle
  
    const metaDescription = validateMetaDescription(values.metaDescription)
    if (metaDescription) errors.metaDescription = metaDescription
  
    const ogImageUrl = validateOgImageUrl(values.ogImageUrl)
    if (ogImageUrl) errors.ogImageUrl = ogImageUrl
  
    return errors
  }
  
  /*
   * validateAllSections — runs all section validators and returns the complete
   * BikeFormErrors object.
   *
   * Called on final form submission to catch any section the admin skipped.
   * The form shell (A-08.2) uses this to show error badges on section tabs.
   */
  export function validateAllSections(values: BikeFormValues): BikeFormErrors {
    const errors: BikeFormErrors = {}
  
    const basic = validateBasicValues(values.basic)
    if (Object.keys(basic).length > 0) errors.basic = basic
  
    const specs = validateSpecValues(values.specs)
    if (Object.keys(specs).length > 0) errors.specs = specs
  
    const pricing = validatePricingValues(values.pricing)
    if (Object.keys(pricing).length > 0) errors.pricing = pricing
  
    const gallery = validateGalleryValues(values.gallery)
    if (Object.keys(gallery).length > 0) errors.gallery = gallery
  
    const seo = validateSEOValues(values.seo)
    if (Object.keys(seo).length > 0) errors.seo = seo
  
    return errors
  }
  
  /*
   * getSectionValidity — derives per-section valid/invalid booleans from
   * BikeFormErrors, used to show checkmarks or error indicators on tabs.
   *
   * A section is 'valid' when it has no errors in the errors object.
   * A section with no errors key (never validated) defaults to false
   * so the tab doesn't prematurely show a checkmark on first load.
   *
   * The `validated` parameter is a set of section keys that have been
   * touched at least once (the form shell tracks this).
   */
  export function getSectionValidity(
    errors: BikeFormErrors,
    validated: Set<BikeFormSectionKey>,
  ): BikeFormSectionValidity {
    return {
      basic:   validated.has('basic')   && !errors.basic,
      specs:   validated.has('specs')   && !errors.specs,
      pricing: validated.has('pricing') && !errors.pricing,
      gallery: validated.has('gallery') && !errors.gallery,
      seo:     validated.has('seo')     && !errors.seo,
    }
  }
  
  /*
   * isFormReadyToSubmit — returns true when the form has no errors.
   *
   * A convenience shorthand used by the submit button:
   *   const errors = validateAllSections(values)
   *   disabled={!isFormReadyToSubmit(errors)}
   */
  export function isFormReadyToSubmit(errors: BikeFormErrors): boolean {
    return Object.keys(errors).length === 0
  }
  
  // ---------------------------------------------------------------------------
  // 4. Submit payload builder
  // ---------------------------------------------------------------------------
  
  /*
   * buildSubmitPayload — converts BikeFormValues to BikeFormSubmitPayload.
   *
   * TRANSFORMATIONS:
   *   pricing.exShowroom (string) → number         (parsePriceString, non-null guaranteed
   *                                                  because form validates before calling)
   *   pricing.onRoad (string)    → number | omit   (empty → key omitted)
   *   specs fields (string)      → string | omit   (empty string → key omitted)
   *   gallery.heroBlurDataUrl    → blurDataUrl | omit
   *   gallery.video360Url        → video360Url | omit
   *   colors[].imageUrl          → imageUrl | omit (per variant)
   *   seo (all empty)            → seo key omitted
   *   features (all false)       → features object with only true keys
   *   ridingModes (empty array)  → ridingModes key omitted
   *
   * ASSUMPTION:
   *   This function is called ONLY after validateAllSections() passes.
   *   If exShowroom cannot be parsed (returns null), 0 is used as a fallback —
   *   but this state should never be reached in a validated form.
   */
  export function buildSubmitPayload(
    values: BikeFormValues,
  ): BikeFormSubmitPayload {
    const { basic, specs, pricing, gallery, seo } = values
  
    // ── Pricing ───────────────────────────────────────────────────────────
  
    const exShowroom = parsePriceString(pricing.exShowroom) ?? 0
    const onRoad     = pricing.onRoad.trim()
      ? parsePriceString(pricing.onRoad) ?? undefined
      : undefined
  
    // ── Colours ───────────────────────────────────────────────────────────
  
    const colors = pricing.colors.map((c) => ({
      name:                         c.name.trim(),
      hex:                          c.hex.trim(),
      ...(c.imageUrl?.trim() && { imageUrl: c.imageUrl.trim() }),
    }))
  
    // ── Gallery ───────────────────────────────────────────────────────────
  
    const galleryItems = gallery.gallery.map((g) => ({
      url:                              g.secureUrl,
      ...(g.blurDataUrl?.trim()    && { blurDataUrl: g.blurDataUrl }),
      ...(g.publicId?.trim()       && { publicId:    g.publicId    }),
    }))
  
    // ── Spec engine — omit empty fields ──────────────────────────────────
  
    const engineRaw: Record<string, string> = {
      displacement:   specs.engine.displacement,
      engineType:     specs.engine.engineType,
      maxPower:       specs.engine.maxPower,
      maxTorque:      specs.engine.maxTorque,
      fuelSystem:     specs.engine.fuelSystem,
      coolingType:    specs.engine.coolingType,
      transmission:   specs.engine.transmission,
      mileage:        specs.engine.mileage,
      clutch:         specs.engine.clutch,
      startingSystem: specs.engine.startingSystem,
      emission:       specs.engine.emission,
    }
  
    const engine = omitEmpty(engineRaw)
  
    // ── Spec dimensions — omit empty fields ──────────────────────────────
  
    const dimensionsRaw: Record<string, string> = {
      kerbWeight:      specs.dimensions.kerbWeight,
      fuelCapacity:    specs.dimensions.fuelCapacity,
      seatHeight:      specs.dimensions.seatHeight,
      groundClearance: specs.dimensions.groundClearance,
      wheelbase:       specs.dimensions.wheelbase,
      overallLength:   specs.dimensions.overallLength,
      overallWidth:    specs.dimensions.overallWidth,
      overallHeight:   specs.dimensions.overallHeight,
    }
  
    const dimensions = omitEmpty(dimensionsRaw)
  
    // ── Spec features — omit false values; omit ridingModes if empty ─────
  
    const featureInput = specs.features
    const features: BikeFormSubmitPayload['specs']['features'] = {}
  
    if (featureInput.abs)              features.abs              = true
    if (featureInput.dualChannelAbs)   features.dualChannelAbs   = true
    if (featureInput.slipAssistClutch) features.slipAssistClutch = true
    if (featureInput.tractionControl)  features.tractionControl  = true
    if (featureInput.quickshifter)     features.quickshifter     = true
    if (featureInput.autoblipper)      features.autoblipper      = true
    if (featureInput.cruiseControl)    features.cruiseControl    = true
    if (featureInput.tft)              features.tft              = true
    if (featureInput.bluetooth)        features.bluetooth        = true
    if (featureInput.navigation)       features.navigation       = true
    if (featureInput.usbCharging)      features.usbCharging      = true
    if (featureInput.ledLights)        features.ledLights        = true
    if (featureInput.ridingModes.length > 0) {
      features.ridingModes = featureInput.ridingModes
    }
  
    // ── SEO — omit entirely if all fields empty ───────────────────────────
  
    const seoPayload:
      | BikeFormSubmitPayload['seo']
      | undefined = (
      seo.metaTitle.trim() ||
      seo.metaDescription.trim() ||
      seo.ogImageUrl.trim()
    )
      ? {
          ...(seo.metaTitle.trim()       && { metaTitle:       seo.metaTitle.trim() }),
          ...(seo.metaDescription.trim() && { metaDescription: seo.metaDescription.trim() }),
          ...(seo.ogImageUrl.trim()      && { ogImageUrl:      seo.ogImageUrl.trim() }),
        }
      : undefined
  
    // ── Assemble payload ─────────────────────────────────────────────────
  
    const payload: BikeFormSubmitPayload = {
      slug:      basic.slug.trim(),
      brandSlug: basic.brandSlug,
      name:      basic.name.trim(),
      tagline:   basic.tagline.trim(),
      category:  basic.category,
      status:    basic.status,
  
      pricing: {
        exShowroom,
        ...(onRoad !== undefined && { onRoad }),
      },
  
      heroImageUrl: gallery.heroImageUrl,
      ...(gallery.heroBlurDataUrl.trim() && { blurDataUrl: gallery.heroBlurDataUrl }),
      ...(gallery.video360Url.trim()     && { video360Url: gallery.video360Url }),
  
      gallery: galleryItems,
      colors,
  
      specs: {
        engine,
        dimensions,
        features,
      },
  
      ...(seoPayload && { seo: seoPayload }),
    }
  
    return payload
  }
  
  // ---------------------------------------------------------------------------
  // 5. Edit-mode form seeder
  // ---------------------------------------------------------------------------
  
  /*
   * bikeToFormValues — converts a BikeFormInitialData (from the Server Component)
   * to BikeFormValues for seeding the form in edit mode.
   *
   * STRATEGY:
   *   Each field falls back to the corresponding DEFAULT_FORM_VALUES key.
   *   This ensures the form always has a complete, type-safe object even when
   *   the bike document is missing optional fields.
   *
   * PRICING NUMBERS → STRINGS:
   *   exShowroom and onRoad are numbers in MongoDB.
   *   They become strings in the form via .toString().
   *   parsePriceString() converts them back on submit.
   *
   * GALLERY ITEMS:
   *   bike.gallery[].url → BikeFormGalleryItem.secureUrl
   *   (mirroring the same conversion used in BikeEditMediaClient, A-07.5)
   *
   * USAGE (in the edit page Server Component):
   *   const initialValues = bikeToFormValues(serializedBike)
   *   // Pass to the form Client Component as a prop
   */
  export function bikeToFormValues(bike: BikeFormInitialData): BikeFormValues {
    const def = DEFAULT_FORM_VALUES
  
    return {
      basic: {
        name:      bike.name      ?? def.basic.name,
        slug:      bike.slug      ?? def.basic.slug,
        brandSlug: bike.brandSlug ?? def.basic.brandSlug,
        category:  bike.category  ?? def.basic.category,
        tagline:   bike.tagline   ?? def.basic.tagline,
        status:    bike.status    ?? def.basic.status,
      },
  
      specs: {
        engine: {
          displacement:   bike.specs?.engine?.displacement   ?? '',
          engineType:     bike.specs?.engine?.engineType     ?? '',
          maxPower:       bike.specs?.engine?.maxPower       ?? '',
          maxTorque:      bike.specs?.engine?.maxTorque      ?? '',
          fuelSystem:     bike.specs?.engine?.fuelSystem     ?? '',
          coolingType:    bike.specs?.engine?.coolingType    ?? '',
          transmission:   bike.specs?.engine?.transmission   ?? '',
          mileage:        bike.specs?.engine?.mileage        ?? '',
          clutch:         bike.specs?.engine?.clutch         ?? '',
          startingSystem: bike.specs?.engine?.startingSystem ?? '',
          emission:       bike.specs?.engine?.emission       ?? '',
        },
  
        dimensions: {
          kerbWeight:      bike.specs?.dimensions?.kerbWeight      ?? '',
          fuelCapacity:    bike.specs?.dimensions?.fuelCapacity    ?? '',
          seatHeight:      bike.specs?.dimensions?.seatHeight      ?? '',
          groundClearance: bike.specs?.dimensions?.groundClearance ?? '',
          wheelbase:       bike.specs?.dimensions?.wheelbase       ?? '',
          overallLength:   bike.specs?.dimensions?.overallLength   ?? '',
          overallWidth:    bike.specs?.dimensions?.overallWidth    ?? '',
          overallHeight:   bike.specs?.dimensions?.overallHeight   ?? '',
        },
  
        features: {
          abs:              bike.specs?.features?.abs              ?? false,
          dualChannelAbs:   bike.specs?.features?.dualChannelAbs   ?? false,
          slipAssistClutch: bike.specs?.features?.slipAssistClutch ?? false,
          tractionControl:  bike.specs?.features?.tractionControl  ?? false,
          quickshifter:     bike.specs?.features?.quickshifter     ?? false,
          autoblipper:      bike.specs?.features?.autoblipper      ?? false,
          cruiseControl:    bike.specs?.features?.cruiseControl    ?? false,
          tft:              bike.specs?.features?.tft              ?? false,
          bluetooth:        bike.specs?.features?.bluetooth        ?? false,
          navigation:       bike.specs?.features?.navigation       ?? false,
          usbCharging:      bike.specs?.features?.usbCharging      ?? false,
          ledLights:        bike.specs?.features?.ledLights        ?? false,
          ridingModes:      bike.specs?.features?.ridingModes      ?? [],
        },
      },
  
      pricing: {
        /*
         * Number → string for form input.
         * '0' for exShowroom indicates a bike with no price set —
         * the form validator will flag this as required.
         */
        exShowroom: bike.pricing.exShowroom
          ? bike.pricing.exShowroom.toString()
          : '',
        onRoad: bike.pricing.onRoad
          ? bike.pricing.onRoad.toString()
          : '',
        colors: (bike.colors ?? []).map((c) => ({
          name:      c.name,
          hex:       c.hex,
          imageUrl:  c.imageUrl,
        })),
      },
  
      gallery: {
        heroImageUrl:    bike.heroImageUrl   ?? '',
        heroBlurDataUrl: bike.blurDataUrl    ?? '',
        gallery: (bike.gallery ?? []).map((g) => ({
          secureUrl:   g.url,
          blurDataUrl: g.blurDataUrl,
          publicId:    g.publicId,
        })),
        video360Url:     bike.video360Url    ?? '',
      },
  
      seo: {
        metaTitle:       bike.seo?.metaTitle       ?? '',
        metaDescription: bike.seo?.metaDescription ?? '',
        ogImageUrl:      bike.seo?.ogImageUrl       ?? '',
      },
    }
  }  
  /*
 * validateSpecsQuickFields — validates the nine quick-entry spec fields
 * shown in BikeFormSpecifications (A-08.4).
 *
 * These are a curated subset of the full spec fields: the nine that have
 * the most universal data across Indian motorcycles.
 *
 * Returns errors in the same nested shape as validateSpecValues() so the
 * BikeFormShell can merge them into BikeFormErrors.specs without any
 * additional reshaping.
 *
 * All fields are optional (empty string = not filled in).
 * Validation rules:
 *   - Max FIELD_LIMITS.SPEC_FIELD_MAX characters (200) per field
 *   - No format enforcement — specs are stored as plain strings with units
 *     included by the admin (e.g. "648 cc", "47 bhp @ 7,150 rpm").
 */
export function validateSpecsQuickFields(specs: BikeFormSpecValues): {
  engine?:     FieldErrors<BikeFormSpecEngineValues>
  dimensions?: FieldErrors<BikeFormSpecDimensionValues>
} {
  const result: {
    engine?:     FieldErrors<BikeFormSpecEngineValues>
    dimensions?: FieldErrors<BikeFormSpecDimensionValues>
  } = {}

  /*
   * Engine fields shown in BikeFormSpecifications:
   *   displacement (Engine CC)
   *   maxPower     (Power)
   *   maxTorque    (Torque)
   *   transmission (Transmission)
   */
  const engineErrors = validateSpecEngineValues(specs.engine)
  const engineSubset: FieldErrors<BikeFormSpecEngineValues> = {}

  for (const key of [
    'displacement',
    'maxPower',
    'maxTorque',
    'transmission',
  ] as const) {
    if (engineErrors[key]) {
      engineSubset[key] = engineErrors[key]
    }
  }

  if (Object.keys(engineSubset).length > 0) {
    result.engine = engineSubset
  }

  /*
   * Dimension fields shown in BikeFormSpecifications:
   *   fuelCapacity    (Fuel Tank Capacity)
   *   seatHeight      (Seat Height)
   *   groundClearance (Ground Clearance)
   *   kerbWeight      (Kerb Weight)
   */
  const dimensionErrors = validateSpecDimensionValues(specs.dimensions)
  const dimensionSubset: FieldErrors<BikeFormSpecDimensionValues> = {}

  for (const key of [
    'fuelCapacity',
    'seatHeight',
    'groundClearance',
    'kerbWeight',
  ] as const) {
    if (dimensionErrors[key]) {
      dimensionSubset[key] = dimensionErrors[key]
    }
  }

  if (Object.keys(dimensionSubset).length > 0) {
    result.dimensions = dimensionSubset
  }

  return result
}