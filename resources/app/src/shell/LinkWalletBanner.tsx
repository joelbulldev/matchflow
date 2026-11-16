import { Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNearAuth } from '@/auth/NearAuthContext'

export function LinkWalletBanner() {
  const { needsNearLink, linkNearWallet, connecting, error, clearError } = useNearAuth()
  if (!needsNearLink) return null

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/[0.08] via-card to-card shadow-sm"
      role="region"
      aria-label="NEAR wallet setup"
    >
      <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Wallet className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-foreground">Link a wallet</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="size-3" aria-hidden />
              Hackathon path
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You signed in with email. Connect a wallet to approve settlements and sign treasury actions.
          </p>
          {error ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {error ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          ) : null}
          <Button type="button" size="sm" className="min-w-[9.5rem]" onClick={() => void linkNearWallet()} disabled={connecting}>
            <Wallet className="size-4" aria-hidden />
            {connecting ? 'Connecting…' : 'Link wallet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
