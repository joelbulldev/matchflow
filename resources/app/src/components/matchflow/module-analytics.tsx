import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, Clock, FileWarning, Package, Scale, Users, Wallet,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AmountDisplay, MetricCard, MetricStrip, ModuleInsightsPanel } from '@/components/matchflow'
import { mfToast } from '@/lib/mutation-feedback'
import { DistributionChartPro, DonutChartPro } from '@/components/matchflow/analytics-charts'
import { InsightsSkeleton } from '@/components/matchflow/module-analytics-skeleton'
import { useMetricsPeriod } from '@/contexts/metrics-period'
import { useModuleAnalytics } from '@/hooks/use-module-analytics'
import { api } from '@/lib/api-client'
import { AgingSummaryChart } from '@/components/matchflow/module-analytics-aging'

const METRIC_ICONS: Record<string, LucideIcon> = {
  receivables: ArrowUpRight,
  collected: Banknote,
  pending_settlements: Clock,
  overdue: AlertTriangle,
  active_links: Wallet,
  payables: ArrowDownLeft,
  exceptions: FileWarning,
  paid: CheckCircle2,
  bills: Scale,
  pending_approvals: Clock,
  pending: Clock,
  suppliers: Users,
  customers: Users,
  open_pos: Package,
  grn: Package,
  incoming: ArrowUpRight,
  outgoing: ArrowDownLeft,
  matched: CheckCircle2,
  unmatched: Clock,
  total: Scale,
}

export { InsightsSkeleton } from '@/components/matchflow/module-analytics-skeleton'
export { AgingSummaryChart } from '@/components/matchflow/module-analytics-aging'

export function ModuleAnalyticsPanel({
  orgId,
  module,
  context = 'default',
  chartLayout = 'auto',
}: {
  orgId: number | null
  module: string
  context?: string
  chartLayout?: 'auto' | 'bar' | 'donut'
}) {
  const { period } = useMetricsPeriod()
  const q = useModuleAnalytics(orgId, module, context, period)
  const lastError = useRef<string | null>(null)
  useEffect(() => {
    if (q.isError) {
      const message = (q.error as Error).message
      if (message !== lastError.current) {
        lastError.current = message
        mfToast.error('Analytics unavailable', message)()
      }
    } else {
      lastError.current = null
    }
  }, [q.isError, q.error])
  if (q.isLoading) return <InsightsSkeleton />
  if (q.isError) return null
  if (!q.data?.metrics?.length) return null

  const useDonut = chartLayout === 'donut' || (chartLayout === 'auto' && (q.data.charts?.length === 1))

  return (
    <ModuleInsightsPanel className="mb-6">
      <MetricStrip>
        {q.data.metrics.map((m) => (
          <MetricCard
            key={m.id}
            icon={METRIC_ICONS[m.id] ?? Scale}
            label={m.label}
            hint={m.hint}
            value={m.kind === 'money' ? <AmountDisplay value={m.value} /> : m.value}
          />
        ))}
      </MetricStrip>
      {q.data.charts?.length ? (
        <div className={cnCharts(q.data.charts.length)}>
          {q.data.charts.map((chart) =>
            useDonut ? (
              <DonutChartPro key={chart.id} chart={chart} />
            ) : (
              <DistributionChartPro key={chart.id} chart={chart} />
            ),
          )}
        </div>
      ) : null}
    </ModuleInsightsPanel>
  )
}

function cnCharts(n: number) {
  if (n === 0) return ''
  return 'grid gap-5 lg:grid-cols-2'
}

export function ReportsHubMetrics({ orgId }: { orgId: number | null }) {
  const { period } = useMetricsPeriod()
  const panel = useModuleAnalytics(orgId, 'reports', 'default', period)
  if (panel.isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[7.5rem] rounded-xl border border-border/80 bg-card" />
        ))}
      </div>
    )
  }
  if (!panel.data?.metrics?.length) return null
  return (
    <ModuleInsightsPanel className="mb-6">
      <MetricStrip>
        {panel.data.metrics.map((m) => (
          <MetricCard
            key={m.id}
            icon={METRIC_ICONS[m.id] ?? Scale}
            label={m.label}
            hint={m.hint}
            value={m.kind === 'money' ? <AmountDisplay value={m.value} /> : m.value}
          />
        ))}
      </MetricStrip>
    </ModuleInsightsPanel>
  )
}

export function ReportsHubInsights({ orgId }: { orgId: number | null }) {
  const { period } = useMetricsPeriod()
  const panel = useModuleAnalytics(orgId, 'reports', 'default', period)
  const arAging = useQuery({
    queryKey: ['report-summary', '/reports/receivables-aging', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ summary?: Record<string, string> }>('/reports/receivables-aging', {}, orgId),
    staleTime: 60_000,
    select: (d) => d.summary,
  })
  const apAging = useQuery({
    queryKey: ['report-summary', '/reports/payables-aging', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ summary?: Record<string, string> }>('/reports/payables-aging', {}, orgId),
    staleTime: 60_000,
    select: (d) => d.summary,
  })

  if (panel.isLoading) return null
  if (panel.data) {
    return (
      <ModuleInsightsPanel className="mb-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <AgingSummaryChart summary={arAging.data} title="Customer balances" />
          <AgingSummaryChart summary={apAging.data} title="Supplier balances" />
        </div>
      </ModuleInsightsPanel>
    )
  }
  return null
}

/** @deprecated use ModuleAnalyticsPanel */
export function ReceivablesInsightsLoader({ orgId, context = 'default' }: { orgId: number | null; context?: string }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="receivables" context={context} />
}

export function PayablesInsights({ orgId, context = 'default' }: { orgId: number | null; context?: string }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="payables" context={context} chartLayout="bar" />
}

export function ProcurementInsightsLoader({ orgId, context = 'default' }: { orgId: number | null; context?: string }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="procurement" context={context} />
}

export function ApprovalsInsights({ orgId }: { orgId: number | null }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="approvals" chartLayout="donut" />
}

export function PaymentsInsights({ orgId }: { orgId: number | null }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="payments" chartLayout="bar" />
}

export function ReconciliationInsights({
  orgId,
  context = 'default',
}: {
  orgId: number | null
  context?: 'default' | 'unmatched'
}) {
  return <ModuleAnalyticsPanel orgId={orgId} module="reconciliation" context={context} chartLayout="donut" />
}

export function FinanceAiInsights({ orgId }: { orgId: number | null }) {
  return <ModuleAnalyticsPanel orgId={orgId} module="finance-ai" />
}
