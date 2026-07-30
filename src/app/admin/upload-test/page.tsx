import { requireAdminSession } from '@/lib/auth'
import UploadTestClient from './UploadTestClient'

export default async function UploadTestPage() {
  await requireAdminSession()
  return <UploadTestClient />
}