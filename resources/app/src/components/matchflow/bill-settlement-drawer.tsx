import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { SettlementQuotePanel } from '@/components/matchflow/structured-views'
import { ResponsiveFormSurface } from '@/components/matchflow/responsive-form-surface'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'
import { Link } from '@tanstack/react-router'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: string
  orgId: number | null
  supplierName?: string
  amount?: string
}

export function BillSettlementDrawer({ open, onOpenChange, billId, orgId, supplierName, amount }: Props) {
  const [refundAddress, setRefundAddress] = useState('')
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null)
  const [settlementId, setSettlementId] = useState<number | null>(null)

  const preview = useMutation({
    mutationFn: () =>
      api('/settlements/quotes', {
        method: 'POST',
        body: JSON.stringify({
          dry: true,
          purpose: 'AP_SETTLEMENT',
          subject_type: 'ap_bill',
          subject_id: Number(billId),
          origin_asset_id: 'nep141:wrap.near',
          refund_address: refundAddress,
          destination_decimals: 6,
        }),
      }, orgId),
    onSuccess: (data) => {
      setQuote(data as Record<string, unknown>)
      mfToast.success('Quote preview ready')()
    },
    onError: mfToast.error('Quote preview failed'),
  })

  const commit = useMutation({
    mutationFn: () =>
      api('/settlements/quotes', {
        method: 'POST',
        body: JSON.stringify({
          dry: false,
          purpose: 'AP_SETTLEMENT',
          subject_type: 'ap_bill',
          subject_id: Number(billId),
          origin_asset_id: 'nep141:wrap.near',
          refund_address: refundAddress,
          destination_decimals: 6,
        }),
      }, orgId),
    onSuccess: (data) => {
      const id = Number((data as { settlement_id?: number; id?: number }).settlement_id ?? (data as { id?: number }).id)
      if (id) setSettlementId(id)
      setQuote(data as Record<string, unknown>)
      mfToast.success('Settlement started', 'Send the deposit, then track status.')()
    },
    onError: mfToast.error('Could not start settlement'),
  })

  function close() {
    onOpenChange(false)
  }

  return (
    <ResponsiveFormSurface
      open={open}
      onOpenChange={onOpenChange}
      title="Pay supplier bill"
      description="Cross-chain settlement — same flow as receivables, with quote review before deposit."
      footer={
        <FormSurfaceFooter
          onCancel={close}
          onSubmit={() => (quote ? commit.mutate() : preview.mutate())}
          submitLabel={quote ? 'Start settlement' : 'Preview quote'}
          disabled={!refundAddress.trim() || preview.isPending || commit.isPending}
          pending={preview.isPending || commit.isPending}
        />
      }
    >
      <Alert>
        <AlertDescription>
          Paying {supplierName || `bill #${billId}`}
          {amount ? ` · ${amount}` : ''}. Refund address must match your NEAR origin if the swap fails.
        </AlertDescription>
      </Alert>
      <FormField label="Refund address (.near)" hint="Your NEAR account for failed-swap refunds.">
        <Input value={refundAddress} onChange={(e) => setRefundAddress(e.target.value)} placeholder="treasury.near" />
      </FormField>
      {quote ? <SettlementQuotePanel quote={quote} /> : null}
      {settlementId ? (
        <Button asChild variant="outline" className="w-full">
          <Link to="/app/payments/$paymentId" params={{ paymentId: String(settlementId) }}>Open payment #{settlementId}</Link>
        </Button>
      ) : null}
    </ResponsiveFormSurface>
  )
}
