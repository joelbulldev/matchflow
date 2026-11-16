import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Ban, Bell, Check, CheckCircle2, ClipboardCheck, Clock, Download, FileDown, FileText, Hash, KeyRound,
  Link2, Loader2, LogIn, Mail, MessageSquare, Package, Pencil, Plus, Printer, Save, Scale, Send, ShoppingCart, UserPlus, Wallet, XCircle,
} from 'lucide-react'
import { mfToast } from '@/lib/mutation-feedback'
import { downloadInvoicePdfFromBase64, openInvoicePrintablePdf } from '@/lib/invoice-pdf-client'
import {
  BillMatchHistoryPanel,
  EntityRecordPanel,
  PublicPaymentStatusCard,
  PublicReceiptCard,
} from '@/components/matchflow/structured-views'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AmountDisplay, AuthShell, ColorPickerField, CreateLinkButton, DataTable, DetailGrid, EmptyState, ErrorState, EvidenceChain, MetricCard, MetricStrip,
  FormField, KeyValueList, LivePollingBadge, LoadingBlock, NavButton, PageHeader, PageSkeleton, PayLinkActions, PayLinkCard, PublicShell,
  SectionCard, SecuritySettingsPanel, SettingsContentGrid, SettlementHubCard, SettlementTimeline, StatusBadge, BillSettlementDrawer,
  OnboardingStepper, WorkspacePage,
  ApprovalsInsights, ModuleAnalyticsPanel, PayablesInsights, PaymentsInsights, ReconciliationInsights, ReportsHubMetrics,
  ReceivablesInsightsLoader,
} from '@/components/matchflow'
import { CheckoutBrandHeader } from '@/components/matchflow/checkout-brand-header'
import { CheckoutLogoUpload } from '@/components/matchflow/checkout-logo-upload'
import { checkoutThemeStyle, resolveCheckoutAccent } from '@/lib/checkout-theme'
import { PublicCheckoutShell } from '@/components/matchflow/public-checkout-shell'
import { api } from '@/lib/api-client'
import { listItems, type Paginated } from '@/lib/paginated'
import { useCapabilities } from '@/hooks/use-capabilities'
import { useNearAuth } from '@/auth/NearAuthContext'
import { WalletTransferConfirmation } from '@/wallet'
import { validateForgotLogin, validateResetPassword } from '@/lib/auth-validation'
import { appNavigate } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/routes'
import { MetricPeriodTabs } from '@/components/matchflow/metric-period-tabs'
import { SettlementAssetSelect } from '@/components/matchflow/settlement-asset-select'
import { settlementAssetLabel } from '@/lib/settlement-labels'
import { ReportExportDialog } from '@/components/matchflow/report-export-dialog'
import { BillLinesAdjust } from '@/components/matchflow/forms/bill-lines-adjust'
import { useMetricsPeriod } from '@/contexts/metrics-period'
import { triggerCsvDownload } from '@/lib/report-csv'
import { ResponsiveFormSurface } from '@/components/matchflow/responsive-form-surface'
import { PaymentRequestCreateForm } from '@/components/matchflow/forms/payment-request-create-form'

function useOrgId() {
  const q = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<{ currentOrganizationId: number | null }>('/bootstrap'),
  })
  return q.data?.currentOrganizationId ?? null
}

function QueryFrame({ loading, error, onRetry, empty, children }: { loading?: boolean; error?: Error | null; onRetry?: () => void; empty?: boolean; children: React.ReactNode }) {
  const lastError = useRef<string | null>(null)
  useEffect(() => {
    if (error?.message && error.message !== lastError.current) {
      lastError.current = error.message
      mfToast.error('Request failed')(error)
    }
    if (!error) lastError.current = null
  }, [error])
  if (loading) return <PageSkeleton />
  if (error) return null
  if (empty) return <EmptyState title="Nothing here yet" description="Create a record to get started." />
  return <>{children}</>
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string }
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const q = useQuery({
    queryKey: ['invoice', orgId, invoiceId],
    enabled: !!orgId && !!invoiceId,
    queryFn: () => api<Record<string, unknown>>(`/receivables/invoices/${invoiceId}`, {}, orgId),
  })
  const lineRows = useMemo(() => {
    const raw = q.data?.items
    return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
  }, [q.data?.items])

  const issue = useMutation({
    mutationFn: (sendEmail?: boolean) =>
      api(`/receivables/invoices/${invoiceId}/issue`, {
        method: 'POST',
        body: JSON.stringify({ send_email: !!sendEmail }),
      }, orgId),
    onSuccess: () => {
      mfToast.success('Invoice issued', 'Payment link is ready.')()
      void q.refetch()
    },
    onError: mfToast.error('Could not issue invoice'),
  })
  const sendLink = useMutation({
    mutationFn: () =>
      api(`/receivables/invoices/${invoiceId}/notify`, {
        method: 'POST',
        body: JSON.stringify({ type: 'invoice_issued' }),
      }, orgId),
    onSuccess: mfToast.success('Payment link emailed', 'Customer notified with pay URL.'),
    onError: mfToast.error('Could not email payment link'),
  })
  const sendReminder = useMutation({
    mutationFn: () =>
      api(`/receivables/invoices/${invoiceId}/notify`, {
        method: 'POST',
        body: JSON.stringify({ type: 'invoice_reminder' }),
      }, orgId),
    onSuccess: mfToast.success('Reminder sent'),
    onError: mfToast.error('Could not send reminder'),
  })
  const voidInv = useMutation({
    mutationFn: () => api(`/receivables/invoices/${invoiceId}/void`, { method: 'POST' }, orgId),
    onSuccess: () => {
      mfToast.success('Invoice voided')()
      void q.refetch()
    },
    onError: mfToast.error('Could not void invoice'),
  })
  const pdf = useMutation({
    mutationFn: () =>
      api<{ html?: string; pdfBase64?: string; filename?: string; pdfFallback?: boolean; message?: string }>(
        `/receivables/invoices/${invoiceId}/pdf`,
        { method: 'POST' },
        orgId,
      ),
    onSuccess: (res) => {
      if (res.pdfBase64) {
        downloadInvoicePdfFromBase64(res.pdfBase64, res.filename || `invoice-${invoiceId}.pdf`)
        mfToast.success('PDF download started')()
        return
      }
      mfToast.error('PDF download unavailable', res.message || 'Install dompdf: composer install --no-dev in the plugin directory.')()
      if (res.pdfFallback && res.html) {
        openInvoicePrintablePdf(res.html, res.filename || `invoice-${invoiceId}.pdf`)
      }
    },
    onError: mfToast.error('PDF failed'),
  })
  return (
    <WorkspacePage className="min-w-0 max-w-full overflow-x-hidden">
      <PageHeader
        title={`Invoice ${String(q.data?.invoice_number ?? invoiceId)}`}
        description="Line items, payment attempts, receipts and audit history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/app/receivables/invoices/$invoiceId/edit" params={{ invoiceId }}><Pencil className="size-4" /> Edit</Link></Button>
            <Button variant="outline" onClick={() => pdf.mutate()} disabled={pdf.isPending}><FileDown className="size-4" /> PDF</Button>
            {q.data?.payment_url ? (
              <PayLinkActions
                paymentUrl={String(q.data.payment_url)}
                invoiceNumber={String(q.data?.invoice_number ?? '')}
                size="default"
              />
            ) : null}
            {can('ar.write') && q.data?.status === 'draft' ? (
              <>
                <Button onClick={() => issue.mutate(false)} disabled={issue.isPending}><Send className="size-4" /> Issue</Button>
                <Button variant="secondary" onClick={() => issue.mutate(true)} disabled={issue.isPending} title="Issue and email customer">
                  <Mail className="size-4" aria-hidden />
                  Issue &amp; email
                </Button>
              </>
            ) : null}
            {can('ar.write') && q.data?.payment_url ? (
              <>
                <Button variant="outline" onClick={() => sendLink.mutate()} disabled={sendReminder.isPending || sendLink.isPending}>
                  <Mail className="size-4" aria-hidden />
                  Email pay link
                </Button>
                {['issued', 'overdue', 'partially_paid'].includes(String(q.data?.status)) ? (
                  <Button variant="outline" onClick={() => sendReminder.mutate()} disabled={sendReminder.isPending}>
                    <Send className="size-4" aria-hidden />
                    Send reminder
                  </Button>
                ) : null}
              </>
            ) : null}
            {['issued', 'overdue', 'partially_paid'].includes(String(q.data?.status)) ? (
              <Button variant="destructive" onClick={() => voidInv.mutate()} disabled={voidInv.isPending}><Ban className="size-4" /> Void</Button>
            ) : null}
          </div>
        }
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} onRetry={() => q.refetch()}>
        <DetailGrid className="lg:grid-cols-[2fr_1fr]">
          <SectionCard title="Invoice summary" description="Amounts, customer, and lifecycle status.">
            <KeyValueList items={[
              { label: 'Status', value: <StatusBadge status={String(q.data?.status || '')} /> },
              { label: 'Customer', value: String(q.data?.customer_name || `#${String(q.data?.customer_id)}`) },
              { label: 'Customer email', value: String(q.data?.customer_email || '—') },
              { label: 'PDF theme', value: String(q.data?.brand_theme || 'classic') },
              { label: 'Due', value: String(q.data?.due_date || '—') },
              { label: 'Total', value: <AmountDisplay value={String(q.data?.total_decimal || '0')} currency={String(q.data?.currency || 'USD')} /> },
              { label: 'Outstanding', value: <AmountDisplay value={String(q.data?.amount_outstanding_decimal || '0')} /> },
            ]} />
            <DataTable
              rows={lineRows}
              emptyTitle="No line items"
              columns={[
                { key: 'description', label: 'Description', render: (r) => String(r.description ?? '—') },
                { key: 'quantity_decimal', label: 'Qty', render: (r) => String(r.quantity_decimal ?? r.quantity ?? '—') },
                { key: 'unit_price_decimal', label: 'Rate', render: (r) => <AmountDisplay value={String(r.unit_price_decimal ?? r.unit_price ?? '0')} /> },
                { key: 'line_total_decimal', label: 'Line', render: (r) => <AmountDisplay value={String(r.line_total_decimal ?? '0')} /> },
              ]}
            />
            {q.data?.notes ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{String(q.data.notes)}</p> : null}
          </SectionCard>
          <div className="min-w-0 max-w-full space-y-4">
            <PayLinkCard
              paymentUrl={q.data?.payment_url ? String(q.data.payment_url) : null}
              invoiceNumber={String(q.data?.invoice_number ?? '')}
            />
            <EvidenceChain steps={['Invoice drafted & issued', 'Public payment token', 'Quote + deposit', 'SUCCESS status + receipt']} />
          </div>
        </DetailGrid>
      </QueryFrame>
    </WorkspacePage>
  )
}

