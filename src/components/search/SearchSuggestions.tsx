'use client'

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Icon from '@/components/ui/Icon'
import type { SearchSuggestion } from '@/types/bike'

const MAX_SUGGESTIONS = 8
const MAX_RECENT = 5

export const PANEL_ID = 'search-suggestions-panel'
export const OPTION_ID_PREFIX = 'search-option-'

export interface SearchSuggestionsProps {
  isOpen: boolean
  query: string
  suggestions: SearchSuggestion[]
  isLoading: boolean
  recentSearches: string[]
  onSelect: (term: string) => void
  onClearRecent: () => void
  onClose: () => void
  activeIndex: number
  onActiveIndexChange: (index: number) => void
}

function highlightMatch(
  label: string,
  query: string,
  accentColor: string,
): React.ReactNode {
  if (!query || query.trim().length === 0) {
    return <span>{label}</span>
  }

  const lowerLabel = label.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  const matchIndex = lowerLabel.indexOf(lowerQuery)

  if (matchIndex === -1) {
    return <span>{label}</span>
  }

  const before = label.slice(0, matchIndex)
  const match = label.slice(matchIndex, matchIndex + lowerQuery.length)
  const after = label.slice(matchIndex + lowerQuery.length)

  return (
    <>
      {before && <span>{before}</span>}
      <mark
        style={{
          backgroundColor: 'transparent',
          color: accentColor,
          fontWeight: 600,
        }}
      >
        {match}
      </mark>
      {after && <span>{after}</span>}
    </>
  )
}

function SuggestionSkeleton({ index }: { index: number }) {
  const widths = ['72%', '58%', '65%']
  const width = widths[index % widths.length]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          backgroundColor: 'var(--color-surface-sunken)',
          flexShrink: 0,
          backgroundImage:
            'linear-gradient(90deg, var(--color-surface-sunken) 0%, var(--color-border-hairline) 50%, var(--color-surface-sunken) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.2s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '14px',
          width,
          borderRadius: '4px',
          backgroundColor: 'var(--color-surface-sunken)',
          backgroundImage:
            'linear-gradient(90deg, var(--color-surface-sunken) 0%, var(--color-border-hairline) 50%, var(--color-surface-sunken) 100%)',
          backgroundSize: '200% 100%',
          animation: `shimmer 1.2s ease-in-out ${index * 80}ms infinite`,
        }}
      />
    </div>
  )
}

