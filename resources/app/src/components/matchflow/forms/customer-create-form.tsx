import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'

export function CustomerCreateForm({
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

  const save = useMutation({
    mutationFn: () =>
      api<{ id: number }>(
        '/counterparties',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'customer', name, email }),
        },
        orgId,
      ),
    onSuccess: (row) => {
      mfToast.success('Customer created')()
      qc.invalidateQueries({ queryKey: ['/counterparties?type=customer'] })
      onDone?.(row.id)
    },
    onError: mfToast.error('Could not save customer'),
  })

  return (
    <div className="space-y-4">
      <FormField label="Customer name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label="Billing email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
      <FormSurfaceFooter
        onCancel={onCancel}
        onSubmit={() => save.mutate()}
        submitLabel={<><UserPlus className="size-4" /> Save customer</>}
        disabled={!name}
        pending={save.isPending}
      />
    </div>
  )
}
