/*
 * bike-form.ts — TypeScript types for the MotoHub360 BikeForm system.
 *
 * MPD Tasks A-08 through A-12:
 *   "BikeForm components: basic info (A-08), specs (A-09), pricing (A-10),
 *   gallery/media (A-11), SEO (A-12)."
 *
 * A-08.1 scope:
 *   Single source of truth for all BikeForm types, default values,
 *   and the API submit payload shape.
 *
 *   Centralising here prevents:
 *     - Circular imports between the five section components
 *     - Type drift between form state and the Bike MongoDB schema (DB-02)
 *     - Submit payload mismatches with POST/PUT /api/bikes
 *
 * DESIGN DECISIONS:
 *
 * All form field values are strings (matching native <input> value type),
 * with three exceptions:
 *   Boolean toggles (feature checkboxes) — boolean
 *   Array fields (gallery, colors, ridingModes) — typed arrays
 *   Numbers that are stored as strings while in the form input — string
 *     (e.g. exShowroom = '348000' as the user types, parsed on submit)
 *
 * Empty string ('') represents "field not filled in" for optional fields.
 * buildSubmitPayload() in bike-form-validation.ts strips empty optionals
 * before sending to the API.
 *
 * RELATIONSHIP TO BIKE MONGODB SCHEMA (DB-02):
 *   BikeFormSubmitPayload mirrors IBike's input shape for POST /api/bikes
 *   and PUT /api/bikes/[id]. It uses number (not string) for pricing, and
 *   omits empty optional spec/seo fields to keep documents clean.
 *
 *   BikeFormValues ≠ IBike — form values are strings for numeric fields and
 *   empty strings for unset optional spec fields. Conversion happens in
 *   buildSubmitPayload().
 *
 * RELATIONSHIP TO A-07 (Media Upload):
 *   BikeFormGalleryValues carries heroImageUrl, gallery, and video360Url.
 *   In edit mode these come from the existing bike document.
 *   In create mode they default to empty; the admin uses the A-11 gallery
 *   section or A-07.5 media edit page to upload assets.
 *
 * FORM SECTIONS:
 *   BASIC   → name, slug, brandSlug, category, tagline, status
 *   SPECS   → engine fields + dimension fields + feature toggles
 *   PRICING → exShowroom, onRoad, color variants
 *   GALLERY → heroImageUrl, heroBlurDataUrl, gallery items, video360Url
 *   SEO     → metaTitle, metaDescription, ogImageUrl
 *
 * USAGE:
 *   import type { BikeFormValues, BikeFormBasicValues, ... }
 *     from '@/types/bike-form'
 *
 *   // Safe in both Server and Client Components.
 *   // No Node.js dependencies — pure TypeScript type declarations and
 *   // JSON-serializable constant objects.
 */

// ---------------------------------------------------------------------------
// Mode and section constants
// ---------------------------------------------------------------------------

/*
 * BikeFormMode — whether the form is creating a new bike or editing one.
 * 'create': page.tsx is /admin/bikes/new; no existing _id.
 * 'edit':   page.tsx is /admin/bikes/[slug]/edit; existing bike _id present.
 */
export type BikeFormMode = 'create' | 'edit'

/*
 * BikeFormStatus — mirrors the status field in the Bike Mongoose schema.
 * 'draft':     bike is not visible on the public site.
 * 'published': bike is visible; ISR revalidation is triggered on save.
 */
export type BikeFormStatus = 'draft' | 'published'

/*
 * BIKE_FORM_SECTIONS — ordered section identifiers used to drive the
 * form shell's navigation tabs (A-08.2) and progress indicator.
 *
 * `as const satisfies readonly string[]` — TypeScript enforces that every
 * value is a string literal at the call site (prevents adding non-strings).
 *
 * Usage: BIKE_FORM_SECTIONS[0] === 'basic', BIKE_FORM_SECTIONS.length === 5
 */
export const BIKE_FORM_SECTIONS = [
  'basic',
  'specs',
  'pricing',
  'gallery',
  'seo',
] as const satisfies readonly string[]

