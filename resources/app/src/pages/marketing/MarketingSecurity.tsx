import { Shield, KeyRound, Link2, FileSearch } from 'lucide-react'
import { MarketingSection } from './MarketingLayout'
import { MarketingPageHero, MarketingSubpageCta } from './MarketingPageHero'

export function MarketingSecurityPage() {
  return (
    <>
      <MarketingPageHero
        eyebrow="Security"
        title="Confidential where it matters. Auditable everywhere else."
        lead="Role-based capabilities, org isolation, concealed public tokens, and settlement paths that never route funds through MATCHFLOW infrastructure."
      />

      <MarketingSection>
        <p className="mf-mkt-eyebrow text-center">Controls</p>
        <h2 className="mf-mkt-h2 text-center max-w-2xl mx-auto">Production posture by default.</h2>
        <div className="mf-mkt-pill-grid mt-10">
          {[
            { icon: KeyRound, title: 'Capabilities model', body: 'Fine-grained AR, AP, procurement, reports, and admin permissions per membership.' },
            { icon: Link2, title: 'Public pay links', body: 'Opaque tokens — no sequential IDs on customer-facing checkout.' },
            { icon: Shield, title: 'NEAR challenges', body: 'Wallet login uses expiring sign challenges; retry UX guides operators through failures.' },
            { icon: FileSearch, title: 'Evidence trail', body: 'Quotes, statuses, and receipts linked to invoices, bills, and payments for audit.' },
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