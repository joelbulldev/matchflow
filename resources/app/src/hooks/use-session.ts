import { useQuery } from '@tanstack/react-query'
import { api, getBootstrap } from '@/lib/api-client'
import { useNearAuth } from '@/auth/NearAuthContext'

export function useSession() {
  const { user: authUser, isAuthenticated } = useNearAuth()
  const bootUser = getBootstrap().user

  const bootstrap = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () =>
      api<{
        authenticated: boolean
        currentOrganizationId: number | null
        organizations: Array<{ id: number; name: string }>
        user: typeof bootUser
      }>('/bootstrap'),
    staleTime: 20_000,
  })

  const user = authUser ?? bootstrap.data?.user ?? bootUser
  const orgId = bootstrap.data?.currentOrganizationId ?? null
  const needsWorkspace = !!user && !orgId && (bootstrap.data?.organizations?.length ?? 0) === 0

  return {
    user,
    orgId,
    isAuthenticated: isAuthenticated || bootstrap.data?.authenticated || !!bootUser,
    needsWorkspace,
    organizations: bootstrap.data?.organizations ?? [],
    isLoading: bootstrap.isLoading,
    refetchBootstrap: () => bootstrap.refetch(),
  }
}
