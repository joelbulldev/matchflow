import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type AnalyticsSegment = {
  label: string
  value: number
  amount?: string
}

export type AnalyticsChart = {
  id: string
  title: string
  description?: string
  segments: AnalyticsSegment[]
}

export type AnalyticsMetric = {
  id: string
  label: string
  value: string
  kind: 'money' | 'count'
  hint?: string
}

export type ModuleAnalyticsPayload = {
  module: string
  context: string
  period?: string
  periodLabel?: string
  metrics: AnalyticsMetric[]
  charts: AnalyticsChart[]
}

export function useModuleAnalytics(
  orgId: number | null,
  module: string,
  context = 'default',
  period = 'all',
) {
  return useQuery({
    queryKey: ['module-analytics', orgId, module, context, period],
    enabled: !!orgId,
    queryFn: () =>
      api<ModuleAnalyticsPayload>(
        `/dashboard/analytics/${module}?context=${encodeURIComponent(context)}&period=${encodeURIComponent(period)}`,
        {},
        orgId,
      ),
    staleTime: 20_000,
  })
}
