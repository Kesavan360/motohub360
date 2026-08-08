'use client'

/*
 * BikeTable — Admin bike listing table with publish/unpublish/delete actions.
 *
 * MPD Task A-06:
 *   "Bike list: a simple table of all bikes (draft + published).
 *   Columns: Thumbnail (40px), Name, Brand, Category, Price
 *   (ex-showroom mono), Status (Published/Draft pill),
 *   Actions (Edit, Publish/Unpublish, Delete)."
 *
 * MPD Section 5.5, Admin Dashboard:
 *   "Published in a muted green, Draft in ink-tertiary grey.
 *   Thumbnail (40px, r-sm). Dense, utilitarian table."
 *
 * A-10 additions:
 *   - Search/filter input: client-side, filters by name, brand, or category.
 *   - Created date: displayed below the bike name in the Name cell.
 *   - Responsive: columns remain legible at narrow widths via overflow scroll.
 *
 * COMPONENT TYPE: 'use client'
 *   Action buttons (Publish/Unpublish, Delete) require:
 *   - useState for per-row loading state and search query
 *   - fetch() calls to the publish and bikes APIs
 *   - useRouter().refresh() to re-fetch server data after mutations
 *   - window.confirm() for delete confirmation
 *
 * ACTIONS:
 *   Edit:      Link to /admin/bikes/[slug]/edit (A-08 implements the form)
 *   Publish:   POST /api/bikes/[id]/publish → sets status: 'published' + ISR
 *   Unpublish: DELETE /api/bikes/[id]/publish → sets status: 'draft' + ISR
 *   Delete:    window.confirm() → DELETE /api/bikes/[id] → removes from DB
 *
 * SEARCH:
 *   Client-side filter on the bikes array already passed from the Server
 *   Component. No additional API call. Matches name, brandName, or category
 *   (case-insensitive substring). Clears with the × button or by emptying
 *   the input. Shows a "No bikes match" empty state when the filter returns
 *   zero results.
 *
 * LOADING STATE:
 *   actionLoading: Record<string, 'publish' | 'delete' | null>
 *   Key is bike._id. Value is the pending action type or null.
 *   Disables all action buttons for the row while an action is pending.
 *   Prevents double-clicks from firing duplicate API calls.
 *
 * REFRESH PATTERN:
 *   After a successful mutation (publish, unpublish, delete), calls
 *   router.refresh() to invalidate the Server Component cache and
 *   re-fetch the bike list from MongoDB. The Server Component handles
 *   the data fetch; this component only handles the UI.
 *
 * THUMBNAIL:
 *   40×40px, border-radius 6px (admin-table-thumb class from admin.css).
 *   Uses Next.js Image with sizes="40px" for optimal loading.
 *   Falls back to a placeholder div if heroImageUrl is absent.
 *
 * PRICE FORMATTING:
 *   formatPriceInLakhs from constants/priceRanges for consistent ₹X.XXL display.
 *   Monospace font via inline style — matches admin data display convention.
 *
 * RESPONSIVE:
 *   The table has horizontal scroll on narrow viewports.
 *   Min-width on the table ensures columns don't collapse unusably.
 *   The admin panel is a desktop-first tool; mobile is icon-only nav.
 */

import { useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPriceInLakhs } from '@/constants/priceRanges'
import { Fragment } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BikeTableRow {
  _id: string
  slug: string
  brandSlug: string
  brandName: string
  name: string
  tagline: string
  category: string
  status: 'draft' | 'published'
  pricing: { exShowroom: number }
  heroImageUrl: string
  publishedAt: string | null   // ISO string (serialized from Date)
  createdAt: string            // ISO string (serialized from Date)
}

interface BikeTableProps {
  bikes: BikeTableRow[]
}

// ---------------------------------------------------------------------------
// Action loading state type
// ---------------------------------------------------------------------------

type ActionType = 'publish' | 'delete'
type ActionLoadingState = Record<string, ActionType | null>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/*
 * formatCreatedAt — formats a serialized ISO date string into a short
 * human-readable date for the admin table.
 *
 * Uses 'en-IN' locale for day-month-year ordering consistent with the
 * MotoHub360 India market context.
 *
 * Returns a fallback '—' if the value is missing or unparseable.
 */
function formatCreatedAt(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    })
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// BikeTable Component
// ---------------------------------------------------------------------------

