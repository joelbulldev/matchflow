import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AmountDisplay } from '@/components/matchflow'
import type { AnalyticsChart, AnalyticsSegment } from '@/hooks/use-module-analytics'
import { cn } from '@/lib/utils'

const BAR_COLORS = ['bg-primary', 'bg-emerald-600', 'bg-sky-600', 'bg-amber-500', 'bg-violet-600', 'bg-rose-500'] as const

function segmentDisplay(seg: AnalyticsSegment): ReactNode {
  if (seg.amount !== undefined && seg.amount !== '') {
    return <AmountDisplay value={seg.amount} />
  }
  return <span className="tabular-nums">{seg.value}</span>
}

export function DistributionChartPro({
  chart,
  className,
}: {
  chart: AnalyticsChart
  className?: string
}) {
  const segments = chart.segments.filter((s) => s.value > 0 || s.amount)
  const max = Math.max(1, ...segments.map((s) => s.value))
  const total = segments.reduce((a, s) => a + s.value, 0)

  return (
    <Card className={cn('border-border/80 shadow-sm', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{chart.title}</CardTitle>
        {chart.description ? <CardDescription>{chart.description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!total ? (
          <p className="text-sm text-muted-foreground">No records in this organization yet.</p>
        ) : (
          segments.map((seg, i) => (
            <div key={`${seg.label}-${i}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium capitalize text-foreground">{seg.label.replaceAll('_', ' ')}</span>
                <span className="text-muted-foreground">{segmentDisplay(seg)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-300 ease-out', BAR_COLORS[i % BAR_COLORS.length])}
                  style={{ width: `${Math.max(6, (seg.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function DonutChartPro({ chart, className }: { chart: AnalyticsChart; className?: string }) {
  const slices = useMemo(() => chart.segments.filter((s) => s.value > 0), [chart.segments])
  const total = slices.reduce((a, s) => a + s.value, 0)
  const gradient = useMemo(() => {
    if (!total) return 'conic-gradient(hsl(var(--muted)) 0deg 360deg)'
    let angle = 0
    const parts: string[] = []
    slices.forEach((s, i) => {
      const sweep = (s.value / total) * 360
      const color = i === 0 ? 'hsl(var(--primary))' : i === 1 ? '#059669' : i === 2 ? '#d97706' : '#6366f1'
      parts.push(`${color} ${angle}deg ${angle + sweep}deg`)
      angle += sweep
    })
    return `conic-gradient(${parts.join(', ')})`
  }, [slices, total])

  return (
    <Card className={cn('border-border/80 shadow-sm', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{chart.title}</CardTitle>
        {chart.description ? <CardDescription>{chart.description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {!total ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="relative size-32 shrink-0 rounded-full shadow-inner ring-4 ring-background"
              style={{ background: gradient }}
              role="img"
              aria-label={chart.title}
            >
              <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-card text-center">
                <span className="text-lg font-semibold tabular-nums">{total}</span>
              </div>
            </div>
            <ul className="w-full space-y-2 text-sm">
              {slices.map((s, i) => (
                <li key={s.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 capitalize">
                    <span className={cn('size-2 rounded-full', BAR_COLORS[i % BAR_COLORS.length])} aria-hidden />
                    {s.label.replaceAll('_', ' ')}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
