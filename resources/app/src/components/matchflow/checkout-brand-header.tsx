import type { CSSProperties, ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { checkoutThemeStyle, resolveCheckoutAccent } from '@/lib/checkout-theme'
import { cn } from '@/lib/utils'

export type PublicCheckoutBranding = {
  organizationName?: string
  checkoutTagline?: string
  checkoutAccentColor?: string
  checkoutLogoUrl?: string
  checkoutSupportEmail?: string
  invoiceNumber?: string
  label?: string
}

type Props = PublicCheckoutBranding & {
  className?: string
  center?: boolean
  actions?: ReactNode
}

export function CheckoutBrandHeader({
  organizationName = 'MATCHFLOW',
  checkoutTagline,
  checkoutAccentColor,
  checkoutLogoUrl,
  checkoutSupportEmail,
  invoiceNumber,
  label = 'Secure checkout',
  className,
  center,
  actions,
}: Props) {
  const accent = resolveCheckoutAccent(checkoutAccentColor)

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/60 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80',
        className,
      )}
      style={checkoutThemeStyle(accent)}
    >
      <div
        className={cn(
          'mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4',
          center && 'max-w-lg flex-col text-center',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-3', center && 'flex-col')}>
          {checkoutLogoUrl ? (
            <img
              src={checkoutLogoUrl}
              alt=""
              className="h-10 w-auto max-w-[140px] object-contain"
              loading="lazy"
            />
          ) : (
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground',
                !accent && 'bg-primary',
              )}
              style={accent ? { backgroundColor: accent } : undefined}
              aria-hidden
            >
              {organizationName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className={cn('min-w-0', center && 'text-center')}>
            <p
              className={cn('text-[10px] font-semibold uppercase tracking-[0.28em]', !accent && 'text-primary')}
              style={accent ? { color: accent } : undefined}
            >
              {label}
            </p>
            <h1 className="truncate text-lg font-semibold">{organizationName}</h1>
            {checkoutTagline ? <p className="text-sm text-muted-foreground">{checkoutTagline}</p> : null}
            {invoiceNumber ? (
              <p className="text-sm text-muted-foreground">Invoice {invoiceNumber}</p>
            ) : null}
          </div>
        </div>
        {actions}
        {checkoutSupportEmail && center ? (
          <a
            href={`mailto:${checkoutSupportEmail}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Mail className="size-3.5" />
            {checkoutSupportEmail}
          </a>
        ) : null}
      </div>
    </header>
  )
}

export function checkoutBrandStyle(accent?: string | null): CSSProperties | undefined {
  return checkoutThemeStyle(resolveCheckoutAccent(accent))
}
