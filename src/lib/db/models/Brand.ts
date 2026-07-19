/*
 * Brand.ts — Mongoose model for motorcycle brands.
 *
 * MPD Task DB-03:
 *   "Mongoose model for Brand. Fields: slug, name, accentColor,
 *   logoUrl, defaultMetaDescription, heroImageUrl.
 *   Indexed on slug (unique)."
 *
 * MPD Section 8, Technical Architecture — Data Models:
 *   "Brand document: slug, name, accentColor, logoUrl,
 *   defaultMetaDescription, heroImageUrl, bikesCount (virtual),
 *   createdAt, updatedAt."
 *
 * MPD Section 5.2, Brand Listing Pages:
 *   "Brand header: 64px logo chip + brand name. Logo from Cloudinary
 *   (stored as logoUrl on the Brand document). When no logo is set,
 *   BrandLogoChip falls back to initials."
 *
 * RELATIONSHIP TO constants/brands.ts (S-08):
 *   The static BRANDS constant in S-08 provides the initial 6 brands
 *   used during the pre-database development phases (Phases 1–6).
 *   This Brand model is the production replacement — DB-08 wires listing
 *   pages to query Brand documents from MongoDB instead of the constant.
 *
 *   The two are kept in sync by convention:
 *   - slug values must match (e.g. 'royal-enfield')
 *   - accentColor values should match the BRAND_ACCENT_MAP in S-08
 *   - The static constant is the fallback when DB is unavailable
 *
 * SINGLETON PATTERN:
 *   Same mongoose.models guard as Bike.ts (DB-02) to prevent
 *   "Cannot overwrite `Brand` model" errors during Next.js HMR.
 *
 * VIRTUAL: bikesCount
 *   A virtual field (not stored in MongoDB) that represents the count
 *   of published bikes for this brand. Populated via aggregation in
 *   the brands API route (DB-05). Not part of the stored schema.
 *
 * LOGO STRATEGY:
 *   logoUrl stores the Cloudinary delivery URL of the SVG/PNG logo.
 *   It is optional — BrandLogoChip (H-02) falls back to initials
 *   when logoUrl is absent.
 *   The admin uploads the logo via the media upload endpoint (A-07).
 *
 * ACCENT COLOR:
 *   accentColor is the brand's primary hex color.
 *   Used by BrandLogoChip hover state, BikeCard arrow hover,
 *   and search result match highlighting.
 *   Validated as a CSS hex color (#RGB or #RRGGBB).
 *
 * INDEXES:
 *   slug: unique — enforces one document per brand identifier.
 *   name: text index — for admin search/filter by brand name.
 */

import mongoose, {
    type Document,
    type Model,
    Schema,
  } from 'mongoose'
  
  // ---------------------------------------------------------------------------
  // Interfaces
  // ---------------------------------------------------------------------------
  
  /*
   * IBrand — the TypeScript interface for a Brand Mongoose document.
   * Extends Document to include Mongoose instance methods and virtuals.
   *
   * Used when working with Brand documents returned from queries:
   *   const brand = await Brand.findOne({ slug: 'royal-enfield' })
   *   // brand is typed as IBrand
   */
  export interface IBrand extends Document {
    /*
     * slug — URL-safe unique identifier for this brand.
     * Used as the [brand] route param in /brands/[brand].
     * Must match the slug in constants/brands.ts (S-08).
     * Format: lowercase kebab-case, alphanumeric + hyphens.
     * Example: "royal-enfield", "ktm", "yamaha"
     * Immutable after creation — changing it breaks existing URLs.
     */
    slug: string
  
    /*
     * name — display name of the brand.
     * Shown in the brand listing header, navigation, and brand chips.
     * Example: "Royal Enfield", "KTM", "Yamaha"
     */
    name: string
  
    /*
     * accentColor — brand's primary color as a CSS hex code.
     * Used by BrandLogoChip hover, BikeCard arrow hover,
     * and SearchSuggestions match highlight (SR-02).
     * Must match BRAND_ACCENT_MAP in constants/brands.ts (S-08).
     * Example: "#7A2E2E" (Royal Enfield), "#FF6A00" (KTM)
     */
    accentColor: string
  
    /*
     * logoUrl — Cloudinary delivery URL for the brand logo.
     * Rendered in BrandLogoChip (H-02) when present.
     * Falls back to initials if absent.
     * Supports SVG, PNG, and WebP from Cloudinary.
     * Example: "https://res.cloudinary.com/motohub360/image/upload/brands/royal-enfield.svg"
     */
    logoUrl?: string
  
    /*
     * defaultMetaDescription — SEO meta description for the brand
     * listing page (/brands/[brand]).
     * Used in generateMetadata() in LP-04 (src/app/brands/[brand]/page.tsx).
     * Should describe the brand's available models and price range.
     * Max 160 characters for Google's meta description limit.
     * Example: "Explore all Royal Enfield motorcycles in India..."
     */
    defaultMetaDescription: string
  
    /*
     * heroImageUrl — optional Cloudinary URL for a brand hero/banner image.
     * Shown at the top of the brand listing page as a full-bleed header
     * (future Phase 8 feature — reserved field).
     * Falls back to no hero if absent.
     */
    heroImageUrl?: string
  
    /*
     * displayOrder — controls the order brands appear in the Home page
     * brand chip grid and the /brands hub page.
     * Lower numbers appear first. Default: 0 (appended to end).
     * Allows admin to prioritise prominent brands (e.g. Royal Enfield first).
     */
    displayOrder: number
  
    /*
     * isActive — whether the brand is currently active on the site.
     * Inactive brands: hidden from public listing, still visible in admin.
     * Allows removing a brand without deleting its data.
     * Default: true
     */
    isActive: boolean
  
    // ── Timestamps (auto-managed by Mongoose) ──────────────────────────
  
    createdAt: Date
    updatedAt: Date
  }
  
  /*
   * IBrandInput — plain object type for creating or updating a Brand.
   * Used in API route handlers (DB-05/DB-06) where request body data
   * is passed to Brand.create() or brand.save().
   *
   * Omits Document-specific fields (_id, __v, createdAt, updatedAt)
   * managed by Mongoose.
   *
   * displayOrder and isActive have defaults and can be omitted on create.
   */
  export type IBrandInput = Omit<
  IBrand,
  keyof Document | 'createdAt' | 'updatedAt'
