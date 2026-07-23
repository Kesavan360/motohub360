'use client'

/*
 * Bike360Viewer — 360-degree spin video viewer.
 *
 * MPD Task B-04:
 *   "360° viewer embed — Cloudinary 360-degree spin video.
 *   Play/pause control. Poster image shown before activation.
 *   Only rendered when video360Url is present."
 *
 * MPD Section 5.3, Bike Detail Page — Below the fold:
 *   "360° viewer embed: plays a Cloudinary spin video (frames
 *   rendered from all angles around the motorcycle).
 *   Initial state: static poster image with a '360°' activation button.
 *   Active state: video plays in a loop. Play/pause toggle available."
 *
 * STATES:
 *
 *   INACTIVE (initial):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                                                          │
 *   │                  [poster image]                          │
 *   │                                                          │
 *   │              ┌─────────────────┐                         │
 *   │              │  ↻  View 360°   │  ← CTA button          │
 *   │              └─────────────────┘                         │
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   ACTIVE (video playing):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                                                          │
 *   │              [spinning video loop]                       │
 *   │                                                    ⏸    │  ← top-right
 *   │                                                          │
 *   │                                              ↻ 360°     │  ← badge bottom-right
 *   └──────────────────────────────────────────────────────────┘
 *
 *   PAUSED:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                                                          │
 *   │              [frozen video frame]                        │
 *   │                                                    ▶    │
 *   │                                                          │
 *   │                                              ↻ 360°     │
 *   └──────────────────────────────────────────────────────────┘
 *
 * VIDEO:
 *   Uses the HTML5 <video> element.
 *   Attributes: muted, loop, playsInline (required for iOS autoplay).
 *   The poster prop shows the bike's heroImageUrl before activation.
 *   Once activated, play() is called imperatively via videoRef.
 *   The video plays silently (muted) — spin videos have no audio.
 *
 * CLOUDINARY SPIN VIDEO:
 *   A Cloudinary 360° spin is a video file (mp4/webm) containing
 *   sequential frames of the motorcycle photographed from all angles.
 *   The video plays at ~24fps giving the illusion of rotation.
 *   Cloudinary URL format:
 *     https://res.cloudinary.com/[cloud]/video/upload/[public_id].mp4
 *   Optimal transformations (applied at upload time, not at render):
 *     q_auto, f_auto, w_1280 — auto quality, format, 1280px wide.
 *
 * ACTIVATION:
 *   User clicks the "View 360°" button → isActive becomes true.
 *   The <video> element is already in the DOM (isActive just changes
 *   visibility). Once visible, videoRef.current.play() is called
 *   inside useEffect when isActive changes.
 *
 * WHY VIDEO IS ALWAYS IN DOM:
 *   If the video is conditionally rendered (isActive ? <video> : null),
 *   the video element is created fresh on activation, which can cause
 *   a delay while the browser loads and buffers the video source.
 *   Keeping it in the DOM (display: none / display: block) means it
 *   starts loading immediately on page load, so when the user clicks
 *   "View 360°", playback begins instantly.
 *
 *   The trade-off: the video starts loading even if the user never
 *   activates the viewer. For a motorcycle showcase this is acceptable
 *   — users who reach the 360° section are engaged enough to benefit
 *   from pre-buffering.
 *
 * FULLSCREEN:
 *   A fullscreen button is shown in the active state.
 *   Calls videoRef.current.requestFullscreen() (with webkit prefix for iOS).
 *   Hides if the Fullscreen API is not available (e.g. in iframes).
 *
 * KEYBOARD INTERACTIONS:
 *   The viewer container has tabIndex={0} and onKeyDown.
 *   Space / Enter (when inactive): activates the viewer.
 *   Space (when active): toggles play/pause.
 *   Escape (when active): deactivates (returns to poster state).
 *   F: toggles fullscreen.
 *
 * LOADING STATE:
 *   Between activation click and first video frame, a loading indicator
 *   (spinner) is shown over the video area.
 *   onCanPlay: loading → false.
 *   onLoadedData: loading → false (additional safety).
 *
 * ERROR STATE:
 *   If the video fails to load (network error, invalid URL), the viewer
 *   returns to the inactive state with an error message.
 *   This prevents a blank broken video element from confusing the user.
 *
 * WHY 'use client':
 *   useState (isActive, isPlaying, isLoading, hasError, supportsFullscreen)
 *   useRef (videoRef for imperative play/pause/fullscreen calls)
 *   useEffect (play/pause on isActive change; fullscreen support detection)
 *   onKeyDown, onClick event handlers
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/*
 * DEFAULT_BLUR — base64 blur placeholder for the poster image.
 */
