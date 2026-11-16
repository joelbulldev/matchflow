/**
 * WalletAdapter — thin interface over wagmi/viem when available.
 * Wallet popup success is never settlement proof; MATCHFLOW reconciles only on signed SUCCESS.
 */

export type WalletConnectResult = {
  address: string
  chainId: number
}

export type TransferParams = {
  to: string
  amountAtomic: string
  tokenAddress?: string
  chainId?: number
}

export interface WalletAdapter {
  connect(): Promise<WalletConnectResult>
  getAddress(): string | null
  transfer(params: TransferParams): Promise<{ txHash: string }>
  disconnect(): Promise<void>
}

/** Fallback adapter until a browser wallet is connected via wagmi. */
export class ManualTxHashAdapter implements WalletAdapter {
  private address: string | null = null

  async connect(): Promise<WalletConnectResult> {
    this.address = 'manual'
    return { address: 'manual', chainId: 8453 }
  }

  getAddress(): string | null {
    return this.address
  }

  async transfer(): Promise<{ txHash: string }> {
    throw new Error('Use confirm-deposit with the on-chain tx hash. Wallet UI success is not settlement proof.')
  }

  async disconnect(): Promise<void> {
    this.address = null
  }
}

let adapter: WalletAdapter = new ManualTxHashAdapter()

export function getWalletAdapter(): WalletAdapter {
  return adapter
}

export function setWalletAdapter(next: WalletAdapter): void {
  adapter = next
}
