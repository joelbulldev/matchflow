import { getBootstrap, resolveRestBaseUrl } from '@/lib/api-client'

export async function uploadApBillDocument(orgId: number, file: File, billId?: number): Promise<{ id: number; sha256?: string }> {
  const fd = new FormData()
  fd.append('file', file)
  if (billId) {
    fd.append('owner_type', 'ap_bill')
    fd.append('owner_id', String(billId))
  }
  const res = await fetch(`${resolveRestBaseUrl()}/files`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': getBootstrap().restNonce,
      'X-Matchflow-Organization': String(orgId),
    },
    body: fd,
  })
  const json = (await res.json()) as { success?: boolean; data?: { id: number; sha256?: string }; message?: string }
  if (!res.ok || !json.success || !json.data?.id) {
    throw new Error(json.message || 'Upload failed')
  }
  return json.data
}