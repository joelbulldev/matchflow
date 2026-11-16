import { Workflow, Shield, Sparkles, ArrowUpRight } from 'lucide-react'
import { MarketingSection } from './MarketingLayout'
import { MarketingPageHero, MarketingSubpageCta } from './MarketingPageHero'

export function MarketingProductPage() {
  return (
    <>
      <MarketingPageHero
        eyebrow="Product"
        title="Every lane of financial operations, one workspace."
        lead="Receivables, payables, procurement, reconciliation, and settlement in one workspace. Built for teams that outgrew shallow dashboards."
      />

      <MarketingSection>
        <p className="mf-mkt-eyebrow text-center">Modules</p>
        <h2 className="mf-mkt-h2 text-center max-w-2xl mx-auto">One spine from quote to receipt.</h2>
        <p className="mf-mkt-body text-center max-w-xl mx-auto">
          Every lane shares approvals, evidence, and Intents checkout. One record from quote to receipt.
        </p>
        <div className="mf-mkt-pill-grid mt-10">
          {[
            {
              icon: ArrowUpRight,
              title: 'Receivables',
              body: 'Issue invoices, reminders, and NEAR Intents payment links with org-branded checkout.',
            },
            {
              icon: Workflow,
              title: 'Payables',
              body: 'Ingest supplier bills, run three-way match, and settle with quote preview.',
            },
            {
              icon: Sparkles,
              title: 'Procurement',
              body: 'POs and goods receipts linked to payables — filters and server-backed lists at scale.',
            },
            {
              icon: Shield,
              title: 'Payments & reconciliation',
              body: 'Settlement hub, timeline, unmatched queue, and aging reports with export.',
            },
            {
              icon: Sparkles,
              title: 'Finance AI',
              body: 'Structured answers over your operational data — grounded in records you already trust.',
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

      <MarketingSubpageCta />
    </>
  )
}