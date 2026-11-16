import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { connectNearWalletOnly, getNearConnector, restoreNearCheckoutSession } from '@/lib/near-connector'

type Props = {
  onAccount: (accountId: string) => void
  initialAccountId?: string
  persistKey?: string
}

/**
 * Public checkout — NEAR Connect for refund address + NEAR-native Intents path.
 * Does not replace deposit to the Intents address; wallet success is not settlement proof.
 */
export function NearCheckoutWallet({ onAccount, initialAccountId, persistKey }: Props) {
  const [busy, setBusy] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(initialAccountId?.trim() || null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const seed = initialAccountId?.trim()
    if (seed) {
      setAccountId(seed)
      return
    }
    let cancelled = false
    void (async () => {
      const id = await restoreNearCheckoutSession()
      if (!cancelled && id) {
        setAccountId(id)
        onAccount(id)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore session once per mount / seed
  }, [initialAccountId])

  async function connect() {
    setError(null)
    setBusy(true)
    try {
      const id = await connectNearWalletOnly()
      if (!id) {
        setError('No NEAR account selected.')
        return
      }
      setAccountId(id)
      onAccount(id)
      if (persistKey) {
        try {
          localStorage.setItem(persistKey, id)
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'NEAR wallet connection failed')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const connector = await getNearConnector()
      await connector.disconnect()
      setAccountId(null)
      if (persistKey) {
        try {
          localStorage.removeItem(persistKey)
        } catch {
          /* ignore */
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Wallet className="size-4 text-primary" />
        Connect wallet
      </div>
      <p className="text-xs text-muted-foreground">
        Connect your NEAR account for refunds and one-click wallet payment on the next step.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void connect()}>
          <Wallet className="size-4" aria-hidden />
          {accountId ? `Connected · ${accountId}` : 'Connect wallet'}
        </Button>
        {accountId ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
