import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/** ReUI / shadcn Sonner baseline — mount once at app root. See https://reui.io/components/sonner */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      expand
      richColors
      visibleToasts={4}
      closeButton
      offset={{ top: '4.25rem', right: '1rem' }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:border-border/90 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-md',
          title: 'group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-foreground',
          description: 'group-[.toast]:text-xs group-[.toast]:text-muted-foreground',
          success: 'group-[.toast]:border-emerald-500/25',
          error: 'group-[.toast]:border-destructive/30',
          warning: 'group-[.toast]:border-amber-500/30',
          info: 'group-[.toast]:border-primary/25',
          actionButton:
            'group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:font-medium',
          cancelButton: 'group-[.toast]:rounded-lg group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:border-border/80 group-[.toast]:bg-card group-[.toast]:text-muted-foreground hover:group-[.toast]:bg-muted',
        },
      }}
      {...props}
    />
  )
}