/*
 * BikeFormSectionKey — union of the five section identifiers.
 * 'basic' | 'specs' | 'pricing' | 'gallery' | 'seo'
 */
export type BikeFormSectionKey = (typeof BIKE_FORM_SECTIONS)[number]

/*
 * BIKE_FORM_SECTION_LABELS — human-readable display names for each section.
 * Used in the form shell's navigation tabs.
 */
export const BIKE_FORM_SECTION_LABELS: Record<BikeFormSectionKey, string> = {
  basic:   'Basic Info',
  specs:   'Specifications',
  pricing: 'Pricing & Colours',
  gallery: 'Gallery & Media',
  seo:     'SEO',
}

// ---------------------------------------------------------------------------
// Section 1 — Basic info
// ---------------------------------------------------------------------------

/*
 * BikeFormBasicValues — form state for the Basic Info section (A-08).
 *
 * ALL required for bike creation. Status defaults to 'draft'.
 * slug is auto-generated from name on first keystroke, then editable.
 *
 * Field constraints (enforced by bike-form-validation.ts):
 *   name:      2–100 characters, required
 *   slug:      2–80 characters, lowercase alphanumeric + hyphens, required, unique
 *   brandSlug: must exist in BRANDS constant (S-08), required
 *   category:  must exist in CATEGORIES constant (S-08), required
 *   tagline:   max 120 characters, optional
 *   status:    'draft' | 'published', required (defaults to 'draft')
 */
export interface BikeFormBasicValues {
  name:      string
  slug:      string
  brandSlug: string
  category:  string
  tagline:   string
  status:    BikeFormStatus
}

// ---------------------------------------------------------------------------
// Section 2 — Specifications
// ---------------------------------------------------------------------------

/*
 * BikeFormSpecEngineValues — engine and performance fields.
 *
 * ALL optional (manufacturer spec format varies significantly —
 * Royal Enfield uses "47 bhp @ 7,150 rpm" while KTM uses "43 PS @ 9,000 rpm").
 * Stored and displayed as plain strings; no parsing or unit conversion.
 *
 * Max 200 characters per field (generous for formatted spec strings).
 */
export interface BikeFormSpecEngineValues {
  displacement:   string   // "648 cc"
  engineType:     string   // "Parallel-twin, 4-stroke, SOHC, Air + Oil Cooled"
  maxPower:       string   // "47 bhp @ 7,150 rpm"
  maxTorque:      string   // "52 Nm @ 5,250 rpm"
  fuelSystem:     string   // "Fuel Injection (EFI)"
  coolingType:    string   // "Air + Oil Cooled"
  transmission:   string   // "6-Speed, Constant Mesh"
  mileage:        string   // "25 kmpl"
  clutch:         string   // "Wet, Multi-plate, Slip & Assist"
  startingSystem: string   // "Electric Start"
  emission:       string   // "OBD2B (BS6 Phase 2)"
}

/*
 * BikeFormSpecDimensionValues — physical dimensions and capacities.
 * ALL optional. Stored and displayed as plain strings with units included.
 * Max 80 characters per field.
 */
export interface BikeFormSpecDimensionValues {
  kerbWeight:      string   // "202 kg"
  fuelCapacity:    string   // "13.7 litres"
  seatHeight:      string   // "790 mm"
  groundClearance: string   // "174 mm"
  wheelbase:       string   // "1,400 mm"
  overallLength:   string   // "2,122 mm"
  overallWidth:    string   // "785 mm"
  overallHeight:   string   // "1,024 mm"
}

/*
 * BikeFormSpecFeatureValues — boolean feature toggles and riding modes.
 *
 * Boolean fields default to false (unchecked).
 * ridingModes: a string array of mode names (e.g. ['Eco', 'City', 'Sport', 'Rain']).
 *   Rendered as a tag-style input in A-09; stored in MongoDB as string[].
 *   Empty array = no riding modes.
 *
 * Note on dualChannelAbs + abs:
 *   If dualChannelAbs is true, abs is implicitly true.
 *   BikeFeaturesList (B-06) handles this display logic.
 *   The form lets admins set both independently.
 */
