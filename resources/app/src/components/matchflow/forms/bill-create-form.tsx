import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField, FormSurfaceFooter } from '@/components/matchflow'
import { ApInvoiceUpload } from '@/components/matchflow/ap-invoice-upload'
import { PurchaseOrderSelect } from '@/components/matchflow/purchase-order-select'
import { api } from '@/lib/api-client'
import { uploadApBillDocument } from '@/lib/ap-file-upload'
import { mfToast } from '@/lib/mutation-feedback'
import { CounterpartySelect } from '@/components/matchflow/counterparty-select'

type Props = {
  orgId: number | null
  onDone?: (billId: number) => void
  onCancel?: () => void
}

const DEMO_LINE = 'Solar equipment'

export function BillCreateForm({ orgId, onDone, onCancel }: Props) {
  const qc = useQueryClient()
  const [poId, setPoId] = useState<number | null>(null)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState(`SUP-${String(Date.now()).slice(-8)}`)
  const [description, setDescription] = useState(DEMO_LINE)
  const [qty, setQty] = useState('120')
  const [price, setPrice] = useState('20')
  const [scanFile, setScanFile] = useState<File | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const bill = await api<{ id: number }>(
        '/payables/bills',
        {
          method: 'POST',
          body: JSON.stringify({
            supplier_id: supplierId,
            purchase_order_id: poId,
            invoice_number: invoiceNumber,
            currency: 'USD',
            items: [{ description, quantity: qty, unit_price: price }],
          }),
        },
        orgId,
      )
      if (scanFile && orgId) {
        await uploadApBillDocument(orgId, scanFile, bill.id)
      }
      return bill
    },
    onSuccess: (bill) => {
      mfToast.success('Bill captured', scanFile ? 'Invoice scan attached — review lines, then run match.' : 'Opening match workflow.')()
      qc.invalidateQueries({ queryKey: ['/payables/bills'] })
      onDone?.(bill.id)
    },
    onError: mfToast.error('Could not create bill'),
  })

  return (
    <div className="space-y-4">
      <ApInvoiceUpload file={scanFile} onFileChange={setScanFile} disabled={create.isPending} />
      <FormField label="Supplier" hint="Must match the PO supplier for three-way match.">
        <CounterpartySelect orgId={orgId} type="supplier" value={supplierId} onChange={setSupplierId} />
      </FormField>
      <FormField label="Supplier invoice #" hint="As printed on the vendor document.">
        <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
      </FormField>
      <FormField label="Purchase order" hint="Required for three-way match (PO → GRN → bill).">
        <PurchaseOrderSelect orgId={orgId} value={poId} onChange={setPoId} supplierId={supplierId} />
      </FormField>
      <FormField label="Line description" hint="Must match the PO line text (e.g. Solar equipment).">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Invoiced quantity">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </FormField>
        <FormField label="Unit price (USD)">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        </FormField>
      </div>
      <FormSurfaceFooter
        onCancel={onCancel}
        onSubmit={() => create.mutate()}
        submitLabel={<><FileUp className="size-4" /> Save &amp; match</>}
        disabled={!supplierId}
        pending={create.isPending}
      />
    </div>
  )
}