import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURATED_ASSET_LABELS, labelOriginAsset, type SupportedToken } from '@/lib/checkout-theme'
import { settlementAssetLabel } from '@/lib/settlement-labels'
import { api } from '@/lib/api-client'

const FALLBACK_ASSET_IDS = [
  'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
  'nep141:wrap.near',
  'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  'nep141:ethereum.omft.near',
  'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
]

export function SettlementAssetSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (assetId: string) => void
  disabled?: boolean
}) {
  const supported = useQuery({
    queryKey: ['supported-assets'],
    queryFn: () => api<SupportedToken[]>('/supported-assets'),
    staleTime: 300_000,
  })

  const options = useMemo(() => {
    const tokens = supported.data ?? []
    const ids = new Set<string>(FALLBACK_ASSET_IDS)
    for (const t of tokens) {
      const id = String(t.assetId ?? t.id ?? '').trim()
      if (id) ids.add(id)
    }
    if (value) ids.add(value)
    return [...ids].map((id) => ({
      id,
      label: labelOriginAsset(id, tokens.length ? tokens : undefined) || settlementAssetLabel(id),
    }))
  }, [supported.data, value])

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled || supported.isLoading}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select settlement asset" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.label}
          </SelectItem>
        ))}
        {value && !options.some((o) => o.id === value) ? (
          <SelectItem value={value}>{CURATED_ASSET_LABELS[value] ?? settlementAssetLabel(value)}</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}