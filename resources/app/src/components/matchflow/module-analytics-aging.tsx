import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DistributionChartPro } from '@/components/matchflow/analytics-charts'
import type { AnalyticsChart } from '@/hooks/use-module-analytics'

const AGING_BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  days_1_30: '1–30 days',
  days_31_60: '31–60 days',
  days_61_90: '61–90 days',
  days_90_plus: '90+ days',
}

export function AgingSummaryChart({ summary, title = 'Aging distribution' }: { summary?: Record<string, string>; title?: string }) {
  const chart: AnalyticsChart = useMemo(() => {
    const segments = Object.keys(AGING_BUCKET_LABELS).map((key) => {
      const amount = parseFloat(String(summary?.[key] ?? '0')) || 0
      return {
        label: AGING_BUCKET_LABELS[key],
        value: amount > 0 ? amount : 0,
        amount: String(summary?.[key] ?? '0'),
      }
    })
    return {
      id: 'aging',
      title,
      description: 'Outstanding balance by due-date bucket (org-wide).',
      segments,
    }
  }, [summary, title])

  const hasBalance = chart.segments.some((s) => (s.value ?? 0) > 0)

  if (!summary) {
    return (
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>Loading aging buckets…</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">—</CardContent>
      </Card>
    )
  }

  if (!hasBalance) {
    return (
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">No outstanding balance in this bucket set.</CardContent>
      </Card>
    )
  }

  return <DistributionChartPro chart={chart} />
}
