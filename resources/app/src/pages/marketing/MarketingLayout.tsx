import type { ReactNode } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MarketingThemeToggle } from './MarketingThemeToggle'
import { applyMarketingTheme, bindMarketingBody, readMarketingTheme } from './marketing-theme'
import { Button } from '@/components/ui/button'
import { routes, marketing } from '@/lib/routes'
import { MarketingDemoButton } from './MarketingDemoButton'
import { cn } from '@/lib/utils'
import '@/pages/marketing/marketing.css'

const navLinks = [
  { to: marketing.product, label: 'Product' },
  { to: marketing.security, label: 'Security' },
  { to: marketing.faq, label: 'FAQ' },
] as const

export function MarketingLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    applyMarketingTheme(readMarketingTheme())
    bindMarketingBody(true)
    return () => bindMarketingBody(false)
  }, [])

  return (
    <div className="mf-marketing min-h-screen">
      <header className="mf-mkt-header">
        <div className="mf-mkt-header-inner">
          <Link to={marketing.home} className="mf-mkt-logo" onClick={() => setMenuOpen(false)}>
            <span className="mf-mkt-logo-mark">M</span>
            <span className="mf-mkt-logo-text">MATCHFLOW</span>
          </Link>

          <nav className="mf-mkt-nav-desktop" aria-label="Marketing">
            {navLinks.map((item) => (
              <Link key={item.to} to={item.to} className="mf-mkt-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mf-mkt-header-actions">
            <MarketingThemeToggle className="hidden md:inline-flex" />
            <Button asChild size="sm" className="mf-mkt-btn-primary hidden sm:inline-flex">
              <Link to={routes.appEntry}>
                Open app
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <button
              type="button"
              className="mf-mkt-menu-btn md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="mf-mkt-mobile-panel md:hidden">
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm text-[var(--mkt-muted)]">Theme</span>
              <MarketingThemeToggle />
            </div>
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="mf-mkt-mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link to={routes.login} className="mf-mkt-mobile-link" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <MarketingDemoButton className="mf-mkt-btn-outline w-full" onStarted={() => setMenuOpen(false)} />
            <Button asChild className="mf-mkt-btn-primary w-full">
              <Link to={routes.appEntry} onClick={() => setMenuOpen(false)}>
                Open app
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <Outlet />

      <footer className="mf-mkt-footer">
        <div className="mf-mkt-footer-grid">
          <div>
            <p className="mf-mkt-logo-text mb-2">MATCHFLOW</p>
            <p className="text-sm text-[var(--mkt-muted)] max-w-xs">
              Evidence-to-settlement finance operations powered by NEAR Intents. Collect, match, approve, and settle — without giving up custody.
            </p>
          </div>
          <div>
            <p className="mf-mkt-footer-label">Product</p>
            <Link to={marketing.product} className="mf-mkt-footer-link">How it works</Link>
            <Link to={routes.appEntry} className="mf-mkt-footer-link">Open workspace</Link>
          </div>
          <div>
            <p className="mf-mkt-footer-label">Trust</p>
            <Link to={marketing.security} className="mf-mkt-footer-link">Security & controls</Link>
            <Link to={marketing.faq} className="mf-mkt-footer-link">FAQ</Link>
          </div>
        </div>
        <p className="mf-mkt-footer-meta">
          Settlement via NEAR Intents 1Click. MATCHFLOW never holds customer funds.
        </p>
      </footer>
    </div>
  )
}

export function MarketingSection({
  className,
  children,
  id,
}: {
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} className={cn('mf-mkt-section', className)}>
      {children}
    </section>
  )
}
