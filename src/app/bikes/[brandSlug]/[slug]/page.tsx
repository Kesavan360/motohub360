/*
 * Bike Detail Page — /bikes/[brandSlug]/[slug]
 *
 * MPD Task B-01:
 *   "Bike detail page at /bikes/[brandSlug]/[slug].
 *   ISR 5 min. generateStaticParams from DB. Full bike data:
 *   hero image, name, brand, price block, breadcrumb.
 *   Placeholder sections for gallery, specs, colors, 360°, related."
 *
 * MPD Section 4, Site Structure:
 *   "/bikes/[brandSlug]/[slug] → Bike detail | ISR (5min) |
 *   Rebuilds when bike updated or published."
 *
 * MPD Section 5.3, Bike Detail Page:
 *   "Above the fold:
 *    - Full-bleed hero image (Cloudinary, optimised via Next.js Image)
 *    - Brand name in body-sm/ink-tertiary above the bike name
 *    - Bike name in display-xl
 *    - Tagline in body-lg/ink-secondary
 *    - Price block: ex-showroom (primary) + on-road (secondary) in mono
 *    - Color selector (B-05)
 *   Below the fold:
 *    - Image gallery strip (B-04)
 *    - 360° viewer embed (B-03)
 *    - Full spec table (B-06)
 *    - Features list (B-07)
 *    - Related bikes (B-08)
 *    - Mobile action bar (B-09, sticky bottom)"
 *
 * MPD Section 12, SEO Architecture:
 *   "Vehicle JSON-LD structured data on bike detail pages.
 *   BreadcrumbList via Breadcrumb component (L-05).
 *   Canonical URL: /bikes/[brandSlug]/[slug]
 *   OG image: bike heroImageUrl (Cloudinary)."
 *
 * RENDERING STRATEGY:
 *   ISR with revalidate = 300 (5 minutes).
 *   DB-07 calls revalidatePath('/bikes/[brandSlug]/[slug]') immediately
 *   on publish/update — so the page rebuilds within seconds of changes.
 *   The 5-minute TTL is a safety net, not the primary update mechanism.
 *
 * ROUTE PARAMETERS:
 *   [brandSlug] — e.g. "royal-enfield"
 *   [slug]      — e.g. "gt-650"
 *   Together they uniquely identify a bike: Bike.findOne({ brandSlug, slug })
 *
 * NOT FOUND:
 *   - Bike document does not exist → notFound()
 *   - Bike status is 'draft' → notFound() (public page, drafts not visible)
 *   - brandSlug does not match the bike's actual brandSlug → notFound()
 *     (prevents /bikes/ktm/gt-650 from resolving Royal Enfield's GT 650)
 *
 * generateStaticParams:
 *   Queries all published bikes from MongoDB.
 *   Falls back to [] if DB unavailable at build time —
 *   Next.js will SSR those pages on first request (fallback: 'blocking').
 *
 * SERVER COMPONENT:
 *   This page is a Server Component.
 *   All data fetching is server-side.
 *   Client components (gallery, color selector, mobile action bar)
 *   are imported and Next.js handles client boundaries automatically.
 *   For B-01, no client sub-components are used yet.
 *
 * B-02 THROUGH B-09 INTEGRATION POINTS:
 *   Each section below the hero is clearly marked with a comment block
 *   describing exactly which component is rendered in each subsequent task.
 *   This makes the integration points explicit and prevents structural
 *   conflicts when multiple B-tasks are worked in parallel.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import Brand from '@/lib/db/models/Brand'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { BRAND_MAP, BRAND_ACCENT_MAP } from '@/constants/brands'
import { formatPriceInLakhs } from '@/constants/priceRanges'
import type { IBike } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

/*
 * ISR — 5 minute revalidation.
 * MPD Section 8: "/bikes/[brandSlug]/[slug] → ISR (5min)"
 * DB-07 calls revalidatePath() immediately on publish/update.
 */
export const revalidate = 300

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * BikeDetailParams — the dynamic route params for this page.
 * Typed as Promise<> per Next.js 15+ async params convention.
 */
interface BikeDetailParams {
  params: Promise<{
    brandSlug: string
    slug: string
  }>
}

/*
 * BikeDetailData — the resolved bike document shape for this page.
 * Uses the full IBike interface from DB-02.
 * The lean() call returns a plain object, so we cast appropriately.
 */