> & {
  displayOrder?: number
  isActive?: boolean
}
  
  /*
   * IBrandSummary — lightweight projection for listing pages and API responses.
   * Contains only the fields needed to render BrandLogoChip and navigation.
   * Used as the return type for Brand list queries in DB-08.
   */
  export interface IBrandSummary {
    slug: string
    name: string
    accentColor: string
    logoUrl?: string
    displayOrder: number
  }
  
  // ---------------------------------------------------------------------------
  // Brand schema
  // ---------------------------------------------------------------------------
  
  const BrandSchema = new Schema<IBrand>(
    {
      // ── Identity ────────────────────────────────────────────────────
  
      slug: {
        type: String,
        required: [true, 'Brand slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        match: [
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'Slug must be lowercase alphanumeric with hyphens only (e.g. royal-enfield)',
        ],
      },
  
      name: {
        type: String,
        required: [true, 'Brand name is required'],
        trim: true,
        maxlength: [100, 'Brand name must be 100 characters or fewer'],
      },
  
      accentColor: {
        type: String,
        required: [true, 'Accent color is required'],
        trim: true,
        match: [
          /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          'Accent color must be a valid CSS hex color (e.g. #FF6A00)',
        ],
      },
  
      // ── Media ────────────────────────────────────────────────────────
  
      logoUrl: {
        type: String,
        trim: true,
      },
  
      heroImageUrl: {
        type: String,
        trim: true,
      },
  
      // ── SEO ──────────────────────────────────────────────────────────
  
      defaultMetaDescription: {
        type: String,
        required: [true, 'Default meta description is required'],
        trim: true,
        maxlength: [
          165,
          'Meta description must be 165 characters or fewer',
        ],
      },
  
      // ── Display ──────────────────────────────────────────────────────
  
      displayOrder: {
        type: Number,
        default: 0,
        min: [0, 'Display order cannot be negative'],
      },
  
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
      collection: 'brands',
      toJSON: { virtuals: true },
      toObject: { virtuals: true },
    },
  )
  
  // ---------------------------------------------------------------------------
  // Indexes
  // ---------------------------------------------------------------------------
  
  /*
   * slug: unique — enforced at schema level (unique: true above) AND
   * via an explicit index definition for clarity and index options.
   * The schema-level unique:true creates the index automatically;
   * the explicit definition allows adding options in future (sparse, etc.).
   *
   * Note: Mongoose creates the slug unique index from the schema definition.
   * We add additional indexes below for query patterns not covered by it.
   */
  
  /*
   * name text index — admin panel brand search:
   *   Brand.find({ $text: { $search: 'royal' } })
   * Text indexes support case-insensitive partial matching.
   */
  BrandSchema.index({ name: 'text' })
  
  /*
   * isActive + displayOrder compound index — public brand listing query:
   *   Brand.find({ isActive: true }).sort({ displayOrder: 1 })
   * The compound index covers both the filter and the sort in a single scan.
   */
  BrandSchema.index({ isActive: 1, displayOrder: 1 })
  
  /*
   * slug + isActive — brand existence check in listing pages (DB-08):
   *   Brand.findOne({ slug: 'royal-enfield', isActive: true })
   * Allows fast existence validation before rendering brand pages.
   */
  BrandSchema.index({ slug: 1, isActive: 1 })
  
  // ---------------------------------------------------------------------------
  // Virtuals
  // ---------------------------------------------------------------------------
  
  /*
   * bikesCount virtual — populated via aggregation in API routes.
   *
   * This virtual is NOT automatically populated — it must be explicitly
   * set via an aggregation $lookup or $group pipeline in the brands API.
   *
   * It is defined here as a virtual to ensure it appears in toJSON()
   * output when populated, without requiring a stored field.
   *
   * DB-05 populates this via:
   *   Brand.aggregate([
   *     { $lookup: {
   *         from: 'bikes',
   *         localField: 'slug',
   *         foreignField: 'brandSlug',
   *         pipeline: [{ $match: { status: 'published' } }],
   *         as: 'publishedBikes'
   *     }},
   *     { $addFields: { bikesCount: { $size: '$publishedBikes' } } },
   *   ])
   */
  BrandSchema.virtual('bikesCount').get(function () {
    return undefined
  })
  
  // ---------------------------------------------------------------------------
  // Model export — singleton pattern
  // ---------------------------------------------------------------------------
  
  /*
   * Singleton model registration — prevents HMR errors.
   * See Bike.ts (DB-02) for detailed explanation of this pattern.
   */
  const Brand =
    (mongoose.models['Brand'] as Model<IBrand> | undefined) ??
    mongoose.model<IBrand>('Brand', BrandSchema)
  
  export default Brand