const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Bike360ViewerProps {
  /*
   * videoUrl — Cloudinary URL for the 360° spin video.
   * Required — this component only renders when videoUrl is present.
   * Format: https://res.cloudinary.com/[cloud]/video/upload/[id].mp4
   */
  videoUrl: string

  /*
   * posterUrl — the bike's heroImageUrl shown before activation.
   * Provides context so the user knows what they're about to see.
   */
  posterUrl: string

  /*
   * posterBlurUrl — blur-up placeholder for the poster image.
   * Optional — falls back to DEFAULT_BLUR.
   */
  posterBlurUrl?: string

  /*
   * bikeName — used in aria-label on the viewer region.
   * Example: "GT 650"
   */
  bikeName: string

  /*
   * accentColor — brand accent hex for the activation button.
   * Example: '#7A2E2E' for Royal Enfield.
   */
  accentColor: string
}

// ---------------------------------------------------------------------------
// Bike360Viewer Component
// ---------------------------------------------------------------------------

export default function Bike360Viewer({
  videoUrl,
  posterUrl,
  posterBlurUrl,
  bikeName,
  accentColor,
}: Bike360ViewerProps) {
  // ── State ─────────────────────────────────────────────────────────────

  /*
   * isActive — whether the viewer has been activated by the user.
   * false: poster + CTA button shown.
   * true:  video shown (playing or paused).
   */
  const [isActive, setIsActive] = useState<boolean>(false)

  /*
   * isPlaying — whether the video is currently playing.
   * Drives the play/pause button icon.
   */
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  /*
   * isLoading — whether the video is buffering after activation.
   * true between activation click and first renderable frame.
   * Shows a spinner over the video area.
   */
  const [isLoading, setIsLoading] = useState<boolean>(false)

  /*
   * hasError — whether the video failed to load.
   * true: reverts to poster state with an error message.
   */
  const [hasError, setHasError] = useState<boolean>(false)

  /*
   * supportsFullscreen — whether the browser supports the Fullscreen API.
   * Detected on mount. false: fullscreen button is hidden.
   */
  const [supportsFullscreen, setSupportsFullscreen] =
    useState<boolean>(false)

  // ── Refs ──────────────────────────────────────────────────────────────

  /*
   * videoRef — ref to the <video> element.
   * Used for: play(), pause(), requestFullscreen().
   */
  const videoRef = useRef<HTMLVideoElement>(null)

  /*
   * containerRef — ref to the viewer container div.
   * Used for: keyboard focus management, fullscreen (container-level).
   */
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Effects ───────────────────────────────────────────────────────────

  /*
   * Detect Fullscreen API support on mount.
   */
  useEffect(() => {
    setSupportsFullscreen(
      typeof document !== 'undefined' &&
        (document.fullscreenEnabled ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).webkitFullscreenEnabled === true),
    )
  }, [])

  /*
   * Play the video when the viewer is activated.
   * Pause/stop when deactivated.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive) {
      setIsLoading(true)
      setHasError(false)

      video.play().then(() => {
        setIsPlaying(true)
        setIsLoading(false)
      }).catch(() => {
        /*
         * play() can throw a DOMException if the video fails to load
         * or if autoplay is blocked (though muted videos should always
         * autoplay per browser policy).
         */
        setHasError(true)
        setIsActive(false)
        setIsLoading(false)
      })
    } else {
      video.pause()
      video.currentTime = 0
      setIsPlaying(false)
    }
  }, [isActive])

  // ── Handlers ─────────────────────────────────────────────────────────

  /*
   * activate — activates the 360° viewer.
   * Called on CTA button click or Space/Enter when inactive.
   */
  const activate = useCallback(() => {
    setIsActive(true)
    setHasError(false)
  }, [])

  /*
   * deactivate — returns to the poster state.
   * Called on Escape key when active.
   */
  const deactivate = useCallback(() => {
    setIsActive(false)
    setIsLoading(false)
    containerRef.current?.focus()
  }, [])

  /*
   * togglePlayPause — toggles video play/pause in the active state.
   */
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [])

  /*
   * toggleFullscreen — requests/exits fullscreen on the video element.
   * Falls back to webkit prefix for iOS Safari.
   */
  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else if (video.requestFullscreen) {
      void video.requestFullscreen()
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = video as any
      if (typeof v.webkitRequestFullscreen === 'function') {
        v.webkitRequestFullscreen()
      }
    }
  }, [])

  /*
   * handleKeyDown — keyboard interactions for the viewer.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (!isActive) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        activate()
      }
      return
    }

    switch (e.key) {
      case ' ':
        e.preventDefault()
        togglePlayPause()
        break
      case 'Escape':
        e.preventDefault()
        deactivate()
        break
      case 'f':
      case 'F':
        if (supportsFullscreen) {
          toggleFullscreen()
        }
        break
      default:
        break
    }
  }

  return (
    <>
      <style>{`
        /*
         * Viewer container focus ring.
         */
        .bike-360-viewer:focus-visible {
          outline: none;
          box-shadow: var(--shadow-focus);
          border-radius: 12px;
        }

        /*
         * CTA button hover state.
         */
        .bike-360-cta:hover {
          background-color: rgba(255,255,255,0.12) !important;
          transform: scale(1.04) !important;
        }

        .bike-360-cta:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.6);
          border-radius: 999px;
        }

        .bike-360-cta:active {
          transform: scale(0.97) !important;
        }

        /*
         * Control button hover.
         */
        .bike-360-ctrl:hover {
          background-color: rgba(14,15,18,0.72) !important;
        }

        .bike-360-ctrl:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.6);
          border-radius: 999px;
        }

        /*
         * Spin animation for the loading indicator.
         */
        @keyframes bike-360-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bike-360-spinner {
          animation: bike-360-spin 1s linear infinite;
        }

        /*
         * Poster fade-in.
         */
        @keyframes bike-360-poster-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .bike-360-poster {
          animation: bike-360-poster-fade 200ms ease forwards;
        }

        /*
         * Keyboard hint — shown below the CTA.
         */
        .bike-360-hint {
          opacity: 0.6;
          transition: opacity 200ms;
        }

        .bike-360-viewer:focus-visible .bike-360-hint {
          opacity: 1;
        }
      `}</style>

      <div
        ref={containerRef}
        className="bike-360-viewer"
        role="region"
        aria-label={`${bikeName} 360° viewer — ${isActive ? (isPlaying ? 'playing' : 'paused') : 'inactive'}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-inverse)',
          border: '1px solid var(--color-border-hairline)',
          cursor: isActive ? 'default' : 'pointer',
        }}
        onClick={!isActive ? activate : undefined}
        aria-pressed={isActive}
      >
        {/* ── Poster image (always in DOM, hidden when active) ──── */}
        {/*
         * The poster overlays the video container.
         * Fades out after activation (opacity transition via isActive state).
         * Next.js Image with fill to match the container's aspect ratio.
         */}
        <div
          className={isActive ? undefined : 'bike-360-poster'}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: isActive ? 0 : 2,
            opacity: isActive ? 0 : 1,
            pointerEvents: isActive ? 'none' : 'auto',
            transition: 'opacity 300ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <Image
            src={posterUrl}
            alt={`${bikeName} — 360° viewer poster`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1440px) 65vw, 900px"
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            placeholder={posterBlurUrl ? 'blur' : 'empty'}
            blurDataURL={posterBlurUrl ?? DEFAULT_BLUR}
          />

          {/*
           * Dark overlay over the poster — ensures CTA text is legible
           * regardless of the poster image brightness.
           */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(14,15,18,0.42)',
            }}
          />
        </div>

        {/* ── 360° spin video (always in DOM, hidden when inactive) ── */}
        {/*
         * The video is always present but hidden (opacity 0, pointer events none)
         * until activated. This pre-buffers the video for instant playback.
         *
         * Attributes:
         *   muted:       required for autoplay on all browsers
         *   loop:        spin videos should loop continuously
         *   playsInline: prevents iOS from going fullscreen on play
         *   preload:     'auto' — start downloading immediately
         */}
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setIsLoading(false)}
          onLoadedData={() => setIsLoading(false)}
          onError={() => {
            setHasError(true)
            setIsActive(false)
            setIsLoading(false)
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            zIndex: isActive ? 1 : 0,
            opacity: isActive ? 1 : 0,
            transition: 'opacity 300ms cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: isActive ? 'auto' : 'none',
          }}
        />

        {/* ── Loading spinner (shown during buffering) ────────────── */}
        {isActive && isLoading && !hasError && (
          <div
            aria-label="Loading 360° video"
            role="status"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(14,15,18,0.5)',
            }}
          >
            <div
              className="bike-360-spinner"
              aria-hidden="true"
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255,255,255,0.25)',
                borderTopColor: 'rgba(255,255,255,0.9)',
                borderRadius: '999px',
              }}
            />
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {hasError && (
          <div
            role="alert"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: 'rgba(14,15,18,0.72)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                margin: 0,
              }}
            >
              Unable to load 360° view
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
                margin: 0,
              }}
            >
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setHasError(false)
                activate()
              }}
              className="bike-360-cta"
              style={{
                marginTop: '8px',
                height: '36px',
                padding: '0 16px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'background-color 200ms, transform 200ms',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Inactive CTA button ────────────────────────────────── */}
        {!isActive && !hasError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              pointerEvents: 'none',
            }}
          >
            {/*
             * Activation button.
             * Large, pill-shaped, brand-accent background.
             * pointerEvents: auto on the button so it captures clicks
             * without the container's onClick firing twice.
             */}
            <button
              type="button"
              className="bike-360-cta"
              aria-label={`Activate 360° view for ${bikeName}`}
              onClick={(e) => {
                e.stopPropagation()
                activate()
              }}
              style={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                height: '52px',
                padding: '0 28px',
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: accentColor,
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(14,15,18,0.4)',
                transition:
                  'background-color 200ms cubic-bezier(0.4,0,0.2,1), ' +
                  'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
                letterSpacing: '0.01em',
              }}
            >
              {/*
               * 360° icon — a circular arrow suggesting rotation.
               * Using the Icon component with the closest available icon,
               * supplemented by the text label.
               */}
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                360°
              </span>
              View in 360°
            </button>

            {/*
             * Keyboard hint — shown below the CTA button.
             * Subtle guide for keyboard users.
             */}
            <p
              className="bike-360-hint"
              aria-hidden="true"
              style={{
                pointerEvents: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.6)',
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              Press Space or Enter to activate
            </p>
          </div>
        )}

        {/* ── Active controls overlay ────────────────────────────── */}
        {isActive && !isLoading && !hasError && (
          <>
            {/*
             * Play/Pause button — top-right corner.
             */}
            <button
              type="button"
              className="bike-360-ctrl"
              aria-label={isPlaying ? 'Pause 360° view' : 'Play 360° view'}
              onClick={(e) => {
                e.stopPropagation()
                togglePlayPause()
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: supportsFullscreen ? '60px' : '12px',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: 'rgba(14,15,18,0.52)',
                border: 'none',
                cursor: 'pointer',
                color: '#FFFFFF',
                transition: 'background-color 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <span
  style={{
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1,
  }}
>
  {isPlaying ? '⏸' : '▶'}
</span>
            </button>

            {/*
             * Fullscreen button — top-right corner (beside play/pause).
             * Hidden when fullscreen is not supported.
             */}
            {supportsFullscreen && (
              <button
                type="button"
                className="bike-360-ctrl"
                aria-label="Toggle fullscreen"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFullscreen()
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(14,15,18,0.52)',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#FFFFFF',
                  transition:
                    'background-color 200ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
               <span
  style={{
    fontSize: '16px',
    lineHeight: 1,
  }}
>
  ⛶
</span>
              </button>
            )}

            {/*
             * Close/Back button — top-left corner.
             * Returns to the poster state.
             */}
            <button
              type="button"
              className="bike-360-ctrl"
              aria-label="Exit 360° view"
              onClick={(e) => {
                e.stopPropagation()
                deactivate()
              }}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: 'rgba(14,15,18,0.52)',
                border: 'none',
                cursor: 'pointer',
                color: '#FFFFFF',
                transition:
                  'background-color 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Icon name="close" size={16} strokeWidth={2} />
            </button>

            {/*
             * 360° badge — bottom-right corner.
             * Persistent identifier so the user knows what they're watching.
             * Matches the BikeGallery counter badge visual style.
             */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                zIndex: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '26px',
                padding: '0 10px',
                backgroundColor: 'rgba(14,15,18,0.62)',
                borderRadius: '999px',
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.01em',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '10px', letterSpacing: '0.04em' }}>↻</span>
              360°
            </div>

            {/*
             * Keyboard hint — shown when the viewer is focused.
             * Bottom-left, subtly styled.
             */}
            <div
              className="bike-360-hint"
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                zIndex: 4,
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
                userSelect: 'none',
                letterSpacing: '0.02em',
              }}
            >
              Space: play/pause · Esc: exit
            </div>
          </>
        )}
      </div>
    </>
  )
}