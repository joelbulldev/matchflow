import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type BootstrapOrg = {
  currentOrganizationId: number | null
  organizations?: Array<{ id: number; name: string }>
}

export function useOrgId() {
  const q = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<BootstrapOrg>('/bootstrap'),
    staleTime: 15_000,
  })
  return {
    orgId: q.data?.currentOrganizationId ?? null,
    organizations: q.data?.organizations ?? [],
    isLoading: q.isLoading,
    needsOrg: !q.isLoading && q.data && !q.data.currentOrganizationId && !(q.data.organizations?.length),
    refetch: () => q.refetch(),
  }
}
