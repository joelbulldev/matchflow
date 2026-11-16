import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Sparkles, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatMoney } from '@/lib/utils'
import { TxHashActions } from '@/components/matchflow/tx-hash-actions'
import { settlementAssetLabel, settlementPurposeLabel } from '@/lib/settlement-labels'

function Money({ value }: { value: string }) {
  return <span className="font-mono-money font-medium">{formatMoney(value)}</span>
}

function StatusPill({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  const tone =
    s.includes('pass') || s === 'matched' || s === 'success' ? 'bg-emerald-500/15 text-emerald-700'
      : s.includes('exception') || s.includes('fail') || s === 'rejected' ? 'bg-destructive/15 text-destructive'
        : 'bg-muted text-muted-foreground'
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', tone)}>{status || '—'}</span>
}

function KV({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
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

export function asRecordRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

export function LineItemsTable({ items, emptyTitle = 'No line items' }: { items: unknown; emptyTitle?: string }) {
  const rows = asRecordRows(items)
  if (!rows.length) return <p className="text-sm text-muted-foreground">{emptyTitle}</p>
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={String(r.id ?? i)}>
              <TableCell>{String(r.description ?? '—')}</TableCell>
              <TableCell>{String(r.quantity_decimal ?? r.quantity ?? r.received_quantity_decimal ?? r.ordered_quantity_decimal ?? '—')}</TableCell>
              <TableCell className="text-right"><Money value={String(r.unit_price_decimal ?? r.unit_price ?? '0')} /></TableCell>
              <TableCell className="text-right">{r.line_total_decimal != null ? <Money value={String(r.line_total_decimal)} /> : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

const SEVERITY: Record<string, { label: string; className: string; Icon: typeof AlertTriangle }> = {
  duplicate_invoice: { label: 'Critical', className: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle },
  missing_po: { label: 'Critical', className: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle },
  missing_receipt: { label: 'High', className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
  quantity_over_received: { label: 'High', className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
  price_variance: { label: 'Variance', className: 'border-primary/30 bg-primary/5 text-primary', Icon: Info },
  missing_bill: { label: 'Critical', className: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle },
}

function discrepancySeverity(code: string) {
  return SEVERITY[code] ?? { label: 'Review', className: 'border-border bg-muted/50 text-muted-foreground', Icon: Info }
}

export type MatchRunPayload = {
  result?: string
  rule_version?: string
  match_status?: string
  discrepancies?: Array<Record<string, unknown>>
}

export function DiscrepancyList({ discrepancies }: { discrepancies?: Array<Record<string, unknown>> }) {
  const rows = discrepancies ?? []
  if (!rows.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        No discrepancies — PO, receipt, and invoice quantities align within policy.
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {rows.map((d, i) => {
        const code = String(d.code ?? 'unknown')
        const sev = discrepancySeverity(code)
        const Icon = sev.Icon
        return (
          <li key={`${code}-${i}`} className={cn('rounded-xl border p-4', sev.className)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <Icon className="size-4 shrink-0" />
                <span className="capitalize">{code.replaceAll('_', ' ')}</span>
              </div>
              <Badge variant="outline" className="bg-background/60">
                {sev.label}
              </Badge>
            </div>
            <p className="mt-2 text-sm opacity-90">{String(d.message ?? '')}</p>
            {d.item ? <p className="mt-1 text-xs opacity-75">Line: {String(d.item)}</p> : null}
            {d.financial_impact ? (
              <p className="mt-2 text-xs font-medium">
                Financial impact: <Money value={String(d.financial_impact)} />
              </p>
            ) : null}
            {d.existing_bill_id ? (
              <p className="mt-1 text-xs">Duplicate of bill #{String(d.existing_bill_id)}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function MatchRunPanel({ data }: { data: MatchRunPayload | null | undefined }) {
  if (!data) return null
  const result = String(data.result ?? '—')
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Match result</CardTitle>
          <CardDescription>Rule version {String(data.rule_version ?? '—')}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={result} />
          {data.match_status ? <StatusPill status={String(data.match_status)} /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <DiscrepancyList discrepancies={data.discrepancies as Array<Record<string, unknown>> | undefined} />
      </CardContent>
    </Card>
  )
}

export function EntityRecordPanel({ record, kind }: { record: Record<string, unknown> | null | undefined; kind: 'po' | 'grn' | 'bill' | 'customer' | 'supplier' }) {
  if (!record) return <p className="text-sm text-muted-foreground">Record not found.</p>
  const items: Array<{ label: string; value: ReactNode }> = [
    { label: 'Status', value: <StatusPill status={String(record.status ?? record.approval_status ?? '')} /> },
  ]
  if (kind === 'customer' || kind === 'supplier') {
    items.push(
      { label: 'Name', value: String(record.name ?? '—') },
      { label: 'Email', value: String(record.email ?? '—') },
      { label: 'Type', value: String(record.type ?? kind) },
      ...(kind === 'supplier' ? [{ label: 'Approved', value: record.approved ? 'Yes' : 'Pending' }] : []),
    )
  } else if (kind === 'bill') {
    items.push(
      { label: 'Invoice #', value: String(record.invoice_number ?? '—') },
      { label: 'Supplier', value: `#${String(record.supplier_id ?? '—')}` },
      { label: 'PO', value: record.purchase_order_id ? `#${String(record.purchase_order_id)}` : '—' },
      { label: 'Match', value: <StatusPill status={String(record.match_status ?? 'pending')} /> },
      { label: 'Total', value: <Money value={String(record.total_decimal ?? '0')} /> },
    )
  } else if (kind === 'po') {
    items.push(
      { label: 'PO number', value: String(record.po_number ?? record.id ?? '—') },
      { label: 'Supplier', value: `#${String(record.supplier_id ?? '—')}` },
      { label: 'Total', value: <Money value={String(record.total_decimal ?? '0')} /> },
    )
  } else {
    items.push(
      { label: 'Reference', value: String(record.receipt_reference ?? record.id ?? '—') },
      { label: 'Purchase order', value: `#${String(record.po_id ?? '—')}` },
    )
  }
  return (
    <div className="space-y-4">
      <KV items={items} />
      {kind !== 'customer' && kind !== 'supplier' ? <LineItemsTable items={record.items} /> : null}
    </div>
  )
}

export function SettlementQuotePanel({ quote }: { quote: unknown }) {
  const root = (quote ?? {}) as Record<string, unknown>
  const inner = (root.quote as Record<string, unknown> | undefined)?.quote ?? root.quote ?? root
  const q = (typeof inner === 'object' && inner ? inner : root) as Record<string, unknown>
  const deposit = String(q.depositAddress ?? root.deposit_address ?? '—')
  const memo = String(q.depositMemo ?? q.memo ?? root.deposit_memo ?? '—')
  const amountIn = String(q.amountIn ?? root.source_amount_atomic ?? '—')
  const amountOut = String(q.amountOut ?? root.destination_amount_decimal ?? '—')
  const expires = String(q.deadline ?? root.quote_expires_at ?? '—')
  const dry = Boolean(root.dry)
  const valid = root.signatureValid
  return (
    <Card className="border-primary/15">
      <CardHeader>
        <CardTitle className="text-base">{dry ? 'Quote preview (dry run)' : 'Deposit required'}</CardTitle>
        <CardDescription>
          {dry
            ? 'Dry run only — no deposit address is issued.'
            : 'This quote is valid. Approve the wallet transfer below; payment is not complete until status is SUCCESS.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <KV
          items={[
            { label: 'Deposit address', value: <span className="font-mono text-xs">{deposit}</span> },
            { label: 'Memo', value: memo === '—' ? 'None' : memo },
            { label: 'Amount in (atomic)', value: amountIn },
            { label: 'Destination amount', value: <Money value={amountOut} /> },
            { label: 'Quote expires', value: expires },
            ...(valid !== undefined ? [{ label: 'Signature', value: valid ? 'Verified' : 'Unverified' }] : []),
          ]}
        />
        <Alert>
          <AlertDescription>Wallet transfer success alone is not settlement proof — wait for SUCCESS status.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

export function FinanceAiAnswerCard({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return null
  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Sparkles className="size-5 text-primary" />
        <CardTitle className="text-base">Grounded answer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="leading-relaxed text-foreground">{String(data.answer ?? '')}</p>
        <div className="flex flex-wrap gap-2">
          {data.grounded ? <Badge variant="secondary">Dashboard-grounded</Badge> : null}
          {Array.isArray(data.sources) && data.sources.length ? (
            <Badge variant="outline">Sources: {(data.sources as string[]).join(', ')}</Badge>
          ) : null}
        </div>
        {data.note ? <p className="text-xs text-muted-foreground">{String(data.note)}</p> : null}
      </CardContent>
    </Card>
  )
}

export function CheckoutQuoteSummary({ quote }: { quote: unknown }) {
  if (!quote) return null
  return <SettlementQuotePanel quote={quote} />
}

export function PublicPaymentStatusCard({
  data,
  payToken,
  receiptToken,
}: {
  data: Record<string, unknown> | undefined
  payToken?: string
  receiptToken?: string
}) {
  if (!data) return null
  const settlement = (data.settlement ?? {}) as Record<string, unknown>
  const status = String(settlement.normalized_status ?? data.status ?? data.invoiceStatus ?? '')
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Payment progress</CardTitle>
        <StatusPill status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {['PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'INCOMPLETE_DEPOSIT', 'PROCESSING'].includes(status.toUpperCase()) ? (
          <Alert>
            <AlertDescription>
              Waiting for your on-chain deposit. If you already approved payment in your wallet, this page updates automatically.
            </AlertDescription>
          </Alert>
        ) : null}
        <KV
          items={[
            { label: 'Invoice status', value: <StatusPill status={String(data.invoiceStatus ?? '—')} /> },
            { label: 'Outstanding', value: <Money value={String(data.outstanding ?? '0')} /> },
            { label: 'Settlement', value: <StatusPill status={status || 'PENDING_DEPOSIT'} /> },
            { label: 'Deposit address', value: <span className="break-all font-mono text-xs">{String(settlement.deposit_address ?? '—')}</span> },
            { label: 'Destination tx', value: <span className="break-all font-mono text-xs">{String(settlement.destination_tx_hash ?? '—')}</span> },
            { label: 'Last update', value: String(settlement.updated_at ?? '—') },
          ]}
        />
        {payToken && receiptToken ? (
          <p className="text-sm text-muted-foreground">
            Settlement confirmed.{' '}
            <a className="font-medium text-primary underline-offset-4 hover:underline" href={`/receipt/${receiptToken}`}>
              Open receipt
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function PublicReceiptCard({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return null
  const currency = String(data.currency ?? 'USD')
  const amount = String(data.amount ?? '')
  const purposeLabel = data.purposeLabel
    ? String(data.purposeLabel)
    : settlementPurposeLabel(String(data.purpose ?? ''))
  const assetLabel = settlementAssetLabel(
    String(data.assetId ?? ''),
    String(data.assetLabel ?? ''),
  )
  const destTx = String(data.destinationTxHash ?? '')
  const sourceTx = String(data.sourceTxHash ?? '')
  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="h-1 bg-primary" aria-hidden />
      <CardHeader>
        <CardTitle>Settlement receipt</CardTitle>
        <CardDescription>Proof of successful reconciliation on-chain.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <KV
          items={[
            { label: 'Status', value: <StatusPill status={String(data.status ?? 'SUCCESS')} /> },
            { label: 'Purpose', value: purposeLabel },
            {
              label: 'Amount',
              value: amount ? (
                <span className="font-mono-money font-medium">{formatMoney(amount, currency)}</span>
              ) : (
                '—'
              ),
            },
            { label: 'Settlement asset', value: <span className="text-sm font-medium">{assetLabel}</span> },
            { label: 'Recipient', value: <span className="break-all font-mono text-xs">{String(data.recipient ?? '—')}</span> },
            { label: 'Delivery tx', value: <TxHashActions hash={destTx} title="Destination chain transaction" /> },
            { label: 'Deposit tx', value: sourceTx ? <TxHashActions hash={sourceTx} title="Payer deposit transaction" /> : <span className="text-muted-foreground">—</span> },
            { label: 'Reconciled (UTC)', value: String(data.reconciledAt ?? '—') },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function BillMatchHistoryPanel({ matchRuns }: { matchRuns: unknown }) {
  const runs = asRecordRows(matchRuns)
  if (!runs.length) return null
  const latest = runs[0]
  let discrepancies: Array<Record<string, unknown>> = []
  try {
    const raw = latest.discrepancies_json
    discrepancies = typeof raw === 'string' ? (JSON.parse(raw) as Array<Record<string, unknown>>) : asRecordRows(raw)
  } catch {
    discrepancies = []
  }
  return (
    <MatchRunPanel
      data={{
        result: String(latest.result ?? ''),
        rule_version: String(latest.rule_version ?? ''),
        match_status: undefined,
        discrepancies,
      }}
    />
  )
}
