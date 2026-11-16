export type InvoiceLineItem = {
  id: string
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
}

export type InvoiceBrandTheme = 'classic' | 'minimal' | 'bold'

export const INVOICE_TEMPLATES = {
  professional: {
    label: 'Professional services',
    description: 'Single engagement, clean totals',
    accent: 'classic' as InvoiceBrandTheme,
    lines: [{ description: 'Consulting & advisory', quantity: '1', unit_price: '2500', tax_rate: '0' }],
  },
  milestone: {
    label: 'Milestone delivery',
    description: 'Multi-phase project billing',
    accent: 'bold' as InvoiceBrandTheme,
    lines: [
      { description: 'Phase 1 — design', quantity: '1', unit_price: '8000', tax_rate: '0' },
      { description: 'Phase 2 — implementation', quantity: '1', unit_price: '4500', tax_rate: '0' },
    ],
  },
  subscription: {
    label: 'Subscription',
    description: 'Recurring access or SaaS seat',
    accent: 'minimal' as InvoiceBrandTheme,
    lines: [{ description: 'Monthly platform access', quantity: '1', unit_price: '499', tax_rate: '0' }],
  },
  retail: {
    label: 'Product order',
    description: 'SKU-style line items',
    accent: 'classic' as InvoiceBrandTheme,
    lines: [
      { description: 'Hardware kit (SKU-1042)', quantity: '2', unit_price: '149', tax_rate: '8' },
      { description: 'Shipping & handling', quantity: '1', unit_price: '25', tax_rate: '0' },
    ],
  },
  freelance: {
    label: 'Freelance / creative',
    description: 'Time & materials',
    accent: 'minimal' as InvoiceBrandTheme,
    lines: [
      { description: 'Design hours', quantity: '12', unit_price: '95', tax_rate: '0' },
      { description: 'Asset licensing', quantity: '1', unit_price: '200', tax_rate: '0' },
    ],
  },
} as const

export function lineTotal(qty: string, price: string, tax: string): number {
  const sub = Number(qty || 0) * Number(price || 0)
  return sub + sub * (Number(tax || 0) / 100)
}

export function sumLines(lines: InvoiceLineItem[]): { subtotal: number; tax: number; total: number } {
  let subtotal = 0
  let tax = 0
  for (const l of lines) {
    const s = Number(l.quantity || 0) * Number(l.unit_price || 0)
    const t = s * (Number(l.tax_rate || 0) / 100)
    subtotal += s
    tax += t
  }
  return { subtotal, tax, total: subtotal + tax }
}
