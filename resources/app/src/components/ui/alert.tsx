import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-xl border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-card text-foreground',
      destructive: 'border-destructive/40 bg-destructive/5 text-destructive',
      success: 'border-success/30 bg-success/5 text-success',
      warning: 'border-warning/30 bg-warning/5 text-warning',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
}
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm opacity-90', className)} {...props} />
}
