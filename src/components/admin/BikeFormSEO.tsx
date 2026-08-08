'use client'

/*
 * BikeFormSEO — SEO section of the BikeForm.
 *
 * MPD Task A-09.5:
 *   "SEO: SEO Title, Meta Description, Canonical URL, Open Graph Image URL,
 *   Twitter Image URL, Structured Data Preview."
 *
 * FIELDS:
 *   metaTitle       — required, max META_TITLE_MAX (60) chars
 *   metaDescription — required, max META_DESCRIPTION_MAX (160) chars, textarea
 *   canonicalUrl    — optional, valid URL if provided
 *   metaKeywords    — optional, comma-separated
 *   ogTitle         — optional, max META_TITLE_MAX chars
 *   ogDescription   — optional, max META_DESCRIPTION_MAX chars
 *   ogImageUrl      — optional, valid URL if provided, live preview
 *   twitterImageUrl — optional, valid URL if provided, live preview (A-09.5)
 *
 * STRUCTURED DATA PREVIEW:
 *   Read-only JSON-LD block generated from current values.
 *   Auto-populates fallbacks (ogTitle → metaTitle, twitterImageUrl → ogImageUrl).
 *   No editing — purely informational.
 *
 * VALIDATION PATTERN:
 *   Identical to BikeFormBasic, BikeFormPricing, BikeFormGallery:
 *     - Local blur errors stored in localErrors state.
 *     - Parent errors (BikeFormSEOErrors from BikeFormShell) in errors prop.
 *     - Merged before render; local errors take precedence (most current).
 *
 * IMAGE PREVIEW:
 *   OG Image and Twitter Image share the same ImagePreview sub-component.
 *   Previews use regular <img> (not Next.js Image) — admin context, URLs
 *   are external/Cloudinary and not configured in next.config.ts remotePatterns.
 *   Broken URLs tracked per URL string in brokenUrls Set.
 *
 * WHY 'use client':
 *   useState (localErrors, brokenUrls)
 *   useCallback (field change/blur handlers)
 *   Event handlers (onChange, onBlur)
 */

import { useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import {
  validateMetaTitle,
  validateMetaDescription,
  validateCanonicalUrl,
  validateMetaKeywords,
  validateOgTextField,
  validateOgImageUrl,
  validateTwitterImageUrl,
  FIELD_LIMITS,
} from '@/lib/bike-form-validation'
import type {
  BikeFormSEOValues,
  BikeFormSEOErrors,
} from '@/types/bike-form'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BikeFormSEOProps {
  /*
   * values — current SEO section state from BikeFormShell (values.seo).
   */
  values: BikeFormSEOValues

  /*
   * errors — section-level errors from BikeFormShell's last full validation.
   * Merged with local blur errors; local errors take precedence.
   */
  errors?: BikeFormSEOErrors

  /*
   * onChange — fires on every field change with the updated SEO values.
   * BikeFormShell wires this to updateSEO().
   */
  onChange: (values: BikeFormSEOValues) => void

  /*
   * disabled — all inputs are inert when true (form is submitting).
   */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// FieldLabel — label + optional char counter
// Identical pattern to BikeFormBasic, BikeFormPricing, BikeFormGallery.
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
        display:        'flex',
        alignItems:     'baseline',
        justifyContent: 'space-between',
        marginBottom:   '6px',
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
            fontSize:   '11px',
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
// FieldError — inline error message
// Identical pattern across all BikeForm section components.
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
      aria-live="polite"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize:   '12px',
        color:      '#C8102E',
        margin:     '5px 0 0',
        display:    'flex',
        alignItems: 'flex-start',
        gap:        '4px',
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
// ImagePreview — live thumbnail for an optional image URL field
// ---------------------------------------------------------------------------

interface ImagePreviewProps {
  url:      string
  alt:      string
  isBroken: boolean
  onError:  (url: string) => void
}

function ImagePreview({ url, alt, isBroken, onError }: ImagePreviewProps) {
  const trimmed = url.trim()
  const hasUrl  = trimmed.length > 0
  const isValid = hasUrl && /^https?:\/\/.+\..+/.test(trimmed)
  const showImg = isValid && !isBroken

  const containerStyle: React.CSSProperties = {
    width:           '100%',
    height:          160,
    borderRadius:    8,
    overflow:        'hidden',
    border:          '1px solid var(--color-border-hairline)',
    backgroundColor: 'var(--color-surface-sunken)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       '8px',
  }

  if (!hasUrl) return null

  if (showImg) {
    return (
      <div style={containerStyle} aria-hidden="true">
        {/*
         * Regular <img> for admin preview — not Next.js Image.
         * See component header for rationale.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trimmed}
          alt={alt}
          onError={() => onError(trimmed)}
          draggable={false}
          style={{
            width:         '100%',
            height:        '100%',
            objectFit:     'cover',
            display:       'block',
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  }

  /*
   * Invalid URL or failed load — show a contextual placeholder.
   */
  return (
    <div style={containerStyle} aria-hidden="true">
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            '6px',
          color:          isBroken ? '#C8102E' : 'var(--color-ink-tertiary)',
          opacity:        0.65,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isBroken ? (
            <>
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </>
          ) : (
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </>
          )}
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   '11px',
          }}
        >
          {isBroken ? 'Image failed to load' : 'Invalid URL'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// buildJsonLd — generates the read-only structured data preview object
// ---------------------------------------------------------------------------

/*
 * buildJsonLd — constructs a minimal JSON-LD Article schema from the
 * current SEO values. Used only for the read-only preview; not submitted
 * to the API (the server generates canonical JSON-LD from the DB).
 *
 * Fallback logic mirrors how the public page's generateMetadata() works:
 *   ogTitle      → falls back to metaTitle
 *   ogDescription → falls back to metaDescription
 *   ogImageUrl   → falls back to '' (no image)
 */
function buildJsonLd(values: BikeFormSEOValues): string {
  const schema = {
    '@context':   'https://schema.org',
    '@type':      'Product',
    name:          values.ogTitle.trim()       || values.metaTitle.trim()       || '(SEO title not set)',
    description:   values.ogDescription.trim() || values.metaDescription.trim() || '(Meta description not set)',
    ...(values.canonicalUrl.trim()    && { url:   values.canonicalUrl.trim() }),
    ...(values.ogImageUrl.trim()      && { image: values.ogImageUrl.trim() }),
    ...(values.metaKeywords.trim()    && {
      keywords: values.metaKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .join(', '),
    }),
  }

  return JSON.stringify(schema, null, 2)
}

// ---------------------------------------------------------------------------
// BikeFormSEO
// ---------------------------------------------------------------------------

export default function BikeFormSEO({
  values,
  errors,
  onChange,
  disabled = false,
}: BikeFormSEOProps) {

  // ── Local blur error state ─────────────────────────────────────────────

  const [localErrors, setLocalErrors] = useState<BikeFormSEOErrors>({})

  // ── Broken URL tracking ────────────────────────────────────────────────

  /*
   * brokenUrls — URL strings where the <img> onError fired.
   * Keyed by URL string so preview state is resilient to field changes.
   * When a URL field changes, the old URL is removed so the new value
   * is evaluated fresh.
   */
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((url: string): void => {
    setBrokenUrls((prev) => new Set([...prev, url]))
  }, [])

  const clearBrokenForOld = useCallback((oldUrl: string): void => {
    if (!oldUrl.trim()) return
    setBrokenUrls((prev) => {
      const next = new Set(prev)
      next.delete(oldUrl.trim())
      return next
    })
  }, [])

  // ── Merged errors ──────────────────────────────────────────────────────

  /*
   * Local blur errors take precedence over parent section-validation errors.
   * Identical merge pattern to BikeFormBasic and all other section components.
   */
  const mergedErrors: BikeFormSEOErrors = {
    ...errors,
    ...localErrors,
  }

  // ── Generic field change handler ──────────────────────────────────────

  const handleFieldChange = useCallback(
    (field: keyof BikeFormSEOValues, value: string): void => {
      onChange({ ...values, [field]: value })
    },
    [values, onChange],
  )

  // ── Blur handlers ──────────────────────────────────────────────────────

  const handleMetaTitleBlur = useCallback((): void => {
    const err = validateMetaTitle(values.metaTitle)
    setLocalErrors((prev) => ({ ...prev, metaTitle: err ?? undefined }))
  }, [values.metaTitle])

  const handleMetaDescriptionBlur = useCallback((): void => {
    const err = validateMetaDescription(values.metaDescription)
    setLocalErrors((prev) => ({ ...prev, metaDescription: err ?? undefined }))
  }, [values.metaDescription])

  const handleCanonicalUrlBlur = useCallback((): void => {
    const err = validateCanonicalUrl(values.canonicalUrl)
    setLocalErrors((prev) => ({ ...prev, canonicalUrl: err ?? undefined }))
  }, [values.canonicalUrl])

  const handleMetaKeywordsBlur = useCallback((): void => {
    const err = validateMetaKeywords(values.metaKeywords)
    setLocalErrors((prev) => ({ ...prev, metaKeywords: err ?? undefined }))
  }, [values.metaKeywords])

  const handleOgTitleBlur = useCallback((): void => {
    const err = validateOgTextField(
      values.ogTitle,
      'Open Graph title',
      FIELD_LIMITS.META_TITLE_MAX,
    )
    setLocalErrors((prev) => ({ ...prev, ogTitle: err ?? undefined }))
  }, [values.ogTitle])

  const handleOgDescriptionBlur = useCallback((): void => {
    const err = validateOgTextField(
      values.ogDescription,
      'Open Graph description',
      FIELD_LIMITS.META_DESCRIPTION_MAX,
    )
    setLocalErrors((prev) => ({ ...prev, ogDescription: err ?? undefined }))
  }, [values.ogDescription])

  const handleOgImageUrlBlur = useCallback((): void => {
    const err = validateOgImageUrl(values.ogImageUrl)
    setLocalErrors((prev) => ({ ...prev, ogImageUrl: err ?? undefined }))
  }, [values.ogImageUrl])

  const handleTwitterImageUrlBlur = useCallback((): void => {
    const err = validateTwitterImageUrl(values.twitterImageUrl)
    setLocalErrors((prev) => ({ ...prev, twitterImageUrl: err ?? undefined }))
  }, [values.twitterImageUrl])

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Group label — uppercase muted heading.
         * Matches the pattern used in BikeFormSpecifications,
         * BikeFormPricing, and BikeFormGallery.
         */
        .bfseo-group-label {
          font-family:    var(--font-body);
          font-size:      11px;
          font-weight:    600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color:          var(--color-ink-tertiary);
          margin:         0 0 16px;
        }

        /* Section divider */
        .bfseo-divider {
          height:           1px;
          background-color: var(--color-border-hairline);
          margin:           24px 0;
        }

        /*
         * Two-column grid for OG Title / OG Description on desktop.
         * Collapses to single column on mobile (≤ 600px).
         */
        .bfseo-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 600px) {
          .bfseo-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        /*
         * Two-column grid for OG Image / Twitter Image previews.
         * Each column contains a URL input + image preview.
         */
        .bfseo-image-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .bfseo-image-grid {
            grid-template-columns: 1fr;
          }
        }

        /*
         * Textarea — Meta Description and OG Description.
         */
        .bfseo-textarea {
          width:      100%;
          box-sizing: border-box;
          min-height: 80px;
          resize:     vertical;
        }

        /*
         * Structured data preview card.
         */
        .bfseo-json-card {
          background-color: var(--color-surface-sunken);
          border:           1px solid var(--color-border-hairline);
          border-radius:    8px;
          overflow:         hidden;
        }

        .bfseo-json-header {
          display:          flex;
          align-items:      center;
          justify-content:  space-between;
          padding:          8px 14px;
          border-bottom:    1px solid var(--color-border-hairline);
          background-color: var(--color-surface-raised);
        }

        .bfseo-json-label {
          font-family:    var(--font-body);
          font-size:      11px;
          font-weight:    600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color:          var(--color-ink-tertiary);
          margin:         0;
        }

        .bfseo-json-badge {
          font-family:      var(--font-body);
          font-size:        10px;
          font-weight:      500;
          color:            var(--color-ink-tertiary);
          background-color: var(--color-surface-sunken);
          border:           1px solid var(--color-border-hairline);
          border-radius:    4px;
          padding:          1px 6px;
        }

        .bfseo-json-pre {
          margin:      0;
          padding:     14px;
          font-family: var(--font-mono);
          font-size:   11px;
          line-height: 1.65;
          color:       var(--color-ink-secondary);
          overflow-x:  auto;
          white-space: pre;
        }

        /*
         * Search result preview card — live Google-style snippet.
         */
        .bfseo-serp-card {
          padding:          14px 16px;
          background-color: var(--color-surface-raised);
          border:           1px solid var(--color-border-hairline);
          border-radius:    8px;
          margin-bottom:    20px;
        }

        .bfseo-serp-label {
          font-family:    var(--font-body);
          font-size:      10px;
          font-weight:    600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color:          var(--color-ink-tertiary);
          margin:         0 0 10px;
        }

        .bfseo-serp-url {
          font-family:   var(--font-body);
          font-size:     13px;
          color:         #1a5c2e;
          margin:        0 0 2px;
          overflow:      hidden;
          text-overflow: ellipsis;
          white-space:   nowrap;
        }

        .bfseo-serp-title {
          font-family:   Arial, Helvetica, sans-serif;
          font-size:     18px;
          color:         #1a0dab;
          margin:        0 0 2px;
          line-height:   1.3;
          overflow:      hidden;
          text-overflow: ellipsis;
          white-space:   nowrap;
        }

        .bfseo-serp-description {
          font-family:          Arial, Helvetica, sans-serif;
          font-size:            14px;
          color:                #4d5156;
          margin:               0;
          line-height:          1.5;
          display:              -webkit-box;
          -webkit-line-clamp:   2;
          -webkit-box-orient:   vertical;
          overflow:             hidden;
        }

        /* Field hint */
        .bfseo-hint {
          font-family: var(--font-body);
          font-size:   11px;
          color:       var(--color-ink-tertiary);
          margin:      5px 0 0;
          line-height: 1.5;
        }
      `}</style>

      <div>

        {/* ── Live SERP preview ──────────────────────────────────── */}
        {/*
         * Google-style snippet preview — updates live as the admin types.
         * Falls back to placeholder text when fields are empty.
         */}
        <div
          className="bfseo-serp-card"
          role="img"
          aria-label={
            `Search result preview: ${values.metaTitle || 'SEO title'} — ${values.metaDescription || 'meta description'}`
          }
        >
          <p className="bfseo-serp-label">Search Result Preview</p>
          <p className="bfseo-serp-url">
            {values.canonicalUrl.trim() || 'motohub360.in › bikes › brand › model'}
          </p>
          <p className="bfseo-serp-title">
            {values.metaTitle.trim() || 'Your SEO title will appear here'}
          </p>
          <p className="bfseo-serp-description">
            {values.metaDescription.trim() ||
              'Your meta description will appear here. Write a concise, compelling summary.'}
          </p>
        </div>

        {/* ── Section 1: Core SEO ───────────────────────────────── */}
        <section aria-label="Core SEO fields">
          <p className="bfseo-group-label">SEO</p>

          {/* SEO Title */}
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel
              htmlFor="bfseo-metaTitle"
              label="SEO Title"
              required
              current={values.metaTitle.length}
              max={FIELD_LIMITS.META_TITLE_MAX}
            />

            <input
              id="bfseo-metaTitle"
              type="text"
              value={values.metaTitle}
              onChange={(e) => handleFieldChange('metaTitle', e.target.value)}
              onBlur={handleMetaTitleBlur}
              disabled={disabled}
              placeholder="Royal Enfield GT 650 Price in India, Specs & Colours"
              maxLength={FIELD_LIMITS.META_TITLE_MAX + 20}
              className="admin-input"
              style={{
                width:     '100%',
                boxSizing: 'border-box',
                ...(mergedErrors.metaTitle && { borderColor: '#C8102E' }),
              }}
              aria-describedby={[
                'bfseo-metaTitle-hint',
                mergedErrors.metaTitle ? 'bfseo-metaTitle-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              aria-required="true"
              aria-invalid={!!mergedErrors.metaTitle}
              autoComplete="off"
              spellCheck={false}
            />

            {!mergedErrors.metaTitle && (
              <p id="bfseo-metaTitle-hint" className="bfseo-hint">
                The clickable headline in search results. Keep under {FIELD_LIMITS.META_TITLE_MAX} characters.
              </p>
            )}

            <FieldError id="bfseo-metaTitle-error" message={mergedErrors.metaTitle} />
          </div>

          {/* Meta Description */}
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel
              htmlFor="bfseo-metaDescription"
              label="Meta Description"
              required
              current={values.metaDescription.length}
              max={FIELD_LIMITS.META_DESCRIPTION_MAX}
            />

            <textarea
              id="bfseo-metaDescription"
              value={values.metaDescription}
              onChange={(e) =>
                handleFieldChange('metaDescription', e.target.value)
              }
              onBlur={handleMetaDescriptionBlur}
              disabled={disabled}
              placeholder="Explore the Royal Enfield GT 650 — price, mileage, specs, colours and more."
              maxLength={FIELD_LIMITS.META_DESCRIPTION_MAX + 20}
              className="admin-input bfseo-textarea"
              style={{
                ...(mergedErrors.metaDescription && { borderColor: '#C8102E' }),
              }}
              aria-describedby={[
                'bfseo-metaDescription-hint',
                mergedErrors.metaDescription ? 'bfseo-metaDescription-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              aria-required="true"
              aria-invalid={!!mergedErrors.metaDescription}
            />

            {!mergedErrors.metaDescription && (
              <p id="bfseo-metaDescription-hint" className="bfseo-hint">
                Shown below the title in search results. Keep under {FIELD_LIMITS.META_DESCRIPTION_MAX} characters.
              </p>
            )}

            <FieldError
              id="bfseo-metaDescription-error"
              message={mergedErrors.metaDescription}
            />
          </div>

          {/* Canonical URL */}
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel htmlFor="bfseo-canonicalUrl" label="Canonical URL" />

            <input
              id="bfseo-canonicalUrl"
              type="url"
              value={values.canonicalUrl}
              onChange={(e) => handleFieldChange('canonicalUrl', e.target.value)}
              onBlur={handleCanonicalUrlBlur}
              disabled={disabled}
              placeholder="https://motohub360.in/bikes/royal-enfield/gt-650"
              className="admin-input"
              style={{
                width:     '100%',
                boxSizing: 'border-box',
                ...(mergedErrors.canonicalUrl && { borderColor: '#C8102E' }),
              }}
              aria-describedby={[
                'bfseo-canonicalUrl-hint',
                mergedErrors.canonicalUrl ? 'bfseo-canonicalUrl-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              aria-invalid={!!mergedErrors.canonicalUrl}
              autoComplete="off"
              spellCheck={false}
            />

            {!mergedErrors.canonicalUrl && (
              <p id="bfseo-canonicalUrl-hint" className="bfseo-hint">
                Optional. Leave empty to use the default page URL. Must be https:// if provided.
              </p>
            )}

            <FieldError
              id="bfseo-canonicalUrl-error"
              message={mergedErrors.canonicalUrl}
            />
          </div>

          {/* Meta Keywords */}
          <div>
            <FieldLabel htmlFor="bfseo-metaKeywords" label="Meta Keywords" />

            <input
              id="bfseo-metaKeywords"
              type="text"
              value={values.metaKeywords}
              onChange={(e) => handleFieldChange('metaKeywords', e.target.value)}
              onBlur={handleMetaKeywordsBlur}
              disabled={disabled}
              placeholder="royal enfield gt 650, gt650 price, cruiser motorcycle india"
              className="admin-input"
              style={{
                width:     '100%',
                boxSizing: 'border-box',
                ...(mergedErrors.metaKeywords && { borderColor: '#C8102E' }),
              }}
              aria-describedby={[
                'bfseo-metaKeywords-hint',
                mergedErrors.metaKeywords ? 'bfseo-metaKeywords-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              aria-invalid={!!mergedErrors.metaKeywords}
              autoComplete="off"
            />

            {!mergedErrors.metaKeywords && (
              <p id="bfseo-metaKeywords-hint" className="bfseo-hint">
                Optional. Comma-separated. Low SEO value in modern search engines.
              </p>
            )}

            <FieldError
              id="bfseo-metaKeywords-error"
              message={mergedErrors.metaKeywords}
            />
          </div>
        </section>

        <div className="bfseo-divider" aria-hidden="true" />

        {/* ── Section 2: Open Graph ─────────────────────────────── */}
        <section aria-label="Open Graph social sharing">
          <p className="bfseo-group-label">
            Open Graph &amp; Social
          </p>

          {/* OG Title + OG Description */}
          <div className="bfseo-grid-2" style={{ marginBottom: '16px' }}>

            <div>
              <FieldLabel
                htmlFor="bfseo-ogTitle"
                label="Open Graph Title"
                current={values.ogTitle.length}
                max={FIELD_LIMITS.META_TITLE_MAX}
              />

              <input
                id="bfseo-ogTitle"
                type="text"
                value={values.ogTitle}
                onChange={(e) => handleFieldChange('ogTitle', e.target.value)}
                onBlur={handleOgTitleBlur}
                disabled={disabled}
                placeholder="Falls back to SEO Title"
                maxLength={FIELD_LIMITS.META_TITLE_MAX + 20}
                className="admin-input"
                style={{
                  width:     '100%',
                  boxSizing: 'border-box',
                  ...(mergedErrors.ogTitle && { borderColor: '#C8102E' }),
                }}
                aria-describedby={
                  mergedErrors.ogTitle ? 'bfseo-ogTitle-error' : undefined
                }
                aria-invalid={!!mergedErrors.ogTitle}
                autoComplete="off"
                spellCheck={false}
              />

              <FieldError id="bfseo-ogTitle-error" message={mergedErrors.ogTitle} />
            </div>

            <div>
              <FieldLabel
                htmlFor="bfseo-ogDescription"
                label="Open Graph Description"
                current={values.ogDescription.length}
                max={FIELD_LIMITS.META_DESCRIPTION_MAX}
              />

              <textarea
                id="bfseo-ogDescription"
                value={values.ogDescription}
                onChange={(e) =>
                  handleFieldChange('ogDescription', e.target.value)
                }
                onBlur={handleOgDescriptionBlur}
                disabled={disabled}
                placeholder="Falls back to Meta Description"
                maxLength={FIELD_LIMITS.META_DESCRIPTION_MAX + 20}
                className="admin-input bfseo-textarea"
                style={{
                  ...(mergedErrors.ogDescription && { borderColor: '#C8102E' }),
                }}
                aria-describedby={
                  mergedErrors.ogDescription
                    ? 'bfseo-ogDescription-error'
                    : undefined
                }
                aria-invalid={!!mergedErrors.ogDescription}
              />

              <FieldError
                id="bfseo-ogDescription-error"
                message={mergedErrors.ogDescription}
              />
            </div>
          </div>

          {/* OG Image + Twitter Image side by side */}
          <div className="bfseo-image-grid">

            {/* OG Image */}
            <div>
              <FieldLabel htmlFor="bfseo-ogImageUrl" label="Open Graph Image URL" />

              <input
                id="bfseo-ogImageUrl"
                type="url"
                value={values.ogImageUrl}
                onChange={(e) => {
                  clearBrokenForOld(values.ogImageUrl)
                  handleFieldChange('ogImageUrl', e.target.value)
                }}
                onBlur={handleOgImageUrlBlur}
                disabled={disabled}
                placeholder="https://res.cloudinary.com/..."
                className="admin-input"
                style={{
                  width:     '100%',
                  boxSizing: 'border-box',
                  ...(mergedErrors.ogImageUrl && { borderColor: '#C8102E' }),
                }}
                aria-describedby={[
                  'bfseo-ogImageUrl-hint',
                  mergedErrors.ogImageUrl ? 'bfseo-ogImageUrl-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                aria-invalid={!!mergedErrors.ogImageUrl}
                autoComplete="off"
                spellCheck={false}
              />

              {!mergedErrors.ogImageUrl && (
                <p id="bfseo-ogImageUrl-hint" className="bfseo-hint">
                  Optional. Falls back to hero image. Recommended: 1200 × 630px.
                </p>
              )}

              <FieldError
                id="bfseo-ogImageUrl-error"
                message={mergedErrors.ogImageUrl}
              />

              <ImagePreview
                url={values.ogImageUrl}
                alt="Open Graph image preview"
                isBroken={brokenUrls.has(values.ogImageUrl.trim())}
                onError={handleImageError}
              />
            </div>

            {/* Twitter Image */}
            <div>
              <FieldLabel
                htmlFor="bfseo-twitterImageUrl"
                label="Twitter / X Image URL"
              />

              <input
                id="bfseo-twitterImageUrl"
                type="url"
                value={values.twitterImageUrl}
                onChange={(e) => {
                  clearBrokenForOld(values.twitterImageUrl)
                  handleFieldChange('twitterImageUrl', e.target.value)
                }}
                onBlur={handleTwitterImageUrlBlur}
                disabled={disabled}
                placeholder="https://res.cloudinary.com/..."
                className="admin-input"
                style={{
                  width:     '100%',
                  boxSizing: 'border-box',
                  ...(mergedErrors.twitterImageUrl && { borderColor: '#C8102E' }),
                }}
                aria-describedby={[
                  'bfseo-twitterImageUrl-hint',
                  mergedErrors.twitterImageUrl
                    ? 'bfseo-twitterImageUrl-error'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                aria-invalid={!!mergedErrors.twitterImageUrl}
                autoComplete="off"
                spellCheck={false}
              />

              {!mergedErrors.twitterImageUrl && (
                <p id="bfseo-twitterImageUrl-hint" className="bfseo-hint">
                  Optional. Falls back to Open Graph image. Recommended: 1200 × 628px.
                </p>
              )}

              <FieldError
                id="bfseo-twitterImageUrl-error"
                message={mergedErrors.twitterImageUrl}
              />

              <ImagePreview
                url={values.twitterImageUrl}
                alt="Twitter image preview"
                isBroken={brokenUrls.has(values.twitterImageUrl.trim())}
                onError={handleImageError}
              />
            </div>
          </div>
        </section>

        <div className="bfseo-divider" aria-hidden="true" />

        {/* ── Section 3: Structured Data Preview ────────────────── */}
        {/*
         * Read-only JSON-LD preview generated from current form values.
         * Helps the admin verify how their SEO fields will appear in
         * structured data before publishing.
         *
         * This is a CLIENT-SIDE preview only. The server generates the
         * canonical JSON-LD from the saved DB document at render time.
         * Do not use this output directly in API submissions.
         */}
        <section aria-label="Structured data preview">
          <p className="bfseo-group-label">Structured Data Preview</p>

          <div className="bfseo-json-card">
            <div className="bfseo-json-header">
              <p className="bfseo-json-label">JSON-LD · Product Schema</p>
              <span className="bfseo-json-badge">Read-only</span>
            </div>

            <pre
              className="bfseo-json-pre"
              aria-label="Structured data JSON-LD preview"
              tabIndex={0}
            >
              {buildJsonLd(values)}
            </pre>
          </div>

          <p className="bfseo-hint" style={{ marginTop: '8px' }}>
            Generated from current values. Updates live as you edit the fields above.
            The server generates the final JSON-LD from saved data at publish time.
          </p>
        </section>
      </div>
    </>
  )
}