type BikeDetailData = Omit<IBike, "_id"> & {
    _id: string
  }

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

/*
 * generateStaticParams — pre-builds all published bike detail pages
 * at deploy time.
 *
 * Queries MongoDB for all bikes with status: 'published'.
 * Returns an array of { brandSlug, slug } objects.
 *
 * Falls back to [] if:
 *   - MONGODB_URI is not set (CI/CD environments)
 *   - DB is unreachable at build time
 *
 * With [] returned, Next.js uses dynamic SSR on first request
 * (ISR fallback: 'blocking') and then caches the result.
 * This allows the build to succeed even before the DB is seeded.
 *
 * DB-10 seeds the GT 650 bike so this returns [
 *   { brandSlug: 'royal-enfield', slug: 'gt-650' }
 * ] after first seed run.
 */
export async function generateStaticParams(): Promise<
  Array<{ brandSlug: string; slug: string }>
> {
  try {
    await connectDB()

    const bikes = await Bike.find({ status: 'published' })
      .select('brandSlug slug')
      .lean<Array<{ brandSlug: string; slug: string }>>()

    return bikes.map((bike) => ({
      brandSlug: bike.brandSlug,
      slug: bike.slug,
    }))
  } catch {
    /*
     * DB unavailable at build time — return empty array.
     * Pages are built on first request (ISR fallback).
     */
    return []
  }
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

/*
 * generateMetadata — per-bike SEO metadata.
 *
 * MPD Section 12, SEO:
 *   "Vehicle JSON-LD on bike detail pages.
 *   OG image: bike heroImageUrl.
 *   Canonical URL: /bikes/[brandSlug]/[slug]"
 *
 * Title format: "[Brand] [Name] Price in India, Specs, Colours [Year] | MotoHub360"
 * Example: "Royal Enfield GT 650 Price in India, Specs, Colours 2024 | MotoHub360"
 *
 * Falls back to a generic title if the bike is not found — the page
 * component calls notFound() so this metadata is not seen by users
 * but prevents a TypeScript error in generateMetadata.
 */
export async function generateMetadata({
  params,
}: BikeDetailParams): Promise<Metadata> {
  const { brandSlug, slug } = await params
  console.log("=== generateMetadata ===")
  console.log({ brandSlug, slug })
  try {
    await connectDB()

    const bike = await Bike.findOne({
      brandSlug,
      slug,
      status: 'published',
    })
      .select('name tagline brandName heroImageUrl seo')
      .lean<Pick<IBike, 'name' | 'tagline' | 'brandName' | 'heroImageUrl' | 'seo'>>()
      console.log("Metadata bike:", bike)

    if (!bike) {
      return {
        title: 'Bike Not Found | MotoHub360',
        robots: { index: false, follow: false },
      }
    }

    /*
     * Use custom seo fields if set by admin, otherwise generate defaults.
     * Custom fields allow the admin to override auto-generated meta
     * for bikes with unusual names or marketing requirements.
     */
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

    const canonicalUrl = `${siteUrl}/bikes/${brandSlug}/${slug}`

    const year = new Date().getFullYear()

    const title =
      bike.seo?.metaTitle ??
      `${bike.brandName} ${bike.name} Price in India, Specs, Colours ${year} | MotoHub360`

    const description =
      bike.seo?.metaDescription ??
      `${bike.brandName} ${bike.name} — ${bike.tagline}. Check
       ${bike.name} price in India, specs, colours and on-road costs on MotoHub360.` +
        bike.tagline

    const ogImage =
      bike.seo?.ogImageUrl ?? bike.heroImageUrl

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'website',
        images: ogImage
          ? [
              {
                url: ogImage,
                width: 1200,
                height: 630,
                alt: `${bike.brandName} ${bike.name}`,
              },
            ]
          : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
      alternates: {
        canonical: canonicalUrl,
      },
    }
  } catch {
    return {
      title: 'Bike Detail | MotoHub360',
    }
  }
}

// ---------------------------------------------------------------------------
// Vehicle JSON-LD
// ---------------------------------------------------------------------------