export interface BikeFormSpecFeatureValues {
  abs:              boolean
  dualChannelAbs:   boolean
  slipAssistClutch: boolean
  tractionControl:  boolean
  quickshifter:     boolean
  autoblipper:      boolean
  cruiseControl:    boolean
  tft:              boolean
  bluetooth:        boolean
  navigation:       boolean
  usbCharging:      boolean
  ledLights:        boolean
  ridingModes:      string[]
}

/*
 * BikeFormSpecValues — complete specification section (A-09).
 */
export interface BikeFormSpecValues {
  engine:     BikeFormSpecEngineValues
  dimensions: BikeFormSpecDimensionValues
  features:   BikeFormSpecFeatureValues
}

// ---------------------------------------------------------------------------
// Section 3 — Pricing and colour variants
// ---------------------------------------------------------------------------

/*
 * BikeFormColorVariant — a single colour option for the bike.
 *
 * name:     display name shown to customers ("Stealth Black", "Signals Green")
 * hex:      brand-accurate hex colour for the swatch (#1A1A1A, #4A7C59)
 * imageUrl: optional Cloudinary URL for this variant's specific image;
 *           used by BikeColorSelector (B-03) to swap the preview image
 *           when the customer selects this colour.
 *
 * Hex format: must match /^#[0-9A-Fa-f]{6}$/ (validated in A-10).
 */
export interface BikeFormColorVariant {
  name:      string
  hex:       string
  imageUrl?: string
}

/*
 * BikeFormPricingValues — pricing fields and colour variants (A-10).
 *
 * PRICES AS STRINGS:
 *   exShowroom and onRoad are strings in the form state to match
 *   <input type="number"> which returns strings via event.target.value.
 *   The validator accepts Indian-formatted numbers ("3,48,000")
 *   by stripping commas before parsing.
 *   buildSubmitPayload() converts them to numbers for the API.
 *
 * exShowroom: required, the manufacturer's ex-showroom price in INR.
 *             Must be between ₹10,000 and ₹10,00,00,000.
 * onRoad:     optional estimated on-road price (includes registration,
 *             insurance, road tax). Must be >= exShowroom if provided.
 * colors:     ordered list of colour variants. Min 0 (no colours listed),
 *             max 20. The first colour in the array is the default.
 */
export interface BikeFormPricingValues {
  exShowroom: string
  onRoad:     string
  colors:     BikeFormColorVariant[]
}

// ---------------------------------------------------------------------------
// Section 4 — Gallery and media
// ---------------------------------------------------------------------------

/*
 * BikeFormGalleryItem — a single gallery image.
 * Mirrors GalleryChangeItem from GalleryUploader (A-07.4) to avoid
 * importing from a 'use client' component into this types file.
 *
 * Defined here as a standalone type (same shape, different name)
 * to prevent circular imports:
 *   bike-form.ts → GalleryUploader.tsx would create:
 *   GalleryUploader.tsx imports → bike-form.ts (for types) → GalleryUploader.tsx
 *
 * A-10 (BikeFormGallery component) maps between the two types locally.
 */
export interface BikeFormGalleryItem {
  secureUrl:   string
  blurDataUrl?: string
  publicId?:   string
}

/*
 * BikeFormGalleryValues — media management section (A-11).
 *
 * heroImageUrl:     required for publish. The primary bike image.
 *                   Set via MediaUploader (intent='bike_hero').
 * heroBlurDataUrl:  base64 JPEG blur-up placeholder for Next.js Image.
 *                   Set automatically when heroImageUrl is uploaded.
 *                   Empty string = not generated (MediaUploader handles fallback).
 * gallery:          ordered array of additional images. Managed by GalleryUploader.
 *                   May be empty — hero image alone is sufficient for draft.
 * video360Url:      optional 360° spin video. Set via MediaUploader (intent='bike_360').
 *                   Empty string = no video.
 */
export interface BikeFormGalleryValues {
  heroImageUrl:    string
  heroBlurDataUrl: string
  gallery:         BikeFormGalleryItem[]
  video360Url:     string
}

// ---------------------------------------------------------------------------
// Section 5 — SEO
// ---------------------------------------------------------------------------

