import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { readMetricPeriod, writeMetricPeriod, type MetricPeriod } from '@/lib/analytics-period'

type MetricsPeriodContextValue = {
  period: MetricPeriod
  setPeriod: (p: MetricPeriod) => void
}

const MetricsPeriodContext = createContext<MetricsPeriodContextValue | null>(null)

export function MetricsPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<MetricPeriod>(() => readMetricPeriod())
  const value = useMemo(
    () => ({
      period,
      setPeriod: (p: MetricPeriod) => {
        setPeriodState(p)
        writeMetricPeriod(p)
      },
    }),
    [period],
  )
  return <MetricsPeriodContext.Provider value={value}>{children}</MetricsPeriodContext.Provider>
}

export function useMetricsPeriod(): MetricsPeriodContextValue {
  const ctx = useContext(MetricsPeriodContext)
  if (!ctx) {
    return {
      period: 'all',
      setPeriod: () => {},
    }
  }
  return ctx
}