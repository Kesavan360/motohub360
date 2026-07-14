'use client'

/*
 * FilterBar — Listing page filter and sort controls.
 *
 * MPD Task LP-03:
 *   "Three pill-style dropdown triggers (Category, Price, Sort).
 *   Desktop: inline row. Mobile: single 'Filters ⌄' button that
 *   opens a bottom sheet with all three options. Filter state
 *   managed locally for now (wired to API in Phase 7)."
 *
 * MPD Section 5.2, Browse/Listing Pages:
 *   "Filter/sort controls kept minimal and unobtrusive — filtering
 *   should feel like refining a curated catalog, not a marketplace
 *   search. No clutter: no ads, no sponsored placements, no
 *   review-style star ratings."
 *
 * MPD High-Fidelity UI, Brand Listing Page:
 *   "Filters sit on a single quiet row: three pill-style dropdown
 *   triggers (Category, Price, Sort), surface-raised with
 *   border-hairline, collapsing into a single 'Filters' button +
 *   bottom sheet on mobile to preserve the image-first grid above
 *   the fold."
 *
 * MPD Component Library:
 *   FilterBar | Inline desktop, bottom sheet mobile
 *
 * FILTER OPTIONS:
 *   Category: All Categories + the 5 categories from S-08
 *   Price:    All Prices + the 4 price ranges from S-08
 *   Sort:     Featured, Price: Low to High, Price: High to Low,
 *             Name: A–Z, Recently Added
 *
 * STATE:
 *   Filter state is managed locally in this component for LP-03.
 *   Phase 7 (DB-08) wires the selected values to the API query.
 *   The component exposes an onChange prop so parent pages can
 *   read the current filter values and trigger data fetches.
 *
 * DESKTOP LAYOUT:
 *   Three pill-style dropdown triggers in a horizontal row.
 *   Each trigger opens a dropdown panel below it.
 *   Only one dropdown is open at a time.
 *   Clicking outside any open dropdown closes it.
 *
 * MOBILE LAYOUT:
 *   A single "Filters" pill button (with active filter count badge).
 *   Tapping opens a bottom sheet covering the lower portion of the screen.
 *   Bottom sheet contains all three filter sections stacked vertically.
 *   A backdrop closes the sheet on tap.
 *   "Apply" button closes the sheet and fires onChange.
 *   "Clear all" resets all filters.
 *
 * ACTIVE STATE:
 *   A filter is "active" when its value is not the default ("all").
 *   Active filters: pill has ink-primary text + surface-sunken background.
 *   Mobile: active filter count badge on the "Filters" button.
 *
 * WHY 'use client':
 *   useState for open/close state of dropdowns and bottom sheet.
 *   useRef for outside-click detection.
 *   useEffect for escape key + body scroll lock.
 *   onChange handlers for filter value changes.
 */

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import Icon from '@/components/ui/Icon'
import { CATEGORIES } from '@/constants/categories'
import { PRICE_RANGES } from '@/constants/priceRanges'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterValues {
  /*
   * category — selected category slug or 'all'.
   * Maps to BikeCategory from types/bike.ts.
   * 'all' means no category filter applied.
   */
  category: string

  /*
   * priceRange — selected price range slug or 'all'.
   * Maps to PRICE_RANGES slugs from constants/priceRanges.ts.
   * 'all' means no price filter applied.
   */
  priceRange: string

  /*
   * sort — selected sort option.
   * Maps to the sort options defined in SORT_OPTIONS below.
   */
  sort: string
}

export interface FilterBarProps {
  /*
   * initialValues — starting filter values.
   * Used when the parent page sets filters from URL params.
   * Default: all filters set to 'all' / 'featured'.
   */
  initialValues?: Partial<FilterValues>

  /*
   * onChange — called when any filter value changes.
   * Receives the complete current FilterValues object.
   * Parent uses this to trigger a new API call (DB-08).
   */
  onChange?: (values: FilterValues) => void

  /*
   * className — additional CSS classes on the outer container.
   */
  className?: string

