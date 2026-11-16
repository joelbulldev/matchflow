import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { appNavigate } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { applyAuthSession, type LoginPayload } from '@/lib/session'
import { toast } from '@/lib/toast'

export async function loginAsDemoUser(qc: QueryClient) {
  const session = await api<LoginPayload>('/auth/demo', { method: 'POST' })
  await applyAuthSession(qc, session)
  toast.success('Welcome to the demo workspace', 'Sample invoices, bills, and payment links are ready to explore.')
  await appNavigate(routes.overview)
}
