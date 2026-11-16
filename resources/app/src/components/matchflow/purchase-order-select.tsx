import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api-client'
export function PurchaseOrderSelect({
  orgId,
  value,
  onChange,
  supplierId,
}: {
  orgId: number | null
  value: number | null
  onChange: (poId: number | null) => void
  supplierId?: number | null
}) {
  const q = useQuery({
    queryKey: ['po-picklist', orgId],
    enabled: !!orgId,
    queryFn: () => api<Array<Record<string, unknown>>>('/procurement/purchase-orders', {}, orgId),
    staleTime: 30_000,
  })
  const rows = (q.data || []).filter((row) => {
    if (!supplierId) return true
    return Number(row.supplier_id) === supplierId
  })
  return (
    <Select
      value={value ? String(value) : '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : Number(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder={q.isLoading ? 'Loading POs…' : 'Link purchase order'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No PO (manual bill)</SelectItem>
        {rows.map((row) => (
          <SelectItem key={String(row.id)} value={String(row.id)}>
            {`${String(row.po_number || `PO #${row.id}`)}${row.total_decimal ? ` · ${String(row.total_decimal)} ${String(row.currency || 'USD')}` : ''}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}