import { Link } from '@tanstack/react-router'
import { MarketingSection } from './MarketingLayout'
import { routes } from '@/lib/routes'
import { MarketingPageHero, MarketingSubpageCta } from './MarketingPageHero'

const faqs = [
  {
    q: 'Does MATCHFLOW custody funds?',
    a: 'No. Payments settle directly between payer and your configured beneficiary address through NEAR Intents. We store evidence, quotes, and status — not balances.',
  },
  {
    q: 'How do customers pay an invoice?',
    a: 'You issue a branded payment link. Payers open checkout, receive a firm quote, authorize in their wallet, and track status until SUCCESS and receipt.',
  },
  {
    q: 'Can we enforce approvals before AP settlement?',
    a: 'Yes. Bills move through match, review, and approvals queues. Settlement drawers mirror receivables — preview quote, then commit.',
  },
  {
    q: 'What wallets do you support?',
    a: 'NEAR wallet sign-in and linking for operators, plus passkey-friendly flows where configured. Treasury addresses use standard NEAR account IDs.',
  },
  {
    q: 'Is there a demo environment?',
    a: 'Use “Login as demo user” on the sign-in screen to explore receivables, payables, and reports without affecting production data.',
  },
  {
    q: 'Where does settlement data live?',
    a: 'Org-scoped records in your WordPress-hosted MATCHFLOW instance, exportable reports, and PDF receipts for successful settlements.',
  },
] as const

export function MarketingFaqPage() {
  return (
    <>
      <MarketingPageHero
        eyebrow="FAQ"
        title="Answers for finance, ops, and engineering."
        lead={
          <>
            Can’t find your answer? Open the workspace and use in-app notifications — or{' '}
            <Link to={routes.appEntry} className="text-[var(--mkt-accent)] hover:underline">
              talk to us from settings
            </Link>
            .
          </>
        }
      />

      <MarketingSection>
        <div className="mf-mkt-faq">
          {faqs.map((item) => (
            <details key={item.q} className="mf-mkt-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </MarketingSection>

      <MarketingSubpageCta />
    </>
  )
}