import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, ChevronLeft, ChevronRight, FilterX, Inbox, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatMoney } from '@/lib/utils'
import { MatchRunPanel } from './structured-views'

export function PageHeader({
  title,
  description,
  actions,
  kpiPeriod,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** Desktop: period control aligned with title row (use with module KPI strips). */
  kpiPeriod?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 mf-enter lg:mb-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 lg:items-center">
        <div className="min-w-0 max-w-3xl space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">{title}</h1>
          {description ? <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {kpiPeriod ? <div className="hidden lg:block">{kpiPeriod}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {kpiPeriod ? <div className="flex justify-end lg:hidden">{kpiPeriod}</div> : null}
    </div>
  )
}

export function AmountDisplay({ value, currency = 'USD', className }: { value: string | number; currency?: string; className?: string }) {
  return <span className={cn('font-mono-money font-medium', className)}>{formatMoney(value, currency)}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  let variant: 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'default' = 'secondary'
  if (['paid', 'success', 'approved', 'matched', 'passed', 'verified', 'active'].some((k) => s.includes(k))) variant = 'success'
  else if (['pending', 'draft', 'processing', 'incomplete', 'overdue', 'exception', 'warning'].some((k) => s.includes(k))) variant = 'warning'
  else if (['failed', 'rejected', 'refunded', 'void'].some((k) => s.includes(k))) variant = 'destructive'
  else if (['issued', 'open', 'known'].some((k) => s.includes(k))) variant = 'info'
  return <Badge variant={variant} className="capitalize">{status.replaceAll('_', ' ') || '—'}</Badge>
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
}) {
  return (
    <Card className="mf-enter border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-5">
        <p className="text-xs leading-relaxed text-muted-foreground min-h-[2.5rem]">{hint || '\u00a0'}</p>
      </CardContent>
    </Card>
  )
}

export function MetricStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-5 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
}

/** Consistent spacing between KPI strip and chart cards on module pages */
export function ModuleInsightsPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('mf-insights-panel', className)}>{children}</section>
}

export function ActionLinkCard({
  title,
  description,
  to,
  icon: Icon,
  variant = 'outline',
  layout = 'tile',
}: {
  title: string
  description?: string
  to: string
  icon: LucideIcon
  variant?: 'default' | 'outline'
  layout?: 'list' | 'tile'
}) {
  const isPrimary = variant === 'default'
  if (layout === 'list') {
    return (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm transition-colors hover:bg-muted/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 ring-1 ring-border/60">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </span>
      </Link>
    )
  }
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-[4.75rem] items-center gap-3 rounded-xl px-4 py-3.5 shadow-sm transition-[transform,box-shadow] duration-150',
        isPrimary
          ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/92'
          : 'border border-border/90 bg-card hover:border-primary/25 hover:bg-muted/30',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          isPrimary ? 'bg-primary-foreground/15' : 'bg-muted/70 ring-1 ring-border/70',
        )}
      >
        <Icon className={cn('size-4', isPrimary ? 'text-primary-foreground' : 'text-primary')} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold leading-tight', isPrimary ? 'text-primary-foreground' : 'text-foreground')}>{title}</span>
        {description ? (
          <span className={cn('mt-0.5 block text-xs leading-snug', isPrimary ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
            {description}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="border border-dashed border-border/90 bg-card shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground"><Inbox className="size-5" /></div>
        <div>
          <h3 className="font-medium">{title}</h3>
          {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? (
          <div className="flex flex-wrap items-center justify-center gap-2 [&_.inline-flex]:min-h-10 [&_a.inline-flex]:h-10">
            {action}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function LivePollingBadge({ active, label = 'Updating live' }: { active: boolean; label?: string }) {
  if (!active) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1 space-y-2">
          <AlertDescription>{message}</AlertDescription>
          {onRetry ? <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="size-3.5" /> Retry</Button> : null}
        </div>
      </div>
    </Alert>
  )
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  )
}

export function MetricStripSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-border/80 shadow-sm">
          <CardHeader className="space-y-3 pb-0">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32" />
          </CardHeader>
          <CardContent className="pt-2">
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function ListTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm" aria-busy="true" aria-label="Loading table">
      <CardContent className="space-y-3 p-0 pt-2">
        <Skeleton className="mx-3 h-10 w-[calc(100%-1.5rem)] rounded-lg" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="mx-3 h-11 w-[calc(100%-1.5rem)] rounded-md" />
        ))}
      </CardContent>
    </Card>
  )
}

export function PageSkeleton({ withMetrics = true }: { withMetrics?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withMetrics ? <MetricStripSkeleton /> : null}
      <ListTableSkeleton />
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card aria-busy="true" aria-label="Loading form">
      <CardContent className="space-y-4 pt-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  )
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]" aria-busy="true">
      <Card><CardContent className="space-y-3 pt-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
      <Card><CardContent className="space-y-3 pt-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
    </div>
  )
}