/*
 * buildVehicleJsonLd — generates schema.org Vehicle structured data.
 *
 * Google uses Vehicle schema to display rich results for:
 *   - Model name
 *   - Brand
 *   - Price
 *   - Description (tagline)
 *   - Image
 *
 * MPD Section 12: "Vehicle JSON-LD structured data on bike detail pages."
 *
 * Schema reference: https://schema.org/Vehicle
 *   (Motorcycle is a subtype of Vehicle in schema.org)
 *
 * P-02 (future) adds more detailed Vehicle schema with specs.
 * This is the minimal baseline for B-01.
 */
function buildVehicleJsonLd(bike: BikeDetailData, brandSlug: string, slug: string): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const vehicle = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${bike.brandName} ${bike.name}`,
    description: bike.tagline,
    brand: {
      '@type': 'Brand',
      name: bike.brandName,
    },
    model: bike.name,
    image: bike.heroImageUrl,
    url: `${siteUrl}/bikes/${brandSlug}/${slug}`,
    offers: {
      '@type': 'Offer',
      price: bike.pricing.exShowroom,
      priceCurrency: 'INR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: bike.pricing.exShowroom,
        priceCurrency: 'INR',
        name: 'Ex-showroom price',
      },
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'MotoHub360',
      },
    },
  }

  return JSON.stringify(vehicle)
}

// ---------------------------------------------------------------------------
// Default blur placeholder
// ---------------------------------------------------------------------------

const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function BikeDetailPage({
  params,
}: BikeDetailParams) {
  const { brandSlug, slug } = await params
  console.log("=== BikeDetailPage ===")
  console.log({ brandSlug, slug })
  // ── Fetch bike from MongoDB ─────────────────────────────────────────

  await connectDB()

  /*
   * Find the bike by brandSlug + slug.
   * Both fields are required — prevents /bikes/ktm/gt-650 from
   * resolving to the Royal Enfield GT 650 (wrong brandSlug).
   *
   * status: 'published' — drafts are not visible on the public page.
   * Admins can preview drafts via the admin panel (Phase 9).
   */
  const bike = await Bike.findOne({
    brandSlug,
    slug,
    status: 'published',
  }).lean<BikeDetailData>()
  console.log("brandSlug:", brandSlug)
console.log("slug:", slug)
console.log("bike:", bike)
console.log("Bike from DB:", bike)

if (!bike) {
    console.log("Bike not found in DB")
    console.log({
      brandSlug,
      slug,
    })
    notFound()
  }
  
  console.log("Bike found:", bike.name)
  
  const bikeData = JSON.parse(
    JSON.stringify({
      ...bike,
      _id: bike._id.toString(),
    })
  ) as BikeDetailData
  // ── Fetch brand accent color ────────────────────────────────────────

  /*
   * Try Brand document first (DB-03), fall back to BRAND_ACCENT_MAP (S-08).
   * The Brand document may have a different accent color than the static
   * constant if it was updated via the admin panel.
   */
  let accentColor = BRAND_ACCENT_MAP[brandSlug] ?? '#15161A'

  try {
    const brandDoc = await Brand.findOne({ slug: brandSlug, isActive: true })
      .select('accentColor')
      .lean<{ accentColor: string }>()

    if (brandDoc?.accentColor) {
      accentColor = brandDoc.accentColor
    }
  } catch {
    /*
     * Brand query failed — use static fallback.
     * The bike still renders correctly without the brand doc.
     */
  }

  // ── Derived values ──────────────────────────────────────────────────

  /*
   * Brand display name — from the bike document (denormalised in DB-02).
   * Falls back to BRAND_MAP if brandName somehow missing.
   */
  const brandName =
    bike.brandName ||
    BRAND_MAP[brandSlug]?.name ||
    brandSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  /*
   * Price formatting.
   */
  const exShowroomFormatted = formatPriceInLakhs(bike.pricing.exShowroom)
  const onRoadFormatted = bike.pricing.onRoad
    ? formatPriceInLakhs(bike.pricing.onRoad)
    : null

  /*
   * Breadcrumb items — Home > Brand > Bike Name.
   * Per MPD L-05 usage:
   *   { label: 'Home', href: '/' }
   *   { label: 'Royal Enfield', href: '/brands/royal-enfield' }
   *   { label: 'GT 650', href: '/bikes/royal-enfield/gt-650' }
   */
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: brandName, href: `/brands/${brandSlug}` },
    { label: bikeData.name!, href: `/bikes/${brandSlug}/${slug}` },
  ]

  /*
   * Vehicle JSON-LD for this bike.
   */
  const vehicleJsonLd = buildVehicleJsonLd(bikeData, brandSlug, slug)

  /*
   * Default color — the first color variant.
   * B-05 adds the interactive color selector.
   * For B-01, we display the hero image and first color name only.
   */
  const defaultColor = bike.colors[0] ?? null

  return (
    <>
      {/* ── Structured data ──────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: vehicleJsonLd }}
      />

      <style>{`
        /*
         * Bike detail page layout.
         * surface-base background throughout.
         */
        .bike-detail-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }

        /*
         * Hero section — full-bleed image with overlay content.
         * Aspect ratio: 16/9 on desktop, 4/3 on tablet, 1/1 on mobile.
         * MPD Section 5.3: "Full-bleed hero image."
         */
        .bike-hero-section {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background-color: var(--color-surface-inverse);
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .bike-hero-section {
            aspect-ratio: 4 / 3;
          }
        }

        @media (max-width: 480px) {
          .bike-hero-section {
            aspect-ratio: 1 / 1;
          }
        }

        /*
         * Hero gradient scrim — bottom-up dark gradient.
         * Ensures text legibility over any hero image.
         * Stronger than the Home page BikeHero scrim (full detail page).
         */
        .bike-hero-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(14, 15, 18, 0.92) 0%,
            rgba(14, 15, 18, 0.6) 35%,
            rgba(14, 15, 18, 0.2) 60%,
            transparent 80%
          );
          z-index: 1;
        }

        /*
         * Hero content — positioned in the lower-third of the hero image.
         */
        .bike-hero-content {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: clamp(24px, 5vw, 56px);
          z-index: 2;
        }

        /*
         * Content container — max 1440px, centered.
         */
        .bike-detail-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }

        @media (max-width: 768px) {
          .bike-detail-inner {
            padding: 0 20px;
          }
        }

        /*
         * Breadcrumb row — above the hero.
         */
        .bike-breadcrumb-row {
          padding: 20px 0 0;
        }

        /*
         * Price block — below the hero, above the content sections.
         */
        .bike-price-block {
          padding: 28px 0 0;
          border-bottom: 1px solid var(--color-border-hairline);
          padding-bottom: 28px;
        }

        /*
         * Price values row.
         */
        .bike-price-row {
          display: flex;
          align-items: baseline;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        /*
         * Section gap — consistent spacing between content sections.
         */
        .bike-section-gap {
          margin-top: 48px;
        }

        @media (max-width: 768px) {
          .bike-section-gap {
            margin-top: 32px;
          }
        }

        /*
         * Section label — uppercase body-sm above each section.
         */
        .bike-section-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 16px;
        }

        /*
         * Stub placeholder — visual marker for B-02 through B-09 sections.
         * Removed when each section is implemented.
         */
        .bike-stub-section {
          padding: 24px;
          background-color: var(--color-surface-raised);
          border: 1px dashed var(--color-border-hairline);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /*
         * Bottom safe area padding for mobile action bar (B-09).
         */
        .bike-detail-bottom-pad {
          padding-bottom: clamp(80px, 12vw, 120px);
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bike-detail-bottom-pad {
            padding-bottom: calc(clamp(80px, 12vw, 120px) + env(safe-area-inset-bottom));
          }
        }

        /*
         * Back to brand link hover.
         */
        .bike-back-link:hover {
          color: var(--color-ink-primary) !important;
        }
        .bike-back-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
        }

        /*
         * Color swatch indicator in hero.
         */
        .bike-color-swatch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 480px) {
          .bike-hero-content {
            padding: 20px;
          }
          .bike-price-block {
            padding: 20px 0;
          }
        }
      `}</style>

      <main
        className="bike-detail-page"
        role="main"
        aria-label={`${brandName} ${bike.name} details`}
      >
        {/* ── HERO SECTION ──────────────────────────────────────────── */}
        {/*
         * Full-bleed hero image.
         * The image fills the section; the gradient scrim overlays it.
         * The text content (name, tagline, price preview) sits above the scrim.
         *
         * B-03 INTEGRATION POINT:
         *   The hero image is replaced by the 360° viewer component
         *   when video360Url is present. B-03 adds a toggle button
         *   ("View 360°") that switches between the still image and
         *   the Cloudinary 360° spin video.
         *
         * B-04 INTEGRATION POINT:
         *   A thumbnail strip of gallery images is added below the
         *   hero image. Clicking a thumbnail updates the hero to show
         *   that gallery image.
         *
         * B-05 INTEGRATION POINT:
         *   The color selector updates the hero image to the selected
         *   color variant's imageUrl (IBikeColor.imageUrl).
         */}
        <section
          className="bike-hero-section"
          aria-label={`${bike.name} hero image`}
        >
          <Image
            src={bikeData.heroImageUrl!}
            alt={`${brandName} ${bike.name} — ${bike.tagline}`}
            fill
            priority
            sizes="100vw"
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            placeholder={bike.blurDataUrl ? 'blur' : 'empty'}
            blurDataURL={bike.blurDataUrl ?? DEFAULT_BLUR}
          />

          {/* Dark gradient scrim */}
          <div className="bike-hero-scrim" aria-hidden="true" />

          {/* Hero text content */}
          <div className="bike-hero-content">
            <div
              style={{
                maxWidth: '1440px',
                margin: '0 auto',
              }}
            >
              {/*
               * Brand name — small label above the bike name.
               * MPD Section 5.3: "Brand name in body-sm/ink-tertiary above the bike name."
               * Rendered in muted white (not ink-tertiary, which is dark).
               * Links back to the brand listing page.
               */}
              <Link
                href={`/brands/${brandSlug}`}
                className="bike-back-link"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.6)',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginBottom: '8px',
                  transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {brandName}
              </Link>

              {/*
               * Bike name — display-xl.
               * MPD Section 5.3: "Bike name in display-xl."
               * Largest text on the page — the primary identifier.
               * clamp() scales from 36px mobile to 72px desktop.
               */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(36px, 6vw, 72px)',
                  fontWeight: 600,
                  lineHeight: 1.0,
                  letterSpacing: '-0.025em',
                  color: '#FFFFFF',
                  margin: 0,
                  textShadow: '0 2px 20px rgba(14,15,18,0.5)',
                }}
              >
                {bike.name}
              </h1>

              {/*
               * Tagline — body-lg, muted white.
               * MPD Section 5.3: "Tagline in body-lg/ink-secondary."
               * Translated to rgba(255,255,255,0.75) on the dark hero.
               */}
              {bike.tagline && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'clamp(15px, 1.8vw, 18px)',
                    fontWeight: 400,
                    lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.75)',
                    margin: '8px 0 0',
                    maxWidth: '560px',
                  }}
                >
                  {bike.tagline}
                </p>
              )}

              {/*
               * Color name preview — shown in the hero for the default color.
               * B-05 replaces this with an interactive color swatch selector.
               */}
              {defaultColor && (
                <div className="bike-color-swatch" aria-label={`Default color: ${defaultColor.name}`}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '999px',
                      backgroundColor: defaultColor.hex,
                      border: '2px solid rgba(255,255,255,0.4)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {defaultColor.name}
                    {bike.colors.length > 1 && (
                      <span style={{ marginLeft: '6px', opacity: 0.5 }}>
                        +{bike.colors.length - 1} more
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── PAGE CONTENT ──────────────────────────────────────────── */}
        <div className="bike-detail-inner">

          {/* ── Breadcrumb ────────────────────────────────────────── */}
          {/*
           * Home > [Brand] > [Bike Name]
           * With BreadcrumbList JSON-LD (L-05).
           */}
          <div className="bike-breadcrumb-row">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* ── Price block ───────────────────────────────────────── */}
          {/*
           * MPD Section 5.3, Price Block:
           *   "Price block: ex-showroom (primary) + on-road (secondary) in mono."
           *
           * Ex-showroom is the mandatory price (always present).
           * On-road is optional — shown when available, location-specific.
           *
           * The asterisk (*) signals ex-showroom pricing.
           * "On-road" price is labeled clearly to avoid confusion.
           *
           * B-09 INTEGRATION POINT:
           *   The mobile action bar (sticky bottom) repeats the ex-showroom
           *   price with a "Get On-Road Price" CTA button.
           */}
          <div className="bike-price-block">
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              Price in India
            </p>

            <div className="bike-price-row">
              {/*
               * Ex-showroom price — primary price display.
               * data-xl: large monospace for the engineering aesthetic.
               * MPD Section 6, Data Display: "Mono, tabular numerals."
               */}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'clamp(28px, 4vw, 44px)',
                    fontWeight: 600,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  {exShowroomFormatted}
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 400,
                      color: 'var(--color-ink-tertiary)',
                      marginLeft: '4px',
                    }}
                  >
                    *
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 400,
                    color: 'var(--color-ink-tertiary)',
                    margin: '4px 0 0',
                  }}
                >
                  Ex-showroom price
                </p>
              </div>

              {/*
               * On-road price — secondary, shown when available.
               * Separated from ex-showroom by a subtle divider.
               */}
              {onRoadFormatted && (
                <>
                  <div
                    aria-hidden="true"
                    style={{
                      width: '1px',
                      height: '44px',
                      backgroundColor: 'var(--color-border-hairline)',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(20px, 2.8vw, 32px)',
                        fontWeight: 500,
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                        color: 'var(--color-ink-secondary)',
                      }}
                    >
                      {onRoadFormatted}
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12px',
                        fontWeight: 400,
                        color: 'var(--color-ink-tertiary)',
                        margin: '4px 0 0',
                      }}
                    >
                      On-road price (est.)
                    </p>
                  </div>
                </>
              )}
            </div>

            {/*
             * Ex-showroom footnote.
             * *Prices are ex-showroom and may vary by city.
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
              *Ex-showroom price. On-road price includes registration,
              insurance, and other local charges which vary by city.
            </p>
          </div>

          {/* ── B-05: Color selector ──────────────────────────────── */}
          {/*
           * B-05 INTEGRATION POINT:
           *
           * Renders the interactive color selector component.
           * Each color swatch (hex circle) + color name.
           * Selecting a color updates the hero image to the color variant's
           * imageUrl (IBikeColor.imageUrl from DB-02).
           *
           * When implemented, this section renders:
           *   <BikeColorSelector
           *     colors={bike.colors}
           *     accentColor={accentColor}
           *     onColorChange={(color) => ...}
           *   />
           *
           * For B-01: renders the colors list as a static display.
           */}
          {bike.colors.length > 0 && (
            <div className="bike-section-gap">
              <p className="bike-section-label">
                Available Colours
                <span
                  style={{
                    fontStyle: 'normal',
                    fontWeight: 400,
                    color: 'var(--color-ink-tertiary)',
                    marginLeft: '8px',
                  }}
                >
                  ({bike.colors.length})
                </span>
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
                role="list"
                aria-label="Available colour variants"
              >
                {bikeData.colors!.map((
                 color: BikeDetailData["colors"][number],
                index: number
              ) => (
                  <div
                    key={`${color.hex}-${index}`}
                    role="listitem"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      backgroundColor: 'var(--color-surface-raised)',
                      border: index === 0
                        ? `1.5px solid ${accentColor}`
                        : '1px solid var(--color-border-hairline)',
                      borderRadius: '999px',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '999px',
                        backgroundColor: color.hex,
                        border: '1.5px solid rgba(15,16,18,0.12)',
                        flexShrink: 0,
                        display: 'block',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '13px',
                        fontWeight: index === 0 ? 500 : 400,
                        color: 'var(--color-ink-primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {color.name}
                    </span>
                  </div>
                ))}
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-ink-tertiary)',
                  margin: '10px 0 0',
                }}
              >
                Interactive colour selector coming in B-05.
                Tap a colour to update the hero image.
              </p>
            </div>
          )}

          {/* ── B-04: Image gallery ───────────────────────────────── */}
          {/*
           * B-04 INTEGRATION POINT:
           *
           * Renders a horizontal strip of gallery thumbnails below
           * the color selector. Clicking a thumbnail updates the main
           * hero image. Gallery images come from bike.gallery (IBikeGalleryImage[]).
           *
           * When implemented:
           *   <BikeGallery
           *     images={bike.gallery}
           *     bikeName={bike.name}
           *     accentColor={accentColor}
           *   />
           *
           * For B-01: renders a stub showing image count.
           */}
          {bike.gallery.length > 0 && (
            <div className="bike-section-gap">
              <p className="bike-section-label">Gallery</p>
              <div className="bike-stub-section">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px',
                    color: 'var(--color-ink-tertiary)',
                  }}
                >
                  ◻
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--color-ink-primary)',
                      margin: 0,
                    }}
                  >
                    {bike.gallery.length} image{bike.gallery.length !== 1 ? 's' : ''} available
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--color-ink-tertiary)',
                      margin: '2px 0 0',
                    }}
                  >
                    Image gallery strip — implemented in B-04.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── B-03: 360° viewer ────────────────────────────────── */}
          {/*
           * B-03 INTEGRATION POINT:
           *
           * Renders the Cloudinary 360° spin video viewer.
           * Only shown when bike.video360Url is present.
           * A "View in 360°" toggle button in the hero switches
           * between the still image and the spin video.
           *
           * When implemented:
           *   <Bike360Viewer
           *     videoUrl={bike.video360Url}
           *     posterUrl={bike.heroImageUrl}
           *   />
           *
           * For B-01: renders a stub only when video360Url is present.
           */}
          {bike.video360Url && (
            <div className="bike-section-gap">
              <p className="bike-section-label">360° View</p>
              <div className="bike-stub-section">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px',
                    color: 'var(--color-ink-tertiary)',
                  }}
                >
                  ↻
                </span>
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--color-ink-primary)',
                      margin: 0,
                    }}
                  >
                    360° viewer available
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      color: 'var(--color-ink-tertiary)',
                      margin: '2px 0 0',
                    }}
                  >
                    Interactive 360° spin viewer — implemented in B-03.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── B-06: Spec table ─────────────────────────────────── */}
          {/*
           * B-06 INTEGRATION POINT:
           *
           * Renders the full specification table with three sections:
           *   - Engine & Performance (displacement, power, torque, etc.)
           *   - Dimensions & Capacity (weight, seat height, fuel tank, etc.)
           *   - Features (ABS, riding modes, Bluetooth, etc.)
           *
           * Each row: label (body-sm/ink-secondary) + value (body-md/ink-primary).
           * Empty spec fields are omitted from the table.
           *
           * When implemented:
           *   <BikeSpecTable specs={bike.specs} />
           *
           * For B-01: renders a static preview of key engine specs.
           */}
          <div className="bike-section-gap">
            <p className="bike-section-label">Key Specifications</p>

            {/*
             * Quick-glance spec strip — 4 most important specs.
             * Shown in B-01 as a preview. B-06 replaces with full table.
             */}
            {(bike.specs.engine.displacement ||
              bike.specs.engine.maxPower ||
              bike.specs.engine.maxTorque ||
              bike.specs.dimensions.kerbWeight) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '1px',
                  backgroundColor: 'var(--color-border-hairline)',
                  border: '1px solid var(--color-border-hairline)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '16px',
                }}
              >
                {[
                  {
                    label: 'Engine',
                    value: bike.specs.engine.displacement,
                  },
                  {
                    label: 'Max Power',
                    value: bike.specs.engine.maxPower,
                  },
                  {
                    label: 'Max Torque',
                    value: bike.specs.engine.maxTorque,
                  },
                  {
                    label: 'Kerb Weight',
                    value: bike.specs.dimensions.kerbWeight,
                  },
                ]
                  .filter((spec) => spec.value)
                  .map((spec) => (
                    <div
                      key={spec.label}
                      style={{
                        padding: '16px 20px',
                        backgroundColor: 'var(--color-surface-raised)',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '11px',
                          fontWeight: 500,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--color-ink-tertiary)',
                          margin: '0 0 4px',
                        }}
                      >
                        {spec.label}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '15px',
                          fontWeight: 500,
                          color: 'var(--color-ink-primary)',
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {spec.value}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            <div className="bike-stub-section">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  color: 'var(--color-ink-tertiary)',
                }}
              >
                ≡
              </span>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                    margin: 0,
                  }}
                >
                  Full specification table
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-ink-tertiary)',
                    margin: '2px 0 0',
                  }}
                >
                  Complete engine, dimensions, and features — implemented in B-06.
                </p>
              </div>
            </div>
          </div>

          {/* ── B-07: Features list ───────────────────────────────── */}
          {/*
           * B-07 INTEGRATION POINT:
           *
           * Renders a grid of feature chips (ABS, Bluetooth, Riding Modes, etc.).
           * Boolean features: chip with check icon when true.
           * Array features (riding modes): individual mode chips.
           *
           * When implemented:
           *   <BikeFeaturesList features={bike.specs.features} />
           *
           * For B-01: renders a stub showing key features.
           */}
          {(bike.specs.features.abs ||
            bike.specs.features.bluetooth ||
            bike.specs.features.tft ||
            (bike.specs.features.ridingModes?.length ?? 0) > 0) && (
            <div className="bike-section-gap">
              <p className="bike-section-label">Notable Features</p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '16px',
                }}
                role="list"
                aria-label="Notable features"
              >
                {[
                  bike.specs.features.dualChannelAbs
                    ? 'Dual-Channel ABS'
                    : bike.specs.features.abs
                    ? 'ABS'
                    : null,
                  bike.specs.features.slipAssistClutch ? 'Slipper Clutch' : null,
                  bike.specs.features.bluetooth ? 'Bluetooth' : null,
                  bike.specs.features.tft ? 'TFT Display' : null,
                  bike.specs.features.usbCharging ? 'USB Charging' : null,
                  bike.specs.features.ledLights ? 'Full LED' : null,
                  bike.specs.features.quickshifter ? 'Quickshifter' : null,
                  bike.specs.features.tractionControl ? 'Traction Control' : null,
                  bike.specs.features.cruiseControl ? 'Cruise Control' : null,
                ]
                  .filter(Boolean)
                  .map((feature) => (
                    <span
                      key={feature}
                      role="listitem"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '32px',
                        padding: '0 12px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '13px',
                        fontWeight: 400,
                        color: 'var(--color-ink-secondary)',
                        backgroundColor: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border-hairline)',
                        borderRadius: '999px',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '999px',
                          backgroundColor: accentColor,
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                      {feature}
                    </span>
                  ))}

                {(bike.specs.features.ridingModes?.length ?? 0) > 0 && (
                  <span
                    role="listitem"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '32px',
                      padding: '0 12px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: 'var(--color-ink-secondary)',
                      backgroundColor: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border-hairline)',
                      borderRadius: '999px',
                    }}
                  >
                    {bike.specs.features.ridingModes?.length} Riding Modes
                  </span>
                )}
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-ink-tertiary)',
                  margin: 0,
                }}
              >
                Full features checklist with icons — implemented in B-07.
              </p>
            </div>
          )}

          {/* ── B-08: Related bikes ───────────────────────────────── */}
          {/*
           * B-08 INTEGRATION POINT:
           *
           * Renders a horizontal scroll row of BikeCard (compact variant)
           * showing related bikes from the same brand or same category.
           * Maximum 4 related bikes.
           *
           * Query strategy:
           *   1. Other published bikes from the same brandSlug
           *   2. If < 4: top up from same category (different brand)
           *
           * When implemented:
           *   <RelatedBikes
           *     currentSlug={slug}
           *     brandSlug={brandSlug}
           *     category={bike.category}
           *   />
           *
           * For B-01: renders a stub.
           */}
          <div className="bike-section-gap">
            <p className="bike-section-label">Related Motorcycles</p>
            <div className="bike-stub-section">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  color: 'var(--color-ink-tertiary)',
                }}
              >
                ⊞
              </span>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-ink-primary)',
                    margin: 0,
                  }}
                >
                  Related {brandName} motorcycles
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-ink-tertiary)',
                    margin: '2px 0 0',
                  }}
                >
                  Compact BikeCard scroll row — implemented in B-08.
                </p>
              </div>
            </div>
          </div>

          {/* ── Bottom padding for mobile action bar (B-09) ──────── */}
          {/*
           * B-09 INTEGRATION POINT:
           *
           * Sticky mobile action bar at the bottom of the viewport.
           * Contains:
           *   - Ex-showroom price (compact mono)
           *   - "Get On-Road Price" CTA button (accent color)
           *   - "Compare" secondary link (optional in V1)
           *
           * The bottom padding here reserves space so the page content
           * is not obscured by the sticky bar.
           *
           * When implemented:
           *   <BikeMobileActionBar
           *     price={bike.pricing.exShowroom}
           *     bikeName={bike.name}
           *     accentColor={accentColor}
           *   />
           *
           * For B-01: bottom padding reserves the space.
           */}
          <div className="bike-detail-bottom-pad" />
        </div>
      </main>
    </>
  )
}