export function CustomerFormPage({ mode }: { mode: 'new' | 'detail' }) {
  const { customerId } = useParams({ strict: false }) as { customerId?: string }
  const orgId = useOrgId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const detail = useQuery({
    queryKey: ['customer', orgId, customerId],
    enabled: mode === 'detail' && !!orgId && !!customerId,
    queryFn: () => api<Record<string, string>>(`/counterparties/${customerId}`, {}, orgId),
  })
  const customerInvoices = useQuery({
    queryKey: ['customer-invoices', orgId, customerId],
    enabled: mode === 'detail' && !!orgId && !!customerId,
    queryFn: async () => {
      const rows = listItems(await api<Paginated<Record<string, unknown>>>('/receivables/invoices?limit=200', {}, orgId))
      return rows.filter((r) => String(r.customer_id) === String(customerId))
    },
  })
  useEffect(() => {
    if (detail.data) { setName(detail.data.name || ''); setEmail(detail.data.email || '') }
  }, [detail.data])
  const save = useMutation({
    mutationFn: () => api<{ id: number }>(mode === 'new' ? '/counterparties' : `/counterparties/${customerId}`, {
      method: mode === 'new' ? 'POST' : 'PATCH',
      body: JSON.stringify({ type: 'customer', name, email }),
    }, orgId),
    onSuccess: (row: { id: number }) => {
      mfToast.success(mode === 'new' ? 'Customer created' : 'Customer updated')()
      void appNavigate(`/app/receivables/customers/${row.id}`)
    },
    onError: mfToast.error('Could not save customer'),
  })
  if (mode === 'detail') {
    return (
      <WorkspacePage>
        <PageHeader title="Customer detail" description="Profile, open invoices, and collections history." />
        <QueryFrame loading={detail.isLoading} error={detail.error as Error | null} onRetry={() => detail.refetch()}>
          <DetailGrid>
            <SectionCard title="Profile">
              <EntityRecordPanel record={detail.data as Record<string, unknown>} kind="customer" />
              <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
              <FormField label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
              <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
                <Save className="size-4" aria-hidden />
                Save changes
              </Button>
            </SectionCard>
            <EvidenceChain steps={['Customer onboarded', 'Invoice issued', 'Payment link', 'Settlement', 'Receipt']} />
          </DetailGrid>
          <SectionCard title="Invoices" className="mt-5">
            <QueryFrame loading={customerInvoices.isLoading} error={customerInvoices.error as Error | null} empty={!customerInvoices.data?.length}>
              <DataTable
                rows={customerInvoices.data || []}
                emptyTitle="No invoices for this customer"
                emptyDescription="Issue an invoice from Receivables to start collections."
                columns={[
                  { key: 'invoice_number', label: 'Invoice', render: (r) => (
                    <Link className="text-primary hover:underline" to="/app/receivables/invoices/$invoiceId" params={{ invoiceId: String(r.id) }}>{String(r.invoice_number)}</Link>
                  ) },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal)} /> },
                ]}
              />
            </QueryFrame>
          </SectionCard>
        </QueryFrame>
      </WorkspacePage>
    )
  }
  return (
    <WorkspacePage>
      <PageHeader title="New customer" description="Customer profile for invoicing." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-5">
          <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            <Save className="size-4" aria-hidden />
            Save
          </Button>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}

export function SupplierFormPage({ mode }: { mode: 'new' | 'detail' }) {
  const { supplierId } = useParams({ strict: false }) as { supplierId?: string }
  const orgId = useOrgId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [assetId, setAssetId] = useState('nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near')
  const detail = useQuery({
    queryKey: ['supplier', orgId, supplierId],
    enabled: mode === 'detail' && !!orgId && !!supplierId,
    queryFn: () => api<Record<string, unknown>>(`/counterparties/${supplierId}`, {}, orgId),
  })
  const supplierBills = useQuery({
    queryKey: ['supplier-bills', orgId, supplierId],
    enabled: mode === 'detail' && !!orgId && !!supplierId,
    queryFn: async () => {
      const rows = listItems(await api<Paginated<Record<string, unknown>>>('/payables/bills?limit=200', {}, orgId))
      return rows.filter((r) => String(r.supplier_id) === String(supplierId))
    },
  })
  const supplierPos = useQuery({
    queryKey: ['supplier-pos', orgId, supplierId],
    enabled: mode === 'detail' && !!orgId && !!supplierId,
    queryFn: async () => {
      const rows = await api<Array<Record<string, unknown>>>('/procurement/purchase-orders', {}, orgId)
      return rows.filter((r) => String(r.supplier_id) === String(supplierId))
    },
  })
  useEffect(() => {
    if (detail.data) {
      setName(String(detail.data.name || ''))
      setEmail(String(detail.data.email || ''))
    }
  }, [detail.data])
  const save = useMutation({
    mutationFn: async () => {
      const row = await api<{ id: number }>(mode === 'new' ? '/counterparties' : `/counterparties/${supplierId}`, {
        method: mode === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify({ type: 'supplier', name, email, approved: true }),
      }, orgId)
      if (address) {
        await api(`/counterparties/${row.id}/addresses`, {
          method: 'POST',
          body: JSON.stringify({ chain_id: 'base', asset_id: assetId, address, status: 'verified' }),
        }, orgId)
      }
      return row
    },
    onSuccess: (row) => {
      mfToast.success(mode === 'new' ? 'Supplier created' : 'Supplier updated')()
      void appNavigate(`/app/payables/suppliers/${row.id}`)
    },
    onError: mfToast.error('Could not save supplier'),
  })
  if (mode === 'detail') {
    const addresses = Array.isArray(detail.data?.addresses)
      ? (detail.data.addresses as Array<Record<string, unknown>>)
      : []
    return (
      <WorkspacePage>
        <PageHeader
          title={String(detail.data?.name || 'Supplier')}
          description="Settlement destinations, purchase orders, and AP bills."
          kpiPeriod={<MetricPeriodTabs />}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/app/procurement/purchase-orders/new">New PO</Link>
            </Button>
          }
        />
        <PayablesInsights orgId={orgId} context="suppliers" />
        <QueryFrame loading={detail.isLoading} error={detail.error as Error | null} onRetry={() => detail.refetch()}>
          <DetailGrid>
            <SectionCard title="Vendor profile">
              <EntityRecordPanel record={detail.data as Record<string, unknown>} kind="supplier" />
              <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
              <FormField label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
              <FormField label="Settlement address" hint="Save to add a verified payout destination.">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </FormField>
              <FormField label="Settlement asset" hint="Ticker shown in the UI; OMFT asset id is stored for settlement.">
                <SettlementAssetSelect value={assetId} onChange={setAssetId} disabled={save.isPending} />
              </FormField>
              <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
                <Save className="size-4" aria-hidden />
                Save supplier
              </Button>
            </SectionCard>
            <SectionCard title="Verified addresses" description="On-chain destinations for AP settlement.">
              {addresses.length ? (
                <DataTable
                  rows={addresses}
                  columns={[
                    { key: 'chain_id', label: 'Chain' },
                    {
                      key: 'asset_id',
                      label: 'Asset',
                      render: (r) => (
                        <span className="text-sm font-medium" title={String(r.asset_id)}>
                          {settlementAssetLabel(String(r.asset_id))}
                        </span>
                      ),
                    },
                    { key: 'address', label: 'Address', render: (r) => <span className="font-mono text-xs">{String(r.address)}</span> },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  ]}
                />
              ) : (
                <EmptyState title="No addresses" description="Add a settlement address when saving profile changes." />
              )}
            </SectionCard>
          </DetailGrid>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <SectionCard title="Purchase orders">
              <QueryFrame loading={supplierPos.isLoading} error={supplierPos.error as Error | null} empty={!supplierPos.data?.length}>
                <DataTable
                  rows={supplierPos.data || []}
                  emptyTitle="No POs for this supplier"
                  columns={[
                    { key: 'po_number', label: 'PO', render: (r) => (
                      <Link className="text-primary hover:underline" to="/app/procurement/purchase-orders/$poId" params={{ poId: String(r.id) }}>{String(r.po_number)}</Link>
                    ) },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                    { key: 'total_decimal', label: 'Total', render: (r) => <AmountDisplay value={String(r.total_decimal)} /> },
                  ]}
                />
              </QueryFrame>
            </SectionCard>
            <SectionCard title="Bills">
              <QueryFrame loading={supplierBills.isLoading} error={supplierBills.error as Error | null} empty={!supplierBills.data?.length}>
                <DataTable
                  rows={supplierBills.data || []}
                  emptyTitle="No bills"
                  columns={[
                    { key: 'invoice_number', label: 'Bill', render: (r) => (
                      <Link className="text-primary hover:underline" to="/app/payables/bills/$billId" params={{ billId: String(r.id) }}>{String(r.invoice_number || `#${String(r.id)}`)}</Link>
                    ) },
                    { key: 'match_status', label: 'Match', render: (r) => <StatusBadge status={String(r.match_status)} /> },
                    { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal)} /> },
                  ]}
                />
              </QueryFrame>
            </SectionCard>
          </div>
          <div className="mt-5">
            <EvidenceChain steps={['Vendor approved', 'PO issued', 'Bill received', 'Match', 'Settlement']} />
          </div>
        </QueryFrame>
      </WorkspacePage>
    )
  }
  return (
    <WorkspacePage>
      <PageHeader title="New supplier" description="Verified destinations for AP settlement." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-5">
          <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
          <FormField label="Settlement address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></FormField>
          <FormField label="Settlement asset">
            <SettlementAssetSelect value={assetId} onChange={setAssetId} disabled={save.isPending} />
          </FormField>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            <Save className="size-4" aria-hidden />
            Save supplier
          </Button>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}

