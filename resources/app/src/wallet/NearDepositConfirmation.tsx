import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'
import {
  depositWrapNearToIntents,
  isNearOriginChainAsset,
} from '@/lib/near-intents-deposit'
import { cn } from '@/lib/utils'

type Props = {
  payToken: string
  settlementId: number
  depositAddress: string
  amountAtomic: string
  originAssetId: string
  payerAccountId: string | null
  depositMemo?: string | null
  onTxSubmitted?: (txHash: string) => void
  className?: string
}

/**
 * NEAR wallet sends native NEAR to the 1Click implicit deposit account,
 * then MATCHFLOW notifies 1Click via public confirm-deposit.
 */
export function NearDepositConfirmation({
  payToken,
  settlementId,
  depositAddress,
  amountAtomic,
  originAssetId,
  payerAccountId,
  onTxSubmitted,
  className,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [manual, setManual] = useState(false)

  if (!isNearOriginChainAsset(originAssetId)) {
    return null
  }

  async function payWithWallet() {
    setError(null)
    if (!payerAccountId) {
      setError('Connect your NEAR wallet on the previous step.')
      return
    }
    setBusy(true)
    try {
      const hash = await depositWrapNearToIntents({
        depositAddress,
        amountAtomic,
      })
      setTxHash(hash)
      await api(`/public/payments/${payToken}/settlements/${settlementId}/confirm-deposit`, {
        method: 'POST',
        body: JSON.stringify({
          txHash: hash,
          nearSenderAccount: payerAccountId,
        }),
      })
      onTxSubmitted?.(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment could not be sent.'
      if (msg.toLowerCase().includes('not enough') || msg.toLowerCase().includes('insufficient')) {
        setError('Insufficient NEAR in your wallet for this quote (amount + gas).')
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="size-4 text-primary" aria-hidden />
        Pay with your NEAR wallet
      </div>
      <p className="text-xs text-muted-foreground">
        Your wallet will ask you to approve the deposit. The invoice is paid only after 1Click reports SUCCESS on-chain.
      </p>
      <Button
        type="button"
        className="w-full"
        size="lg"
        disabled={busy || !payerAccountId || Boolean(txHash)}
        onClick={() => void payWithWallet()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wallet className="size-4" aria-hidden />}
        {txHash ? 'Deposit submitted' : 'Pay with NEAR'}
      </Button>
      {txHash ? (
        <p className="text-xs text-muted-foreground break-all">
          Tx: <span className="font-mono">{txHash}</span>
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setManual((v) => !v)}
      >
        {manual ? 'Hide manual transfer' : 'Manual transfer (advanced)'}
      </button>
      {manual ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Send exactly <span className="font-mono">{amountAtomic}</span> yoctoNEAR to the deposit address, then track status.
          </p>
          <Input readOnly value={depositAddress} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        </div>
      ) : null}
    </div>
  )
}