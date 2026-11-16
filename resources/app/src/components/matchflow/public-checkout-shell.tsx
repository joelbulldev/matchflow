import type { ReactNode } from 'react'
import { CheckoutBrandHeader, type PublicCheckoutBranding } from '@/components/matchflow/checkout-brand-header'
import { cn } from '@/lib/utils'

type Props = PublicCheckoutBranding & {
  label?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

/** Shared layout for /pay, /pay/…/status, /receipt/… */
export function PublicCheckoutShell({ label, children, className, actions, ...brand }: Props) {
  return (
    <div className={cn('min-h-screen bg-gradient-to-b from-muted/30 to-background', className)}>
      <CheckoutBrandHeader {...brand} label={label} center actions={actions} />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-8 sm:px-6">{children}</div>
    </div>
  )
}

export function CheckoutStepBar({ step, labels }: { step: number; labels: string[] }) {
  return (
    <nav aria-label="Checkout progress" className="mb-2">
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        {labels.map((text, i) => {
          const active = i === step
          const done = i < step
          return (
            <li key={text} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-[11px]',
                  done && 'border-primary bg-primary/10 text-primary',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !done && !active && 'border-border bg-muted/40',
                )}
              >
                {i + 1}
              </span>
              <span className={cn(active && 'text-foreground')}>{text}</span>
              {i < labels.length - 1 ? <span className="hidden text-border sm:inline" aria-hidden>·</span> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
