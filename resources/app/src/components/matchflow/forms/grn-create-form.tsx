import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { PurchaseOrderSelect } from '@/components/matchflow/purchase-order-select'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'

export function GrnCreateForm({
  orgId,
  onDone,
  onCancel,
}: {
  orgId: number | null
  onDone?: (id: number) => void
  onCancel?: () => void
}) {
  const qc = useQueryClient()
  const [poId, setPoId] = useState<number | null>(null)
  const [reference, setReference] = useState(`GRN-${String(Date.now()).slice(-6)}`)
  const [qty, setQty] = useState('100')

  const create = useMutation({
    mutationFn: () =>
      api<{ id: number }>(
        '/procurement/goods-receipts',
        {
          method: 'POST',
          body: JSON.stringify({
            po_id: poId,
            receipt_reference: reference,
            items: [{ po_item_index: 0, received_quantity: qty }],
          }),
        },
        orgId,
      ),
    onSuccess: (row) => {
      mfToast.success('Receipt recorded')()
      qc.invalidateQueries({ queryKey: ['/procurement/goods-receipts'] })
      onDone?.(row.id)
    },
    onError: mfToast.error('Could not record receipt'),
  })

  return (
    <div className="space-y-4">
      <FormField label="Purchase order">
        <PurchaseOrderSelect orgId={orgId} value={poId} onChange={setPoId} />
      </FormField>
      <FormField label="Receipt reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></FormField>
      <FormField label="Received quantity (line 0)" hint="Demo: 100 received vs 120 ordered catches over-billing.">
        <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
      </FormField>
      <FormSurfaceFooter
        onCancel={onCancel}
        onSubmit={() => create.mutate()}
        submitLabel={<><PackageCheck className="size-4" /> Record delivery</>}
        disabled={!poId}
        pending={create.isPending}
      />
    </div>
  )
}
