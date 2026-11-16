/** Extract human-facing 1Click quote fields for checkout copy. */
export function readQuotePricing(payload: unknown): {
  amountInFormatted: string | null
  amountInUsd: string | null
  amountOutUsd: string | null
} {
  const root = (payload ?? {}) as Record<string, unknown>
  let quote: Record<string, unknown> = {}
  if (root.dry === true && root.quote && typeof root.quote === 'object') {
    const outer = root.quote as Record<string, unknown>
    quote = (outer.quote as Record<string, unknown>) ?? outer
  } else if (typeof root.quote_json === 'string' && root.quote_json !== '') {
    try {
      const parsed = JSON.parse(root.quote_json) as { quote?: Record<string, unknown> }
      quote = parsed.quote ?? {}
    } catch {
      quote = {}
    }
  } else if (root.quote && typeof root.quote === 'object') {
    const nested = root.quote as Record<string, unknown>
    quote = (nested.quote as Record<string, unknown>) ?? nested
  }
  const fmt = (key: string) => {
    const v = quote[key]
    return v != null && String(v).trim() !== '' ? String(v) : null
  }
  return {
    amountInFormatted: fmt('amountInFormatted'),
    amountInUsd: fmt('amountInUsd'),
    amountOutUsd: fmt('amountOutUsd'),
  }
}