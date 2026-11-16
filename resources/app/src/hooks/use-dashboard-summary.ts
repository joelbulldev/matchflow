import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type DashboardSummary = {
  receivablesOutstanding?: string
  payablesOutstanding?: string
  collected?: string
  paid?: string
  pendingApprovals?: number
  exceptions?: number
  pendingSettlements?: number
}

export function useDashboardSummary(orgId: number | null, period = 'all') {
  return useQuery({
    queryKey: ['dashboard', orgId, period],
    enabled: !!orgId,
    queryFn: () =>
      api<DashboardSummary>(`/dashboard/summary?period=${encodeURIComponent(period)}`, {}, orgId),
    staleTime: 30_000,
  })
}
