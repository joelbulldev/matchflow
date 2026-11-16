import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routes } from '@/lib/routes'
import { MarketingSection } from './MarketingLayout'

type Props = {
  eyebrow: string
  title: string
  lead: ReactNode
  children?: ReactNode
  cta?: ReactNode
}

export function MarketingPageHero({ eyebrow, title, lead, children, cta }: Props) {
  return (
    <MarketingSection className="mf-mkt-page-hero">
      <p className="mf-mkt-eyebrow">{eyebrow}</p>
      <h1 className="mf-mkt-h1">{title}</h1>
      <p className="mf-mkt-lead">{lead}</p>
      {children}
      {cta ?? (
        <div className="mf-mkt-hero-cta">
          <Button asChild size="lg" className="mf-mkt-btn-primary h-11 px-6">
            <Link to={routes.appEntry}>
              Open app
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </MarketingSection>
  )
}

export function MarketingSubpageCta() {
  return (
    <MarketingSection className="text-center pb-24 mf-mkt-cta-band">
      <h2 className="mf-mkt-h2">Open a workspace when you are ready.</h2>
      <p className="mf-mkt-body mx-auto">Connect NEAR, invite the team, and send the first payment link.</p>
      <div className="mf-mkt-hero-cta">
        <Button asChild size="lg" className="mf-mkt-btn-primary h-11 px-6">
          <Link to={routes.appEntry}>
            Open app
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
    </MarketingSection>
  )
}