/*
 * BikeFormSEOValues — search engine optimisation fields (A-12).
 *
 * All fields are optional. When empty:
 *   metaTitle:       auto-generated: "${brandName} ${name} Price in India, Specs..."
 *   metaDescription: auto-generated from name + tagline
 *   ogImageUrl:      falls back to heroImageUrl
 *
 * Field constraints:
 *   metaTitle:       max 60 chars (Google truncates at ~60)
 *   metaDescription: max 160 chars (Google truncates at ~155–160)
 *   ogImageUrl:      must be a valid URL if provided (Cloudinary or external)
 *
 * The auto-generation logic lives in generateMetadata() in
 * src/app/bikes/[brandSlug]/[slug]/page.tsx (implemented in B-01).
 */
export interface BikeFormSEOValues {
  metaTitle:       string
  metaDescription: string
  ogImageUrl:      string
}

// ---------------------------------------------------------------------------
// Complete form state
// ---------------------------------------------------------------------------

/*
 * BikeFormValues — the complete form state across all five sections.
 *
 * Used as the top-level state type in the BikeForm shell (A-08.2).
 * Each section component receives and updates its own slice:
 *   BikeFormBasic   → values.basic
 *   BikeFormSpecs   → values.specs
 *   BikeFormPricing → values.pricing
 *   BikeFormGallery → values.gallery
 *   BikeFormSEO     → values.seo
 */
export interface BikeFormValues {
  basic:   BikeFormBasicValues
  specs:   BikeFormSpecValues
  pricing: BikeFormPricingValues
  gallery: BikeFormGalleryValues
  seo:     BikeFormSEOValues
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

/*
 * FieldErrors<T> — a map of field names to error message strings.
 *
 * Only fields that have errors appear in the object.
 * An empty object ({}) means the section is valid.
 *
 * Usage:
 *   const errors = validateBasicValues(values)
 *   const isValid = Object.keys(errors).length === 0
 *   const nameError = errors.name // string | undefined
 */
export type FieldErrors<T extends object> = {
  [K in keyof T]?: string
}

/*
 * BikeFormErrors — error state for all sections.
 *
 * Each section's errors are optional — a section with no errors
 * simply has no key here.
 *
 * Spec errors are nested because the section has sub-sections:
 *   errors.specs.engine.maxPower = 'Max power is too long'
 *   errors.specs.dimensions.kerbWeight = 'Kerb weight is too long'
 *   (features section has no text field errors — boolean toggles cannot fail)
 */
export interface BikeFormErrors {
  basic?:   FieldErrors<BikeFormBasicValues>
  specs?: {
    engine?:     FieldErrors<BikeFormSpecEngineValues>
    dimensions?: FieldErrors<BikeFormSpecDimensionValues>
  }
  pricing?: FieldErrors<Pick<BikeFormPricingValues, 'exShowroom' | 'onRoad'>>
  gallery?: FieldErrors<Pick<BikeFormGalleryValues, 'heroImageUrl'>>
  seo?:     FieldErrors<BikeFormSEOValues>
}

/*
 * BikeFormSectionValidity — tracks which sections have passed validation.
 * Used by the form shell's navigation tabs to show progress indicators.
 */
export type BikeFormSectionValidity = Record<BikeFormSectionKey, boolean>

// ---------------------------------------------------------------------------
// API submit payload
// ---------------------------------------------------------------------------

/*
 * BikeFormSubmitPayload — the body sent to POST /api/bikes (create) or
 * PUT /api/bikes/[id] (edit).
 *
 * Differences from BikeFormValues:
 *   - pricing.exShowroom is number (not string)
 *   - pricing.onRoad is number | undefined (not string)
 *   - Empty optional spec strings are omitted (not included as '')
 *   - gallery items use 'url' (not 'secureUrl') to match Mongoose schema
 *   - heroBlurDataUrl in gallery → top-level blurDataUrl
 *   - Empty heroBlurDataUrl → blurDataUrl omitted
 *   - Empty video360Url → video360Url omitted
 *   - Empty seo fields → seo object omitted entirely
 *   - colors with empty imageUrl → imageUrl omitted per item
 *
 * buildSubmitPayload() in bike-form-validation.ts handles all conversions.
 */
export interface BikeFormSubmitPayload {
  /*
   * Core identity — required for both create and update.
   */
  slug:      string
  brandSlug: string
  name:      string
  tagline:   string
  category:  string
  status:    BikeFormStatus

