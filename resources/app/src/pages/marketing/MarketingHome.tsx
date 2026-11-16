import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Shield, Sparkles, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routes, marketing } from '@/lib/routes'
import { MarketingSection } from './MarketingLayout'
import { MarketingDemoButton } from './MarketingDemoButton'

export function MarketingHome() {
  return (
    <>
      <MarketingSection className="mf-mkt-hero">
        <p className="mf-mkt-eyebrow">Treasury operations</p>
        <h1 className="mf-mkt-h1">Collect, approve, and settle with a trail auditors can follow.</h1>
        <p className="mf-mkt-lead">
          MATCHFLOW runs receivables, payables, and procurement in one workspace. Quotes come from NEAR Intents. Funds move wallet to wallet. We never custody your balances.
        </p>
        <div className="mf-mkt-hero-cta">
          <Button asChild size="lg" className="mf-mkt-btn-primary h-11 px-6">
            <Link to={routes.appEntry}>
              Open app
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
          <MarketingDemoButton size="lg" variant="outline" className="mf-mkt-btn-outline h-11" />
          <Button asChild size="lg" variant="ghost" className="mf-mkt-btn-ghost h-11 sm:px-4">
            <Link to={marketing.product}>How it works</Link>
          </Button>
        </div>

        <div className="mf-mkt-hero-visual" aria-hidden>
          <div className="mf-mkt-mock-bar">
            <span>Workspace overview</span>
            <span className="text-[var(--mkt-accent)]">● Live</span>
          </div>
          <div className="mf-mkt-mock-grid">
            <div className="mf-mkt-mock-cell">
              <p className="text-xs text-[var(--mkt-muted)] mb-2">Open AR</p>
              <p className="text-2xl font-semibold tabular-nums">$284,120</p>
              <p className="text-xs text-[var(--mkt-muted)] mt-1">12 invoices due this week</p>
            </div>
            <div className="mf-mkt-mock-cell">
              <p className="text-xs text-[var(--mkt-muted)] mb-2">Settlement pipeline</p>
              <div className="space-y-2 text-sm">
                <p>INV-1042 · Quote ready · wrap.near → USDC</p>
                <p>INV-1038 · Awaiting payer signature</p>
                <p>BILL-880 · Matched · Pending approval</p>
              </div>
            </div>
            <div className="mf-mkt-mock-cell">
              <p className="text-xs text-[var(--mkt-muted)] mb-2">NEAR Intents</p>
              <p className="text-lg font-medium text-[var(--mkt-accent)]">Best price in 4.2s</p>
              <p className="text-xs text-[var(--mkt-muted)] mt-2">Slippage guard · Receipt on SUCCESS</p>
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="mf-mkt-stat-row">
          {[
            ['$1.2B+', 'Settlement volume routed'],
            ['35+', 'Networks supported'],
            ['130+', 'Settlement assets'],
            ['<5s', 'Typical quote latency'],
          ].map(([b, s]) => (
            <div key={b} className="mf-mkt-stat">
              <b>{b}</b>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="mf-mkt-feature">
          <div>
            <p className="mf-mkt-eyebrow">Intents checkout</p>
            <h2 className="mf-mkt-h2">Invoice in USD. Paid in whatever the payer holds.</h2>
            <p className="mf-mkt-body">
              Send a branded payment link. The payer picks an asset. Market makers on NEAR Intents bid before money moves, so your team sees rate, slippage, and expiry up front.
            </p>
          </div>
          <div className="mf-mkt-swap-demo">
            <div className="mf-mkt-swap-row">
              <div>
                <p className="font-medium">12,500 USDC</p>
                <p className="mf-mkt-swap-meta">Invoice INV-1042</p>
              </div>
              <span className="text-[var(--mkt-muted)]">→</span>
              <div className="text-right">
                <p className="font-medium">48.2 NEAR</p>
                <p className="mf-mkt-swap-meta">Receive at treasury</p>
              </div>
            </div>
            <p className="text-xs text-[var(--mkt-muted)]">Rate locked 60s · Max slippage 0.50%</p>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="mf-mkt-feature reverse">
          <div className="mf-mkt-illus">
            <Shield className="size-8 text-[var(--mkt-accent)]" />
            <h3 className="text-lg font-semibold">Controls without custody</h3>
            <p className="text-sm text-[var(--mkt-muted)]">
              Three-way match, approval chains, and policy checks run before settlement. MATCHFLOW coordinates quotes and evidence. Your wallets stay yours.
            </p>
          </div>
          <div>
            <p className="mf-mkt-eyebrow">Payables & procurement</p>
            <h2 className="mf-mkt-h2">Spend goes through the same gates as invoices.</h2>
            <p className="mf-mkt-body">
              POs, receipts, and bills tie together. Exceptions surface before pay. AP uses the same Intents flow as AR, so finance sees one ledger story end to end.
            </p>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <p className="mf-mkt-eyebrow text-center">Stack</p>
        <h2 className="mf-mkt-h2 text-center max-w-2xl mx-auto">Open rails, familiar controls.</h2>
        <p className="mf-mkt-body text-center max-w-xl mx-auto">
          Built for teams that already run tight books and want settlement that matches how they work.
        </p>
        <div className="mf-mkt-pill-grid mt-10">
          {[
            {
              icon: Workflow,
              title: 'NEAR Protocol',
              body: 'Fast finality and passkey-friendly sign-in for operators who live on chain.',
            },
            {
              icon: Sparkles,
              title: 'NEAR Intents',
              body: 'One quoting layer for collections and disbursements across networks.',
            },
            {
              icon: Shield,
              title: 'Evidence to settlement',
              body: 'Document, match, approve, quote, receipt. Same order every time.',
            },
            {
              icon: ArrowUpRight,
              title: 'Your checkout',
              body: 'Payment pages carry your name, colors, and support contacts.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="mf-mkt-pill">
              <Icon className="mb-3 size-5 text-[var(--mkt-accent)]" />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="faq-preview">
        <h2 className="mf-mkt-h2 text-center">Before you switch</h2>
        <p className="mf-mkt-body text-center mb-8">
          <Link to={marketing.faq} className="text-[var(--mkt-accent)] hover:underline">
            Full FAQ
          </Link>
        </p>
        <div className="mf-mkt-faq">
          <details className="mf-mkt-faq-item" open>
            <summary>Do you hold our funds?</summary>
            <p>No. Settlement is payer to beneficiary through NEAR Intents. We track status and store receipts.</p>
          </details>
          <details className="mf-mkt-faq-item">
            <summary>Can the team keep email and password login?</summary>
            <p>Yes. Workspace accounts use email and password. Treasurers can link NEAR wallets when a payment needs a signature.</p>
          </details>
          <details className="mf-mkt-faq-item">
            <summary>What does day-one setup look like?</summary>
            <p>Create a workspace, set your org profile, attach a treasury wallet, tune checkout branding, then issue the first invoice or payment link.</p>
          </details>
        </div>
      </MarketingSection>

      <MarketingSection className="text-center pb-24 mf-mkt-cta-band">
        <h2 className="mf-mkt-h2">Open a workspace when you are ready.</h2>
        <p className="mf-mkt-body mx-auto">Connect NEAR, invite the team, and send the first payment link this afternoon.</p>
        <div className="mf-mkt-hero-cta">
          <Button asChild size="lg" className="mf-mkt-btn-primary h-11 px-6">
            <Link to={routes.register}>Create workspace</Link>
          </Button>
          <MarketingDemoButton size="lg" variant="outline" className="mf-mkt-btn-outline h-11" />
          <Button asChild size="lg" variant="ghost" className="mf-mkt-btn-ghost h-11">
            <Link to={routes.login}>Sign in</Link>
          </Button>
        </div>
      </MarketingSection>
    </>
  )
}
