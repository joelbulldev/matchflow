import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWalletAdapter } from './WalletProvider'
import { BASE_USDC } from './types'

type Props = {
  depositAddress?: string | null
  /** Human decimal amount in USDC (6 decimals on Base). */
  amountDecimal?: string | null
  onTxHash?: (hash: string) => void
  /** When false, omit the EVM wallet assist block entirely (NEAR-only checkout path). */
  showEvmAssist?: boolean
}

/**
 * Connect / transfer / confirm UI for Base USDC.
 * Non-blocking when wallet is missing — deposit address remains usable manually.
 * Wallet popup success is never settlement proof.
 */
export function WalletTransferConfirmation({
  depositAddress,
  amountDecimal,
  onTxHash,
  showEvmAssist = true,
}: Props) {
  const wallet = useWalletAdapter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(wallet.getAddress())

  const available = wallet.isAvailable()

  async function handleConnect() {
    setError(null)
    setBusy(true)
    try {
      const addr = await wallet.connect()
      setAddress(addr)
      if (!addr) setError('Wallet not connected. You can still send USDC manually to the deposit address.')
    } finally {
      setBusy(false)
    }
  }

  async function handleTransfer() {
    setError(null)
    if (!depositAddress || !amountDecimal) {
      setError('Deposit details are not ready yet.')
      return
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(depositAddress)) {
      setError('Deposit address is not an EVM address for this Base USDC route.')
      return
    }
    setBusy(true)
    try {
      const parts = amountDecimal.split('.')
      const whole = parts[0] || '0'
      const frac = (parts[1] || '').padEnd(6, '0').slice(0, 6)
      const atomic = BigInt(whole) * 1_000_000n + BigInt(frac || '0')
      const result = await wallet.transferUsdc({
        to: depositAddress as `0x${string}`,
        amountAtomic: atomic,
        chainId: BASE_USDC.chainId,
        tokenAddress: BASE_USDC.tokenAddress,
      })
      if (!result) {
        setError('Transfer was cancelled or wallet is unavailable. Manual deposit still works.')
        return
      }
      setHash(result.hash)
      onTxHash?.(result.hash)
    } finally {
      setBusy(false)
    }
  }

  if (!showEvmAssist) return null

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="text-sm font-semibold">Approve in your wallet</div>
      <p className="text-xs text-muted-foreground">Confirm the USDC transfer when your wallet opens.</p>
      {!available ? (
        <Alert>
          <AlertDescription>
            No browser wallet detected. Copy the deposit address and transfer Base USDC manually.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleConnect}>
            {address ? `Connected ${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet'}
          </Button>
          <Button type="button" size="lg" className="w-full sm:w-auto" disabled={busy || !depositAddress || !address} onClick={handleTransfer}>
            Pay USDC
          </Button>
        </div>
      )}
      {hash ? (
        <p className="break-all text-xs text-muted-foreground">
          Origin tx submitted: {hash}. Waiting for deposit detection / SUCCESS…
        </p>
      ) : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    </div>
  )
}
