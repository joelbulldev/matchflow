import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Standard workspace page root — consistent rhythm across all /app/* routes */
export function WorkspacePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mf-workspace-page min-w-0 max-w-full space-y-7 overflow-x-hidden', className)}>{children}</div>
}

export function SectionCard({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('w-full min-w-0 max-w-full overflow-hidden border-border/80 shadow-sm', className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
          {description ? <CardDescription className="leading-relaxed">{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function FilterToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-0 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid w-full min-w-0 max-w-full gap-5 lg:grid-cols-[1.35fr_1fr]', className)}>{children}</div>
}