export function PaymentLinksPage() {
  const orgId = useOrgId()
  const [tab, setTab] = useState<'invoices' | 'requests'>('invoices')
  const [requestOpen, setRequestOpen] = useState(false)
  const q = useQuery({
    queryKey: ['invoices-links', orgId],
    enabled: !!orgId && tab === 'invoices',
    queryFn: async () => listItems(await api<Paginated<Record<string, string>>>('/receivables/invoices?status=issued&limit=100', {}, orgId)),
  })
  const overdue = useQuery({
    queryKey: ['invoices-links-overdue', orgId],
    enabled: !!orgId && tab === 'invoices',
    queryFn: async () => listItems(await api<Paginated<Record<string, string>>>('/receivables/invoices?status=overdue&limit=100', {}, orgId)),
  })
  const requests = useQuery({
    queryKey: ['payment-requests-links', orgId],
    enabled: !!orgId && tab === 'requests',
    queryFn: async () => listItems(await api<Paginated<Record<string, string>>>('/receivables/payment-requests?status=open&limit=100', {}, orgId)),
  })
  const invoiceRows = [...(q.data || []), ...(overdue.data || [])] as Array<Record<string, unknown>>
  const requestRows = (requests.data || []) as Array<Record<string, unknown>>
  const loading = tab === 'invoices' ? q.isLoading || overdue.isLoading : requests.isLoading
  const error = (tab === 'invoices' ? (q.error || overdue.error) : requests.error) as Error | null
  return (
    <WorkspacePage>
      <PageHeader
        title="Payment links"
        description="Checkout URLs for issued invoices or standalone payment requests — no invoice required."
        kpiPeriod={<MetricPeriodTabs />}
        actions={
          tab === 'invoices' ? (
            <CreateLinkButton to="/app/receivables/invoices/new">New invoice &amp; link</CreateLinkButton>
          ) : (
            <Button type="button" onClick={() => setRequestOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              New payment request
            </Button>
          )
        }
      />
      <ReceivablesInsightsLoader orgId={orgId} context="links" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'invoices' | 'requests')} className="mb-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoice links</TabsTrigger>
          <TabsTrigger value="requests">Standalone requests</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryFrame loading={loading} error={error}>
        {tab === 'invoices' ? (
          <DataTable
            rows={invoiceRows}
            emptyTitle="No invoice pay links"
            emptyDescription="Create an invoice, issue it, then copy the checkout URL."
            emptyAction={
              <CreateLinkButton to="/app/receivables/invoices/new">New invoice &amp; link</CreateLinkButton>
            }
            columns={[
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal)} /> },
              { key: 'amount_outstanding_decimal', label: 'Due', render: (r) => <AmountDisplay value={String(r.amount_outstanding_decimal || r.total_decimal)} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
              {
                key: 'payment_url',
                label: 'Pay link',
                render: (r) => (
                  <PayLinkActions
                    paymentUrl={String(r.payment_url || '')}
                    invoiceNumber={String(r.invoice_number || '')}
                  />
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={requestRows}
            emptyTitle="No standalone payment requests"
            emptyDescription="Collect a fixed amount without creating an invoice — ideal for deposits and one-off charges."
            emptyAction={
              <Button type="button" onClick={() => setRequestOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              New payment request
            </Button>
            }
            columns={[
              { key: 'reference', label: 'Reference' },
              { key: 'label', label: 'Title' },
              { key: 'amount_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.amount_decimal)} /> },
              { key: 'amount_outstanding_decimal', label: 'Due', render: (r) => <AmountDisplay value={String(r.amount_outstanding_decimal || r.amount_decimal)} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
              {
                key: 'payment_url',
                label: 'Pay link',
                render: (r) => (
                  <PayLinkActions
                    paymentUrl={String(r.payment_url || '')}
                    invoiceNumber={String(r.reference || r.label || '')}
                  />
                ),
              },
            ]}
          />
        )}
      </QueryFrame>
      <ResponsiveFormSurface
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Standalone payment request"
        description="Mint a public /pay/ link without an invoice."
      >
        <PaymentRequestCreateForm orgId={orgId} onCancel={() => setRequestOpen(false)} onDone={() => setRequestOpen(false)} />
      </ResponsiveFormSurface>
    </WorkspacePage>
  )
}

export function RemindersPage() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['reminders', orgId],
    enabled: !!orgId,
    queryFn: async () => listItems(await api<Paginated<Record<string, string>>>('/receivables/invoices?status=overdue&limit=100', {}, orgId)),
  })
  const { can } = useCapabilities()
  const remind = useMutation({
    mutationFn: (id: number) =>
      api(`/receivables/invoices/${id}/notify`, { method: 'POST', body: JSON.stringify({ type: 'invoice_reminder' }) }, orgId),
    onSuccess: mfToast.success('Reminder sent'),
    onError: mfToast.error('Could not send reminder'),
  })
  return (
    <WorkspacePage>
      <PageHeader title="Reminders" description="Overdue receivables — send payment reminders with outstanding balance and pay link." kpiPeriod={<MetricPeriodTabs />} />
      <ReceivablesInsightsLoader orgId={orgId} context="reminders" />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} empty={!q.data?.length}>
        <DataTable
          rows={(q.data || []) as Array<Record<string, unknown>>}
          columns={[
            { key: 'invoice_number', label: 'Invoice' },
            { key: 'customer_name', label: 'Customer', render: (r) => String(r.customer_name || '—') },
            { key: 'amount_outstanding_decimal', label: 'Outstanding', render: (r) => <AmountDisplay value={String(r.amount_outstanding_decimal || r.total_decimal)} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            {
              key: 'actions',
              label: '',
              render: (r) => can('ar.write') ? (
                <Button type="button" size="sm" variant="outline" disabled={remind.isPending} onClick={() => remind.mutate(Number(r.id))}>
                  <Bell className="size-4" aria-hidden />
                  Send reminder
                </Button>
              ) : '—',
            },
          ]}
        />
      </QueryFrame>
    </WorkspacePage>
  )
}

export function BillDetailPage() {
  const { billId } = useParams({ strict: false }) as { billId: string }
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const [settleOpen, setSettleOpen] = useState(false)
  const q = useQuery({
    queryKey: ['bill', orgId, billId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, unknown>>(`/payables/bills/${billId}`, {}, orgId),
  })
  const submitApproval = useMutation({
    mutationFn: () => api('/approvals', { method: 'POST', body: JSON.stringify({ subject_type: 'ap_bill', subject_id: Number(billId) }) }, orgId),
    onSuccess: mfToast.success('Submitted for approval'),
    onError: mfToast.error('Approval submission failed'),
  })
  return (
    <WorkspacePage>
      <PageHeader
        title={`Bill #${billId}`}
        description="Supplier document, three-way match, approvals, and NEAR Intents settlement."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/app/payables/bills/$billId/match" params={{ billId }}>Match</Link></Button>
            <Button asChild variant="outline"><Link to="/app/payables/bills/$billId/review" params={{ billId }}>Review</Link></Button>
            {can('payments.initiate') ? (
              <Button onClick={() => setSettleOpen(true)}>
                <Wallet className="size-4" aria-hidden />
                Prepare settlement
              </Button>
            ) : null}
            <Button onClick={() => submitApproval.mutate()} disabled={!can('approvals.read')}>
              <ClipboardCheck className="size-4" aria-hidden />
              Submit approval
            </Button>
          </div>
        }
      />
      <BillSettlementDrawer
        open={settleOpen}
        onOpenChange={setSettleOpen}
        billId={billId}
        orgId={orgId}
        supplierName={String(q.data?.supplier_name || '')}
        amount={String(q.data?.total_decimal || '')}
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} onRetry={() => q.refetch()}>
        <DetailGrid>
          <SectionCard title="Bill record" description="Supplier invoice and match state.">
            <KeyValueList items={[
              { label: 'Status', value: <StatusBadge status={String(q.data?.status || '')} /> },
              { label: 'Invoice #', value: String(q.data?.invoice_number || '—') },
              { label: 'Supplier', value: String(q.data?.supplier_name ?? `#${String(q.data?.supplier_id ?? '—')}`) },
              { label: 'Total', value: <AmountDisplay value={String(q.data?.total_decimal || '0')} /> },
              { label: 'Outstanding', value: <AmountDisplay value={String(q.data?.amount_outstanding_decimal || q.data?.total_decimal || '0')} /> },
              { label: 'Match', value: <StatusBadge status={String(q.data?.match_status || 'unknown')} /> },
              { label: 'Approval', value: <StatusBadge status={String(q.data?.approval_status || 'not_required')} /> },
            ]} />
            <BillLinesAdjust
              orgId={orgId}
              billId={billId}
              matchStatus={String(q.data?.match_status || '')}
              items={Array.isArray(q.data?.items) ? (q.data.items as Array<Record<string, unknown>>) : []}
            />
            <DataTable
              rows={Array.isArray(q.data?.items) ? (q.data.items as Array<Record<string, unknown>>) : []}
              emptyTitle="No lines"
              columns={[
                { key: 'description', label: 'Description' },
                { key: 'quantity_decimal', label: 'Qty', render: (r) => String(r.quantity_decimal ?? r.quantity ?? '—') },
                { key: 'unit_price_decimal', label: 'Rate', render: (r) => <AmountDisplay value={String(r.unit_price_decimal ?? r.unit_price ?? '0')} /> },
              ]}
            />
          </SectionCard>
          {Array.isArray(q.data?.documents) && (q.data.documents as Array<Record<string, unknown>>).length ? (
            <SectionCard title="Attached invoice" description="Private evidence stored for audit.">
              <ul className="space-y-2 text-sm">
                {(q.data.documents as Array<Record<string, unknown>>).map((doc) => (
                  <li key={String(doc.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 px-3 py-2">
                    <span className="font-medium">{String(doc.original_name || `Document #${doc.id}`)}</span>
                    <span className="text-xs text-muted-foreground">{String(doc.mime_type || '')}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
          <EvidenceChain steps={['Document / bill', 'Line review', 'Three-way match', 'Approval', 'Quote → SUCCESS → receipt']} />
        </DetailGrid>
      </QueryFrame>
    </WorkspacePage>
  )
}

export function BillReviewPage() {
  const { billId } = useParams({ strict: false }) as { billId: string }
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['bill-review', orgId, billId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, unknown>>(`/payables/bills/${billId}`, {}, orgId),
  })
  return (
    <WorkspacePage>
      <PageHeader
        title="Bill review"
        description="Confirm captured fields from the supplier invoice before matching."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/payables/bills/$billId/match" params={{ billId }}>Run match</Link>
          </Button>
        }
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} onRetry={() => q.refetch()}>
        <DetailGrid>
          <SectionCard title="Captured bill" description="Enter or verify line items — OCR extraction is not required for match.">
            <EntityRecordPanel record={q.data} kind="bill" />
            <BillMatchHistoryPanel matchRuns={q.data?.match_runs} />
            {Array.isArray(q.data?.documents) && (q.data.documents as Array<Record<string, unknown>>).length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {(q.data.documents as Array<Record<string, unknown>>).map((doc) => (
                  <li key={String(doc.id)} className="rounded-lg border border-border/80 px-3 py-2">
                    Attached: <span className="font-medium">{String(doc.original_name)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
          <EvidenceChain steps={['Upload scan', 'Human line review', 'Three-way match', 'Approval', 'Settlement']} />
        </DetailGrid>
      </QueryFrame>
    </WorkspacePage>
  )
}

export function PurchaseOrderFormPage({ mode }: { mode: 'new' | 'detail' }) {
  const { poId } = useParams({ strict: false }) as { poId?: string }
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const [supplierId, setSupplierId] = useState('')
  const [qty, setQty] = useState('120')
  const [price, setPrice] = useState('20')
  const detail = useQuery({
    queryKey: ['po', orgId, poId],
    enabled: mode === 'detail' && !!orgId && !!poId,
    queryFn: () => api<Record<string, unknown>>(`/procurement/purchase-orders/${poId}`, {}, orgId),
  })
  const poReceipts = useQuery({
    queryKey: ['po-grns', orgId, poId],
    enabled: mode === 'detail' && !!orgId && !!poId,
    queryFn: async () => {
      const rows = await api<Array<Record<string, unknown>>>('/procurement/goods-receipts', {}, orgId)
      return rows.filter((r) => String(r.po_id) === String(poId))
    },
  })
  const create = useMutation({
    mutationFn: () => api<{ id: number }>('/procurement/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: Number(supplierId),
        currency: 'USD',
        items: [{ description: 'Solar equipment', quantity: qty, ordered_quantity: qty, unit_price: price, price_tolerance_bps: 0 }],
      }),
    }, orgId),
    onSuccess: (row: { id: number }) => {
      mfToast.success('Purchase order created')()
      void appNavigate(`/app/procurement/purchase-orders/${row.id}`)
    },
    onError: mfToast.error('Could not create PO'),
  })
  if (mode === 'detail') {
    const po = detail.data
    const supplierLinkId = po?.supplier_id != null ? String(po.supplier_id) : ''
    return (
      <WorkspacePage>
        <PageHeader
          title={`Purchase order ${String(po?.po_number ?? poId)}`}
          description="Lines, goods receipts, supplier link, and match-to-bill path."
          actions={
            <div className="flex flex-wrap gap-2">
              {supplierLinkId ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/payables/suppliers/$supplierId" params={{ supplierId: supplierLinkId }}>Supplier profile</Link>
                </Button>
              ) : null}
              {can('procurement.write') ? (
                <Button asChild size="sm">
                  <Link to="/app/procurement/goods-received/new" search={{ poId: String(poId) }}>Record delivery</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link to="/app/payables/inbox">Supplier bills</Link>
              </Button>
            </div>
          }
        />
        <QueryFrame loading={detail.isLoading} error={detail.error as Error | null} onRetry={() => detail.refetch()}>
          <DetailGrid>
            <SectionCard title="PO lines" description="Committed quantities and price tolerances.">
              <KeyValueList items={[
                { label: 'Status', value: <StatusBadge status={String(po?.status || '')} /> },
                { label: 'Supplier', value: supplierLinkId ? (
                  <Link className="text-primary hover:underline" to="/app/payables/suppliers/$supplierId" params={{ supplierId: supplierLinkId }}>#{supplierLinkId}</Link>
                ) : '—' },
                { label: 'Total', value: <AmountDisplay value={String(po?.total_decimal || '0')} currency={String(po?.currency || 'USD')} /> },
                { label: 'Expected', value: String(po?.expected_date || '—') },
              ]} />
              <EntityRecordPanel record={po} kind="po" />
            </SectionCard>
            <EvidenceChain steps={['PO issued', 'Goods received', 'Supplier invoice', 'Match & approve', 'Settlement']} />
          </DetailGrid>
          <SectionCard title="Goods receipts" description="Deliveries recorded against this PO." className="mt-5">
            <QueryFrame loading={poReceipts.isLoading} error={poReceipts.error as Error | null} onRetry={() => poReceipts.refetch()} empty={!poReceipts.data?.length}>
              <DataTable
                rows={poReceipts.data || []}
                emptyTitle="No receipts yet"
                emptyDescription="Record a delivery when goods arrive."
                columns={[
                  { key: 'receipt_reference', label: 'Reference', render: (r) => (
                    <Link className="text-primary hover:underline" to="/app/procurement/goods-received/$receiptId" params={{ receiptId: String(r.id) }}>
                      {String(r.receipt_reference || `#${String(r.id)}`)}
                    </Link>
                  ) },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  { key: 'received_at', label: 'Received' },
                ]}
              />
            </QueryFrame>
          </SectionCard>
        </QueryFrame>
      </WorkspacePage>
    )
  }
  return (
    <WorkspacePage>
      <PageHeader title="New purchase order" description="Create a PO with line items and tolerances." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-5">
          <FormField label="Supplier ID"><Input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity"><Input value={qty} onChange={(e) => setQty(e.target.value)} /></FormField>
            <FormField label="Unit price"><Input value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <ShoppingCart className="size-4" aria-hidden />
            Create PO
          </Button>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}

export function GoodsReceiptFormPage({ mode }: { mode: 'new' | 'detail' }) {
  const { receiptId } = useParams({ strict: false }) as { receiptId?: string }
  const search = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams())
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const [poId, setPoId] = useState(search.get('poId') || '')
  const [qty, setQty] = useState('100')
  const detail = useQuery({
    queryKey: ['grn', orgId, receiptId],
    enabled: mode === 'detail' && !!orgId && !!receiptId,
    queryFn: () => api<Record<string, unknown>>(`/procurement/goods-receipts/${receiptId}`, {}, orgId),
  })
  const create = useMutation({
    mutationFn: () => api<{ id: number }>('/procurement/goods-receipts', {
      method: 'POST',
      body: JSON.stringify({ po_id: Number(poId), items: [{ po_item_index: 0, received_quantity: qty }] }),
    }, orgId),
    onSuccess: (row: { id: number }) => {
      mfToast.success('Goods receipt recorded')()
      void appNavigate(`/app/procurement/goods-received/${row.id}`)
    },
    onError: mfToast.error('Could not record receipt'),
  })
  if (mode === 'detail') {
    const grn = detail.data
    const po = grn?.purchase_order as Record<string, unknown> | undefined
    const linkedPoId = grn?.po_id != null ? String(grn.po_id) : ''
    return (
      <WorkspacePage>
        <PageHeader
          title={`Delivery ${String(grn?.receipt_reference ?? receiptId)}`}
          description="Received quantities tied to purchase order and three-way match."
          actions={
            linkedPoId ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/app/procurement/purchase-orders/$poId" params={{ poId: linkedPoId }}>Open PO #{linkedPoId}</Link>
              </Button>
            ) : null
          }
        />
        <QueryFrame loading={detail.isLoading} error={detail.error as Error | null} onRetry={() => detail.refetch()}>
          <DetailGrid>
            <SectionCard title="Receipt lines" description="Quantities accepted on this delivery.">
              <KeyValueList items={[
                { label: 'Status', value: <StatusBadge status={String(grn?.status || '')} /> },
                { label: 'PO', value: linkedPoId ? (
                  <Link className="text-primary hover:underline" to="/app/procurement/purchase-orders/$poId" params={{ poId: linkedPoId }}>
                    {String(po?.po_number ?? `#${linkedPoId}`)}
                  </Link>
                ) : '—' },
                { label: 'Received at', value: String(grn?.received_at || '—') },
              ]} />
              <EntityRecordPanel record={grn} kind="grn" />
            </SectionCard>
            <EvidenceChain steps={['PO committed', 'Shipment', 'GRN recorded', 'Invoice matched', 'Paid']} />
          </DetailGrid>
        </QueryFrame>
      </WorkspacePage>
    )
  }
  return (
    <WorkspacePage>
      <PageHeader title="Record delivery" description="Enter received quantities against a PO." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-5">
          <FormField label="PO ID"><Input value={poId} onChange={(e) => setPoId(e.target.value)} /></FormField>
          <FormField label="Received qty"><Input value={qty} onChange={(e) => setQty(e.target.value)} /></FormField>
          <Button onClick={() => create.mutate()} disabled={!poId || create.isPending || !can('procurement.write')}>
            <Package className="size-4" aria-hidden />
            Save receipt
          </Button>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}

export function ApprovalsQueuePage() {
  const orgId = useOrgId()
  const [tab, setTab] = useState('pending')
  const status = tab === 'all' ? 'all' : tab
  const q = useQuery({
    queryKey: ['approvals', orgId, status],
    enabled: !!orgId,
    queryFn: () => api<Array<Record<string, unknown>>>(`/approvals?status=${status}`, {}, orgId),
  })
  return (
    <WorkspacePage>
      <PageHeader title="Approvals" description="Review pending supplier and payment authorizations." kpiPeriod={<MetricPeriodTabs />} />
      <ApprovalsInsights orgId={orgId} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="changes_requested">Changes</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryFrame loading={q.isLoading} error={q.error as Error | null}>
        <DataTable
          rows={(q.data || []) as Array<Record<string, unknown>>}
          emptyTitle="No approvals in this queue"
          emptyDescription="Submit supplier bills when three-way match is clean and policy requires sign-off."
          emptyAction={
            <div className="flex flex-wrap justify-center gap-2">
              <NavButton to="/app/payables/bills">
                <Scale className="size-4" aria-hidden />
                Supplier bills
              </NavButton>
              <NavButton to="/app/payables/bills/new" variant="outline">
                <Plus className="size-4" aria-hidden />
                New supplier bill
              </NavButton>
            </div>
          }
          columns={[
            { key: 'id', label: 'ID', render: (r) => <Link className="text-primary hover:underline" to="/app/approvals/$approvalId" params={{ approvalId: String(r.id) }}>#{String(r.id)}</Link> },
            { key: 'subject_type', label: 'Subject', render: (r) => (
              <span className="capitalize">{String(r.subject_type).replaceAll('_', ' ')} #{String(r.subject_id)}</span>
            ) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: 'created_at', label: 'Submitted', render: (r) => String(r.created_at || '—') },
            {
              key: 'actions',
              label: '',
              render: (r) => r.subject_type === 'ap_bill' ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/payables/bills/$billId" params={{ billId: String(r.subject_id) }}>View bill</Link>
                </Button>
              ) : '—',
            },
          ]}
        />
      </QueryFrame>
    </WorkspacePage>
  )
}

export function PaymentsListPage() {
  const orgId = useOrgId()
  const [tab, setTab] = useState('all')
  const q = useQuery({
    queryKey: ['payments', orgId],
    enabled: !!orgId,
    queryFn: async () => listItems(await api<Paginated<Record<string, unknown>>>('/payments?limit=100', {}, orgId)),
  })
  const rows = useMemo(() => {
    const all = q.data || []
    const terminal = new Set(['SUCCESS', 'FAILED', 'REFUNDED'])
    switch (tab) {
      case 'incoming':
        return all.filter((r) => r.purpose === 'AR_COLLECTION')
      case 'outgoing':
        return all.filter((r) => r.purpose === 'AP_SETTLEMENT')
      case 'pending':
        return all.filter((r) => !terminal.has(String(r.normalized_status || '').toUpperCase()))
      case 'successful':
        return all.filter((r) => String(r.normalized_status).toUpperCase() === 'SUCCESS')
      case 'failed':
        return all.filter((r) => ['FAILED', 'INCOMPLETE', 'UNKNOWN_REVIEW'].includes(String(r.normalized_status).toUpperCase()))
      case 'refunded':
        return all.filter((r) => String(r.normalized_status).toUpperCase() === 'REFUNDED')
      default:
        return all
    }
  }, [q.data, tab])
  return (
    <WorkspacePage>
      <PageHeader title="Payments" description="Settlement attempts across receivables and payables." kpiPeriod={<MetricPeriodTabs />} />
      <PaymentsInsights orgId={orgId} />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="successful">Successful</TabsTrigger>
          <TabsTrigger value="refunded">Refunded</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryFrame loading={q.isLoading} error={q.error as Error | null}>
        <DataTable
          rows={rows as Array<Record<string, unknown>>}
          emptyTitle="No payments in this view"
          emptyDescription="Settlements appear when customers pay invoice links or you initiate AP payouts."
          emptyAction={
            <div className="flex flex-wrap justify-center gap-2">
              <NavButton to="/app/receivables/payment-links">
                <Link2 className="size-4" aria-hidden />
                Payment links
              </NavButton>
              <NavButton to="/app/payables/bills" variant="outline">
                <Scale className="size-4" aria-hidden />
                Supplier bills
              </NavButton>
            </div>
          }
          columns={[
            { key: 'id', label: 'Payment', render: (r) => <Link className="text-primary hover:underline" to="/app/payments/$paymentId" params={{ paymentId: String(r.id) }}>#{String(r.id)}</Link> },
            { key: 'purpose', label: 'Direction', render: (r) => (r.purpose === 'AR_COLLECTION' ? 'Incoming' : 'Outgoing') },
            { key: 'normalized_status', label: 'Status', render: (r) => <StatusBadge status={String(r.normalized_status)} /> },
            { key: 'destination_amount_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.destination_amount_decimal || '0')} /> },
            { key: 'updated_at', label: 'Updated', render: (r) => String(r.updated_at || r.created_at || '—') },
          ]}
        />
      </QueryFrame>
    </WorkspacePage>
  )
}

export function ApprovalDetailPage() {
  const { approvalId } = useParams({ strict: false }) as { approvalId: string }
  const orgId = useOrgId()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const q = useQuery({
    queryKey: ['approval', orgId, approvalId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, unknown>>(`/approvals/${approvalId}`, {}, orgId),
  })
  useEffect(() => {
    if (q.data?.reason) setReason(String(q.data.reason))
  }, [q.data?.reason])
  const policyChecks = (q.data?.policy_checks as Array<{ code?: string; passed?: boolean; message?: string }>) || []
  const dualBlocked = policyChecks.some((c) => c.code === 'dual_control' && c.passed === false)
  const pending = q.data?.status === 'pending'
  const decide = useMutation({
    mutationFn: (decision: string) => api(`/approvals/${approvalId}/decide`, { method: 'POST', body: JSON.stringify({ decision, reason }) }, orgId),
    onSuccess: (_d, decision) => {
      mfToast.success('Decision recorded', `Marked as ${decision}.`)()
      qc.invalidateQueries({ queryKey: ['approvals'] })
      void q.refetch()
    },
    onError: mfToast.error('Could not record decision'),
  })
  const subjectType = String(q.data?.subject_type || '')
  const subjectId = String(q.data?.subject_id || '')
  return (
    <WorkspacePage>
      <PageHeader
        title={`Approval #${approvalId}`}
        description="Evidence, policy checks and authorization decision."
        actions={
          pending ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => decide.mutate('approve')} disabled={decide.isPending || dualBlocked}>
                <CheckCircle2 className="size-4" aria-hidden />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => decide.mutate('reject')} disabled={decide.isPending}>
                <XCircle className="size-4" aria-hidden />
                Reject
              </Button>
              <Button variant="outline" onClick={() => decide.mutate('request_changes')} disabled={decide.isPending}>
                <MessageSquare className="size-4" aria-hidden />
                Request changes
              </Button>
            </div>
          ) : undefined
        }
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} onRetry={() => q.refetch()}>
        <DetailGrid>
          <SectionCard title="Request" description="Authorization scope and decision.">
            <KeyValueList items={[
              { label: 'Status', value: <StatusBadge status={String(q.data?.status || '')} /> },
              { label: 'Subject', value: <span className="capitalize">{subjectType.replaceAll('_', ' ')} #{subjectId}</span> },
              { label: 'Requested', value: String(q.data?.created_at || '—') },
              { label: 'Decided', value: String(q.data?.decided_at || '—') },
            ]} />
            {subjectType === 'ap_bill' ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/payables/bills/$billId" params={{ billId: subjectId }}>Open bill</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/payables/bills/$billId/match" params={{ billId: subjectId }}>Match</Link>
                </Button>
              </div>
            ) : null}
            {pending ? (
              <FormField label="Decision note" hint="Optional context stored on the approval record.">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </FormField>
            ) : q.data?.reason ? (
              <FormField label="Note"><p className="text-sm text-muted-foreground">{String(q.data.reason)}</p></FormField>
            ) : null}
            {dualBlocked ? (
              <Alert variant="destructive"><AlertDescription>Dual-control policy blocks self-approval for this request.</AlertDescription></Alert>
            ) : null}
            {decide.isError ? <Alert variant="destructive"><AlertDescription>{(decide.error as Error).message}</AlertDescription></Alert> : null}
          </SectionCard>
          <SectionCard title="Policy checks" description="Evaluated against the active approval policy.">
            {policyChecks.length ? (
              <DataTable
                rows={policyChecks as Array<Record<string, unknown>>}
                columns={[
                  { key: 'code', label: 'Rule', render: (r) => String(r.code || '').replaceAll('_', ' ') },
                  { key: 'passed', label: 'Result', render: (r) => <StatusBadge status={r.passed ? 'passed' : 'failed'} /> },
                  { key: 'message', label: 'Detail' },
                ]}
              />
            ) : (
              <EmptyState title="No policy checks" description="Checks appear when the approval is loaded." />
            )}
          </SectionCard>
        </DetailGrid>
        <div className="mt-5">
          <EvidenceChain steps={['Evidence uploaded', 'Policy evaluated', 'Human decision', 'Settlement authorized', 'On-chain SUCCESS']} />
        </div>
      </QueryFrame>
    </WorkspacePage>
  )
}

export function PaymentDetailPage() {
  const { paymentId } = useParams({ strict: false }) as { paymentId: string }
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const q = useQuery({
    queryKey: ['payment', orgId, paymentId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, unknown>>(`/settlements/${paymentId}`, {}, orgId),
    refetchInterval: (query) => {
      const status = String((query.state.data as { normalized_status?: string } | undefined)?.normalized_status || '')
      return ['SUCCESS', 'FAILED', 'REFUNDED'].includes(status) ? false : 4000
    },
  })
  const refresh = useMutation({
    mutationFn: () => api(`/settlements/${paymentId}/refresh`, { method: 'POST' }, orgId),
    onSuccess: () => {
      mfToast.success('Status refreshed')()
      void q.refetch()
    },
    onError: mfToast.error('Refresh failed'),
  })
  const retry = useMutation({
    mutationFn: () => api(`/settlements/${paymentId}/retry`, { method: 'POST', body: '{}' }, orgId),
    onSuccess: mfToast.success('Retry queued'),
    onError: mfToast.error('Retry failed'),
  })
  const confirm = useMutation({
    mutationFn: (txHash: string) => api(`/settlements/${paymentId}/confirm-deposit`, { method: 'POST', body: JSON.stringify({ txHash }) }, orgId),
    onSuccess: () => {
      mfToast.success('Deposit confirmed')()
      void q.refetch()
    },
    onError: mfToast.error('Confirmation failed'),
  })
  const receipt = useMutation({
    mutationFn: () => api<{ url?: string }>(`/receipts/${paymentId}`, { method: 'POST' }, orgId),
    onSuccess: (data) => {
      if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
      mfToast.success('Receipt ready')()
      void q.refetch()
    },
    onError: mfToast.error('Could not issue receipt'),
  })
  const [txHash, setTxHash] = useState('')
  const receiptUrl = String(q.data?.receipt_url || '')
  const status = String(q.data?.normalized_status || '')
  const polling = !['SUCCESS', 'FAILED', 'REFUNDED'].includes(status) && !q.isLoading
  return (
    <WorkspacePage>
      <PageHeader
        title={`Payment #${paymentId}`}
        description="Unified settlement timeline, deposit confirmation, quote retry, and public receipt."
        actions={<LivePollingBadge active={polling} />}
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} onRetry={() => q.refetch()}>
        <div className="mb-4">
          <SettlementHubCard
            settlementId={paymentId}
            status={String(q.data?.normalized_status || '')}
            receiptUrl={receiptUrl || null}
            onRefresh={() => refresh.mutate()}
            onRetry={() => retry.mutate()}
            onIssueReceipt={() => receipt.mutate()}
            refreshPending={refresh.isPending}
            retryPending={retry.isPending}
            receiptPending={receipt.isPending}
            canInitiate={can('payments.initiate')}
          />
        </div>
        <DetailGrid>
          <SectionCard title="Settlement" description="Quote, deposit address, and on-chain confirmation.">
            <KeyValueList items={[
              { label: 'Purpose', value: String(q.data?.purpose || '—') },
              { label: 'Status', value: <StatusBadge status={String(q.data?.normalized_status || '')} /> },
              { label: 'Amount', value: <AmountDisplay value={String(q.data?.destination_amount_decimal || '0')} /> },
              { label: 'Origin amount', value: <AmountDisplay value={String(q.data?.origin_amount_decimal || '0')} /> },
              { label: 'Deposit', value: <span className="break-all font-mono text-xs">{String(q.data?.deposit_address || '—')}</span> },
              { label: 'Memo', value: <span className="break-all font-mono text-xs">{String(q.data?.deposit_memo || '—')}</span> },
              { label: 'Quote expires', value: String(q.data?.quote_expires_at || '—') },
              { label: 'Dest tx', value: <span className="break-all font-mono text-xs">{String(q.data?.destination_tx_hash || '—')}</span> },
              { label: 'Reconciled', value: String(q.data?.reconciled_at || 'Not yet') },
            ]} />
            <FormField label="Confirm deposit tx hash" hint="Wallet popup success is not settlement proof. Paste the hash Intents accepted.">
              <div className="flex flex-wrap gap-2">
                <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" className="min-w-[12rem] flex-1" />
                <Button onClick={() => confirm.mutate(txHash)} disabled={!txHash || confirm.isPending}>
                  <Check className="size-4" aria-hidden />
                  Confirm
                </Button>
              </div>
            </FormField>
            <WalletTransferConfirmation
              depositAddress={String(q.data?.deposit_address || '') || null}
              amountDecimal={String(q.data?.origin_amount_decimal || q.data?.destination_amount_decimal || '') || null}
              onTxHash={(hash) => {
                setTxHash(hash)
                confirm.mutate(hash)
              }}
            />
          </SectionCard>
          <div className="space-y-5">
            <SettlementTimeline events={(q.data?.events as Array<Record<string, unknown>>) || []} receiptUrl={receiptUrl || null} />
            <EvidenceChain steps={['Intent quoted', 'Deposit sent', 'Intent matched', 'Destination settled', 'Receipt issued']} />
          </div>
        </DetailGrid>
      </QueryFrame>
    </WorkspacePage>
  )
}

const settlementColumns: Array<{ key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }> = [
  { key: 'id', label: 'ID', render: (r) => <Link className="text-primary hover:underline" to="/app/payments/$paymentId" params={{ paymentId: String(r.id) }}>#{String(r.id)}</Link> },
  { key: 'purpose', label: 'Purpose' },
  { key: 'destination_amount_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.destination_amount_decimal || '0')} /> },
  { key: 'normalized_status', label: 'Status', render: (r) => <StatusBadge status={String(r.normalized_status || 'SUCCESS')} /> },
]

export function ReconciliationPage() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['recon', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ matched: Array<Record<string, unknown>>; unmatched: Array<Record<string, unknown>>; exceptions: Array<Record<string, unknown>> }>('/reconciliation', {}, orgId),
  })
  const empty =
    !q.isLoading &&
    !q.data?.unmatched?.length &&
    !q.data?.exceptions?.length &&
    !q.data?.matched?.length
  return (
    <WorkspacePage>
      <PageHeader
        title="Reconciliation"
        description="Allocate successful settlements to invoices and bills, then clear exceptions."
        kpiPeriod={<MetricPeriodTabs />}
        actions={(
          <NavButton to="/app/reconciliation/unmatched" variant="outline">
            <Scale className="size-4" aria-hidden />
            Unmatched queue
          </NavButton>
        )}
      />
      <QueryFrame loading={q.isLoading} error={q.error as Error | null}>
        <ReconciliationInsights orgId={orgId} />
        {empty ? (
          <EmptyState
            title="Nothing to reconcile yet"
            description="When customers pay invoice links or you settle supplier bills, successful deposits appear here for allocation."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <NavButton to="/app/payments">
                  <Banknote className="size-4" aria-hidden />
                  View payments
                </NavButton>
                <NavButton to="/app/reconciliation/unmatched" variant="outline">
                  <Scale className="size-4" aria-hidden />
                  Unmatched queue
                </NavButton>
              </div>
            }
          />
        ) : null}
        <div className="space-y-6">
          {(q.data?.unmatched?.length ?? 0) > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-medium">Needs allocation</h2>
              <DataTable rows={q.data?.unmatched || []} columns={settlementColumns} emptyTitle="No unmatched settlements" />
            </div>
          ) : null}
          {(q.data?.exceptions?.length ?? 0) > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-medium">Settlement exceptions</h2>
              <DataTable rows={q.data?.exceptions || []} columns={settlementColumns} emptyTitle="No exceptions" />
            </div>
          ) : null}
          {(q.data?.matched?.length ?? 0) > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-medium">Recently reconciled</h2>
              <DataTable
                rows={q.data?.matched || []}
                columns={[
                  ...settlementColumns,
                  { key: 'reconciled_at', label: 'Reconciled at' },
                  { key: 'destination_tx_hash', label: 'Tx', render: (r) => <span className="font-mono text-xs">{String(r.destination_tx_hash || '—').slice(0, 12)}…</span> },
                ]}
                emptyTitle="No reconciled settlements"
              />
            </div>
          ) : null}
        </div>
      </QueryFrame>
    </WorkspacePage>
  )
}

export function UnmatchedPage() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['recon-unmatched', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ unmatched: Array<Record<string, string>> }>('/reconciliation', {}, orgId),
  })
  const statement = useQuery({
    queryKey: ['recon-statement', orgId],
    enabled: !!orgId,
    queryFn: () => api<{
      open_receivables: Array<Record<string, unknown>>
      open_payables: Array<Record<string, unknown>>
      unmatched_settlements: Array<Record<string, unknown>>
    }>('/reconciliation/statement', {}, orgId),
  })
  return (
    <WorkspacePage>
      <PageHeader title="Unmatched" description="Settlements needing allocation and open statement obligations." kpiPeriod={<MetricPeriodTabs />} />
      <ReconciliationInsights orgId={orgId} context="unmatched" />
      <QueryFrame loading={q.isLoading || statement.isLoading} error={(q.error || statement.error) as Error | null} onRetry={() => { void q.refetch(); void statement.refetch() }}>
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-lg font-medium">Unmatched SUCCESS settlements</h2>
            {!q.data?.unmatched?.length ? (
              <EmptyState title="No unmatched SUCCESS settlements" description="Successful settlements awaiting allocation appear here." />
            ) : (
              <DataTable
                rows={(q.data?.unmatched || []) as Array<Record<string, unknown>>}
                columns={[
                  { key: 'id', label: 'Payment', render: (r) => <Link className="text-primary hover:underline" to="/app/payments/$paymentId" params={{ paymentId: String(r.id) }}>#{String(r.id)}</Link> },
                  { key: 'purpose', label: 'Purpose' },
                  { key: 'subject_type', label: 'Subject' },
                  { key: 'subject_id', label: 'Subject ID' },
                  { key: 'destination_amount_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.destination_amount_decimal)} /> },
                  { key: 'normalized_status', label: 'Status', render: (r) => <StatusBadge status={String(r.normalized_status)} /> },
                ]}
              />
            )}
          </div>
          {(statement.data?.open_receivables?.length ?? 0) > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-medium">Open receivables</h2>
              <DataTable
                rows={statement.data?.open_receivables || []}
                columns={[
                  { key: 'invoice_number', label: 'Invoice' },
                  { key: 'customer_id', label: 'Customer' },
                  { key: 'amount_outstanding_decimal', label: 'Outstanding', render: (r) => <AmountDisplay value={String(r.amount_outstanding_decimal)} /> },
                  { key: 'due_date', label: 'Due' },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                ]}
              />
            </div>
          ) : null}
          {(statement.data?.open_payables?.length ?? 0) > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-medium">Open payables</h2>
              <DataTable
                rows={statement.data?.open_payables || []}
                columns={[
                  { key: 'invoice_number', label: 'Bill' },
                  { key: 'supplier_id', label: 'Supplier' },
                  { key: 'amount_outstanding_decimal', label: 'Outstanding', render: (r) => <AmountDisplay value={String(r.amount_outstanding_decimal)} /> },
                  { key: 'due_date', label: 'Due' },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                ]}
              />
            </div>
          ) : null}
        </div>
      </QueryFrame>
    </WorkspacePage>
  )
}