  /*
   * hiddenFilters — array of filter keys to hide.
   * Use on brand listing page to hide the brand filter (already implied).
   * Example: hiddenFilters={['category']} on a category-specific page.
   */
  hiddenFilters?: Array<keyof FilterValues>
}

// ---------------------------------------------------------------------------
// Filter option definitions
// ---------------------------------------------------------------------------

interface FilterOption {
  value: string
  label: string
}

/*
 * CATEGORY_OPTIONS — "All Categories" + 5 categories from S-08.
 */
const CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Categories' },
  ...CATEGORIES.map((cat) => ({
    value: cat.slug,
    label: cat.label,
  })),
]

/*
 * PRICE_OPTIONS — "All Prices" + 4 ranges from S-08.
 */
const PRICE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Prices' },
  ...PRICE_RANGES.map((range) => ({
    value: range.slug,
    label: range.label,
  })),
]

/*
 * SORT_OPTIONS — sorting choices for listing grids.
 */
const SORT_OPTIONS: FilterOption[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'newest', label: 'Recently Added' },
]

/*
 * DEFAULT_FILTERS — initial state for all filters.
 */
const DEFAULT_FILTERS: FilterValues = {
  category: 'all',
  priceRange: 'all',
  sort: 'featured',
}

// ---------------------------------------------------------------------------
// FilterDropdown — desktop pill trigger + dropdown panel
// ---------------------------------------------------------------------------

interface FilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  isOpen: boolean
  isActive: boolean
  onToggle: () => void
  onSelect: (value: string) => void
  onClose: () => void
}

