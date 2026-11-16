import { useEffect, useRef, type RefObject, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/routes'

const STEPS = [
  { key: 'account', label: 'Account', href: routes.register },
  { key: 'business', label: 'Business', href: routes.onboardingBusiness },
  { key: 'wallet', label: 'Wallet', href: routes.onboardingWallet },
  { key: 'complete', label: 'Ready', href: routes.onboardingComplete },
] as const

export type OnboardingStep = (typeof STEPS)[number]['key']

type FlowStep = { key: string; label: string; href?: string }

type Props = {
  active: OnboardingStep
  className?: string
}

/** Horizontal step rail — active step shows title; others show numbers only; scrolls when cramped. */
export function OnboardingStepper({ active, className }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.key === active)
  const railRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const el = railRef.current?.querySelector('[aria-current="step"]')
    if (el && 'scrollIntoView' in el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [active])

  return (
    <FlowStepper
      className={className}
      steps={STEPS.map((s) => ({ key: s.key, label: s.label, href: s.href }))}
      activeIndex={activeIndex}
      railRef={railRef}
      renderStep={(step, index, { done, current }) => {
        const inner = (
          <>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                current && 'bg-primary text-primary-foreground shadow-sm',
                done && !current && 'bg-emerald-600 text-white',
                !done && !current && 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span className={cn('truncate text-sm font-medium', current ? 'max-w-[9rem]' : 'sr-only')}>
              {step.label}
            </span>
          </>
        )
        const cls = cn(
          'flex min-w-[2.75rem] shrink-0 items-center gap-2 rounded-full border px-2 py-1.5 transition-colors',
          current && 'min-w-[7.5rem] border-primary/35 bg-primary/8 text-primary',
          done && !current && 'border-border text-foreground',
          !done && !current && 'border-transparent text-muted-foreground',
        )
        return step.href ? (
          <Link to={step.href} className={cls} aria-current={current ? 'step' : undefined}>
            {inner}
          </Link>
        ) : (
          <span className={cls} aria-current={current ? 'step' : undefined}>
            {inner}
          </span>
        )
      }}
    />
  )
}

export function FlowStepper({
  steps,
  activeIndex,
  className,
  railRef,
  renderStep,
}: {
  steps: FlowStep[]
  activeIndex: number
  className?: string
  railRef?: RefObject<HTMLOListElement | null>
  renderStep: (
    step: FlowStep,
    index: number,
    state: { done: boolean; current: boolean },
  ) => ReactNode
}) {
  return (
    <nav className={cn('mb-8', className)} aria-label="Progress">
      <ol
        ref={railRef}
        className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {steps.map((step, index) => {
          const done = index < activeIndex
          const current = index === activeIndex
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-2">
              {renderStep(step, index, { done, current })}
              {index < steps.length - 1 ? (
                <span className="text-muted-foreground/50" aria-hidden>
                  ·
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
