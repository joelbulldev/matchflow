import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/matchflow'
import { MetricPeriodTabs } from '@/components/matchflow/metric-period-tabs'
import { useMetricsPeriod } from '@/contexts/metrics-period'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'
import { triggerCsvDownload } from '@/lib/report-csv'

export function ReportExportDialog({
  orgId,
  reportKey,
  reportTitle,
  open,
  onOpenChange,
}: {
  orgId: number | null
  reportKey: string | null
  reportTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { period } = useMetricsPeriod()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (reportKey === 'collections') {
      if (fromDate) p.set('from', fromDate)
      if (toDate) p.set('to', toDate)
      else if (period !== 'all' && !fromDate) p.set('period', period)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [reportKey, fromDate, toDate, period])

  const exportCsv = useMutation({
    mutationFn: () => api<{ csv?: string; filename?: string }>(`/reports/${reportKey}/export${qs}`, { method: 'POST' }, orgId),
    onSuccess: (data) => {
      if (triggerCsvDownload(data)) {
        mfToast.success('Export ready')()
        onOpenChange(false)
      }
    },
    onError: mfToast.error('Export failed'),
  })

  const showRange = reportKey === 'collections'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {reportTitle}</DialogTitle>
          <DialogDescription>Download a CSV snapshot from your live ledger. Void and cancelled obligations are excluded where applicable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FormField label="KPI period" hint="Collections use this window when custom dates are empty.">
            <MetricPeriodTabs />
          </FormField>
          {showRange ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="From">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </FormField>
              <FormField label="To">
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </FormField>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">This report exports the current in-app view (filters on the report page still apply when you export from there).</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!orgId || !reportKey || exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            <Download className="size-4" aria-hidden />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}