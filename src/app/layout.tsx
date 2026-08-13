import type { Metadata } from 'next'
import './globals.css'
import { getSiteUrl } from '@/lib/seo/site-url'

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
