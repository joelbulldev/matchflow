export const METRIC_PERIODS = ['7d', '1m', '3m', '6m', 'all'] as const
export type MetricPeriod = (typeof METRIC_PERIODS)[number]

const STORAGE_KEY = 'mf_metric_period'

export function metricPeriodLabel(period: MetricPeriod): string {
  switch (period) {
    case '7d':
      return 'Last 7 days'
    case '1m':
      return 'Last month'
    case '3m':
      return 'Last 3 months'
    case '6m':
      return 'Last 6 months'
    default:
      return 'All time'
  }
}

export function readMetricPeriod(): MetricPeriod {
  if (typeof window === 'undefined') return 'all'
  const raw = localStorage.getItem(STORAGE_KEY)
  return METRIC_PERIODS.includes(raw as MetricPeriod) ? (raw as MetricPeriod) : 'all'
}

export function writeMetricPeriod(period: MetricPeriod) {
  localStorage.setItem(STORAGE_KEY, period)
}