  /*
   * Pricing — exShowroom required; onRoad omitted when not provided.
   */
  pricing: {
    exShowroom: number
    onRoad?:    number
  }

  /*
   * Media — heroImageUrl required; blurDataUrl and video360Url omitted when empty.
   */
  heroImageUrl:  string
  blurDataUrl?:  string
  video360Url?:  string

  /*
   * Gallery — array of gallery items; empty array if no gallery images.
   * Field name 'url' matches IBike.gallery[].url in the Mongoose schema (DB-02).
   */
  gallery: Array<{
    url:          string
    blurDataUrl?: string
    publicId?:    string
  }>

  /*
   * Colour variants — empty array if no colours defined.
   * imageUrl omitted per item when not set.
   */
  colors: Array<{
    name:      string
    hex:       string
    imageUrl?: string
  }>

  /*
   * Specifications — all fields are optional.
   * Empty strings from the form are omitted here.
   * ridingModes: empty array if no modes defined.
   */
  specs: {
    engine: {
      displacement?:   string
      engineType?:     string
      maxPower?:       string
      maxTorque?:      string
      fuelSystem?:     string
      coolingType?:    string
      transmission?:   string
      mileage?:        string
      clutch?:         string
      startingSystem?: string
      emission?:       string
    }
    dimensions: {
      kerbWeight?:      string
      fuelCapacity?:    string
      seatHeight?:      string
      groundClearance?: string
      wheelbase?:       string
      overallLength?:   string
      overallWidth?:    string
      overallHeight?:   string
    }
    features: {
      abs?:              boolean
      dualChannelAbs?:   boolean
      slipAssistClutch?: boolean
      tractionControl?:  boolean
      quickshifter?:     boolean
      autoblipper?:      boolean
      cruiseControl?:    boolean
      tft?:              boolean
      bluetooth?:        boolean
      navigation?:       boolean
      usbCharging?:      boolean
      ledLights?:        boolean
      ridingModes?:      string[]
    }
  }

  /*
   * SEO — entirely omitted when all three fields are empty.
   */
  seo?: {
    metaTitle?:       string
    metaDescription?: string
    ogImageUrl?:      string
  }
}

// ---------------------------------------------------------------------------
// Initial data (from MongoDB — used to seed form in edit mode)
// ---------------------------------------------------------------------------

/*
 * BikeFormInitialData — the shape of a serialized bike document used to
 * seed BikeFormValues in edit mode.
 *
 * Comes from the Server Component (page.tsx) after:
 *   1. Bike.findOne({ slug }).lean()
 *   2. Serialization: ObjectId → string, Date → string, undefined → absent
 *
 * bikeToFormValues() in bike-form-validation.ts converts this to BikeFormValues.
 *
 * All optional fields are typed as `field?: value` — absent in the document
 * means the admin has not filled them in yet.
 */
export interface BikeFormInitialData {
  _id:          string
  slug:         string
  brandSlug:    string
  name:         string
  tagline:      string
  category:     string
  status:       BikeFormStatus
  heroImageUrl: string
  blurDataUrl?: string
  video360Url?: string

  gallery: Array<{
    url:          string
    blurDataUrl?: string
    publicId?:    string
  }>

  colors: Array<{
    name:      string
    hex:       string
    imageUrl?: string
  }>

  pricing: {
    exShowroom: number
    onRoad?:    number
  }