export default function BikeTable({ bikes }: BikeTableProps) {
  const router = useRouter()

  // ── Search state ─────────────────────────────────────────────────────────

  /*
   * searchQuery — the current value of the search/filter input.
   * Client-side only. Does not trigger a server round-trip.
   */
  const [searchQuery, setSearchQuery] = useState('')

  // ── Action loading state ──────────────────────────────────────────────────

  /*
   * actionLoading — tracks which action is pending for which bike.
   * Key: bike._id
   * Value: 'publish' | 'delete' | null (null = no pending action)
   */
  const [actionLoading, setActionLoading] = useState<ActionLoadingState>(() =>
    Object.fromEntries(bikes.map((b) => [b._id, null])),
  )

  /*
   * errorMessages — per-bike error display.
   * Key: bike._id
   * Value: error message string or null
   */
  const [errorMessages, setErrorMessages] = useState<Record<string, string | null>>(
    () => Object.fromEntries(bikes.map((b) => [b._id, null])),
  )

  // ── Filtered bikes ────────────────────────────────────────────────────────

  /*
   * filteredBikes — the bikes array filtered by searchQuery.
   *
   * Matches against name, brandName, and category (case-insensitive).
   * Re-computed only when bikes or searchQuery changes (useMemo).
   *
   * When searchQuery is empty, all bikes are shown.
   */
  const filteredBikes = useMemo((): BikeTableRow[] => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return bikes

    return bikes.filter(
      (bike) =>
        bike.name.toLowerCase().includes(q) ||
        bike.brandName.toLowerCase().includes(q) ||
        bike.category.toLowerCase().includes(q),
    )
  }, [bikes, searchQuery])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setLoading(bikeId: string, action: ActionType | null): void {
    setActionLoading((prev) => ({ ...prev, [bikeId]: action }))
  }

  function setError(bikeId: string, message: string | null): void {
    setErrorMessages((prev) => ({ ...prev, [bikeId]: message }))
  }

  function isRowBusy(bikeId: string): boolean {
    return actionLoading[bikeId] !== null
  }

  // ── Publish / Unpublish ───────────────────────────────────────────────────

  const handlePublishToggle = useCallback(
    async (bike: BikeTableRow): Promise<void> => {
      const bikeId = bike._id
      const isPublished = bike.status === 'published'

      setLoading(bikeId, 'publish')
      setError(bikeId, null)

      try {
        const response = await fetch(`/api/bikes/${bikeId}/publish`, {
          method: isPublished ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          const data = await response.json() as { error?: string }
          throw new Error(data.error ?? 'Failed to update publish status.')
        }

        /*
         * Refresh the Server Component — re-fetches the bike list
         * from MongoDB so the new status appears in the table.
         */
        router.refresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An error occurred.'
        setError(bikeId, message)
      } finally {
        setLoading(bikeId, null)
      }
    },
    [router],
  )

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (bike: BikeTableRow): Promise<void> => {
      const bikeId = bike._id

      /*
       * Require explicit confirmation before deleting.
       * Hard delete — no soft-delete in V1.
       */
      const confirmed = window.confirm(
        `Delete "${bike.name}"?\n\nThis action is permanent and cannot be undone.`,
      )

      if (!confirmed) return

      setLoading(bikeId, 'delete')
      setError(bikeId, null)

      try {
        const response = await fetch(`/api/bikes/${bikeId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const data = await response.json() as { error?: string }
          throw new Error(data.error ?? 'Failed to delete bike.')
        }

        /*
         * Refresh to remove the deleted bike from the table.
         */
        router.refresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An error occurred.'
        setError(bikeId, message)
        setLoading(bikeId, null)
      }
    },
    [router],
  )

  // ── Empty state — no bikes in DB ──────────────────────────────────────────

  if (bikes.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-hairline)',
          borderRadius: '10px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-ink-primary)',
            margin: '0 0 8px',
          }}
        >
          No bikes yet
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-ink-tertiary)',
            margin: '0 0 20px',
          }}
        >
          Add your first motorcycle listing to get started.
        </p>
        <Link
          href="/admin/bikes/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: '40px',
            padding: '0 20px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: '#7A2E2E',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'filter 150ms',
          }}
        >
          Add New Bike
        </Link>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /*
         * Table container — horizontal scroll on narrow viewports.
         */
        .bike-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--color-border-hairline);
          border-radius: 10px;
          background-color: var(--color-surface-raised);
        }

        /*
         * Search bar container — sits above the table.
         */
        .bike-table-search-wrap {
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bike-table-search-input {
          flex: 1;
          min-width: 0;
          height: 36px;
          padding: 0 12px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-ink-primary);
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 8px;
          outline: none;
          transition: border-color 150ms;
        }

        .bike-table-search-input::placeholder {
          color: var(--color-ink-tertiary);
        }

        .bike-table-search-input:focus {
          border-color: #7A2E2E;
        }

        .bike-table-search-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--color-ink-tertiary);
          border-radius: 6px;
          padding: 0;
          transition: color 150ms, background-color 150ms;
          flex-shrink: 0;
        }

        .bike-table-search-clear:hover {
          color: var(--color-ink-primary);
          background-color: var(--color-surface-sunken);
        }

        .bike-table-search-clear:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        .bike-table-search-count {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-tertiary);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /*
         * Action button base styles.
         */
        .bike-table-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 10px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          border: none;
          white-space: nowrap;
          text-decoration: none;
          transition: filter 150ms, opacity 150ms;
          letter-spacing: 0.01em;
        }

        .bike-table-action:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .bike-table-action:not(:disabled):hover {
          filter: brightness(1.08);
        }

        .bike-table-action:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        /*
         * Action variants.
         */
        .bike-table-action--edit {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-secondary);
          border: 1px solid var(--color-border-hairline);
        }

        .bike-table-action--publish {
          background-color: #166534;
          color: #FFFFFF;
        }

        .bike-table-action--unpublish {
          background-color: var(--color-surface-sunken);
          color: var(--color-ink-secondary);
          border: 1px solid var(--color-border-hairline);
        }

        .bike-table-action--delete {
          background-color: #FEE2E2;
          color: #991B1B;
        }

        /*
         * Error row beneath the bike row.
         */
        .bike-table-error {
          font-family: var(--font-body);
          font-size: 12px;
          color: #991B1B;
          padding: 4px 16px 8px;
          background-color: #FEF2F2;
          border-bottom: 1px solid var(--color-border-hairline);
        }

        /*
         * Spinner for loading state.
         */
        @keyframes bike-table-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bike-table-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: currentColor;
          border-radius: 999px;
          animation: bike-table-spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 4px;
        }

        /*
         * Created date — muted sub-text beneath the bike name.
         */
        .bike-table-created {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--color-ink-tertiary);
          margin: 3px 0 0;
          font-weight: 400;
        }

        /*
         * No-results empty state for search filter.
         */
        .bike-table-no-results {
          padding: 32px 24px;
          text-align: center;
        }
      `}</style>

      {/* ── Search / filter bar ─────────────────────────────────────────── */}
      <div className="bike-table-search-wrap">
        <input
          type="search"
          className="bike-table-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, brand, or category…"
          aria-label="Search bikes"
          aria-controls="bike-table"
          spellCheck={false}
          autoComplete="off"
        />

        {/*
         * Clear button — only shown when a query is active.
         * aria-label clarifies its purpose (the × character is decorative).
         */}
        {searchQuery.length > 0 && (
          <button
            type="button"
            className="bike-table-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/*
         * Result count — always visible; shows total when no query,
         * shows filtered / total when a query is active.
         */}
        <span
          className="bike-table-search-count"
          aria-live="polite"
          aria-label={
            searchQuery
              ? `${filteredBikes.length} of ${bikes.length} bikes`
              : `${bikes.length} bikes`
          }
        >
          {searchQuery
            ? `${filteredBikes.length} / ${bikes.length}`
            : `${bikes.length} bike${bikes.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── No-search-results state ─────────────────────────────────────── */}
      {filteredBikes.length === 0 && searchQuery.length > 0 && (
        <div
          className="bike-table-no-results"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '10px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-ink-tertiary)',
              margin: 0,
            }}
          >
            No bikes match &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      )}

      {/* ── Table — only rendered when there are visible rows ───────────── */}
      {filteredBikes.length > 0 && (
        <div className="bike-table-wrap">
          <table
            id="bike-table"
            className="admin-table"
            style={{ minWidth: '820px' }}
            aria-label="All motorcycles"
          >
            <thead>
              <tr>
                <th style={{ width: '52px' }}>Image</th>
                <th>Motorcycle</th>
                <th>Brand</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '220px' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBikes.map((bike) => {
                const busy = isRowBusy(bike._id)
                const pendingAction = actionLoading[bike._id]
                const errorMsg = errorMessages[bike._id]
                const isPublished = bike.status === 'published'

                return (
                  <Fragment key={bike._id}>
                    <tr
                      style={{
                        opacity: busy ? 0.7 : 1,
                        transition: 'opacity 200ms',
                      }}
                    >
                      {/* ── Thumbnail ───────────────────────────── */}
                      <td>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            backgroundColor: 'var(--color-surface-sunken)',
                            flexShrink: 0,
                            position: 'relative',
                          }}
                        >
                          {bike.heroImageUrl ? (
                            <Image
                              src={bike.heroImageUrl}
                              alt={`${bike.name} thumbnail`}
                              fill
                              sizes="40px"
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                color: 'var(--color-ink-tertiary)',
                              }}
                            >
                              –
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ── Name + Tagline + Created date ────────── */}
                      <td style={{ maxWidth: '220px' }}>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--color-ink-primary)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {bike.name}
                        </p>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12px',
                            fontWeight: 400,
                            color: 'var(--color-ink-tertiary)',
                            margin: '2px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {bike.tagline}
                        </p>
                        {/*
                         * Created date — added in A-10.
                         * Renders the serialised createdAt ISO string as a
                         * short human-readable date (e.g. "14 Jul 2025").
                         * Placed beneath the tagline to preserve column width.
                         */}
                        <p className="bike-table-created">
                          Added {formatCreatedAt(bike.createdAt)}
                        </p>
                      </td>

                      {/* ── Brand ───────────────────────────────── */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '13px',
                            color: 'var(--color-ink-secondary)',
                          }}
                        >
                          {bike.brandName}
                        </span>
                      </td>

                      {/* ── Category ────────────────────────────── */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '13px',
                            color: 'var(--color-ink-secondary)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {bike.category}
                        </span>
                      </td>

                      {/* ── Price ───────────────────────────────── */}
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--color-ink-primary)',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {formatPriceInLakhs(bike.pricing.exShowroom)}
                        </span>
                      </td>

                      {/* ── Status pill ─────────────────────────── */}
                      <td>
                        <span
                          className={`admin-status-pill admin-status-pill--${bike.status}`}
                          aria-label={`Status: ${bike.status}`}
                        >
                          {bike.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>

                      {/* ── Actions ─────────────────────────────── */}
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '6px',
                          }}
                        >
                          {/*
                           * Edit — links to the bike edit form (A-08).
                           * Styled as a button but is an anchor element.
                           */}
                          <Link
                            href={`/admin/bikes/${bike.slug}/edit`}
                            className="bike-table-action bike-table-action--edit"
                            aria-label={`Edit ${bike.name}`}
                          >
                            Edit
                          </Link>

                          {/*
                           * Publish / Unpublish toggle.
                           * Published bikes show "Unpublish".
                           * Draft bikes show "Publish".
                           */}
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={
                              isPublished
                                ? `Unpublish ${bike.name}`
                                : `Publish ${bike.name}`
                            }
                            className={`bike-table-action ${
                              isPublished
                                ? 'bike-table-action--unpublish'
                                : 'bike-table-action--publish'
                            }`}
                            onClick={() => handlePublishToggle(bike)}
                          >
                            {pendingAction === 'publish' ? (
                              <>
                                <span className="bike-table-spinner" aria-hidden="true" />
                                {isPublished ? 'Unpublishing…' : 'Publishing…'}
                              </>
                            ) : isPublished ? (
                              'Unpublish'
                            ) : (
                              'Publish'
                            )}
                          </button>

                          {/*
                           * Delete — shows confirmation dialog.
                           * Hard delete — removes from MongoDB permanently.
                           */}
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Delete ${bike.name}`}
                            className="bike-table-action bike-table-action--delete"
                            onClick={() => handleDelete(bike)}
                          >
                            {pendingAction === 'delete' ? (
                              <>
                                <span className="bike-table-spinner" aria-hidden="true" />
                                Deleting…
                              </>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Per-row error ──────────────────────────── */}
                    {errorMsg && (
                      <tr key={`${bike._id}-error`}>
                        <td colSpan={7} className="bike-table-error" role="alert">
                          {errorMsg}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}