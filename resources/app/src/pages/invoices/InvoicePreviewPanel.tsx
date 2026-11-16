import { Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AmountDisplay, StatusBadge } from '@/components/matchflow'
import { cn } from '@/lib/utils'
import type { InvoiceBrandTheme, InvoiceLineItem } from './invoice-types'
import { sumLines } from './invoice-types'

type Props = {
  invoiceNumber: string
  dueDateLabel: string
  customerName: string
  customerEmail?: string
  notes: string
  theme: InvoiceBrandTheme
  lines: InvoiceLineItem[]
  onPreviewPdf?: () => void
  pdfPending?: boolean
}

const themeStyles: Record<InvoiceBrandTheme, string> = {
  classic: 'border-primary/30 shadow-[0_24px_60px_-32px_hsl(var(--primary)/0.45)]',
  minimal: 'border-border shadow-none bg-card',
  bold: 'border-0 shadow-xl overflow-hidden p-0',
}

export function InvoicePreviewPanel({
  invoiceNumber,
  dueDateLabel,
  customerName,
  customerEmail,
  notes,
  theme,
  lines,
  onPreviewPdf,
  pdfPending,
}: Props) {
  const totals = sumLines(lines)
  const isBold = theme === 'bold'
  const isMinimal = theme === 'minimal'
  return (
    <article className={cn('mf-invoice-preview mf-enter sticky top-20 max-h-[min(85vh,820px)] overflow-hidden overflow-y-auto rounded-2xl border bg-card', themeStyles[theme], isBold && 'grid sm:grid-cols-[7rem_1fr]')}>
      {isBold ? (
        <aside className="hidden bg-gradient-to-b from-slate-900 to-teal-900 px-4 py-8 text-white sm:block">
          <p className="text-2xl font-bold leading-none tracking-tight">INVOICE</p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">MATCHFLOW</p>
          <p className="mt-6 text-xs opacity-90">{invoiceNumber}</p>
        </aside>
      ) : (
        <div className={cn('h-2 w-full', isMinimal ? 'bg-border' : 'bg-primary')} />
      )}
      <div className={cn(isBold && 'min-w-0')}>
      <header className={cn('flex items-start justify-between gap-4 border-b border-border px-6 py-5', isMinimal ? 'bg-card' : 'bg-muted/25', isBold && 'sm:pt-8')}>
        <section>
          {!isBold ? (
            <>
              <p className="text-[10px] font-semibold tracking-[0.28em] text-primary">MATCHFLOW</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Invoice</h2>
            </>
          ) : null}
          <p className={cn('text-sm text-muted-foreground', !isBold && 'mt-0')}>{isBold ? invoiceNumber : invoiceNumber}</p>
        </section>
        <section className="text-right text-sm">
          <StatusBadge status="draft" />
          <p className="mt-2 text-muted-foreground">Due {dueDateLabel}</p>
        </section>
      </header>
      <div className="grid gap-6 px-6 py-5 text-sm sm:grid-cols-2">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bill to</p>
          <p className="mt-1 font-semibold">{customerName || 'Select customer'}</p>
          {customerEmail ? <p className="text-muted-foreground">{customerEmail}</p> : null}
        </section>
        <section className="text-right sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment</p>
          <p className="mt-1 text-muted-foreground">Secure payment link on issue</p>
        </section>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-y border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-6 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-6 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border/70">
              <td className="px-6 py-3">{line.description || '—'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="px-3 py-3 text-right"><AmountDisplay value={line.unit_price} /></td>
              <td className="px-6 py-3 text-right font-medium">
                <AmountDisplay value={String((Number(line.quantity) * Number(line.unit_price)).toFixed(2))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <footer className="space-y-2 border-t border-border bg-muted/20 px-6 py-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <AmountDisplay value={totals.subtotal.toFixed(2)} />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Tax</span>
          <AmountDisplay value={totals.tax.toFixed(2)} />
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total due</span>
          <AmountDisplay value={totals.total.toFixed(2)} />
        </div>
        {notes ? <p className="pt-2 text-xs text-muted-foreground">{notes}</p> : null}
        {onPreviewPdf ? (
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onPreviewPdf} disabled={pdfPending}>
            <Download className="size-4" /> {pdfPending ? 'Generating PDF…' : 'Preview branded PDF'}
          </Button>
        ) : null}
        <p className="flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground">
          <Sparkles className="size-3" /> Live preview — aligned with downloadable PDF
        </p>
      </footer>
      </div>
    </article>
  )
}
