import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, SectionCard } from '@/components/matchflow'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'

export function BillLinesAdjust({
  orgId,
  billId,
  items,
  matchStatus,
}: {
  orgId: number | null
  billId: string
  items: Array<Record<string, unknown>>
  matchStatus?: string
}) {
  const qc = useQueryClient()
  const [lines, setLines] = useState(() =>
    items.map((row) => ({
      id: Number(row.id),
      description: String(row.description ?? ''),
      quantity: String(row.quantity_decimal ?? row.quantity ?? '0'),
      unit_price: String(row.unit_price_decimal ?? row.unit_price ?? '0'),
    })),
  )

  useEffect(() => {
    setLines(
      items.map((row) => ({
        id: Number(row.id),
        description: String(row.description ?? ''),
        quantity: String(row.quantity_decimal ?? row.quantity ?? '0'),
        unit_price: String(row.unit_price_decimal ?? row.unit_price ?? '0'),
      })),
    )
  }, [items])

  const save = useMutation({
    mutationFn: () =>
      api(`/payables/bills/${billId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: lines.map((l) => ({
            id: l.id,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        }),
      }, orgId),
    onSuccess: () => {
      mfToast.success('Bill updated', 'Re-run match from the Match screen.')()
      qc.invalidateQueries({ queryKey: ['bill', orgId, billId] })
      qc.invalidateQueries({ queryKey: ['bill-match-meta', orgId, billId] })
    },
    onError: mfToast.error('Could not update bill'),
  })

  if (!lines.length) return null

  return (
    <SectionCard
      title="Correct invoice lines"
      description={
        matchStatus === 'exception'
          ? 'Adjust quantities or prices, save, then re-run three-way match.'
          : 'Edit captured lines before matching or approval.'
      }
    >
      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div key={line.id} className="grid gap-2 rounded-lg border border-border/80 p-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
            <FormField label="Description">
              <Input
                value={line.description}
                onChange={(e) => {
                  const v = e.target.value
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: v } : l)))
                }}
              />
            </FormField>
            </div>
            <FormField label="Quantity">
              <Input
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => {
                  const v = e.target.value
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)))
                }}
              />
            </FormField>
            <FormField label="Unit price">
              <Input
                inputMode="decimal"
                value={line.unit_price}
                onChange={(e) => {
                  const v = e.target.value
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit_price: v } : l)))
                }}
              />
            </FormField>
          </div>
        ))}
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !orgId}>
          <Save className="size-4" aria-hidden />
          Save lines
        </Button>
      </div>
    </SectionCard>
  )
}