import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button, type ButtonProps } from '@/components/ui/button'

type NavButtonProps = Omit<ButtonProps, 'onClick'> & {
  to: string
  children: ReactNode
}

/** Primary/secondary actions that navigate — renders a real `<button>`, not a styled `<a>`. */
export function NavButton({ to, children, ...props }: NavButtonProps) {
  const navigate = useNavigate()
  return (
    <Button type="button" {...props} onClick={() => void navigate({ to })}>
      {children}
    </Button>
  )
}