function FilterDropdown({
  label,
  value,
  options,
  isOpen,
  isActive,
  onToggle,
  onSelect,
  onClose,
}: FilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  /*
   * Outside click detection — closes this dropdown when the user
   * clicks anywhere outside its container.
   */
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  /*
   * Get the display label for the current value.
   * Shows the selected option label, not the trigger label.
   */
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label ?? label

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flexShrink: 0 }}
    >
      {/* ── Pill trigger button ────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${label}: ${selectedLabel}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '40px',
          padding: '0 16px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: isActive ? 500 : 400,
          color: isActive
            ? 'var(--color-ink-primary)'
            : 'var(--color-ink-secondary)',
          backgroundColor: isActive
            ? 'var(--color-surface-sunken)'
            : 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-hairline)',
          borderRadius: '999px',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          transition:
            'color 200ms cubic-bezier(0.4,0,0.2,1), ' +
            'background-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
            'box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isOpen ? 'var(--shadow-focus)' : 'none',
        }}
        className="filter-pill-trigger"
      >
        {/*
         * Show the selected label when a non-default option is selected.
         * Show the generic label when at the default.
         */}
        <span>
          {isActive ? selectedLabel : label}
        </span>
        {/*
         * Chevron rotates 180° when dropdown is open.
         */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
            color: 'var(--color-ink-tertiary)',
          }}
        >
          <Icon name="chevron-down" size={14} strokeWidth={2} />
        </span>
      </button>

      {/* ── Dropdown panel ─────────────────────────────────── */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={`${label} options`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            minWidth: '180px',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-hairline)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(15,16,20,0.12)',
            zIndex: 20,
            overflow: 'hidden',
            /*
             * Animate in from above with a subtle fade + slide.
             */
            animation: 'filter-dropdown-enter 160ms cubic-bezier(0.4,0,0.2,1) forwards',
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(option.value)
                  onClose()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected
                    ? 'var(--color-ink-primary)'
                    : 'var(--color-ink-secondary)',
                  backgroundColor: isSelected
                    ? 'var(--color-surface-sunken)'
                    : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                }}
                className="filter-option-btn"
              >
                {option.label}
                {isSelected && (
                  <Icon
                    name="check"
                    size={14}
                    strokeWidth={2}
                    style={{ color: 'var(--color-ink-primary)', flexShrink: 0 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FilterBar Component
// ---------------------------------------------------------------------------

export default function FilterBar({
  initialValues,
  onChange,
  className = '',
  hiddenFilters = [],
}: FilterBarProps) {
  /*
   * Filter values state — merged with defaults.
   */
  const [values, setValues] = useState<FilterValues>({
    ...DEFAULT_FILTERS,
    ...initialValues,
  })

  /*
   * Desktop: which dropdown is currently open.
   * null = all closed. 'category' | 'priceRange' | 'sort' = one open.
   */
  const [openDropdown, setOpenDropdown] = useState<keyof FilterValues | null>(
    null,
  )

  /*
   * Mobile: whether the bottom sheet is open.
   */
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)

  /*
   * Mobile: local pending values (not applied until "Apply" is tapped).
   * This allows the user to adjust multiple filters before applying.
   */
  const [pendingValues, setPendingValues] = useState<FilterValues>(values)

  /*
   * Count active filters — used for the mobile badge.
   * A filter is active when its value differs from DEFAULT_FILTERS.
   */
  const activeFilterCount = [
    values.category !== 'all',
    values.priceRange !== 'all',
    values.sort !== 'featured',
  ].filter(Boolean).length

  /*
   * updateFilter — updates a single filter value and fires onChange.
   * Used by desktop dropdown onSelect.
   */
  function updateFilter(key: keyof FilterValues, value: string) {
    const next = { ...values, [key]: value }
    setValues(next)
    onChange?.(next)
  }

  /*
   * applyBottomSheet — applies pending mobile filters and closes sheet.
   */
  function applyBottomSheet() {
    setValues(pendingValues)
    onChange?.(pendingValues)
    setIsBottomSheetOpen(false)
  }

  /*
   * clearAllFilters — resets all filters to defaults.
   */
  function clearAllFilters() {
    const reset = { ...DEFAULT_FILTERS }
    setValues(reset)
    setPendingValues(reset)
    onChange?.(reset)
    setIsBottomSheetOpen(false)
    setOpenDropdown(null)
  }

  /*
   * Escape key closes any open dropdown or bottom sheet.
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenDropdown(null)
        setIsBottomSheetOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  /*
   * Body scroll lock when bottom sheet is open on mobile.
   */
  useEffect(() => {
    if (isBottomSheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isBottomSheetOpen])

  /*
   * Sync pendingValues when bottom sheet opens.
   * Ensures the sheet shows current applied values, not stale state.
   */
  useEffect(() => {
    if (isBottomSheetOpen) {
      setPendingValues(values)
    }
  }, [isBottomSheetOpen, values])

  return (
    <>
      {/* ── Scoped styles ─────────────────────────────────────── */}
      <style>{`
        @keyframes filter-dropdown-enter {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes filter-sheet-enter {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .filter-pill-trigger:hover {
          color: var(--color-ink-primary) !important;
          background-color: var(--color-surface-sunken) !important;
        }

        .filter-pill-trigger:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
        }

        .filter-option-btn:hover {
          background-color: var(--color-surface-sunken) !important;
          color: var(--color-ink-primary) !important;
        }

        .filter-option-btn:focus-visible {
          outline: none;
          box-shadow: inset var(--shadow-focus);
        }

        /*
         * Desktop: show filter pills row, hide mobile button.
         * Mobile: hide filter pills row, show mobile button.
         */
        .filterbar-desktop {
          display: flex;
        }
        .filterbar-mobile {
          display: none;
        }

        @media (max-width: 768px) {
          .filterbar-desktop {
            display: none !important;
          }
          .filterbar-mobile {
            display: flex !important;
          }
        }

        /*
         * Bottom sheet option rows.
         */
        .sheet-option:hover {
          background-color: var(--color-surface-sunken) !important;
        }
        .sheet-option:focus-visible {
          outline: none;
          box-shadow: inset var(--shadow-focus);
        }

        /*
         * Apply button hover.
         */
        .sheet-apply-btn:hover {
          opacity: 0.9 !important;
        }
        .sheet-apply-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus) !important;
        }

        /*
         * Clear all link hover.
         */
        .sheet-clear-btn:hover {
          color: var(--color-ink-primary) !important;
        }
      `}</style>

      <div className={className}>

        {/* ════════════════════════════════════════════════════════
            DESKTOP — pill dropdown row
        ════════════════════════════════════════════════════════ */}
        <div
          className="filterbar-desktop"
          style={{
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {/*
           * Category dropdown — hidden when 'category' is in hiddenFilters.
           */}
          {!hiddenFilters.includes('category') && (
            <FilterDropdown
              label="Category"
              value={values.category}
              options={CATEGORY_OPTIONS}
              isOpen={openDropdown === 'category'}
              isActive={values.category !== 'all'}
              onToggle={() =>
                setOpenDropdown((prev) =>
                  prev === 'category' ? null : 'category',
                )
              }
              onSelect={(val) => updateFilter('category', val)}
              onClose={() => setOpenDropdown(null)}
            />
          )}

          {/*
           * Price dropdown — hidden when 'priceRange' is in hiddenFilters.
           */}
          {!hiddenFilters.includes('priceRange') && (
            <FilterDropdown
              label="Price"
              value={values.priceRange}
              options={PRICE_OPTIONS}
              isOpen={openDropdown === 'priceRange'}
              isActive={values.priceRange !== 'all'}
              onToggle={() =>
                setOpenDropdown((prev) =>
                  prev === 'priceRange' ? null : 'priceRange',
                )
              }
              onSelect={(val) => updateFilter('priceRange', val)}
              onClose={() => setOpenDropdown(null)}
            />
          )}

          {/*
           * Sort dropdown — hidden when 'sort' is in hiddenFilters.
           */}
          {!hiddenFilters.includes('sort') && (
            <FilterDropdown
              label="Sort"
              value={values.sort}
              options={SORT_OPTIONS}
              isOpen={openDropdown === 'sort'}
              isActive={values.sort !== 'featured'}
              onToggle={() =>
                setOpenDropdown((prev) =>
                  prev === 'sort' ? null : 'sort',
                )
              }
              onSelect={(val) => updateFilter('sort', val)}
              onClose={() => setOpenDropdown(null)}
            />
          )}

          {/*
           * Clear all button — only shown when at least one filter is active.
           * Ghost style — no border, no fill, muted text.
           */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '40px',
                padding: '0 12px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
              className="sheet-clear-btn"
              aria-label="Clear all filters"
            >
              <Icon name="close" size={12} strokeWidth={2} />
              Clear all
            </button>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            MOBILE — single "Filters" button
        ════════════════════════════════════════════════════════ */}
        <div
          className="filterbar-mobile"
          style={{ alignItems: 'center', gap: '8px' }}
        >
          {/*
           * Filters trigger button — opens bottom sheet.
           * Shows active filter count badge when filters are applied.
           */}
          <button
            type="button"
            onClick={() => setIsBottomSheetOpen(true)}
            aria-label={`Filters${activeFilterCount > 0 ? ` — ${activeFilterCount} active` : ''}`}
            aria-haspopup="dialog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 16px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: activeFilterCount > 0 ? 500 : 400,
              color: activeFilterCount > 0
                ? 'var(--color-ink-primary)'
                : 'var(--color-ink-secondary)',
              backgroundColor: activeFilterCount > 0
                ? 'var(--color-surface-sunken)'
                : 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '999px',
              cursor: 'pointer',
            }}
            className="filter-pill-trigger"
          >
            <Icon name="filter" size={14} strokeWidth={1.75} />
            Filters

            {/*
             * Active filter count badge.
             * Small circle with count — appears when 1+ filters active.
             */}
            {activeFilterCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-ink-primary)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {activeFilterCount}
              </span>
            )}

            <Icon
              name="chevron-down"
              size={14}
              strokeWidth={2}
              style={{ color: 'var(--color-ink-tertiary)' }}
            />
          </button>

          {/*
           * Current sort indicator — shown beside the Filters button.
           * Lets the user see the active sort without opening the sheet.
           */}
          {values.sort !== 'featured' && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-ink-tertiary)',
              }}
            >
              {SORT_OPTIONS.find((s) => s.value === values.sort)?.label}
            </span>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MOBILE BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      {isBottomSheetOpen && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={() => setIsBottomSheetOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(14,15,18,0.6)',
              zIndex: 40,
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Sheet panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter options"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'var(--color-surface-raised)',
              borderRadius: '20px 20px 0 0',
              zIndex: 50,
              animation: 'filter-sheet-enter 240ms cubic-bezier(0.4,0,0.2,1) forwards',
              maxHeight: '80vh',
              overflowY: 'auto',
              /*
               * Safe area for iPhone home indicator.
               */
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Sheet header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 20px 16px',
                borderBottom: '1px solid var(--color-border-hairline)',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--color-surface-raised)',
                zIndex: 1,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--color-ink-primary)',
                  margin: 0,
                }}
              >
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setIsBottomSheetOpen(false)}
                aria-label="Close filters"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-surface-sunken)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-ink-secondary)',
                }}
              >
                <Icon name="close" size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Sheet content — filter sections */}
            <div style={{ padding: '0 0 16px' }}>

              {/*
               * Render each non-hidden filter as a labelled section
               * with radio-style option buttons.
               *
               * Structure:
               *   Section heading (Category / Price / Sort)
               *   Option rows (radio-style, single select)
               */}
              {[
                !hiddenFilters.includes('category') && {
                  key: 'category' as keyof FilterValues,
                  label: 'Category',
                  options: CATEGORY_OPTIONS,
                  value: pendingValues.category,
                },
                !hiddenFilters.includes('priceRange') && {
                  key: 'priceRange' as keyof FilterValues,
                  label: 'Price Range',
                  options: PRICE_OPTIONS,
                  value: pendingValues.priceRange,
                },
                !hiddenFilters.includes('sort') && {
                  key: 'sort' as keyof FilterValues,
                  label: 'Sort By',
                  options: SORT_OPTIONS,
                  value: pendingValues.sort,
                },
              ]
                .filter(Boolean)
                .map((section) => {
                  if (!section) return null
                  return (
                    <div
                      key={section.key}
                      style={{
                        padding: '20px 20px 0',
                      }}
                    >
                      {/* Section heading */}
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--color-ink-tertiary)',
                          margin: '0 0 12px',
                        }}
                      >
                        {section.label}
                      </p>

                      {/* Option rows */}
                      <div
                        style={{
                          borderRadius: '10px',
                          border: '1px solid var(--color-border-hairline)',
                          overflow: 'hidden',
                          marginBottom: '16px',
                        }}
                      >
                        {section.options.map((option, idx) => {
                          const isSelected = section.value === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setPendingValues((prev) => ({
                                  ...prev,
                                  [section.key]: option.value,
                                }))
                              }
                              className="sheet-option"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '13px 16px',
                                fontFamily: 'var(--font-body)',
                                fontSize: '15px',
                                fontWeight: isSelected ? 500 : 400,
                                color: isSelected
                                  ? 'var(--color-ink-primary)'
                                  : 'var(--color-ink-secondary)',
                                backgroundColor: isSelected
                                  ? 'var(--color-surface-sunken)'
                                  : 'var(--color-surface-raised)',
                                border: 'none',
                                borderBottom:
                                  idx < section.options.length - 1
                                    ? '1px solid var(--color-border-hairline)'
                                    : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition:
                                  'background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                              }}
                              aria-pressed={isSelected}
                            >
                              {option.label}
                              {isSelected && (
                                <Icon
                                  name="check"
                                  size={16}
                                  strokeWidth={2}
                                  style={{
                                    color: 'var(--color-ink-primary)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Sheet footer — Apply + Clear */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--color-border-hairline)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                position: 'sticky',
                bottom: 0,
                backgroundColor: 'var(--color-surface-raised)',
              }}
            >
              {/* Apply button */}
              <button
                type="button"
                onClick={applyBottomSheet}
                className="sheet-apply-btn"
                style={{
                  flex: 1,
                  height: '48px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  backgroundColor: 'var(--color-ink-primary)',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                Apply
              </button>

              {/* Clear all — only shown when pending values differ from defaults */}
              {(pendingValues.category !== 'all' ||
                pendingValues.priceRange !== 'all' ||
                pendingValues.sort !== 'featured') && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="sheet-clear-btn"
                  style={{
                    height: '48px',
                    padding: '0 16px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: 'var(--color-ink-tertiary)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                    flexShrink: 0,
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}