const REPORT_CATALOG = [
  {
    reportKey: 'receivables-aging',
    to: '/app/reports/receivables-aging',
    title: 'Customer balances',
    description: 'Open receivables by due date and party.',
  },
  {
    reportKey: 'payables-aging',
    to: '/app/reports/payables-aging',
    title: 'Supplier balances',
    description: 'Open payables by due date and vendor.',
  },
  {
    reportKey: 'collections',
    to: '/app/reports/collections',
    title: 'Collections',
    description: 'Settlement activity for customer payments.',
  },
  {
    reportKey: 'exceptions',
    to: '/app/reports/exceptions',
    title: 'Match exceptions',
    description: 'Supplier bills blocked by three-way match.',
  },
] as const

export function ReportsHubPage() {
  const orgId = useOrgId()
  const [exportKey, setExportKey] = useState<string | null>(null)
  const exportTitle = REPORT_CATALOG.find((r) => r.reportKey === exportKey)?.title ?? 'Report'
  return (
    <WorkspacePage>
      <PageHeader
        title="Reports"
        description="Browse financial snapshots and export CSV for your books or auditors."
        kpiPeriod={<MetricPeriodTabs />}
      />
      <ReportsHubMetrics orgId={orgId} />
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report library</CardTitle>
          <CardDescription>Open a report in the workspace or export with an optional date range.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable
            rows={REPORT_CATALOG as unknown as Array<Record<string, unknown>>}
            emptyTitle="No reports"
            columns={[
              { key: 'title', label: 'Report' },
              { key: 'description', label: 'Description', className: 'hidden md:table-cell' },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={String(r.to)}>Open</Link>
                    </Button>
                    <Button size="sm" variant="default" onClick={() => setExportKey(String(r.reportKey))}>
                      <Download className="size-4" aria-hidden />
                      Export
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
      <ReportExportDialog
        orgId={orgId}
        reportKey={exportKey}
        reportTitle={exportTitle}
        open={!!exportKey}
        onOpenChange={(o) => { if (!o) setExportKey(null) }}
      />
    </WorkspacePage>
  )
}

const AGING_BUCKETS = [
  { id: 'all', label: 'All' },
  { id: 'current', label: 'Current' },
  { id: 'days_1_30', label: '1–30 days' },
  { id: 'days_31_60', label: '31–60' },
  { id: 'days_61_90', label: '61–90' },
  { id: 'days_90_plus', label: '90+' },
] as const

export function ReportPage({ path, title, description }: { path: string; title: string; description: string }) {
  const orgId = useOrgId()
  const { period } = useMetricsPeriod()
  const reportKey = path.replace(/^\/reports\//, '')
  const isAging = reportKey.includes('aging')
  const isCollections = reportKey === 'collections'
  const [bucket, setBucket] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (isAging && bucket !== 'all') p.set('bucket', bucket)
    if (searchText.trim()) p.set('q', searchText.trim())
    if (isCollections) {
      if (fromDate) p.set('from', fromDate)
      if (toDate) p.set('to', toDate)
      else if (period !== 'all' && !fromDate) p.set('period', period)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [bucket, searchText, isAging, isCollections, fromDate, toDate, period])
  const reportQ = useQuery({
    queryKey: ['report', path, orgId, bucket, searchText, fromDate, toDate, period],
    enabled: !!orgId,
    queryFn: () => api<{ report?: string; rows?: Array<Record<string, unknown>>; summary?: Record<string, string> }>(`${path}${qs}`, {}, orgId),
  })
  const exportCsv = useMutation({
    mutationFn: () => api<{ csv?: string; filename?: string }>(`/reports/${reportKey}/export${qs}`, { method: 'POST' }, orgId),
    onSuccess: (data) => {
      if (triggerCsvDownload(data)) mfToast.success('CSV exported')()
    },
    onError: mfToast.error('Export failed'),
  })
  const rows = reportQ.data?.rows || []
  const summary = reportQ.data?.summary
  const columns = useMemo(() => {
    const preferred = ['invoice_number', 'party_name', 'due_date', 'amount_outstanding_decimal', 'aging_bucket', 'days_past_due', 'status', 'normalized_status', 'reconciled_at']
    const keys = rows.length ? [...new Set([...preferred, ...Object.keys(rows[0])])].filter((k) => !['record_url', 'currency'].includes(k)) : []
    const columnLabels: Record<string, string> = {
      aging_bucket: 'Due bucket',
      days_past_due: 'Days past due',
      party_name: 'Party',
      invoice_number: 'Document',
      amount_outstanding_decimal: 'Outstanding',
    }
    return keys.map((key) => ({
      key,
      label: columnLabels[key] ?? key.replaceAll('_', ' '),
      render:
        key === 'invoice_number'
          ? (r: Record<string, unknown>) => {
            const label = String(r.invoice_number ?? '—')
            if (!r.record_url) return label
            try {
              const inApp = new URL(String(r.record_url), window.location.origin).pathname
              if (inApp.startsWith('/app/')) {
                return <Link to={inApp} className="font-medium text-primary hover:underline">{label}</Link>
              }
            } catch {
              /* ignore */
            }
            return <a href={String(r.record_url)} className="font-medium text-primary hover:underline">{label}</a>
          }
          : key.includes('decimal') || key.includes('amount')
            ? (r: Record<string, unknown>) => <AmountDisplay value={String(r[key] ?? '0')} />
            : key === 'status' || key === 'normalized_status' || key === 'aging_bucket'
              ? (r: Record<string, unknown>) => <StatusBadge status={String(r[key])} />
              : undefined,
    }))
  }, [rows])
  return (
    <WorkspacePage>
      <PageHeader
        title={title}
        description={description}
        kpiPeriod={<MetricPeriodTabs />}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/app/reports">All reports</Link></Button>
            <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
          </div>
        }
      />
      <ModuleAnalyticsPanel
        orgId={orgId}
        module="reports"
        context={reportKey}
        chartLayout={reportKey === 'exceptions' ? 'donut' : 'bar'}
      />
      {isAging || reportKey === 'exceptions' || isCollections ? (
        <div className="mb-4 space-y-3">
          {isAging ? (
            <Tabs value={bucket} onValueChange={setBucket}>
              <TabsList className="flex h-auto flex-wrap">
                {AGING_BUCKETS.map((b) => (
                  <TabsTrigger key={b.id} value={b.id}>{b.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          {isCollections ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <FormField label="From">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-[11rem]" />
              </FormField>
              <FormField label="To">
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-[11rem]" />
              </FormField>
              <p className="text-xs text-muted-foreground sm:pb-2">
                Leave &quot;From&quot; empty to use the KPI period tab ({period === 'all' ? 'all reconciled collections' : period.toUpperCase()}).
              </p>
            </div>
          ) : null}
          {(isAging || reportKey === 'exceptions') ? (
            <FormField label="Search">
              <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Invoice # or party name" className="max-w-md" />
            </FormField>
          ) : null}
        </div>
      ) : null}
      <QueryFrame loading={reportQ.isLoading} error={reportQ.error as Error | null}>
        <MetricStrip className="mb-8">
          <MetricCard icon={FileText} label="Rows in view" value={String(rows.length)} hint="After filters" />
          {summary && 'count' in summary ? (
            <MetricCard icon={Hash} label="Report count" value={String(summary.count)} hint="In this bucket" />
          ) : null}
        </MetricStrip>
        {!rows.length ? (
          <EmptyState title="No rows for this report" description="Data appears when matching records exist in the workspace." />
        ) : (
          <DataTable rows={rows} columns={columns} />
        )}
      </QueryFrame>
    </WorkspacePage>
  )
}

function CheckoutBrandingForm() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['settings', 'checkout-branding', orgId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, string>>('/settings/organization', {}, orgId),
  })
  const sampleLink = useQuery({
    queryKey: ['checkout-sample-pay-link', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const batches = await Promise.all([
        api<Paginated<Record<string, string>>>('/receivables/invoices?status=issued&limit=1', {}, orgId),
        api<Paginated<Record<string, string>>>('/receivables/invoices?status=overdue&limit=1', {}, orgId),
        api<Paginated<Record<string, string>>>('/receivables/invoices?status=partially_paid&limit=1', {}, orgId),
      ])
      for (const batch of batches) {
        const row = listItems(batch).find((r) => r.payment_url)
        if (row?.payment_url) return row
      }
      return null
    },
  })
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [accent, setAccent] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!q.data) return
    setDisplayName(q.data.checkout_display_name || '')
    setTagline(q.data.checkout_tagline || '')
    setAccent(q.data.checkout_accent_color || '')
    setLogoUrl(q.data.checkout_logo_url || '')
    setSupportEmail(q.data.checkout_support_email || '')
    setMessage(q.data.checkout_message || '')
  }, [q.data])
  const save = useMutation({
    mutationFn: () =>
      api('/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          checkout_display_name: displayName,
          checkout_tagline: tagline,
          checkout_accent_color: accent,
          checkout_logo_url: logoUrl,
          checkout_support_email: supportEmail,
          checkout_message: message,
        }),
      }, orgId),
    onSuccess: () => {
      mfToast.success('Checkout branding saved')()
      void q.refetch()
    },
    onError: mfToast.error('Could not save checkout branding'),
  })
  const previewName = displayName || q.data?.name || 'Your organization'
  const liveAccent = resolveCheckoutAccent(accent) ?? resolveCheckoutAccent(q.data?.checkout_accent_color)
  const previewTheme = checkoutThemeStyle(liveAccent)
  if (q.isLoading) return <PageSkeleton />
  if (q.error) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Payment page branding</CardTitle>
          <CardDescription>
            Shown on public pay, status, and receipt links — the receiver&apos;s brand, not global WordPress defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField label="Checkout display name" hint="Defaults to organization name when empty.">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={q.data?.name || ''} />
          </FormField>
          <FormField label="Tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Professional invoices, faster collections" /></FormField>
          <FormField label="Accent color" hint="Buttons and progress on your pay links.">
            <ColorPickerField value={accent} onChange={setAccent} />
          </FormField>
          <FormField label="Checkout logo" hint="Shown on payment links. PNG, JPEG, WebP, or SVG.">
            <CheckoutLogoUpload value={logoUrl} onChange={setLogoUrl} orgId={orgId} />
          </FormField>
          <FormField label="Support email"><Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="billing@company.com" /></FormField>
          <FormField label="Checkout message">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Pay from any supported chain." />
          </FormField>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4" aria-hidden />
            Save branding
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className={cn('overflow-hidden border-2', !liveAccent && 'border-border')} style={liveAccent ? { borderColor: liveAccent } : undefined}>
          <div className={cn('h-1.5 w-full', !liveAccent && 'bg-primary')} style={liveAccent ? { backgroundColor: liveAccent } : undefined} />
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Live checkout preview</CardTitle>
            <CardDescription>Payers see your brand colors on buttons, accents, and step indicators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <div className="border-t border-border bg-gradient-to-b from-muted/30 to-background" style={previewTheme}>
              <CheckoutBrandHeader
                organizationName={previewName}
                checkoutTagline={tagline}
                checkoutAccentColor={liveAccent ?? undefined}
                checkoutLogoUrl={logoUrl || undefined}
                invoiceNumber="INV-PREVIEW"
              />
              <div className="space-y-3 px-4 py-5">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</p>
                  <p className="text-2xl font-semibold text-primary">$2,500.00</p>
                  {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
                </div>
                <Button className="w-full" type="button" disabled>
                  <ArrowRight className="size-4" aria-hidden />
                  Continue to payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {sampleLink.data?.payment_url ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Open a real payment link</p>
            <PayLinkActions
              paymentUrl={sampleLink.data.payment_url}
              invoiceNumber={sampleLink.data.invoice_number}
              size="default"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Issue an invoice to open your branded checkout in a new tab.</p>
        )}
      </div>
    </div>
  )
}

