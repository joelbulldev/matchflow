import type { ReactNode } from 'react'
import { CircleCheck, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  onCancel?: () => void
  onSubmit: () => void
  submitLabel: ReactNode
  cancelLabel?: string
  disabled?: boolean
  pending?: boolean
  submitVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  extra?: ReactNode
}

/** Standard drawer/sheet footer: Cancel (ghost) + primary action. */
export function FormSurfaceFooter({
  onCancel,
  onSubmit,
  submitLabel,
  cancelLabel = 'Keep editing',
  disabled,
  pending,
  submitVariant = 'default',
  extra,
}: Props) {
  const labelIsPlainText = typeof submitLabel === 'string'
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      {extra}
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          <X className="size-4" aria-hidden />
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="button" variant={submitVariant} onClick={onSubmit} disabled={disabled || pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : labelIsPlainText ? (
          <CircleCheck className="size-4" aria-hidden />
        ) : null}
        {submitLabel}
      </Button>
    </div>
  )
}
