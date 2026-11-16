import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FilePlus, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CounterpartySelect } from '@/components/matchflow/counterparty-select'
import { EmptyState, FormField, PageHeader, PageSkeleton } from '@/components/matchflow'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { toast } from '@/lib/toast'
import { mfToast } from '@/lib/mutation-feedback'
import { InvoicePreviewPanel } from './InvoicePreviewPanel'
import { INVOICE_TEMPLATES, type InvoiceBrandTheme, type InvoiceLineItem } from './invoice-types'
import { downloadInvoicePdfFromBase64, openInvoicePrintablePdf } from '@/lib/invoice-pdf-client'

import { useOrgId as useWorkspaceOrgId } from '@/lib/use-org-id'

function dueIso(days: string) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days || 30))
  return d.toISOString().slice(0, 10)
}

export function InvoiceCreatePage() {
  const { invoiceId: editInvoiceId } = useParams({ strict: false }) as { invoiceId?: string }
  const isEdit = Boolean(editInvoiceId)
  const { orgId, isLoading: orgLoading, needsOrg } = useWorkspaceOrgId()
  const qc = useQueryClient()
  const [templateKey, setTemplateKey] = useState<keyof typeof INVOICE_TEMPLATES>('professional')
  const [theme, setTheme] = useState<InvoiceBrandTheme>('classic')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`)
  const [dueInDays, setDueInDays] = useState('30')
  const [notes, setNotes] = useState('Thank you for your business.')
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    INVOICE_TEMPLATES.professional.lines.map((l, i) => ({ id: String(i + 1), ...l })),
  )
  const [draftId, setDraftId] = useState<number | null>(editInvoiceId ? Number(editInvoiceId) : null)

  const existing = useQuery({
    queryKey: ['invoice', orgId, editInvoiceId],
    enabled: isEdit && !!orgId && !!editInvoiceId,
    queryFn: () => api<Record<string, unknown>>(`/receivables/invoices/${editInvoiceId}`, {}, orgId),
  })

  useEffect(() => {
    const inv = existing.data
    if (!inv) return
    setInvoiceNumber(String(inv.invoice_number ?? invoiceNumber))
    setCustomerId(inv.customer_id ? Number(inv.customer_id) : null)
    setNotes(String(inv.notes ?? notes))
    const bt = String(inv.brand_theme ?? '')
    if (bt === 'classic' || bt === 'minimal' || bt === 'bold') setTheme(bt)
    if (inv.due_date) {
      const due = new Date(String(inv.due_date))
      const days = Math.max(1, Math.ceil((due.getTime() - Date.now()) / 86400000))
      setDueInDays(String(days))
    }
    const rawItems = inv.items
    if (Array.isArray(rawItems) && rawItems.length) {
      setLines(
        rawItems.map((item, i) => {
          const r = item as Record<string, unknown>
          return {
            id: String(i + 1),
            description: String(r.description ?? ''),
            quantity: String(r.quantity_decimal ?? r.quantity ?? '1'),
            unit_price: String(r.unit_price_decimal ?? r.unit_price ?? '0'),
            tax_rate: String(r.tax_rate ?? '0'),
          }
        }),
      )
    }
  }, [existing.data])

  const customers = useQuery({
    queryKey: ['counterparties', orgId, 'customer'],
    enabled: !!orgId,
    queryFn: () => api<Array<{ id: number; name: string; email?: string }>>(`/counterparties?type=customer`, {}, orgId),
  })
  const customer = customers.data?.find((c) => c.id === customerId)

  const dueLabel = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + Number(dueInDays || 30))
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }, [dueInDays])

  const saveDraft = useMutation({
    mutationFn: async () => {
      const body = {
        customer_id: customerId,
        currency: 'USD',
        invoice_number: invoiceNumber,
        due_date: dueIso(dueInDays),
        notes,
        brand_theme: theme,
        items: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
      }
      if (draftId) {
        await api(`/receivables/invoices/${draftId}`, { method: 'PATCH', body: JSON.stringify(body) }, orgId)
        return { id: draftId }
      }
      const created = await api<{ id: number }>('/receivables/invoices', { method: 'POST', body: JSON.stringify(body) }, orgId)
      setDraftId(created.id)
      return created
    },
    onSuccess: () => toast.success('Draft saved'),
    onError: (e: Error) => {
      if (e.message.toLowerCase().includes('organization')) {
        toast.error('Organization required', 'Finish workspace setup under Settings or onboarding.')
      } else {
        mfToast.error('Could not save draft')(e)
      }
    },
  })

  const issue = useMutation({
    mutationFn: async () => {
      let id = draftId
      if (!id) {
        const saved = await saveDraft.mutateAsync()
        id = Number(saved.id)
      }
      return api<{ id?: number; payment_url?: string }>(`/receivables/invoices/${id}/issue`, { method: 'POST' }, orgId)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice issued', 'Payment link is live.')
      void import('@/lib/navigation').then((m) => m.appNavigate(routes.invoice(String(data.id ?? draftId))))
    },
    onError: mfToast.error('Could not issue invoice'),
  })

  const previewPdf = useMutation({
    mutationFn: async () => {
      let id = draftId
      if (!id) {
        const saved = await saveDraft.mutateAsync()
        id = Number(saved.id)
        setDraftId(id)
      }
      const res = await api<{ html?: string; pdfBase64?: string; filename?: string }>(
        `/receivables/invoices/${id}/pdf?format=html`,
        { method: 'POST' },
        orgId,
      )
      if (res.pdfBase64) {
        downloadInvoicePdfFromBase64(res.pdfBase64, res.filename || 'invoice-preview.pdf')
      } else if (res.html) {
        openInvoicePrintablePdf(res.html, res.filename || 'invoice-preview')
      }
      return res
    },
    onError: mfToast.error('PDF preview failed'),
  })

  const applyTemplate = (key: keyof typeof INVOICE_TEMPLATES) => {
    setTemplateKey(key)
    const t = INVOICE_TEMPLATES[key]
    setTheme(t.accent)
    setLines(t.lines.map((l, i) => ({ id: String(Date.now()) + i, ...l })))
  }

  const updateLine = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const addLine = () => setLines((prev) => [...prev, { id: String(Date.now()), description: '', quantity: '1', unit_price: '0', tax_rate: '0' }])

  if ((isEdit && existing.isLoading) || orgLoading) return <PageSkeleton />
  if (needsOrg) {
    return (
      <EmptyState
        title="Create a workspace first"
        description="Invoices belong to an organization. Set up your business profile, then return here to issue payment links."
        action={<Button asChild><Link to={routes.onboardingBusiness}>Set up workspace</Link></Button>}
      />
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="space-y-5">
        <PageHeader
          title={isEdit ? 'Edit invoice' : 'Create invoice'}
          description="Customer picker, multi-line items, branded PDF, and instant NEAR payment link."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={!customerId || saveDraft.isPending}>
                <Save className="size-4" /> Save draft
              </Button>
              <Button onClick={() => issue.mutate()} disabled={!customerId || issue.isPending}>
                <FilePlus className="size-4" /> Issue & pay link
              </Button>
            </div>
          }
        />

        <Card>
          <CardContent className="space-y-4 pt-5">
            <FormField label="Template">
              <h4 className="sr-only">Invoice template</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(INVOICE_TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTemplate(key as keyof typeof INVOICE_TEMPLATES)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${templateKey === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <span className="font-medium">{t.label}</span>
                    {'description' in t && t.description ? (
                      <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Brand style">
                <Select value={theme} onValueChange={(v) => setTheme(v as InvoiceBrandTheme)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Due in (days)">
                <Input type="number" min={1} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Invoice number">
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </FormField>
            <FormField label="Customer">
              <CounterpartySelect orgId={orgId} type="customer" value={customerId} onChange={setCustomerId} />
            </FormField>
            <FormField label="Notes">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line items</h3>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="size-4" /> Add line</Button>
            </div>
            {lines.map((line, idx) => (
              <div key={line.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-12">
                <Input
                  className="sm:col-span-5"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(idx, { description: e.target.value })}
                />
                <Input className="sm:col-span-2" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                <Input className="sm:col-span-2" placeholder="Rate" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                <Input className="sm:col-span-2" placeholder="Tax %" value={line.tax_rate} onChange={(e) => updateLine(idx, { tax_rate: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" className="sm:col-span-1" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove line">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <InvoicePreviewPanel
        invoiceNumber={invoiceNumber}
        dueDateLabel={dueLabel}
        customerName={customer?.name ?? ''}
        customerEmail={customer?.email}
        notes={notes}
        theme={theme}
        lines={lines}
        onPreviewPdf={() => previewPdf.mutate()}
        pdfPending={previewPdf.isPending}
      />
    </div>
  )
}
