'use client'

/*
 * SearchBar — Hero-size search bar for the Home page.
 *
 * MPD Task H-01:
 *   "Large, r-full, shadow-md → shadow-lg on focus. Search icon left.
 *   Placeholder text per Design System. onChange fires useSearch hook
 *   (wired in Phase 6 — stub the handler for now). Full-width on mobile."
 *
 * MPD Section 5.1, Home Page:
 *   "Prominent search bar as the main element on the page — large,
 *   central, the primary way users find a specific bike (e.g. typing
 *   'GT 650')."
 *
 * MPD Section 6, Design System — Search Experience:
 *   "Search bar is now the single dominant visual element on the page —
 *   largest element, top priority, above everything including the hero."
 *
 * MPD High-Fidelity UI, Home Page:
 *   "Centered, roughly 30% down the viewport on desktop (higher on
 *   mobile, near the top under the header), sits the search bar:
 *   large, r-full rounded, surface-raised on surface-base, with a soft
 *   shadow-md that intensifies on focus. Placeholder text reads
 *   'Search a motorcycle — try GT 650' in ink-tertiary. To its left,
 *   a thin-stroke search icon in ink-secondary."
 *
 * MPD Section 15, Search Architecture:
 *   "Client calls GET /api/search/suggest?q=[query] with 150ms debounce."
 *   The debounce and API call live in useSearch (SR-01).
 *   This component accepts onChange and onSubmit as props so it
 *   remains decoupled from the search logic.
 *
 * COMPONENT ROLE:
 *   SearchBar is a controlled input component.
 *   It owns no search state — all state lives in the parent/hook.
 *   The Home page (H-06) will pass value + onChange from useSearch (SR-01).
 *   For H-01, onChange is a stub prop (console.log in dev).
 *
 * TWO SEARCH BAR COMPONENTS:
 *   SearchBar (this file, H-01) — Hero size, Home page only.
 *   SearchBarCompact (SR-04)    — Header icon → expands on click.
 *   Both share the same visual language but differ in size and context.
 *
 * SUGGESTIONS PANEL:
 *   SearchSuggestions (SR-02) is rendered by the parent (H-06/SR-03),
 *   not inside SearchBar. SearchBar only emits onChange/onSubmit.
 *   This keeps SearchBar reusable without coupling it to suggestions logic.
 *
 * DESIGN:
 *   - Container: surface-raised (#FFFFFF), r-full (999px)
 *   - Shadow: shadow-md at rest → shadow-lg on focus
 *   - Height: 56px desktop / 52px mobile
 *   - Left: search Icon (18px, ink-secondary)
 *   - Input: body-lg (18px), ink-primary text, ink-tertiary placeholder
 *   - Right: optional clear button (× icon) when value is non-empty
 *   - Transition: shadow 280ms premium ease
 *   - Full-width on mobile (no max-width constraint)
 *
 * ACCESSIBILITY:
 *   - role="search" on the form wrapper
 *   - aria-label on the input
 *   - Clear button has aria-label="Clear search"
 *   - Keyboard: Enter submits, Escape clears + blurs
 *
 * WHY 'use client':
 *   useState for isFocused (shadow transition).
 *   useRef for the input element (Escape key blur, focus management).
 *   onChange/onKeyDown event handlers.
 */

