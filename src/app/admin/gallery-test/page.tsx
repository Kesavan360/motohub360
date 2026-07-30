import { requireAdminSession } from '@/lib/auth'
import GalleryTestClient from './GalleryTestClient'

export default async function GalleryTestPage() {
  await requireAdminSession()
  return <GalleryTestClient />
}