import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { CounterpartySelect } from '@/components/matchflow/counterparty-select'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'

type Line = { id: string; description: string; quantity: string; unit_price: string }

export function PurchaseOrderCreateForm({
  orgId,
  onDone,
  onCancel,
}: {
  orgId: number | null
  onDone?: (poId: number) => void
  onCancel?: () => void
}) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { id: '1', description: 'Solar equipment', quantity: '120', unit_price: '20' },
  ])

  const addLine = () => setLines((prev) => [...prev, { id: String(Date.now()), description: '', quantity: '1', unit_price: '0' }])

  const create = useMutation({
    mutationFn: () =>
      api<{ id: number }>(
        '/procurement/purchase-orders',
        {
          method: 'POST',
          body: JSON.stringify({
            supplier_id: supplierId,
            currency: 'USD',
            notes,
            items: lines.map((l) => ({
              description: l.description || 'Line item',
              quantity: l.quantity,
              ordered_quantity: l.quantity,
              unit_price: l.unit_price,
              price_tolerance_bps: 50,
            })),
          }),
        },
        orgId,
      ),
    onSuccess: (row) => {
      mfToast.success('Purchase order created')()
      qc.invalidateQueries({ queryKey: ['/procurement/purchase-orders'] })
      onDone?.(row.id)
    },
    onError: mfToast.error('Could not create PO'),
  })

  return (
    <div className="space-y-4">
      <FormField label="Supplier">
        <CounterpartySelect orgId={orgId} type="supplier" value={supplierId} onChange={setSupplierId} />
      </FormField>
      <FormField label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Delivery window, Incoterms, etc." />
      </FormField>
      <div className="space-y-3">
        <p className="text-sm font-medium">Line items</p>
        {lines.map((line, idx) => (
          <div key={line.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
            <Input
              className="sm:col-span-2"
              placeholder="Description"
              value={line.description}
              onChange={(e) => {
                const v = e.target.value
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: v } : l)))
              }}
            />
            <Input
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => {
                const v = e.target.value
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
              }}
            />
            <Input
              placeholder="Unit price"
              value={line.unit_price}
              onChange={(e) => {
                const v = e.target.value
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit_price: v } : l)))
              }}
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          Add line
        </Button>
      </div>
      <FormSurfaceFooter
        onCancel={onCancel}
        onSubmit={() => create.mutate()}
        submitLabel={<><PackagePlus className="size-4" /> Create PO</>}
        disabled={!supplierId}
        pending={create.isPending}
      />
    </div>
  )
}
