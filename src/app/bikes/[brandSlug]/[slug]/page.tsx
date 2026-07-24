/*
 * Bike Detail Page — /bikes/[brandSlug]/[slug]
 *
 * B-06 CHANGES:
 *   - Import BikeFeaturesList
 *   - Replace the B-06 pill-chip stub with <BikeFeaturesList />
 *   - Section label changed from "Notable Features" to "Features"
 *   - Removed the inline pill chips and stub note
 *   - Section condition simplified: BikeFeaturesList.hasAnyPresent
 *     handles the empty state internally (returns null)
 *   - Page always renders the Features section label + BikeFeaturesList
 *     (BikeFeaturesList returns null if nothing to show)
 *
 * All other code from B-01 through B-05 is preserved unchanged.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import connectDB from '@/lib/db/mongodb'
import Bike from '@/lib/db/models/Bike'
import Brand from '@/lib/db/models/Brand'
import Breadcrumb from '@/components/layout/Breadcrumb'
import BikeGallery from '@/components/bike/BikeGallery'
import BikeColorSelector from '@/components/bike/BikeColorSelector'
import Bike360Viewer from '@/components/bike/Bike360Viewer'
import BikeSpecTable from '@/components/bike/BikeSpecTable'
import BikeFeaturesList from '@/components/bike/BikeFeaturesList'
import { BRAND_MAP, BRAND_ACCENT_MAP } from '@/constants/brands'
import { formatPriceInLakhs } from '@/constants/priceRanges'
import type { IBike } from '@/lib/db/models/Bike'

// ---------------------------------------------------------------------------
// Rendering strategy
// ---------------------------------------------------------------------------

export const revalidate = 300

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BikeDetailParams {
  params: Promise<{
    brandSlug: string
    slug: string
  }>
}

type BikeDetailData = Omit<IBike, keyof Document> & {
  _id: string
}

// ---------------------------------------------------------------------------
// generateStaticParams
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<
  Array<{ brandSlug: string; slug: string }>
> {
  try {
    await connectDB()
    const bikes = await Bike.find({ status: 'published' })
      .select('brandSlug slug')
      .lean<Array<{ brandSlug: string; slug: string }>>()
    return bikes.map((bike) => ({ brandSlug: bike.brandSlug, slug: bike.slug }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: BikeDetailParams): Promise<Metadata> {
  const { brandSlug, slug } = await params

  try {
    await connectDB()

    const bike = await Bike.findOne({ brandSlug, slug, status: 'published' })
      .select('name tagline brandName heroImageUrl seo')
      .lean<Pick<IBike, 'name' | 'tagline' | 'brandName' | 'heroImageUrl' | 'seo'>>()

    if (!bike) {
      return {
        title: 'Bike Not Found | MotoHub360',
        robots: { index: false, follow: false },
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
    const canonicalUrl = `${siteUrl}/bikes/${brandSlug}/${slug}`
    const year = new Date().getFullYear()

    const title =
      bike.seo?.metaTitle ??
      `${bike.brandName} ${bike.name} Price in India, Specs, Colours ${year} | MotoHub360`

    const description =
      bike.seo?.metaDescription ??
      `${bike.brandName} ${bike.name} — ${bike.tagline}. ` +
        `Check ${bike.name} price in India, specs, colours, and on-road costs on MotoHub360.`

    const ogImage = bike.seo?.ogImageUrl ?? bike.heroImageUrl

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'website',
        images: ogImage
          ? [{ url: ogImage, width: 1200, height: 630, alt: `${bike.brandName} ${bike.name}` }]
          : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
      alternates: { canonical: canonicalUrl },
    }
  } catch {
    return { title: 'Bike Detail | MotoHub360' }
  }
}

// ---------------------------------------------------------------------------
// Vehicle JSON-LD
// ---------------------------------------------------------------------------

function buildVehicleJsonLd(
  bike: BikeDetailData,
  brandSlug: string,
  slug: string,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${bike.brandName} ${bike.name}`,
    description: bike.tagline,
    brand: { '@type': 'Brand', name: bike.brandName },
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
      seller: { '@type': 'Organization', name: 'MotoHub360' },
    },
  })
}

// ---------------------------------------------------------------------------
// Default blur
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

  await connectDB()

  const bike = await Bike.findOne({
    brandSlug,
    slug,
    status: 'published',
  }).lean<BikeDetailData>()

  if (!bike) {
    notFound()
  }

  let accentColor = BRAND_ACCENT_MAP[brandSlug] ?? '#15161A'

  try {
    const brandDoc = await Brand.findOne({ slug: brandSlug, isActive: true })
      .select('accentColor')
      .lean<{ accentColor: string }>()
    if (brandDoc?.accentColor) {
      accentColor = brandDoc.accentColor
    }
  } catch {
    // static fallback
  }

  const brandName =
    bike.brandName ||
    BRAND_MAP[brandSlug]?.name ||
    brandSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const exShowroomFormatted = formatPriceInLakhs(bike.pricing.exShowroom)
  const onRoadFormatted = bike.pricing.onRoad
    ? formatPriceInLakhs(bike.pricing.onRoad)
    : null

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: brandName, href: `/brands/${brandSlug}` },
    { label: bike.name, href: `/bikes/${brandSlug}/${slug}` },
  ]

  const vehicleJsonLd = buildVehicleJsonLd(bike, brandSlug, slug)
  const defaultColor = bike.colors[0] ?? null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: vehicleJsonLd }}
      />

      <style>{`
        .bike-detail-page {
          min-height: 100vh;
          background-color: var(--color-surface-base);
          overflow-x: hidden;
        }
        .bike-hero-section {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background-color: var(--color-surface-inverse);
          overflow: hidden;
        }
        @media (max-width: 768px) { .bike-hero-section { aspect-ratio: 4 / 3; } }
        @media (max-width: 480px) { .bike-hero-section { aspect-ratio: 1 / 1; } }
        .bike-hero-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(14,15,18,0.92) 0%,
            rgba(14,15,18,0.6) 35%,
            rgba(14,15,18,0.2) 60%,
            transparent 80%
          );
          z-index: 1;
        }
        .bike-hero-content {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: clamp(24px, 5vw, 56px);
          z-index: 2;
        }
        .bike-detail-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 32px;
        }
        @media (max-width: 768px) { .bike-detail-inner { padding: 0 20px; } }
        .bike-breadcrumb-row { padding: 20px 0 0; }
        .bike-price-block {
          padding: 28px 0;
          border-bottom: 1px solid var(--color-border-hairline);
        }
        .bike-price-row {
          display: flex;
          align-items: baseline;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .bike-section-gap { margin-top: 48px; }
        @media (max-width: 768px) { .bike-section-gap { margin-top: 32px; } }
        .bike-section-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-ink-tertiary);
          margin: 0 0 16px;
        }
        .bike-stub-section {
          padding: 24px;
          background-color: var(--color-surface-raised);
          border: 1px dashed var(--color-border-hairline);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .bike-detail-bottom-pad {
          padding-bottom: clamp(80px, 12vw, 120px);
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bike-detail-bottom-pad {
            padding-bottom: calc(
              clamp(80px, 12vw, 120px) + env(safe-area-inset-bottom)
            );
          }
        }
        .bike-back-link:hover { color: var(--color-ink-primary) !important; }
        .bike-back-link:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
        }
        .bike-color-swatch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }
        @media (max-width: 480px) {
          .bike-hero-content { padding: 20px; }
          .bike-price-block { padding: 20px 0; }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>

      <main
        className="bike-detail-page"
        role="main"
        aria-label={`${brandName} ${bike.name} details`}
      >
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section
          className="bike-hero-section"
          aria-label={`${bike.name} hero image`}
        >
          <Image
            src={bike.heroImageUrl}
            alt={`${brandName} ${bike.name} — ${bike.tagline}`}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            placeholder={bike.blurDataUrl ? 'blur' : 'empty'}
            blurDataURL={bike.blurDataUrl ?? DEFAULT_BLUR}
          />
          <div className="bike-hero-scrim" aria-hidden="true" />
          <div className="bike-hero-content">
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
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

              {defaultColor && (
                <div
                  className="bike-color-swatch"
                  aria-label={`Default color: ${defaultColor.name}`}
                >
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

        {/* ── PAGE CONTENT ─────────────────────────────────────────── */}
        <div className="bike-detail-inner">

          {/* Breadcrumb */}
          <div className="bike-breadcrumb-row">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Price block */}
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

          {/* B-03: Color selector */}
          {bike.colors.length > 0 && (
            <div className="bike-section-gap">
              <BikeColorSelector
                colors={bike.colors}
                accentColor={accentColor}
                heroImageUrl={bike.heroImageUrl}
                blurDataUrl={bike.blurDataUrl}
                bikeName={bike.name}
              />
            </div>
          )}

          {/* B-02: Image gallery */}
          {bike.gallery.length > 0 && (
            <div className="bike-section-gap">
              <p className="bike-section-label">
                Gallery
                <span
                  style={{
                    fontStyle: 'normal',
                    fontWeight: 400,
                    color: 'var(--color-ink-tertiary)',
                    marginLeft: '8px',
                  }}
                >
                  ({bike.gallery.length + 1} images)
                </span>
              </p>
              <BikeGallery
                heroImageUrl={bike.heroImageUrl}
                blurDataUrl={bike.blurDataUrl}
                images={bike.gallery}
                bikeName={bike.name}
                accentColor={accentColor}
              />
            </div>
          )}

          {/* B-04: 360° viewer */}
          {bike.video360Url && (
            <div className="bike-section-gap">
              <p className="bike-section-label">360° View</p>
              <Bike360Viewer
                videoUrl={bike.video360Url}
                posterUrl={bike.heroImageUrl}
                posterBlurUrl={bike.blurDataUrl}
                bikeName={bike.name}
                accentColor={accentColor}
              />
            </div>
          )}

          {/* B-05: Spec table */}
          <div className="bike-section-gap">
            <p className="bike-section-label">Specifications</p>
            <BikeSpecTable
              specs={{
                engine: bike.specs.engine,
                dimensions: bike.specs.dimensions,
              }}
              accentColor={accentColor}
            />
          </div>

          {/* ── B-06: Features list — BikeFeaturesList ────────────── */}
          {/*
           * B-06: BikeFeaturesList — IMPLEMENTED.
           *
           * Server Component — zero JS bundle overhead.
           * Four groups: Safety, Performance, Technology, Lighting.
           * ALL features shown (present + absent) for complete information.
           * Riding modes shown as individual chips below the groups.
           * Returns null if no feature data exists — section label
           * is conditionally rendered using the same check.
           *
           * hasAnyFeatureData: true when at least one boolean feature
           * is set OR ridingModes has entries. Used to conditionally
           * render the "Features" section label — avoids an orphaned
           * label with no content when BikeFeaturesList returns null.
           */}
          {(() => {
            const f = bike.specs.features
            const hasAnyFeatureData =
              f.abs === true ||
              f.dualChannelAbs === true ||
              f.tractionControl === true ||
              f.slipAssistClutch === true ||
              f.quickshifter === true ||
              f.autoblipper === true ||
              f.cruiseControl === true ||
              f.tft === true ||
              f.bluetooth === true ||
              f.navigation === true ||
              f.usbCharging === true ||
              f.ledLights === true ||
              (Array.isArray(f.ridingModes) && f.ridingModes.length > 0)

            if (!hasAnyFeatureData) return null

            return (
              <div className="bike-section-gap">
                <p className="bike-section-label">Features</p>
                <BikeFeaturesList
                  features={bike.specs.features}
                  accentColor={accentColor}
                />
              </div>
            )
          })()}

          {/* ── B-07: Related bikes ───────────────────────────────── */}
          {/*
           * B-07 INTEGRATION POINT:
           *   <RelatedBikes
           *     currentSlug={slug}
           *     brandSlug={brandSlug}
           *     category={bike.category}
           *   />
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
                  Compact BikeCard scroll row — implemented in B-07.
                </p>
              </div>
            </div>
          </div>

          {/* ── B-08: Mobile action bar ───────────────────────────── */}
          {/*
           * B-08 INTEGRATION POINT:
           *   <BikeMobileActionBar
           *     price={bike.pricing.exShowroom}
           *     bikeName={bike.name}
           *     accentColor={accentColor}
           *   />
           */}
          <div className="bike-detail-bottom-pad" />
        </div>
      </main>
    </>
  )
}