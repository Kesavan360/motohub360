'use client'

/*
 * BikeFormSEO — Search Engine Optimisation section of the BikeForm.
 *
 * MPD Task A-08.7:
 *   "SEO: SEO Title (required, max 60), Meta Description (required, max 160),
 *   Canonical URL (optional, HTTPS), Meta Keywords (optional, comma-separated),
 *   Open Graph Title (optional), Open Graph Description (optional),
 *   Open Graph Image URL (optional, HTTPS). Controlled inputs, blur validation,
 *   character counters, parent error merging exactly like BikeFormBasic."
 *
 * FIELDS:
 *   metaTitle       — SEO Title (required, ≤ 60 chars)
 *   metaDescription — Meta Description (required, ≤ 160 chars)
 *   canonicalUrl    — Canonical URL (optional, HTTPS)
 *   metaKeywords    — Meta Keywords (optional, comma-separated)
 *   ogTitle         — Open Graph Title (optional, ≤ 60 chars, falls back to metaTitle)
 *   ogDescription   — Open Graph Description (optional, ≤ 160 chars, falls back to metaDescription)
 *   ogImageUrl      — Open Graph Image URL (optional, HTTPS, falls back to heroImageUrl)
 *
 * FALLBACK BEHAVIOUR (documented, enforced server-side / at render time —
 * NOT enforced in this component):
 *   When ogTitle is empty, the public bike page's generateMetadata()
 *   uses metaTitle instead. Same pattern for ogDescription → metaDescription
 *   and ogImageUrl → heroImageUrl. This component only collects the override
 *   values; it does not compute or preview the fallback.
 *
 * SEARCH RESULT PREVIEW:
 *   A lightweight Google-style search snippet preview is rendered above the
 *   SEO Title field, updating live as the admin types. This gives immediate
 *   visual feedback on how the title/description will appear in search
 *   results, reinforcing the character limits without requiring the admin
 *   to count characters manually.
 *
 * VALIDATION PATTERN:
 *   Identical structure to BikeFormBasic, BikeFormSpecifications,
 *   BikeFormPricing, and BikeFormGallery:
 *     - Local blur errors stored in localErrors state.
 *     - Parent errors (BikeFormSEOErrors from BikeFormShell's last full
 *       section validation) passed via the errors prop.
 *     - Merged before render; local errors take precedence (most current).
 *
 * WHY 'use client':
 *   useState (localErrors)
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
   * values — the current SEO state from BikeFormShell (values.seo).
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
   * disabled — all inputs are read-only and inert when true.
   */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// FieldLabel — identical pattern to all other BikeForm section components
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
// FieldError — identical pattern to all other BikeForm section components
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

  // ── Merged errors ──────────────────────────────────────────────────────

  /*
   * Local blur errors take precedence over parent section-validation
   * errors — same merge pattern as BikeFormBasic.
   */
  const mergedErrors: BikeFormSEOErrors = {
    ...errors,
    ...localErrors,
  }

  // ── Field change handler ───────────────────────────────────────────────

  const handleFieldChange = useCallback(
    (field: keyof BikeFormSEOValues, value: string): void => {
      onChange({ ...values, [field]: value })
    },
    [values, onChange],
  )

  // ── Field blur handlers ────────────────────────────────────────────────

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

  // ── Search snippet preview values ──────────────────────────────────────

  /*
   * previewTitle / previewDescription — the values shown in the live
   * Google-style snippet preview. Falls back to a placeholder string
   * when the field is empty so the preview never looks broken.
   */
  const previewTitle = values.metaTitle.trim() || 'Your SEO title will appear here'
  const previewDescription =
    values.metaDescription.trim() ||
    'Your meta description will appear here. Aim for a concise, compelling summary.'
  const previewUrl = values.canonicalUrl.trim() || 'motohub360.in › bikes › brand › model'

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Group label — identical uppercase muted pattern used across all
         * other BikeForm sections (bfs-spec-group-label, bfp-group-label,
         * bfg-group-label).
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

        /*
         * Section divider — consistent with all other BikeForm sections.
         */
        .bfseo-divider {
          height:           1px;
          background-color: var(--color-border-hairline);
          margin:           24px 0;
        }

        /*
         * Search result preview card — mimics a Google search snippet.
         */
        .bfseo-preview-card {
          padding:          14px 16px;
          background-color: var(--color-surface-raised);
          border:           1px solid var(--color-border-hairline);
          border-radius:    8px;
          margin-bottom:    20px;
        }

        .bfseo-preview-label {
          font-family:    var(--font-body);
          font-size:      10px;
          font-weight:    600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color:          var(--color-ink-tertiary);
          margin:         0 0 10px;
        }

        .bfseo-preview-url {
          font-family: var(--font-body);
          font-size:   13px;
          color:       #1a5c2e;
          margin:      0 0 3px;
          overflow:       hidden;
          text-overflow:  ellipsis;
          white-space:    nowrap;
        }

        .bfseo-preview-title {
          font-family: Arial, Helvetica, sans-serif;
          font-size:   18px;
          color:       #1a0dab;
          margin:      0 0 3px;
          line-height: 1.3;
          overflow:       hidden;
          text-overflow:  ellipsis;
          white-space:    nowrap;
        }

        .bfseo-preview-description {
          font-family: Arial, Helvetica, sans-serif;
          font-size:   14px;
          color:       #4d5156;
          margin:      0;
          line-height: 1.5;
          display:            -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow:           hidden;
        }

        /*
         * Field hint — identical pattern to all other sections.
         */
        .bfseo-hint {
          font-family: var(--font-body);
          font-size:   11px;
          color:       var(--color-ink-tertiary);
          margin:      5px 0 0;
          line-height: 1.5;
        }

        /*
         * Two-column grid for OG Title / OG Description on desktop.
         * Collapses to a single column on mobile (≤ 600px).
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
         * Textarea sizing — used for Meta Description and OG Description.
         */
        .bfseo-textarea {
          width:      100%;
          box-sizing: border-box;
          min-height: 72px;
          resize:     vertical;
        }
      `}</style>

      <div>

        {/* ── Live search result preview ─────────────────────────── */}
        <div
          className="bfseo-preview-card"
          role="img"
          aria-label={`Search result preview: ${previewTitle} — ${previewDescription}`}
        >
          <p className="bfseo-preview-label">Search Result Preview</p>
          <p className="bfseo-preview-url">{previewUrl}</p>
          <p className="bfseo-preview-title">{previewTitle}</p>
          <p className="bfseo-preview-description">{previewDescription}</p>
        </div>

        {/* ── Section 1: Core SEO fields ─────────────────────────── */}
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
              onChange={(e) =>
                handleFieldChange('metaTitle', e.target.value)
              }
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
                The clickable headline shown in search results and browser tabs.
              </p>
            )}

            <FieldError
              id="bfseo-metaTitle-error"
              message={mergedErrors.metaTitle}
            />
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
              placeholder="Explore the Royal Enfield GT 650 — price, mileage, specifications, colours, and more. Compare and find your perfect ride on MotoHub360."
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
                The summary text shown below the title in search results.
              </p>
            )}

            <FieldError
              id="bfseo-metaDescription-error"
              message={mergedErrors.metaDescription}
            />
          </div>

          {/* Canonical URL */}
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel
              htmlFor="bfseo-canonicalUrl"
              label="Canonical URL"
            />

            <input
              id="bfseo-canonicalUrl"
              type="url"
              value={values.canonicalUrl}
              onChange={(e) =>
                handleFieldChange('canonicalUrl', e.target.value)
              }
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
                Optional. Leave empty to use the default page URL.
                Must be HTTPS if provided.
              </p>
            )}

            <FieldError
              id="bfseo-canonicalUrl-error"
              message={mergedErrors.canonicalUrl}
            />
          </div>

          {/* Meta Keywords */}
          <div>
            <FieldLabel
              htmlFor="bfseo-metaKeywords"
              label="Meta Keywords"
            />

            <input
              id="bfseo-metaKeywords"
              type="text"
              value={values.metaKeywords}
              onChange={(e) =>
                handleFieldChange('metaKeywords', e.target.value)
              }
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
              spellCheck={false}
            />

            {!mergedErrors.metaKeywords && (
              <p id="bfseo-metaKeywords-hint" className="bfseo-hint">
                Optional. Comma-separated. Modern search engines give this
                little weight, but it is retained for third-party feeds.
              </p>
            )}

            <FieldError
              id="bfseo-metaKeywords-error"
              message={mergedErrors.metaKeywords}
            />
          </div>
        </section>

        <div className="bfseo-divider" aria-hidden="true" />

        {/* ── Section 2: Open Graph (social sharing) ─────────────── */}
        <section aria-label="Open Graph social sharing fields">
          <p className="bfseo-group-label">
            Open Graph &amp; Social Sharing
          </p>

          <div className="bfseo-grid-2" style={{ marginBottom: '16px' }}>

            {/* OG Title */}
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
                onChange={(e) =>
                  handleFieldChange('ogTitle', e.target.value)
                }
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

              <FieldError
                id="bfseo-ogTitle-error"
                message={mergedErrors.ogTitle}
              />
            </div>

            {/* OG Image URL */}
            <div>
              <FieldLabel
                htmlFor="bfseo-ogImageUrl"
                label="Open Graph Image URL"
              />

              <input
                id="bfseo-ogImageUrl"
                type="url"
                value={values.ogImageUrl}
                onChange={(e) =>
                  handleFieldChange('ogImageUrl', e.target.value)
                }
                onBlur={handleOgImageUrlBlur}
                disabled={disabled}
                placeholder="Falls back to hero image"
                className="admin-input"
                style={{
                  width:     '100%',
                  boxSizing: 'border-box',
                  ...(mergedErrors.ogImageUrl && { borderColor: '#C8102E' }),
                }}
                aria-describedby={
                  mergedErrors.ogImageUrl ? 'bfseo-ogImageUrl-error' : undefined
                }
                aria-invalid={!!mergedErrors.ogImageUrl}
                autoComplete="off"
                spellCheck={false}
              />

              <FieldError
                id="bfseo-ogImageUrl-error"
                message={mergedErrors.ogImageUrl}
              />
            </div>
          </div>

          {/* OG Description — full width */}
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
              placeholder="Falls back to Meta Description. Customise for how this bike appears when shared on WhatsApp, Facebook, or Twitter."
              maxLength={FIELD_LIMITS.META_DESCRIPTION_MAX + 20}
              className="admin-input bfseo-textarea"
              style={{
                ...(mergedErrors.ogDescription && { borderColor: '#C8102E' }),
              }}
              aria-describedby={[
                'bfseo-ogDescription-hint',
                mergedErrors.ogDescription ? 'bfseo-ogDescription-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined}
              aria-invalid={!!mergedErrors.ogDescription}
            />

            {!mergedErrors.ogDescription && (
              <p id="bfseo-ogDescription-hint" className="bfseo-hint">
                Optional. Shown in link previews on WhatsApp, Facebook, Twitter, and LinkedIn.
              </p>
            )}

            <FieldError
              id="bfseo-ogDescription-error"
              message={mergedErrors.ogDescription}
            />
          </div>
        </section>
      </div>
    </>
  )
}