function OrganizationSettingsForm() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['settings', 'organization', orgId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, string>>('/settings/organization', {}, orgId),
  })
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [timezone, setTimezone] = useState('')
  const [currency, setCurrency] = useState('USD')
  useEffect(() => {
    if (!q.data) return
    setName(q.data.name || '')
    setCountry(q.data.country || '')
    setTimezone(q.data.timezone || '')
    setCurrency(q.data.reporting_currency || 'USD')
  }, [q.data])
  const save = useMutation({
    mutationFn: () => api('/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name, country, timezone, reporting_currency: currency }),
    }, orgId),
    onSuccess: () => {
      mfToast.success('Organization saved')()
      void q.refetch()
    },
    onError: mfToast.error('Could not save organization'),
  })
  if (q.isLoading) return <PageSkeleton />
  if (q.error) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>Legal entity, locale, and reporting currency for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField label="Organization name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" /></FormField>
            <FormField label="Reporting currency"><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></FormField>
          </div>
          <FormField label="Timezone"><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></FormField>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            <Save className="size-4" aria-hidden />
            Save organization
          </Button>
          {save.isSuccess ? <Alert variant="success"><AlertDescription>Saved.</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-muted/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Workspace defaults</CardTitle>
          <CardDescription>These values appear on invoices, reports, and settlement receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Set settlement destination under <strong className="text-foreground">Settlement</strong> and customer-facing copy under <strong className="text-foreground">Checkout branding</strong>.</p>
          <p>Members and approval policies live in their own settings sections — keep roles aligned with treasury policy.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function SettlementSettingsForm() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['settings', 'settlement', orgId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, string>>('/settings/organization', {}, orgId),
  })
  const [address, setAddress] = useState('')
  const [asset, setAsset] = useState('')
  useEffect(() => {
    if (!q.data) return
    setAddress(q.data.preferred_destination_address || '')
    setAsset(q.data.preferred_destination_asset || '')
  }, [q.data])
  const save = useMutation({
    mutationFn: () => api('/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ preferred_destination_address: address, preferred_destination_asset: asset }),
    }, orgId),
    onSuccess: () => {
      mfToast.success('Settlement defaults saved')()
      void q.refetch()
    },
    onError: mfToast.error('Could not save defaults'),
  })
  if (q.isLoading) return <PageSkeleton />
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Settlement defaults</CardTitle>
          <CardDescription>Default destination for outgoing settlements in this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField label="Destination address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x… or account.near" /></FormField>
          <FormField label="Preferred asset ID" hint="Example: nep141:wrap.near for NEAR. Required for live pay links.">
            <Input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="nep141:wrap.near" />
          </FormField>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4" aria-hidden />
            Save defaults
          </Button>
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-muted/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Receivables collection</CardTitle>
          <CardDescription>Where customer payments land after settlement completes.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          These defaults apply to new invoices and standalone payment requests unless overridden per document.
        </CardContent>
      </Card>
    </div>
  )
}

