'use client'

/*
 * SearchBar — Hero-size search bar for the Home page.
 *
 * MPD Task H-01:
 *   "Large, r-full, shadow-md → shadow-lg on focus. Search icon left.
 *   Placeholder text per Design System. onChange fires useSearch hook
 *   (wired in Phase 6). Full-width on mobile."
 *
 * SR-03 additions:
 *   - suggestionsId?: string   → aria-controls on the input
 *     Points to the SearchSuggestions panel (PANEL_ID from SR-02).
 *   - activeSuggestionId?: string → aria-activedescendant on the input
 *     Set to the id of the keyboard-highlighted suggestion row.
 *   - isSuggestionsOpen?: boolean → dynamic aria-expanded on the input
 *     True when the suggestions panel is visible.
 *   - onKeyDown?: handler → external keyboard handler
 *     Called from the internal handleKeyDown in addition to Escape logic.
 *     Used by the Home page (SR-03) for ArrowUp/Down/Enter navigation.
 *   - aria-haspopup="listbox" added for correct ARIA combobox semantics.
 *
 * COMBOBOX ARIA PATTERN:
 *   role="combobox" + aria-haspopup="listbox" + aria-expanded + aria-controls
 *   + aria-activedescendant is the correct WCAG 2.1 combobox pattern.
 *   The SearchSuggestions panel (SR-02) has role="listbox".
 *   Each suggestion row has role="option".
 *   This makes the search system fully accessible to screen readers.
 *
 * KEYBOARD EVENT ORDER:
 *   1. External onKeyDown fires (navigation: ArrowUp/Down/Enter/Escape).
 *   2. Internal Escape handling fires (clears input + blurs).
 *   Both run on Escape — external closes the panel, internal clears and blurs.
 *   For ArrowUp/Down/Enter: only external runs (navigation only).
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
 * Allows parent components to programmatically focus/blur/clear.
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
   * value — current search query string (controlled input).
   * Bound to useSearch.query in SR-03.
   */
  value?: string

  /*
   * onChange — called on every keystroke with the new query string.
   * Bound to useSearch.setQuery in SR-03.
   */
  onChange?: (value: string) => void

  /*
   * onSubmit — called when the user presses Enter or submits the form.
   * Bound to useSearch.submitSearch in SR-03.
   */
  onSubmit?: (value: string) => void

  /*
   * onFocus — called when the input gains focus.
   * Bound to useSearch.setIsFocused(true) in SR-03.
   */
  onFocus?: () => void

  /*
   * onBlur — called when the input loses focus.
   * Bound to useSearch.setIsFocused(false) in SR-03.
   * Note: use onMouseDown + preventDefault on suggestion rows to
   * prevent blur from firing before a suggestion click registers.
   */
  onBlur?: () => void

  /*
   * onKeyDown — external keyboard handler.
   * SR-03: passed from the Home page for ArrowUp/Down/Enter/Escape
   * navigation in the SearchSuggestions panel.
   * Called BEFORE the internal Escape handler so external logic
   * can e.preventDefault() if needed.
   */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void

  /*
   * suggestionsId — the HTML id of the suggestions panel element.
   * SR-03: set to PANEL_ID from SearchSuggestions (SR-02).
   * Applied as aria-controls on the combobox input.
   * Tells assistive technology which element is the associated listbox.
   */
  suggestionsId?: string

  /*
   * activeSuggestionId — id of the currently keyboard-highlighted option.
   * SR-03: set to `${OPTION_ID_PREFIX}${activeIndex}` when activeIndex >= 0.
   * Applied as aria-activedescendant on the combobox input.
   * Tells screen readers which suggestion is currently focused.
   */
  activeSuggestionId?: string

  /*
   * isSuggestionsOpen — whether the suggestions panel is currently visible.
   * SR-03: computed from useSearch.isFocused + query length.
   * Applied as aria-expanded on the combobox input.
   * Default: false (suggestions panel closed).
   */
  isSuggestionsOpen?: boolean

  /*
   * placeholder — input placeholder text.
   * Default: "Search a motorcycle — try 'GT 650'" per MPD HiFi spec.
   */
  placeholder?: string

  /*
   * autoFocus — whether the input should focus on mount.
   */
  autoFocus?: boolean

  /*
   * className — additional classes for the outer container.
   */
  className?: string

  /*
   * id — HTML id on the input element.
   * Used for label association and aria-controls references.
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
      onKeyDown: externalOnKeyDown,
      suggestionsId,
      activeSuggestionId,
      isSuggestionsOpen = false,
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
     */
    const [isFocused, setIsFocused] = useState(false)

    /*
     * inputRef — direct reference to the <input> element.
     * Used for imperative focus/blur and Escape key handling.
     */
    const inputRef = useRef<HTMLInputElement>(null)

    /*
     * Expose focus/blur/clear to parent via forwardRef handle.
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
     */
    function handleChange(e: ChangeEvent<HTMLInputElement>): void {
      const newValue = e.target.value
      if (onChange) {
        onChange(newValue)
      } else if (process.env.NODE_ENV === 'development') {
        console.log(
          '[SearchBar] onChange stub — wire useSearch in SR-03:',
          newValue,
        )
      }
    }

    /*
     * handleSubmit — fires on form Enter/submit.
     */
    function handleSubmit(e: FormEvent<HTMLFormElement>): void {
      e.preventDefault()
      if (value.trim()) {
        onSubmit?.(value.trim())
      }
    }

    /*
     * handleKeyDown — keyboard interaction.
     *
     * Step 1: Call external onKeyDown (navigation in suggestions panel).
     *   The external handler handles ArrowUp/Down/Enter/Escape for
     *   keyboard navigation. It may call e.preventDefault() for these.
     *
     * Step 2: Internal Escape handling.
     *   Clears the input value and blurs the input.
     *   Runs regardless of whether external handler prevented default
     *   because clearing and blurring is always the correct Escape behavior.
     */
    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
      /*
       * Step 1 — External handler (navigation, panel close, etc.).
       */
      externalOnKeyDown?.(e)

      /*
       * Step 2 — Internal Escape: clear input value + blur.
       * Both behaviors (panel close via external + input clear via internal)
       * should happen on Escape — they are complementary, not conflicting.
       */
      if (e.key === 'Escape') {
        onChange?.('')
        inputRef.current?.blur()
      }
    }

    /*
     * handleFocus — input gains focus.
     */
    function handleFocus(): void {
      setIsFocused(true)
      onFocus?.()
    }

    /*
     * handleBlur — input loses focus.
     */
    function handleBlur(): void {
      setIsFocused(false)
      onBlur?.()
    }

    /*
     * handleClear — clears the input when × button is clicked.
     */
    function handleClear(): void {
      onChange?.('')
      inputRef.current?.focus()
    }

    /*
     * Dynamic shadow — shadow-md at rest, shadow-lg on focus.
     */
    const containerShadow = isFocused
      ? '0 12px 32px rgba(15,16,20,0.12)'
      : '0 4px 12px rgba(15,16,20,0.08)'

    const showClearButton = value.length > 0

    return (
      <>
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
          @media (max-width: 768px) {
            .search-bar-input {
              height: 52px !important;
              font-size: 16px !important;
            }
          }
        `}</style>

        {/*
         * Form wrapper — role="search" per ARIA spec.
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
              border: '1px solid var(--color-border-hairline)',
            }}
          >
            {/*
             * Search icon — left side, non-interactive.
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
             * The search input — combobox with full ARIA attributes.
             *
             * role="combobox" — identifies this as a combobox widget.
             * aria-haspopup="listbox" — declares the associated listbox type.
             * aria-expanded — true when the suggestions panel is visible.
             * aria-controls — points to the suggestions panel by id.
             * aria-activedescendant — id of the keyboard-highlighted option.
             * aria-autocomplete="list" — inline + list autocomplete pattern.
             */}
            <input
              ref={inputRef}
              id={id}
              type="search"
              role="combobox"
              aria-label="Search a motorcycle"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-expanded={isSuggestionsOpen}
              aria-controls={suggestionsId}
              aria-activedescendant={activeSuggestionId}
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
                WebkitAppearance: 'none',
              }}
            />

            {/*
             * Clear button — appears when value is non-empty.
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
                }}
              >
                <Icon name="close" size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </form>
      </>
    )
  },
)

SearchBar.displayName = 'SearchBar'

export default SearchBar