  specs?: {
    engine?: {
      displacement?:   string
      engineType?:     string
      maxPower?:       string
      maxTorque?:      string
      fuelSystem?:     string
      coolingType?:    string
      transmission?:   string
      mileage?:        string
      clutch?:         string
      startingSystem?: string
      emission?:       string
    }
    dimensions?: {
      kerbWeight?:      string
      fuelCapacity?:    string
      seatHeight?:      string
      groundClearance?: string
      wheelbase?:       string
      overallLength?:   string
      overallWidth?:    string
      overallHeight?:   string
    }
    features?: {
      abs?:              boolean
      dualChannelAbs?:   boolean
      slipAssistClutch?: boolean
      tractionControl?:  boolean
      quickshifter?:     boolean
      autoblipper?:      boolean
      cruiseControl?:    boolean
      tft?:              boolean
      bluetooth?:        boolean
      navigation?:       boolean
      usbCharging?:      boolean
      ledLights?:        boolean
      ridingModes?:      string[]
    }
  }

  seo?: {
    metaTitle?:       string
    metaDescription?: string
    ogImageUrl?:      string
  }
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

/*
 * DEFAULT_BASIC_VALUES — initial state for the Basic Info section.
 * Used when creating a new bike (all empty) and as the merge base
 * when converting BikeFormInitialData in edit mode.
 */
export const DEFAULT_BASIC_VALUES: BikeFormBasicValues = {
  name:      '',
  slug:      '',
  brandSlug: '',
  category:  '',
  tagline:   '',
  status:    'draft',
}

/*
 * DEFAULT_SPEC_ENGINE_VALUES — all engine fields empty.
 * Empty string = field not filled in. BikeSpecTable (B-05) omits empty fields.
 */
export const DEFAULT_SPEC_ENGINE_VALUES: BikeFormSpecEngineValues = {
  displacement:   '',
  engineType:     '',
  maxPower:       '',
  maxTorque:      '',
  fuelSystem:     '',
  coolingType:    '',
  transmission:   '',
  mileage: '',
  clutch:         '',
  startingSystem: '',
  emission:       '',
}

/*
 * DEFAULT_SPEC_DIMENSION_VALUES — all dimension fields empty.
 */
export const DEFAULT_SPEC_DIMENSION_VALUES: BikeFormSpecDimensionValues = {
  kerbWeight:      '',
  fuelCapacity:    '',
  seatHeight:      '',
  groundClearance: '',
  wheelbase:       '',
  overallLength:   '',
  overallWidth:    '',
  overallHeight:   '',
}

/*
 * DEFAULT_SPEC_FEATURE_VALUES — all features off, no riding modes.
 * Deliberately conservative — admin explicitly enables features for each bike.
 */
export const DEFAULT_SPEC_FEATURE_VALUES: BikeFormSpecFeatureValues = {
  abs:              false,
  dualChannelAbs:   false,
  slipAssistClutch: false,
  tractionControl:  false,
  quickshifter:     false,
  autoblipper:      false,
  cruiseControl:    false,
  tft:              false,
  bluetooth:        false,
  navigation:       false,
  usbCharging:      false,
  ledLights:        false,
  ridingModes:      [],
}

export const DEFAULT_SPEC_VALUES: BikeFormSpecValues = {
  engine:     DEFAULT_SPEC_ENGINE_VALUES,
  dimensions: DEFAULT_SPEC_DIMENSION_VALUES,
  features:   DEFAULT_SPEC_FEATURE_VALUES,
}

export const DEFAULT_PRICING_VALUES: BikeFormPricingValues = {
  exShowroom: '',
  onRoad:     '',
  colors:     [],
}

export const DEFAULT_GALLERY_VALUES: BikeFormGalleryValues = {
  heroImageUrl:    '',
  heroBlurDataUrl: '',
  gallery:         [],
  video360Url:     '',
}

export const DEFAULT_SEO_VALUES: BikeFormSEOValues = {
  metaTitle:       '',
  metaDescription: '',
  ogImageUrl:      '',
}

/*
 * DEFAULT_FORM_VALUES — the complete initial form state for a new bike.
 * Pass this directly to useState in the BikeForm shell (A-08.2).
 */
export const DEFAULT_FORM_VALUES: BikeFormValues = {
  basic:   DEFAULT_BASIC_VALUES,
  specs:   DEFAULT_SPEC_VALUES,
  pricing: DEFAULT_PRICING_VALUES,
  gallery: DEFAULT_GALLERY_VALUES,
  seo:     DEFAULT_SEO_VALUES,
}