function PoliciesSettingsForm() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['settings', 'policies', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ name?: string; rules?: Record<string, unknown> }>('/settings/policies', {}, orgId),
  })
  const [rules, setRules] = useState<Record<string, unknown>>({})
  useEffect(() => {
    if (q.data?.rules) setRules({ ...q.data.rules })
  }, [q.data])
  const save = useMutation({
    mutationFn: () => api('/settings/policies', { method: 'PATCH', body: JSON.stringify({ name: q.data?.name || 'Policy', rules }) }, orgId),
    onSuccess: () => {
      mfToast.success('Policy saved')()
      void q.refetch()
    },
    onError: mfToast.error('Could not save policy'),
  })
  const toggle = (key: string) => setRules((prev) => ({ ...prev, [key]: !prev[key] }))
  if (q.isLoading) return <PageSkeleton />
  return (
    <Card className="max-w-3xl border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>{q.data?.name || 'Approval policy'}</CardTitle>
        <CardDescription>Version {String(q.data?.rules ? 'active' : '—')}. Changes are audited.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          ['require_approved_supplier', 'Require approved supplier for AP settlement'],
          ['require_match_passed', 'Require three-way match pass'],
          ['block_exact_duplicates', 'Block exact duplicate bills'],
          ['dual_control', 'Dual control (no self-approval)'],
          ['kill_switch', 'Settlement kill-switch'],
        ].map(([key, label]) => (
          <label htmlFor={key} key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-card/50 p-3">
            <span className="text-sm">{label}</span>
            <Switch id={key} checked={!!rules[key]} onCheckedChange={() => toggle(key)} />
          </label>
        ))}
        <FormField label="Auto-approve cap (decimal)">
          <Input value={String(rules.auto_approve_cap_decimal ?? '0')} onChange={(e) => setRules((p) => ({ ...p, auto_approve_cap_decimal: e.target.value }))} />
        </FormField>
        <FormField label="Daily settlement cap (decimal)">
          <Input value={String(rules.daily_settlement_cap_decimal ?? '0')} onChange={(e) => setRules((p) => ({ ...p, daily_settlement_cap_decimal: e.target.value }))} />
        </FormField>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4" aria-hidden />
          Save policy
        </Button>
      </CardContent>
    </Card>
  )
}

