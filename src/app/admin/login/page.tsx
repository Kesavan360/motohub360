/*
 * Admin Login Page — /admin/login
 *
 * MPD Task A-03:
 *   "Login page: email + password form. On submit: POST to
 *   /api/admin/login. On success: redirect to /admin.
 *   On failure: show inline error message."
 *
 * MPD Section 5.5, Admin Panel:
 *   "Login page is deliberately minimal — just the MotoHub360 wordmark,
 *   an email field, a password field, and a 'Sign in' button.
 *   No recovery flow in V1 — passwords reset via seed script."
 *
 * DESIGN:
 *   Full-page centered card on surface-base.
 *   surface-inverse background header: wordmark + tagline.
 *   Form fields: admin-input class from admin.css.
 *   Submit button: accent-colored (Royal Enfield red fallback).
 *   Error message: red inline text below the button.
 *
 * FLOW:
 *   1. User enters email + password.
 *   2. Submit → POST /api/admin/login.
 *   3. Success: router.push('/admin').
 *   4. Failure: show error.message from response.
 *
 * AUTH REDIRECT:
 *   If already logged in, A-04 middleware (next task) will redirect
 *   /admin/login → /admin automatically. For A-03, this redirect
 *   is not yet wired — it is added in A-04.
 *
 * ACCESSIBILITY:
 *   - aria-live="polite" on the error region.
 *   - aria-describedby links inputs to error message when present.
 *   - Button shows loading state during submit (aria-busy).
 *   - Focus moves to the error message on login failure.
 *
 * WHY 'use client':
 *   useState (email, password, error, isLoading)
 *   useRouter (redirect after login)
 *   onSubmit handler
 */

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Login Page Component
// ---------------------------------------------------------------------------

export default function AdminLoginPage() {
  const router = useRouter()

  // ── State ─────────────────────────────────────────────────────────────

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // ── Refs ──────────────────────────────────────────────────────────────

  /*
   * errorRef — ref to the error message element.
   * Focus moves here on login failure for screen reader announcement.
   */
  const errorRef = useRef<HTMLParagraphElement>(null)

  // ── Handlers ─────────────────────────────────────────────────────────

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json() as {
        ok?: boolean
        error?: string
      }

      if (!response.ok) {
        setError(data.error ?? 'Login failed. Please try again.')
        /*
         * Move focus to the error message so screen readers announce it.
         * setTimeout(0) defers until after state update renders the element.
         */
        setTimeout(() => {
          errorRef.current?.focus()
        }, 0)
        return
      }

      /*
       * Success — navigate to the admin dashboard.
       * router.push triggers a client-side navigation.
       * The iron-session cookie is now set in the browser.
       */
      router.push('/admin')
      router.refresh()
    } catch {
      setError('A network error occurred. Check your connection and try again.')
      setTimeout(() => {
        errorRef.current?.focus()
      }, 0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        /*
         * Login page — full viewport, centered content.
         * surface-base background.
         */
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-surface-base);
          padding: 24px;
        }

        /*
         * Login card — centered, max-width 400px.
         * surface-raised background, hairline border, r-lg.
         */
        .login-card {
          width: 100%;
          max-width: 400px;
          background-color: var(--color-surface-raised);
          border: 1px solid var(--color-border-hairline);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(14,15,18,0.10);
        }

        /*
         * Card header — surface-inverse (dark) with wordmark.
         * Signals "admin area" via the dark premium tone.
         */
        .login-card-header {
          padding: 32px 32px 28px;
          background-color: var(--color-surface-inverse);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        /*
         * Card body — form fields.
         */
        .login-card-body {
          padding: 28px 32px 32px;
        }

        /*
         * Field group — label + input + spacing.
         */
        .login-field {
          margin-bottom: 20px;
        }

        .login-field:last-of-type {
          margin-bottom: 0;
        }

        /*
         * Submit button hover/active.
         */
        .login-submit:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .login-submit:active:not(:disabled) {
          filter: brightness(0.92);
          transform: scale(0.99);
        }

        .login-submit:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--color-surface-base),
                      0 0 0 4px #7A2E2E;
          border-radius: 8px;
        }

        .login-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /*
         * Input focus override within admin context.
         * Mirrors admin.css admin-input focus style.
         */
        .login-input:focus {
          outline: none;
          border-color: var(--color-ink-secondary) !important;
          box-shadow: var(--shadow-focus) !important;
        }
      `}</style>

      <div className="login-page">
        <div className="login-card" role="main">

          {/* ── Card header ─────────────────────────────────────── */}
          <div className="login-card-header">
            {/*
             * Wordmark — display font, white on dark header.
             * Same brand voice as the public site header.
             */}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                lineHeight: 1,
                marginBottom: '8px',
                userSelect: 'none',
              }}
            >
              MotoHub
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>360</span>
            </div>

            {/*
             * Tagline — body-sm, muted white.
             * Signals "admin area" without being heavy-handed.
             */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.45)',
                margin: 0,
                letterSpacing: '0.01em',
              }}
            >
              Admin sign in
            </p>
          </div>

          {/* ── Card body: form ──────────────────────────────────── */}
          <div className="login-card-body">
            <form
              onSubmit={handleSubmit}
              aria-label="Admin sign in form"
              noValidate
            >
              {/* Email field */}
              <div className="login-field">
                <label
                  htmlFor="login-email"
                  className="admin-label"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@motohub360.in"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={isLoading}
                  aria-required="true"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="admin-input login-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Password field */}
              <div className="login-field" style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="login-password"
                  className="admin-label"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  aria-required="true"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="admin-input login-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Error message */}
              {/*
               * aria-live="polite" — announced by screen readers
               * without interrupting current speech.
               * role="alert" — ensures announcement even if focus
               * doesn't move here (belt-and-suspenders with focus).
               * tabIndex={-1} — allows programmatic focus for screen readers.
               */}
              {error && (
                <p
                  id="login-error"
                  ref={errorRef}
                  role="alert"
                  aria-live="polite"
                  tabIndex={-1}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: 400,
                    color: '#C8102E',
                    margin: '0 0 16px',
                    lineHeight: 1.5,
                    outline: 'none',
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !email.trim() || !password}
                aria-busy={isLoading}
                aria-label={
                  isLoading ? 'Signing in…' : 'Sign in to admin panel'
                }
                className="login-submit"
                style={{
                  width: '100%',
                  height: '44px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: '#7A2E2E', // Royal Enfield accent — generic admin red
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.01em',
                  transition:
                    'filter 150ms cubic-bezier(0.4,0,0.2,1), ' +
                    'transform 150ms cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    {/*
                     * Inline spinner during submit.
                     * CSS animation via keyframes in the style block.
                     */}
                    <span
                      aria-hidden="true"
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.35)',
                        borderTopColor: '#FFFFFF',
                        borderRadius: '999px',
                        animation: 'login-spin 0.7s linear infinite',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>

              {/*
               * Spinner animation keyframes — scoped inside the form
               * to avoid polluting the global stylesheet.
               */}
              <style>{`
                @keyframes login-spin {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
              `}</style>
            </form>

            {/*
             * No-registration note.
             * Per MPD: "No public registration — admin accounts
             * created via seed script (DB-10)."
             */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 400,
                color: 'var(--color-ink-tertiary)',
                margin: '20px 0 0',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Accounts are managed by the site administrator.
              <br />
              Contact support if you cannot sign in.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}