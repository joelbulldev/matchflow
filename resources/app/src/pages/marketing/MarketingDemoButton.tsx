import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loginAsDemoUser } from '@/lib/demo-auth'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  label?: string
  onStarted?: () => void
}

export function MarketingDemoButton({
  className,
  size = 'default',
  variant = 'outline',
  label = 'Try demo workspace',
  onStarted,
}: Props) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(className)}
      disabled={pending}
      onClick={() => {
        void (async () => {
          onStarted?.()
          setPending(true)
          try {
            await loginAsDemoUser(qc)
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Demo sign-in failed'
            toast.error('Could not start demo', message)
          } finally {
            setPending(false)
          }
        })()
      }}
    >
      <Sparkles className="size-4" aria-hidden />
      {pending ? 'Opening demo…' : label}
    </Button>
  )
}