function MembersSettingsPanel() {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: ['settings', 'members', orgId],
    enabled: !!orgId,
    queryFn: () => api<Array<Record<string, unknown>>>('/organizations/members', {}, orgId),
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const invite = useMutation({
    mutationFn: () => api('/organizations/members', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) }, orgId),
    onSuccess: () => {
      mfToast.success('Invite sent')()
      setInviteEmail('')
      void q.refetch()
    },
    onError: mfToast.error('Invite failed'),
  })
  const roles = ['owner', 'administrator', 'finance_manager', 'ap_officer', 'approver', 'accountant', 'viewer']
  return (
    <div className="space-y-4">
      <Card>
          <CardHeader><CardTitle>Invite member</CardTitle><CardDescription>Creates an account if needed, then adds membership.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <FormField label="Email">
              <Input placeholder="email@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Role">
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <Button onClick={() => invite.mutate()} disabled={!inviteEmail || invite.isPending}>
            <UserPlus className="size-4" aria-hidden />
            Invite
          </Button>
        </CardContent>
      </Card>
      <QueryFrame loading={q.isLoading} error={q.error as Error | null} empty={!q.data?.length}>
        <DataTable
          rows={(q.data || []) as Array<Record<string, unknown>>}
          columns={[
            { key: 'display_name', label: 'Name', render: (r) => String(r.display_name || '—') },
            { key: 'user_email', label: 'Email' },
            { key: 'role', label: 'Role', render: (r) => <span className="capitalize">{String(r.role).replaceAll('_', ' ')}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status || 'active')} /> },
          ]}
        />
      </QueryFrame>
    </div>
  )
}

export function SettingsPage({ kind }: { kind: 'profile' | 'organization' | 'checkout' | 'members' | 'wallets' | 'settlement' | 'policies' | 'notifications' | 'security' }) {
  const orgId = useOrgId()
  const titles: Record<string, [string, string]> = {
    profile: ['Profile', 'User profile settings.'],
    organization: ['Organization', 'Business profile and defaults.'],
    checkout: ['Checkout branding', 'Logo, colors, and copy on public payment links.'],
    members: ['Members', 'Roles and invitations.'],
    wallets: ['Wallets', 'Settlement addresses.'],
    settlement: ['Settlement', 'Assets, slippage and defaults.'],
    policies: ['Policies', 'Approval and payment rules.'],
    notifications: ['Notifications', 'Alert preferences.'],
    security: ['Account security', 'Password, sessions, and how you sign in.'],
  }
  const [title, description] = titles[kind]
  const notificationsQ = useQuery({
    queryKey: ['settings', 'notifications', orgId],
    enabled: !!orgId && kind === 'notifications',
    queryFn: () => api<Array<Record<string, unknown>>>('/settings/notifications', {}, orgId),
  })
  const backup = useMutation({
    mutationFn: () => api('/settings/backup-export', { method: 'POST' }, orgId),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `matchflow-org-${orgId}-backup.json`
      a.click()
      mfToast.success('Backup downloaded')()
    },
    onError: mfToast.error('Backup export failed'),
  })
  return (
    <WorkspacePage>
      <PageHeader
        title={title}
        description={description}
        actions={
          kind === 'organization' ? (
            <Button variant="outline" onClick={() => backup.mutate()} disabled={backup.isPending}>
              <Download className="size-4" aria-hidden />
              Export backup
            </Button>
          ) : undefined
        }
      />
      <SettingsContentGrid>
        {kind === 'profile' ? <ProfileNearPanel /> : null}
        {kind === 'wallets' ? <WalletsSettingsPanel /> : null}
        {kind === 'organization' ? <OrganizationSettingsForm /> : null}
        {kind === 'checkout' ? <CheckoutBrandingForm /> : null}
        {kind === 'settlement' ? <SettlementSettingsForm /> : null}
        {kind === 'policies' ? <PoliciesSettingsForm /> : null}
        {kind === 'members' ? <MembersSettingsPanel /> : null}
        {kind === 'notifications' ? (
          <QueryFrame loading={notificationsQ.isLoading} error={notificationsQ.error as Error | null}>
            <DataTable
              rows={(notificationsQ.data || []) as Array<Record<string, unknown>>}
              emptyTitle="No notifications yet"
              columns={[
                { key: 'type', label: 'Type' },
                { key: 'subject', label: 'Subject' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                { key: 'created_at', label: 'Sent' },
              ]}
            />
          </QueryFrame>
        ) : null}
        {kind === 'security' ? <SecuritySettingsPanel /> : null}
      </SettingsContentGrid>
    </WorkspacePage>
  )
}

function ProfileNearPanel() {
  const { user, needsNearLink, linkNearWallet, unlinkNearWallet, connecting } = useNearAuth()
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>{user?.email || user?.nearAccountId || 'Signed in'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <KeyValueList items={[
          { label: 'Display name', value: user?.displayName || '—' },
          { label: 'NEAR wallet', value: user?.nearAccountId || 'Not linked' },
        ]} />
        {needsNearLink ? (
          <Button onClick={() => void linkNearWallet()} disabled={connecting}>
            <Wallet className="size-4" aria-hidden />
            {connecting ? 'Connecting…' : 'Link NEAR wallet'}
          </Button>
        ) : user?.nearAccountId ? (
          <Button variant="outline" onClick={() => void unlinkNearWallet()}>
            <Wallet className="size-4" aria-hidden />
            Unlink NEAR wallet
          </Button>
        ) : null}
      </CardContent>
    </Card>
    <Card className="border-border/80 bg-muted/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
        <CardDescription>Password and session controls</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/app/settings/security">
            <LogIn className="size-4" aria-hidden />
            Account security
          </Link>
        </Button>
      </CardContent>
    </Card>
    </div>
  )
}

