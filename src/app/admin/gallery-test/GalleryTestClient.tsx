'use client'

import { useState } from 'react'
import GalleryUploader, {
  type GalleryChangeItem,
  type GalleryInitialItem,
} from '@/components/admin/GalleryUploader'

const EXISTING_ITEMS: GalleryInitialItem[] = [
  {
    secureUrl:
      'https://res.cloudinary.com/demo/image/upload/w_800,h_600/sample.jpg',
    publicId: 'motohub360/bikes/gallery/royal-enfield-gt-650-gallery-1',
  },
  {
    secureUrl:
      'https://res.cloudinary.com/demo/image/upload/w_800,h_600/samples/landscapes/beach-boat.jpg',
    publicId: 'motohub360/bikes/gallery/royal-enfield-gt-650-gallery-2',
  },
]

export default function GalleryTestClient() {
  const [gallery, setGallery] = useState<GalleryChangeItem[]>([])

  return (
    <div className="admin-page-content" style={{ maxWidth: '680px' }}>
      <div className="admin-page-header">
        <h1>A-07.4 — GalleryUploader Test</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>

        {/* Test 1: Empty gallery — upload from scratch */}
        <div>
          <p
            className="bike-section-label"
            style={{ marginBottom: '12px' }}
          >
            Test 1 — Empty gallery (minImages=2, maxImages=6)
          </p>
          <GalleryUploader
            brandSlug="royal-enfield"
            slug="gt-650"
            minImages={2}
            maxImages={6}
            label="Bike Gallery"
            hint="Show the motorcycle from multiple angles."
            onChange={(items) => {
              console.log('[Test 1] Gallery changed:', items.length, 'items')
            }}
          />
        </div>

        {/* Test 2: Pre-populated gallery (edit mode) */}
        <div>
          <p
            className="bike-section-label"
            style={{ marginBottom: '12px' }}
          >
            Test 2 — Pre-populated (edit mode, initialItems)
          </p>
          <GalleryUploader
            brandSlug="royal-enfield"
            slug="gt-650"
            initialItems={EXISTING_ITEMS}
            maxImages={4}
            label="Replace / Add Gallery Images"
            onChange={(items) => {
              console.log('[Test 2] Gallery changed:', items.length, 'items')
              setGallery(items)
            }}
          />
        </div>

        {/* Test 3: Disabled */}
        <div>
          <p
            className="bike-section-label"
            style={{ marginBottom: '12px' }}
          >
            Test 3 — Disabled state
          </p>
          <GalleryUploader
            brandSlug="royal-enfield"
            slug="gt-650"
            initialItems={[EXISTING_ITEMS[0]]}
            disabled
            label="Gallery (read-only)"
            onChange={() => {}}
          />
        </div>

        {/* onChange output */}
        {gallery.length > 0 && (
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-hairline)',
              borderRadius: '10px',
            }}
          >
            <p
              className="bike-section-label"
              style={{ marginBottom: '8px' }}
            >
              Test 2 — Current Gallery State
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
              {JSON.stringify(
                gallery.map((item, i) => ({
                  position: i + 1,
                  publicId: item.publicId ?? '(none)',
                  hasBlur: !!item.blurDataUrl,
                })),
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}