export default function SearchSuggestions({
  isOpen,
  query,
  suggestions,
  isLoading,
  recentSearches,
  onSelect,
  onClearRecent,
  onClose,
  activeIndex,
  onActiveIndexChange,
}: SearchSuggestionsProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  const hasQuery = query.trim().length >= 2
  const hasSuggestions = suggestions.length > 0
  const hasRecent = recentSearches.length > 0 && query.trim().length < 2

  type PanelState =
    | 'hidden'
    | 'loading'
    | 'suggestions'
    | 'empty'
    | 'recent'

  let panelState: PanelState = 'hidden'

  if (!isOpen) {
    panelState = 'hidden'
  } else if (hasQuery && isLoading) {
    panelState = 'loading'
  } else if (hasSuggestions) {
    panelState = 'suggestions'
  } else if (hasQuery && !isLoading) {
    panelState = 'empty'
  } else if (hasRecent) {
    panelState = 'recent'
  } else {
    panelState = 'hidden'
  }

  const visibleSuggestions = suggestions.slice(0, MAX_SUGGESTIONS)
  const visibleRecent = recentSearches.slice(0, MAX_RECENT)
  const navigableCount =
    panelState === 'suggestions'
      ? visibleSuggestions.length
      : panelState === 'recent'
      ? visibleRecent.length
      : 0

  useEffect(() => {
    onActiveIndexChange(-1)
  }, [panelState, onActiveIndexChange])

  useEffect(() => {
    if (activeIndex < 0 || !panelRef.current) return
    const activeEl = panelRef.current.querySelector(
      `#${OPTION_ID_PREFIX}${activeIndex}`,
    )
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (panelState === 'hidden' || navigableCount === 0) return

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next =
          activeIndex >= navigableCount - 1 ? 0 : activeIndex + 1
        onActiveIndexChange(next)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev =
          activeIndex <= 0 ? navigableCount - 1 : activeIndex - 1
        onActiveIndexChange(prev)
        break
      }
      case 'Enter': {
        if (activeIndex >= 0) {
          e.preventDefault()
          const selectedTerm =
            panelState === 'suggestions'
              ? (visibleSuggestions[activeIndex]?.label ?? '')
              : (visibleRecent[activeIndex] ?? '')
          if (selectedTerm) {
            onSelect(selectedTerm)
          }
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        onClose()
        break
      }
      case 'Tab': {
        onClose()
        break
      }
      default:
        break
    }
  }

  if (panelState === 'hidden') {
    return null
  }

  return (
    <>
      <style>{`
        @keyframes suggestions-enter {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .suggestion-row:hover,
        .suggestion-row--active {
          background-color: var(--color-surface-sunken) !important;
        }
        .suggestion-row:focus-visible {
          outline: none;
          box-shadow: inset var(--shadow-focus);
        }
        .recent-row:hover,
        .recent-row--active {
          background-color: var(--color-surface-sunken) !important;
        }
        .clear-recent-btn:hover {
          color: var(--color-ink-primary) !important;
        }
        .clear-recent-btn:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 4px;
        }
      `}</style>

      <div
        ref={panelRef}
        id={PANEL_ID}
        role="listbox"
        aria-label="Search suggestions"
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-hairline)',
          borderRadius: '16px',
          boxShadow: '0 12px 32px rgba(15,16,20,0.12)',
          zIndex: 20,
          overflow: 'hidden',
          maxHeight: '400px',
          overflowY: 'auto',
          animation: 'suggestions-enter 160ms cubic-bezier(0.4,0,0.2,1) forwards',
          scrollbarWidth: 'none',
        }}
        onKeyDown={handleKeyDown}
      >
        <style>{`
          #${PANEL_ID}::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* ── LOADING STATE ── */}
        {panelState === 'loading' && (
          <div
            role="status"
            aria-label="Loading search suggestions"
            aria-live="polite"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <SuggestionSkeleton key={i} index={i} />
            ))}
          </div>
        )}

        {/* ── SUGGESTIONS STATE ── */}
        {panelState === 'suggestions' && (
          <>
            <div style={{ padding: '10px 16px 4px' }}>
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
                Suggestions
              </p>
            </div>

            {visibleSuggestions.map((suggestion, index) => {
              const isActive = activeIndex === index
              const accentColor =
                suggestion.accentColor ?? 'var(--color-ink-primary)'

              return (
                <div
                  key={`suggestion-${suggestion.slug}-${index}`}
                  id={`${OPTION_ID_PREFIX}${index}`}
                  role="option"
                  aria-selected={isActive}
                  className={`suggestion-row${isActive ? ' suggestion-row--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(suggestion.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isActive
                      ? 'var(--color-surface-sunken)'
                      : 'transparent',
                    transition:
                      'background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                    userSelect: 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: 'var(--color-ink-tertiary)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Icon name="search" size={16} strokeWidth={1.75} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '15px',
                        fontWeight: 400,
                        color: 'var(--color-ink-primary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {highlightMatch(suggestion.label, query, accentColor)}
                    </p>

                    {suggestion.brandName && (
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
                        {suggestion.brandName}
                      </p>
                    )}
                  </div>

                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{
                        color: 'var(--color-ink-tertiary)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Icon name="arrow-right" size={14} strokeWidth={1.75} />
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {panelState === 'empty' && (
          <div
            style={{ padding: '24px 16px', textAlign: 'center' }}
            role="status"
            aria-live="polite"
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: '0 0 4px',
              }}
            >
              No results for{' '}
              <span
                style={{
                  color: 'var(--color-ink-primary)',
                  fontWeight: 500,
                }}
              >
                &ldquo;{query}&rdquo;
              </span>
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: 0,
              }}
            >
              Try a different search term or browse by brand.
            </p>
          </div>
        )}

        {/* ── RECENT SEARCHES STATE ── */}
        {panelState === 'recent' && (
          <>
            <div
              style={{
                padding: '10px 16px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
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
                Recent Searches
              </p>
            </div>

            {visibleRecent.map((term, index) => {
              const isActive = activeIndex === index

              return (
                <div
                  key={`recent-${index}-${term}`}
                  id={`${OPTION_ID_PREFIX}${index}`}
                  role="option"
                  aria-selected={isActive}
                  className={`recent-row${isActive ? ' recent-row--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(term)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isActive
                      ? 'var(--color-surface-sunken)'
                      : 'transparent',
                    transition:
                      'background-color 150ms cubic-bezier(0.4,0,0.2,1)',
                    userSelect: 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: 'var(--color-ink-tertiary)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Icon name="clock" size={16} strokeWidth={1.75} />
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '15px',
                      fontWeight: 400,
                      color: 'var(--color-ink-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {term}
                  </span>

                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{
                        color: 'var(--color-ink-tertiary)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Icon name="arrow-right" size={14} strokeWidth={1.75} />
                    </span>
                  )}
                </div>
              )
            })}

            <div
              style={{
                padding: '8px 16px 12px',
                borderTop: '1px solid var(--color-border-hairline)',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearRecent}
                className="clear-recent-btn"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'var(--color-ink-tertiary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                aria-label="Clear all recent searches"
              >
                <Icon name="close" size={12} strokeWidth={2} />
                Clear recent searches
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}