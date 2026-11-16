import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { METRIC_PERIODS, metricPeriodLabel, type MetricPeriod } from '@/lib/analytics-period'
import { useMetricsPeriod } from '@/contexts/metrics-period'
import { cn } from '@/lib/utils'

const TAB_LABELS: Record<MetricPeriod, string> = {
  '7d': '7D',
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  all: 'All',
}

export function MetricPeriodTabs({ className }: { className?: string }) {
  const { period, setPeriod } = useMetricsPeriod()
  return (
    <Tabs
      value={period}
      onValueChange={(v) => setPeriod(v as MetricPeriod)}
      className={cn('w-auto', className)}
    >
      <TabsList className="h-8 gap-0.5 bg-muted/60 p-0.5" aria-label="Metric time period">
        {METRIC_PERIODS.map((p) => (
          <TabsTrigger
            key={p}
            value={p}
            className="h-7 px-2.5 text-xs font-medium data-[state=active]:shadow-sm"
            title={metricPeriodLabel(p)}
          >
            {TAB_LABELS[p]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}