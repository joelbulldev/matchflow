import { useEffect, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  Bell, Building2, ChevronDown, FileText, Link2, LogOut, Menu, PanelLeft, PanelLeftClose, Plus, Receipt, Settings, ShoppingCart, User, UserPlus, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useNearAuth } from '@/auth/NearAuthContext'
import { isNavActive, mobileBottomNav, mobileMoreNav, primaryNav } from '@/shell/nav'
import { LinkWalletBanner } from '@/shell/LinkWalletBanner'
import { MobileMoreDrawer } from '@/shell/MobileMoreDrawer'
import { NotificationsDrawer, useUnreadNotifications } from '@/shell/NotificationsDrawer'
import { MetricsPeriodProvider } from '@/contexts/metrics-period'

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/app/overview" className="flex min-w-0 items-center gap-2.5 no-underline">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">M</div>
      {!compact ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-foreground">MATCHFLOW</div>
          <div className="truncate text-[11px] text-muted-foreground">Financial operations</div>
        </div>
      ) : null}
    </Link>
  )
}

function UserMenu() {
  const { user, logout, needsNearLink, linkNearWallet, connecting } = useNearAuth()
  const name = user?.displayName || user?.email?.split('@')[0] || 'Account'
  const email = user?.email?.endsWith('@near.local') ? (user.nearAccountId || 'NEAR wallet') : (user?.email || '')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="mf-user-chip" aria-label="Account menu">
          <span className="mf-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span className="mf-user-meta hidden sm:flex">
            <b>{name}</b>
            <small>{email || 'Signed in'}</small>
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="font-medium">{name}</div>
          <div className="text-xs font-normal text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/app/settings/profile"><User className="size-4" /> Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/settings/organization"><Building2 className="size-4" /> Organization</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/settings/checkout"><Link2 className="size-4" /> Checkout branding</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/settings/wallets"><Wallet className="size-4" /> Wallets</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/settings/security"><Settings className="size-4" /> Account security</Link></DropdownMenuItem>
        {needsNearLink ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={connecting} onSelect={() => void linkNearWallet()}>
              <Wallet className="size-4" /> {connecting ? 'Connecting…' : 'Link wallet'}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}><LogOut className="size-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotifBell({ onOpen }: { onOpen: () => void }) {
  const unread = useUnreadNotifications()
  const count = unread.data?.unread ?? 0
  return (
    <Button variant="ghost" size="icon" type="button" aria-label="Notifications" className="relative" onClick={onOpen}>
      <Bell className="size-4" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Button>
  )
}

function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Create</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Quick create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/app/receivables/invoices/new"><FileText className="size-4" /> Invoice</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/payables/bills/new"><Receipt className="size-4" /> Supplier bill</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/procurement/purchase-orders/new"><ShoppingCart className="size-4" /> Purchase order</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/receivables/customers/new"><UserPlus className="size-4" /> Customer</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function WorkspaceShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const desktop = useIsDesktop()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mf_sidebar_collapsed') === '1')
  const [moreOpen, setMoreOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('mf_sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const moreActive = mobileMoreNav.some((item) => isNavActive(pathname, item))

  if (!desktop) {
    return (
      <div className="mf-shell mf-shell-mobile">
        <header className="mf-m-top">
          <BrandMark />
          <div className="mf-m-topright">
            <CreateMenu />
            <NotifBell onOpen={() => setNotifOpen(true)} />
            <UserMenu />
          </div>
        </header>

        <main className="mf-m-content">
          <MetricsPeriodProvider>
            <LinkWalletBanner />
            <Outlet />
          </MetricsPeriodProvider>
        </main>

        <nav className="mf-m-bottom" aria-label="Primary">
          {mobileBottomNav.map((item) => {
            const Icon = item.icon
            const active = isNavActive(pathname, item)
            return (
              <Link key={item.to} to={item.to} className={cn('mf-m-nav', active && 'active')}>
                <span className="mf-m-nav-icon"><Icon size={18} strokeWidth={active ? 2.35 : 2} /></span>
                {item.label}
              </Link>
            )
          })}
          <button type="button" className={cn('mf-m-nav', moreActive && 'active')} onClick={() => setMoreOpen(true)}>
            <span className="mf-m-nav-icon"><Menu size={18} strokeWidth={moreActive ? 2.35 : 2} /></span>
            More
          </button>
        </nav>

        <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
        <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      </div>
    )
  }

  return (
    <div className={cn('mf-shell mf-shell-desktop', collapsed && 'sidebar-collapsed')}>
      <header className="mf-d-header">
        <div className="mf-d-header-left">
          <BrandMark compact={collapsed} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((c) => !c)}
              >
                {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        </div>
        <div className="mf-d-header-right">
          <CreateMenu />
          <NotifBell onOpen={() => setNotifOpen(true)} />
          <UserMenu />
        </div>
      </header>

      <div className="mf-d-body">
        <aside className={cn('mf-sidebar', collapsed && 'collapsed')}>
          <ScrollArea className="h-full">
            <nav className="space-y-1 p-3 pb-8">
              {primaryNav.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item)
                const link = (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn('mf-side-link', active && 'active')}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                )
                if (!collapsed) return link
                return (
                  <Tooltip key={item.to} delayDuration={0}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </nav>
          </ScrollArea>
        </aside>

        <main className="mf-d-main">
          <div className="mx-auto max-w-[1440px]">
            <MetricsPeriodProvider>
              <LinkWalletBanner />
              <Outlet />
            </MetricsPeriodProvider>
          </div>
        </main>
      </div>

      <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      <Separator className="sr-only" />
    </div>
  )
}
