'use client'

import { useState } from 'react'
import MediaUploader from '@/components/admin/MediaUploader'
import type { CloudinaryUploadResult } from '@/types/cloudinary'
export default function UploadTestClient() {
  const [lastResult, setLastResult] = useState<CloudinaryUploadResult | null>(null)
  const [blurLength, setBlurLength] = useState<number | null>(null)

  function handleComplete(r: CloudinaryUploadResult, blur?: string) {
    setLastResult(r)
    setBlurLength(blur?.length ?? null)
  }

  return (
    <div className="admin-page-content" style={{ maxWidth: '560px' }}>
      <div className="admin-page-header"><h1>A-07.3 Test</h1></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div>
          <p className="bike-section-label" style={{ marginBottom: '8px' }}>
            Test 1 — bike_hero (JPG/PNG/WEBP · 8MB · min 1200×900)
          </p>
          <MediaUploader
            intent="bike_hero"
            brandSlug="royal-enfield"
            slug="gt-650"
            label="Hero Image"
            hint="Full motorcycle on a clean background."
            onUploadComplete={handleComplete}
            onUploadError={(e) => console.error(e)}
          />
        </div>

        <div>
          <p className="bike-section-label" style={{ marginBottom: '8px' }}>
            Test 2 — bike_360 (MP4/WEBM/MOV · 50MB)
          </p>
          <MediaUploader
            intent="bike_360"
            brandSlug="royal-enfield"
            slug="gt-650"
            label="360° Spin Video"
            onUploadComplete={(r) => console.log('360 uploaded:', r.public_id)}
          />
        </div>

        <div>
          <p className="bike-section-label" style={{ marginBottom: '8px' }}>
            Test 3 — with currentUrl
          </p>
          <MediaUploader
            intent="bike_hero"
            brandSlug="royal-enfield"
            slug="gt-650-v2"
            label="Replace Hero"
            currentUrl="https://res.cloudinary.com/demo/image/upload/sample.jpg"
            onUploadComplete={(r) => console.log('Replaced:', r.public_id)}
          />
        </div>

        <div>
          <p className="bike-section-label" style={{ marginBottom: '8px' }}>
            Test 4 — disabled
          </p>
          <MediaUploader
            intent="bike_hero"
            brandSlug="test"
            slug="test"
            disabled
            onUploadComplete={() => {}}
          />
        </div>

        {lastResult && (
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '10px',
            }}
          >
            <p className="bike-section-label" style={{ marginBottom: '8px' }}>
              Last Upload
            </p>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-ink-secondary)',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify({
                public_id:   lastResult.public_id,
                format:      lastResult.format,
                width:       lastResult.width,
                height:      lastResult.height,
                bytes:       lastResult.bytes,
                blur_chars:  blurLength,
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}