export function KeyValueList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-right font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function DataTable({
  columns,
  rows,
  emptyTitle = 'No records yet',
  emptyDescription,
  filterActive = false,
  filteredEmptyTitle = 'No matches for these filters',
  filteredEmptyDescription = 'Try adjusting search or status filters.',
  onClearFilters,
  emptyAction,
  paginate = true,
  defaultPageSize = 25,
  server,
}: {
  columns: Array<{ key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode; className?: string }>
  rows: Array<Record<string, unknown>>
  emptyTitle?: string
  emptyDescription?: string
  filterActive?: boolean
  filteredEmptyTitle?: string
  filteredEmptyDescription?: string
  onClearFilters?: () => void
  emptyAction?: ReactNode
  paginate?: boolean
  defaultPageSize?: number
  server?: {
    total: number
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange: (size: number) => void
  }
}) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const serverMode = !!server
  const totalCount = Math.max(
    0,
    Number(serverMode ? server.total : rows.length) || 0,
  )
  const activePageSize = serverMode ? server.pageSize : pageSize
  const activePage = serverMode ? server.page : page

  const totalPages = Math.max(1, Math.ceil(totalCount / activePageSize))
  const safePage = Math.min(activePage, totalPages - 1)

  const visibleRows = useMemo(() => {
    if (serverMode) return rows
    if (!paginate || rows.length <= activePageSize) return rows
    const start = safePage * activePageSize
    return rows.slice(start, start + activePageSize)
  }, [serverMode, paginate, activePageSize, rows, safePage])

  if (!rows.length) {
    const title = filterActive ? filteredEmptyTitle : emptyTitle
    const description = filterActive ? filteredEmptyDescription : emptyDescription
    return (
      <EmptyState
        title={title}
        description={description}
        action={
          filterActive && onClearFilters ? (
            <Button type="button" variant="outline" onClick={onClearFilters}>
              <FilterX className="size-4" aria-hidden />
              Clear filters
            </Button>
          ) : (
            emptyAction
          )
        }
      />
    )
  }

  const showPager = serverMode || (paginate && rows.length > 10)

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={c.key} className={c.className}>{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, idx) => (
            <TableRow key={String(row.id ?? idx)}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {showPager ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {totalCount} records · page {safePage + 1} of {totalPages}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(activePageSize)}
              onValueChange={(v) => {
                const n = Number(v)
                if (serverMode) server.onPageSizeChange(n)
                else {
                  setPageSize(n)
                  setPage(0)
                }
              }}
            >
              <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 0}
              onClick={() => (serverMode ? server.onPageChange(Math.max(0, safePage - 1)) : setPage((p) => Math.max(0, p - 1)))}
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => (serverMode ? server.onPageChange(Math.min(totalPages - 1, safePage + 1)) : setPage((p) => Math.min(totalPages - 1, p + 1)))}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export function QuoteCard({ title = 'Quote', children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Amounts and deposit details from the quote. Wallet activity alone is not settlement proof.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
      {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
    </Card>
  )
}

export function MatchResultCard({ result, discrepancies, ruleVersion, matchStatus }: { result: string; discrepancies?: unknown; ruleVersion?: string; matchStatus?: string }) {
  const list = Array.isArray(discrepancies) ? (discrepancies as Array<Record<string, unknown>>) : []
  return (
    <MatchRunPanel
      data={{ result, rule_version: ruleVersion, match_status: matchStatus, discrepancies: list }}
    />
  )
}

export function SettlementTimeline({
  events,
  receiptUrl,
}: {
  events: Array<Record<string, unknown>>
  receiptUrl?: string | null
}) {
  if (!events?.length) {
    return (
      <EmptyState
        title="No settlement events yet"
        description="Events appear after you commit a quote and the Intents provider reports deposit and status changes."
      />
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement timeline</CardTitle>
        <CardDescription>Append-only provider events — only verified SUCCESS updates balances.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((e, i) => (
          <div key={String(e.id ?? i)} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={String(e.normalized_status || e.provider_status || '')} />
                <span className="text-xs tabular-nums text-muted-foreground">{String(e.observed_at || '')}</span>
              </div>
              {e.provider_status ? (
                <p className="text-xs text-muted-foreground">Provider: {String(e.provider_status)}</p>
              ) : null}
            </div>
          </div>
        ))}
        {receiptUrl ? (
          <p className="pt-2 text-sm">
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Open public receipt
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EvidenceChain({ steps }: { steps: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence-to-Settlement</CardTitle>
        <CardDescription>Audit trail from document to receipt.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
              <span className="pt-0.5 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export { PayLinkActions } from './pay-link-actions'
export { PayLinkCard } from './pay-link-card'
export { SettingsContentGrid, SettingsSubnav } from './settings-subnav'
export { FormSurfaceFooter } from './form-surface-footer'
export { SettlementHubCard } from './settlement-hub-card'
export { OnboardingStepper } from './onboarding-stepper'
export { BillSettlementDrawer } from './bill-settlement-drawer'

import { NavButton } from './nav-button'

export { NavButton } from './nav-button'
export { ColorPickerField } from './color-picker-field'
export { SecuritySettingsPanel } from './security-settings-panel'

export function CreateLinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavButton to={to}>
      <Plus className="size-4" aria-hidden />
      {children}
    </NavButton>
  )
}

export { WorkspacePage, SectionCard, FilterToolbar, DetailGrid } from './surface'
export {
  AgingSummaryChart,
  ApprovalsInsights,
  FinanceAiInsights,
  ModuleAnalyticsPanel,
  PayablesInsights,
  PaymentsInsights,
  ProcurementInsightsLoader,
  ReceivablesInsightsLoader,
  ReconciliationInsights,
  ReportsHubInsights,
  ReportsHubMetrics,
} from './module-analytics'

export function AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center bg-gradient-to-b from-muted/50 via-background to-background px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/8 to-transparent" aria-hidden />
      <Card className="relative w-full max-w-md border-border/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-1 pb-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">MATCHFLOW</div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription className="text-base leading-relaxed">{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">{footer}</div> : null}
      </Card>
    </div>
  )
}

export function PublicShell({ brand = 'MATCHFLOW', children }: { brand?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 text-center text-lg font-semibold text-primary">{brand}</div>
      {children}
    </div>
  )
}
