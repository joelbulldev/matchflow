import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'
import { CounterpartySelect } from '@/components/matchflow/counterparty-select'

type Props = {
  orgId: number | null
  onDone?: (id: number) => void
  onCancel?: () => void
}

export function PaymentRequestCreateForm({ orgId, onDone, onCancel }: Props) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('Payment request')
  const [amount, setAmount] = useState('100')
  const [description, setDescription] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)

  const create = useMutation({
    mutationFn: () =>
      api<{ id: number; payment_url?: string }>(
        '/receivables/payment-requests',
        {
          method: 'POST',
          body: JSON.stringify({
            label,
            amount_decimal: amount,
            description,
            customer_id: customerId,
            currency: 'USD',
          }),
        },
        orgId,
      ),
    onSuccess: (row) => {
      mfToast.success('Payment link ready', 'Share the checkout URL with your payer.')()
      void qc.invalidateQueries({ queryKey: ['/receivables/payment-requests'] })
      void qc.invalidateQueries({ queryKey: ['payment-requests-links'] })
      onDone?.(row.id)
    },
    onError: mfToast.error('Could not create payment request'),
  })

  return (
    <div className="space-y-4">
      <FormField label="Title" hint="Shown on the public checkout page.">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Consulting retainer" />
      </FormField>
      <FormField label="Amount (USD)">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </FormField>
      <FormField label="Customer (optional)">
        <CounterpartySelect orgId={orgId} type="customer" value={customerId} onChange={setCustomerId} />
      </FormField>
      <FormField label="Description (optional)">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What this payment covers" />
      </FormField>
      <FormSurfaceFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="size-4" aria-hidden />
            Cancel
          </Button>
        ) : null}
        <Button type="button" onClick={() => create.mutate()} disabled={!orgId || !label || create.isPending}>
          <Link2 className="size-4" aria-hidden /> Create link
        </Button>
      </FormSurfaceFooter>
    </div>
  )
}
