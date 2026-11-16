import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const fn = () => setMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

/** Desktop: centered dialog; mobile: bottom sheet. */
export function ResponsiveFormSurface({ open, onOpenChange, title, description, children, footer }: Props) {
  const mobile = useIsMobile()

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </SheetHeader>
          <SheetBody className="space-y-4">{children}</SheetBody>
          {footer ? <SheetFooter className="flex-row justify-end gap-2">{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,720px)] max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[min(60dvh,520px)] overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <DialogFooter className="border-t border-border px-6 py-4">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
