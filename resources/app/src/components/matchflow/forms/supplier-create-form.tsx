import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { SettlementAssetSelect } from '@/components/matchflow/settlement-asset-select'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'

export function SupplierCreateForm({
  orgId,
  onDone,
  onCancel,
}: {
  orgId: number | null
  onDone?: (id: number) => void
  onCancel?: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [assetId, setAssetId] = useState('nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near')

  const save = useMutation({
    mutationFn: async () => {
      const row = await api<{ id: number }>(
        '/counterparties',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'supplier', name, email, approved: true }),
        },
        orgId,
      )
      if (address) {
        await api(
          `/counterparties/${row.id}/addresses`,
          {
            method: 'POST',
            body: JSON.stringify({ chain_id: 'base', asset_id: assetId, address, status: 'verified' }),
          },
          orgId,
        )
      }
      return row
    },
    onSuccess: (row) => {
      mfToast.success('Supplier saved')()
      qc.invalidateQueries({ queryKey: ['/counterparties'] })
      onDone?.(row.id)
    },
    onError: mfToast.error('Could not save supplier'),
  })

  return (
    <div className="space-y-4">
      <FormField label="Legal name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label="Accounts payable email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
      <FormField label="Settlement address" hint="Base/NEAR OMFT destination for payouts.">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
      </FormField>
      <FormField label="Settlement asset" hint="Token the supplier accepts on-chain (OMFT asset id is stored internally).">
        <SettlementAssetSelect value={assetId} onChange={setAssetId} disabled={save.isPending} />
      </FormField>
      <FormSurfaceFooter
        onCancel={onCancel}
        onSubmit={() => save.mutate()}
        submitLabel={<><Building2 className="size-4" /> Save supplier</>}
        disabled={!name}
        pending={save.isPending}
      />
    </div>
  )
}
