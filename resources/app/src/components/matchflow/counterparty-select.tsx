import { useQuery } from '@tanstack/react-query'
import { Building2, User } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'

type Row = { id: number; name: string; email?: string; status?: string }

export function CounterpartySelect({
  orgId,
  type,
  value,
  onChange,
  placeholder,
}: {
  orgId: number | null
  type: 'customer' | 'supplier'
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}) {
  const q = useQuery({
    queryKey: ['counterparties', orgId, type],
    enabled: !!orgId,
    queryFn: () => api<Row[]>(`/counterparties?type=${type}`, {}, orgId),
  })

  if (q.isLoading) return <Skeleton className="h-10 w-full" />

  const Icon = type === 'customer' ? User : Building2

  return (
    <Select
      value={value ? String(value) : ''}
      onValueChange={(v) => onChange(v ? Number(v) : null)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? (type === 'customer' ? 'Select customer' : 'Select supplier')} />
      </SelectTrigger>
      <SelectContent>
        {(q.data ?? []).map((row) => (
          <SelectItem key={row.id} value={String(row.id)}>
            <span className="inline-flex items-center gap-2">
              <Icon className="size-3.5 opacity-70" />
              {row.name}
              {row.email ? <span className="text-muted-foreground"> · {row.email}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
