import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

type Bootstrap = {
  capabilities?: string[]
  currentRole?: string | null
}

export function useCapabilities() {
  const q = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<Bootstrap & { currentOrganizationId: number | null }>('/bootstrap'),
  })
  const caps = q.data?.capabilities ?? []
  const role = q.data?.currentRole ?? null
  function can(capability: string): boolean {
    return caps.includes('*') || caps.includes(capability)
  }
  return { can, role, caps, isLoading: q.isLoading }
}
