import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const items = [
  { to: '/app/settings/profile', label: 'Profile' },
  { to: '/app/settings/organization', label: 'Organization' },
  { to: '/app/settings/checkout', label: 'Checkout branding' },
  { to: '/app/settings/settlement', label: 'Settlement' },
  { to: '/app/settings/wallets', label: 'Wallets' },
  { to: '/app/settings/members', label: 'Members' },
  { to: '/app/settings/policies', label: 'Policies' },
  { to: '/app/settings/security', label: 'Account security' },
] as const

export function SettingsSubnav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <>
      <nav className="mf-settings-rail" aria-label="Settings sections">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <Link key={item.to} to={item.to} className={cn(active && 'active')}>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <nav className="mb-5 flex gap-1 overflow-x-auto pb-1 lg:hidden" aria-label="Settings sections">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export function SettingsContentGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(11.5rem,13.5rem)_minmax(0,1fr)] lg:items-start">
      <SettingsSubnav />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  )
}
