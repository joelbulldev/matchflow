import { CURATED_ASSET_LABELS } from '@/lib/checkout-theme'

const PURPOSE_LABELS: Record<string, string> = {
  AR_COLLECTION: 'Invoice payment',
  AP_SETTLEMENT: 'Supplier payment',
}

export function settlementPurposeLabel(raw: string | undefined | null): string {
  const code = String(raw ?? '').trim()
  if (!code) return '—'
  if (PURPOSE_LABELS[code]) return PURPOSE_LABELS[code]
  if (!code.includes('_')) return code
  return code
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function settlementAssetLabel(assetId: string | undefined | null, serverLabel?: string | null): string {
  const fromServer = String(serverLabel ?? '').trim()
  if (fromServer && !fromServer.startsWith('nep141:') && !fromServer.startsWith('1cs_')) {
    return fromServer
  }
  const id = String(assetId ?? '').trim()
  if (!id) return '—'
  return CURATED_ASSET_LABELS[id] ?? (id.includes('17208628f84f5d6') ? 'USDC (NEAR)' : id.includes('wrap.near') ? 'NEAR' : id.length > 28 ? `${id.slice(0, 16)}…` : id)
}

export function isNearTransactionHash(hash: string): boolean {
  const h = hash.trim()
  if (!h || h.startsWith('0x')) return false
  return /^[1-9A-HJ-NP-Za-km-z]{40,64}$/.test(h)
}

export function nearExplorerTxUrl(hash: string): string {
  return `https://nearblocks.io/txns/${encodeURIComponent(hash.trim())}`
}

export function truncateHash(hash: string, head = 8, tail = 8): string {
  const h = hash.trim()
  if (h.length <= head + tail + 1) return h
  return `${h.slice(0, head)}…${h.slice(-tail)}`
}