function WalletsSettingsPanel() {
  const { user, needsNearLink, linkNearWallet, unlinkNearWallet, connecting, error } = useNearAuth()
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>NEAR wallet</CardTitle>
        <CardDescription>
          Required for operator-signed settlement flows. Email accounts can link a wallet any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {user?.nearAccountId ? (
          <>
            <KeyValueList items={[
              { label: 'Linked account', value: user.nearAccountId },
              { label: 'Linked at', value: user.nearLinkedAt || '—' },
            ]} />
            <Button variant="outline" onClick={() => void unlinkNearWallet()}>
              <Wallet className="size-4" aria-hidden />
              Unlink wallet
            </Button>
          </>
        ) : (
          <>
            <Alert>
              <AlertDescription>
                No NEAR wallet linked. Connect a wallet to settle and receive Intent deposits.
              </AlertDescription>
            </Alert>
            <Button onClick={() => void linkNearWallet()} disabled={connecting}>
              <Wallet className="size-4" aria-hidden />
              {connecting ? 'Connecting…' : 'Connect NEAR wallet'}
            </Button>
          </>
        )}
        {needsNearLink && error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
    <Card className="border-border/80 bg-muted/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Settlement readiness</CardTitle>
        <CardDescription>Link a wallet before initiating AP payouts or confirming deposits.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Destination addresses for collections are configured under Settlement defaults.
      </CardContent>
    </Card>
    </div>
  )
}

export function PaymentStatusPage() {
  const { token } = useParams({ strict: false }) as { token: string }
  const invoice = useQuery({
    queryKey: ['public-invoice-status-meta', token],
    queryFn: () =>
      api<{
        organizationName?: string
        invoiceNumber?: string
        brandTheme?: string
        checkoutTagline?: string
        checkoutAccentColor?: string
        checkoutLogoUrl?: string
        checkoutSupportEmail?: string
      }>(`/public/invoices/${token}`),
  })
  const q = useQuery({
    queryKey: ['pay-status', token],
    queryFn: () => api<Record<string, unknown>>(`/public/payments/${token}/status`),
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string; settlement?: { normalized_status?: string }; invoiceStatus?: string } | undefined
      const status = String(data?.settlement?.normalized_status || data?.status || data?.invoiceStatus || '')
      return ['SUCCESS', 'FAILED', 'REFUNDED', 'paid'].includes(status) ? false : 3000
    },
  })
  const merchant = invoice.data?.organizationName ?? 'MATCHFLOW'
  const payload = q.data as Record<string, unknown> | undefined
  const settlement = (payload?.settlement ?? {}) as Record<string, unknown>
  const norm = String(settlement.normalized_status ?? payload?.status ?? payload?.invoiceStatus ?? '')
  const paid = ['SUCCESS', 'paid', 'PAID'].includes(norm) || String(payload?.invoiceStatus) === 'paid'
  const polling = !paid && !['FAILED', 'REFUNDED'].includes(norm)
  return (
    <PublicCheckoutShell
      label="Payment status"
      organizationName={merchant}
      checkoutTagline={invoice.data?.checkoutTagline}
      checkoutAccentColor={invoice.data?.checkoutAccentColor}
      checkoutLogoUrl={invoice.data?.checkoutLogoUrl}
      checkoutSupportEmail={invoice.data?.checkoutSupportEmail}
      invoiceNumber={invoice.data?.invoiceNumber}
    >
      <div className="flex justify-end">
        <LivePollingBadge active={polling && !q.isLoading} />
      </div>
      <QueryFrame loading={q.isLoading} error={q.isError ? new Error('Unable to load payment status.') : null}>
        <PublicPaymentStatusCard data={payload} receiptToken={paid ? token : undefined} payToken={token} />
      </QueryFrame>
      <Button asChild variant="outline" className="w-full">
        <Link to="/pay/$token" params={{ token }}>{paid ? 'View invoice' : 'Back to checkout'}</Link>
      </Button>
      {paid ? (
        <Button asChild className="w-full">
          <Link to="/receipt/$token" params={{ token }}>Open settlement receipt</Link>
        </Button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Receipt unlocks after on-chain SUCCESS.</p>
      )}
    </PublicCheckoutShell>
  )
}

export function ReceiptPage() {
  const { token } = useParams({ strict: false }) as { token: string }
  const receiptPdf = useMutation({
    mutationFn: () =>
      api<{ pdfBase64?: string; filename?: string; html?: string; pdfFallback?: boolean }>(
        `/public/receipts/${token}/pdf`,
      ),
    onSuccess: (res) => {
      if (res.pdfBase64) {
        downloadInvoicePdfFromBase64(res.pdfBase64, res.filename || `receipt-${token}.pdf`)
        return
      }
      const msg = res.message
      mfToast.error('Receipt PDF unavailable', msg || 'Install dompdf via composer in the plugin directory.')()
      if (res.html && res.pdfFallback) {
        openInvoicePrintablePdf(res.html, res.filename || 'receipt.pdf')
      }
    },
    onError: (e: Error) => mfToast.error('Could not download receipt', e.message)(),
  })
  const meta = useQuery({
    queryKey: ['public-invoice-receipt-meta', token],
    queryFn: () =>
      api<{
        organizationName?: string
        invoiceNumber?: string
        checkoutTagline?: string
        checkoutAccentColor?: string
        checkoutLogoUrl?: string
        checkoutSupportEmail?: string
      }>(`/public/invoices/${token}`),
  })
  const q = useQuery({
    queryKey: ['receipt', token],
    queryFn: () => api(`/public/receipts/${token}`),
  })
  const merchant = meta.data?.organizationName ?? 'MATCHFLOW'
  return (
    <PublicCheckoutShell
      label="Receipt"
      organizationName={merchant}
      checkoutTagline={meta.data?.checkoutTagline}
      checkoutAccentColor={meta.data?.checkoutAccentColor}
      checkoutLogoUrl={meta.data?.checkoutLogoUrl}
      checkoutSupportEmail={meta.data?.checkoutSupportEmail}
      invoiceNumber={meta.data?.invoiceNumber}
    >
      <QueryFrame loading={q.isLoading} error={q.isError ? new Error('Receipt not ready yet. Track status until settlement succeeds.') : null}>
        <PublicReceiptCard data={q.data as Record<string, unknown>} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="w-full flex-1"
            size="lg"
            disabled={receiptPdf.isPending}
            onClick={() => receiptPdf.mutate()}
          >
            {receiptPdf.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
            Download
          </Button>
          <Button asChild variant="outline" className="w-full flex-1" size="lg">
            <Link to="/pay/$token/status" params={{ token }}>Payment status</Link>
          </Button>
        </div>
      </QueryFrame>
    </PublicCheckoutShell>
  )
}

export function SupplierSubmitPage() {
  const { token } = useParams({ strict: false }) as { token: string }
  const [fileName, setFileName] = useState('')
  const submit = useMutation({
    mutationFn: () => api(`/public/supplier/${token}/submit`, {
      method: 'POST',
      body: JSON.stringify({ invoice_number: `SUP-${Date.now()}`, file_name: fileName || 'invoice.pdf' }),
    }),
  })
  return (
    <PublicShell brand="Supplier invoice upload">
      <Card>
        <CardHeader>
          <CardTitle>Secure submit</CardTitle>
          <CardDescription>Upload creates a bill draft without workspace access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField label="File name"><Input value={fileName} onChange={(e) => setFileName(e.target.value)} /></FormField>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            <Send className="size-4" aria-hidden />
            Submit invoice
          </Button>
          {submit.isSuccess ? <Alert variant="success"><AlertDescription>Submitted. Confirmation recorded.</AlertDescription></Alert> : null}
          {submit.isError ? <Alert variant="destructive"><AlertDescription>{(submit.error as Error).message}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
    </PublicShell>
  )
}

export function ForgotPasswordPage() {
  const [login, setLogin] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: () => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ login }) }),
    onError: (e: Error) => setError(e.message),
  })
  function submit() {
    const errs = validateForgotLogin(login)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setError('')
    mutation.mutate()
  }
  return (
    <AuthShell
      title="Forgot password"
      description="We will email a reset link if the account exists."
      footer={<Link className="text-primary hover:underline" to="/app/login">Back to sign in</Link>}
    >
      <FormField label="Email or username">
        <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" aria-invalid={!!fieldErrors.login} />
        {fieldErrors.login ? <p className="text-xs text-destructive">{fieldErrors.login}</p> : null}
      </FormField>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button className="w-full" onClick={submit} disabled={mutation.isPending}>
        <Mail className="size-4" aria-hidden />
        Send reset link
      </Button>
      {mutation.isSuccess ? <Alert variant="success"><AlertDescription>If an account exists, a reset email was sent.</AlertDescription></Alert> : null}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [login, setLogin] = useState('')
  const [key, setKey] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: () => api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ login, key, password }) }),
    onSuccess: () => { void appNavigate(routes.login) },
    onError: (e: Error) => setError(e.message),
  })
  function submit() {
    const errs = validateResetPassword({ login, key, password })
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setError('')
    mutation.mutate()
  }
  return (
    <AuthShell
      title="Reset password"
      description="Enter the key from your email and choose a new password (8+ characters)."
      footer={<Link className="text-primary hover:underline" to="/app/login">Back to sign in</Link>}
    >
      <FormField label="Email or username">
        <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" aria-invalid={!!fieldErrors.login} />
        {fieldErrors.login ? <p className="text-xs text-destructive">{fieldErrors.login}</p> : null}
      </FormField>
      <FormField label="Reset key">
        <Input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="one-time-code" aria-invalid={!!fieldErrors.key} />
        {fieldErrors.key ? <p className="text-xs text-destructive">{fieldErrors.key}</p> : null}
      </FormField>
      <FormField label="New password">
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!fieldErrors.password} />
        {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
      </FormField>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button className="w-full" onClick={submit} disabled={mutation.isPending}>
        <KeyRound className="size-4" aria-hidden />
        Update password
      </Button>
    </AuthShell>
  )
}

export function OnboardingWalletPage() {
  const orgId = useOrgId()
  const { user, needsNearLink, linkNearWallet, connecting, error: nearError } = useNearAuth()
  const [address, setAddress] = useState('')
  const [asset, setAsset] = useState('nep141:wrap.near')
  const save = useMutation({
    mutationFn: () => api('/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ preferred_destination_address: address, preferred_destination_asset: asset }),
    }, orgId),
    onSuccess: async () => {
      mfToast.success('Wallet settings saved')()
      await appNavigate(routes.onboardingComplete)
    },
    onError: mfToast.error('Could not save wallet settings'),
  })
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <OnboardingStepper active="wallet" />
      <PageHeader title="Wallet setup" description="Link your wallet and configure settlement destinations for your organization." />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>NEAR account</CardTitle>
          <CardDescription>Required before you can move money with Intents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user?.nearAccountId ? (
            <Alert variant="success"><AlertDescription>Linked: {user.nearAccountId}</AlertDescription></Alert>
          ) : (
            <div className="space-y-3">
              <Button onClick={() => void linkNearWallet()} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Link NEAR wallet'}
              </Button>
              {nearError ? (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-2">
                    <p>{nearError}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void linkNearWallet()} disabled={connecting}>
                      Try NEAR again
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <FormField label="Destination address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={user?.nearAccountId || '0x… or account.near'} /></FormField>
          <FormField label="Destination asset"><Input value={asset} onChange={(e) => setAsset(e.target.value)} /></FormField>
          <Button onClick={() => save.mutate()} disabled={!address || (needsNearLink && !user?.nearAccountId)}>
            <ArrowRight className="size-4" aria-hidden />
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function OnboardingCompletePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <OnboardingStepper active="complete" />
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Setup complete</CardTitle>
          <CardDescription>Issue invoices, run three-way match, and settle payables — checkout branding lives under Settings → Checkout branding.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <CreateLinkButton to="/app/overview">Go to overview</CreateLinkButton>
          <Button asChild variant="outline"><Link to="/app/settings/checkout">Customize checkout</Link></Button>
        </CardContent>
      </Card>
    </div>
  )
}
