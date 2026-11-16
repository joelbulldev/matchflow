import { Link, useRouterState } from '@tanstack/react-router'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { isNavActive, mobileMoreNav } from './nav'

export function MobileMoreDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh]">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {mobileMoreNav.map((item) => {
            const Icon = item.icon
            const active = isNavActive(pathname, item)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                  strokeWidth={active ? 2.1 : 1.75}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