import {
  forwardRef,
  useRef,
  useState,
  useImperativeHandle,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Icon from '@/components/ui/Icon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * SearchBarHandle — imperative handle exposed via forwardRef.
 * Allows parent components (e.g. Home page) to programmatically
 * focus the search bar (e.g. on keyboard shortcut '/' or 'S').
 */
export interface SearchBarHandle {
  focus: () => void
  blur: () => void
  clear: () => void
}

/*
 * SearchBarProps — props for the SearchBar component.
 */
export interface SearchBarProps {
  /*
   * value — current search query string.
   * Controlled input — parent manages this state (useSearch hook SR-01).
   * Default: '' (empty string for uncontrolled usage in H-01 stub phase).
   */
  value?: string

  /*
   * onChange — called on every keystroke with the new query string.
   * Parent passes this from useSearch hook (SR-01).
   * Stub: console.log in development until SR-01 is implemented.
   */
  onChange?: (value: string) => void

  /*
   * onSubmit — called when the user presses Enter or submits the form.
   * Parent navigates to /search?q=[value] (wired in SR-03).
   */
  onSubmit?: (value: string) => void

  /*
   * onFocus — called when the input gains focus.
   * Used by the parent to show the SearchSuggestions panel (SR-03).
   */
  onFocus?: () => void

  /*
   * onBlur — called when the input loses focus.
   * Used by the parent to hide the SearchSuggestions panel (SR-03).
   * Note: blur fires before suggestion click events — the parent must
   * use a delayed hide (onMouseDown on suggestions panel) to prevent
   * the panel from closing before a suggestion click registers.
   */
  onBlur?: () => void

  /*
   * placeholder — input placeholder text.
   * Default: "Search a motorcycle — try 'GT 650'" per MPD HiFi spec.
   */
  placeholder?: string

  /*
   * autoFocus — whether the input should focus on mount.
   * Default: false. Use on the Home page if desired.
   */
  autoFocus?: boolean

  /*
   * className — additional classes for the outer container.
   * Use for positioning/width constraints from the parent layout.
   */
  className?: string

  /*
   * id — HTML id on the input element.
   * Used for aria-controls on the SearchSuggestions panel (SR-02).
   */
  id?: string
}

// ---------------------------------------------------------------------------
// SearchBar Component
// ---------------------------------------------------------------------------

const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(
  function SearchBar(
    {
      value = '',
      onChange,
      onSubmit,
      onFocus,
      onBlur,
      placeholder = "Search a motorcycle — try 'GT 650'",
      autoFocus = false,
      className = '',
      id = 'search-bar-input',
    },
    ref,
  ) {
    /*
     * isFocused — tracks focus state for the shadow transition.
     * shadow-md at rest → shadow-lg on focus.
     * This is visual-only state, not functional search state.
     */
    const [isFocused, setIsFocused] = useState(false)

    /*
     * inputRef — direct reference to the <input> element.
     * Used for imperative focus/blur and Escape key handling.
     */
    const inputRef = useRef<HTMLInputElement>(null)

    /*
     * useImperativeHandle — expose focus/blur/clear to parent.
     * Allows the Home page to focus the search bar on '/' keypress
     * (a common search UX pattern) without managing focus internally.
     */
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => {
        onChange?.('')
        inputRef.current?.focus()
      },
    }))

    /*
     * handleChange — fires on every keystroke.
     * Extracts the string value from the event and passes to onChange prop.
     * The debounce lives in useSearch (SR-01), not here.
     */
    function handleChange(e: ChangeEvent<HTMLInputElement>): void {
      const newValue = e.target.value
      if (onChange) {
        onChange(newValue)
      } else if (process.env.NODE_ENV === 'development') {
        /*
         * Stub behaviour until SR-01 useSearch is wired (H-06/SR-03).
         * Logs the query so developers can confirm typing is working.
         */
        console.log(
          '[SearchBar] onChange stub — wire useSearch in SR-01:',
          newValue,
        )
      }
    }

    /*
     * handleSubmit — fires on form Enter/submit.
     * Prevents default browser form submission (page reload).
     * Calls onSubmit prop with the current value.
     */
    function handleSubmit(e: FormEvent<HTMLFormElement>): void {
      e.preventDefault()
      if (value.trim()) {
        onSubmit?.(value.trim())
      }
    }

    /*
     * handleKeyDown — keyboard interaction.
     * Escape: clears the input and blurs (dismisses suggestions panel).
     */
    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
      if (e.key === 'Escape') {
        onChange?.('')
        inputRef.current?.blur()
      }
    }

    /*
     * handleFocus — input gains focus.
     * Updates visual state (shadow) and notifies parent.
     */
    function handleFocus(): void {
      setIsFocused(true)
      onFocus?.()
    }

    /*
     * handleBlur — input loses focus.
     * Updates visual state and notifies parent.
     */
    function handleBlur(): void {
      setIsFocused(false)
      onBlur?.()
    }

    /*
     * handleClear — clears the input when × button is clicked.
     * Refocuses the input so the user can type a new query immediately.
     */
    function handleClear(): void {
      onChange?.('')
      inputRef.current?.focus()
    }

    /*
     * Dynamic shadow — shadow-md at rest, shadow-lg on focus.
     * Values from MPD Section 6, Shadows.
     */
    const containerShadow = isFocused
      ? '0 12px 32px rgba(15,16,20,0.12)'
      : '0 4px 12px rgba(15,16,20,0.08)'

    const showClearButton = value.length > 0

    return (
      <>
        {/* Scoped focus-visible style for the input */}
        <style>{`
          .search-bar-input:focus {
            outline: none;
          }
          .search-bar-clear:hover {
            color: var(--color-ink-primary) !important;
            background-color: var(--color-surface-sunken) !important;
          }
          .search-bar-clear:focus-visible {
            outline: none;
            box-shadow: var(--shadow-focus);
          }
        `}</style>

        {/*
         * Form wrapper — role="search" per ARIA spec.
         * Semantically marks this as a search landmark region.
         * Screen readers announce "search" when the user navigates to it.
         */}
        <form
          role="search"
          onSubmit={handleSubmit}
          className={className}
          style={{ width: '100%' }}
          aria-label="Search motorcycles"
        >
          {/*
           * Input container — the visual pill (r-full, surface-raised).
           * Position: relative to allow absolute positioning of icons.
           * Transition: box-shadow only — no layout shift on focus.
           */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              backgroundColor: 'var(--color-surface-raised)',
              borderRadius: '999px',
              boxShadow: containerShadow,
              transition: 'box-shadow 280ms cubic-bezier(0.4,0,0.2,1)',
              /*
               * Subtle border: always present but very low opacity.
               * Provides definition on surface-base background without
               * competing with the shadow as the primary visual cue.
               */
              border: '1px solid var(--color-border-hairline)',
            }}
          >
            {/*
             * Search icon — left side, non-interactive.
             * ink-secondary color, 18px per MPD spec.
             * aria-hidden: the input's aria-label carries the context.
             */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: isFocused
                  ? 'var(--color-ink-secondary)'
                  : 'var(--color-ink-tertiary)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 280ms cubic-bezier(0.4,0,0.2,1)',
                pointerEvents: 'none',
                flexShrink: 0,
              }}
            >
              <Icon name="search" size={18} strokeWidth={1.75} />
            </span>

            {/*
             * The search input itself.
             * paddingLeft accommodates the search icon (20px edge + 18px icon + 12px gap = 50px).
             * paddingRight accommodates the clear button when visible.
             * Height: 56px desktop / reduced via CSS for mobile.
             */}
            <input
              ref={inputRef}
              id={id}
              type="search"
              role="combobox"
              aria-label="Search a motorcycle"
              aria-autocomplete="list"
              /*
               * aria-expanded is false here — set to true by the parent
               * when SearchSuggestions panel is visible (SR-03).
               */
              aria-expanded={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus={autoFocus}
              value={value}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="search-bar-input"
              style={{
                width: '100%',
                height: '56px',
                padding: '0 52px 0 50px',
                fontFamily: 'var(--font-body)',
                fontSize: '18px',
                fontWeight: 400,
                color: 'var(--color-ink-primary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '999px',
                lineHeight: 1,
                /*
                 * Removes default browser 'search' input clear button (×).
                 * MotoHub360 provides its own clear button with consistent styling.
                 */
                WebkitAppearance: 'none',
              }}
            />

            {/*
             * Clear button — appears when value is non-empty.
             * Circular icon button, surface-sunken fill, ink-secondary icon.
             * Positioned absolutely on the right side of the input.
             * type="button" prevents form submission on click.
             */}
            {showClearButton && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="search-bar-clear"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'var(--color-surface-sunken)',
                  color: 'var(--color-ink-secondary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition:
                    'color 200ms cubic-bezier(0.4,0,0.2,1), ' +
                    'background-color 200ms cubic-bezier(0.4,0,0.2,1)',
                  /*
                   * Prevent clear button click from propagating to the
                   * form and triggering handleSubmit.
                   */
                }}
              >
                <Icon name="close" size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </form>

        {/*
         * Mobile height adjustment.
         * Desktop: 56px — generous, dominant per MPD HiFi spec.
         * Mobile: 52px — slightly reduced to leave more vertical space.
         */}
        <style>{`
          @media (max-width: 768px) {
            .search-bar-input {
              height: 52px !important;
              font-size: 16px !important;
            }
          }
        `}</style>
      </>
    )
  },
)

SearchBar.displayName = 'SearchBar'

export default SearchBar