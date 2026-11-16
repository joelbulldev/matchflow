import type { CSSProperties } from 'react'

/** Old DB default — never treat as a merchant accent. */
export const LEGACY_CHECKOUT_ACCENT = '#4f46e5'

/** Hex (#rrggbb) → space-separated HSL channels for Tailwind `hsl(var(--primary))`. */
export function hexToPrimaryChannels(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  const r = parseInt(m[1], 16) / 255
  const g = parseInt(m[2], 16) / 255
  const b = parseInt(m[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return `0 0% ${Math.round(l * 100)}%`
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h /= 6
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Valid #rrggbb set by the merchant; empty / invalid → use app default (Matchflow primary). */
export function resolveCheckoutAccent(value?: string | null): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(raw)
  if (!m) return null
  const normalized = `#${m[1]}${m[2]}${m[3]}`.toLowerCase()
  if (normalized === LEGACY_CHECKOUT_ACCENT) return null
  return normalized
}

export function checkoutThemeStyle(accentHex?: string | null): CSSProperties | undefined {
  const resolved = resolveCheckoutAccent(accentHex)
  if (!resolved) return undefined
  const primary = hexToPrimaryChannels(resolved)
  if (!primary) return { ['--checkout-accent' as string]: resolved }
  return {
    ['--checkout-accent' as string]: resolved,
    ['--primary' as string]: primary,
    ['--ring' as string]: primary,
  }
}

export const CURATED_ASSET_LABELS: Record<string, string> = {
  'nep141:wrap.near': 'NEAR',
  'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1': 'USDC (NEAR)',
  'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near': 'USDC (Base)',
  'nep141:ethereum.omft.near': 'ETH',
  'nep141:btc.omft.near': 'BTC',
  'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near': 'USDC (Arbitrum)',
}

export type SupportedToken = {
  assetId?: string
  id?: string
  symbol?: string
  chain?: string
  name?: string
}

export function labelOriginAsset(id: string, tokens: SupportedToken[] = []): string {
  if (CURATED_ASSET_LABELS[id]) return CURATED_ASSET_LABELS[id]
  const hit = tokens.find((t) => (t.assetId ?? t.id) === id)
  if (hit?.symbol) {
    const chain = hit.chain ? ` (${hit.chain})` : ''
    return `${hit.symbol}${chain}`
  }
  if (id.includes('wrap.near')) return 'NEAR'
  if (id.includes('base-0x833589')) return 'USDC (Base)'
  return 'Select asset'
}
