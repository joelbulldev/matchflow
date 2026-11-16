import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Receipt, ShoppingCart, CheckSquare, Wallet, Scale, Sparkles, BarChart3, Settings,
  Users, Link2,
} from 'lucide-react'
import { routes } from '@/lib/routes'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  match?: string[]
}

export const primaryNav: NavItem[] = [
  { to: routes.overview, label: 'Overview', icon: LayoutDashboard },
  { to: routes.invoices, label: 'Receivables', icon: FileText, match: ['/app/receivables'] },
  { to: routes.payablesInbox, label: 'Payables', icon: Receipt, match: ['/app/payables'] },
  { to: routes.poList, label: 'Procurement', icon: ShoppingCart, match: ['/app/procurement'] },
  { to: routes.approvals, label: 'Approvals', icon: CheckSquare },
  { to: routes.payments, label: 'Payments', icon: Wallet, match: ['/app/payments'] },
  { to: '/app/reconciliation', label: 'Reconciliation', icon: Scale, match: ['/app/reconciliation'] },
  { to: '/app/finance-ai', label: 'Finance AI', icon: Sparkles },
  { to: routes.reports, label: 'Reports', icon: BarChart3, match: ['/app/reports'] },
  { to: routes.settingsOrg, label: 'Settings', icon: Settings, match: ['/app/settings'] },
]

export const mobileBottomNav = primaryNav.slice(0, 4)

export const mobileMoreNav: NavItem[] = [
  { to: routes.approvals, label: 'Approvals', icon: CheckSquare },
  { to: routes.payments, label: 'Payments', icon: Wallet },
  { to: '/app/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/app/finance-ai', label: 'Finance AI', icon: Sparkles },
  { to: routes.reports, label: 'Reports', icon: BarChart3 },
  { to: '/app/receivables/customers', label: 'Customers', icon: Users },
  { to: '/app/receivables/payment-links', label: 'Payment links', icon: Link2 },
  { to: routes.settingsOrg, label: 'Settings', icon: Settings, match: ['/app/settings'] },
]

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return true
  return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(`${m}/`))
}
