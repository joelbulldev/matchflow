import type { TransferResult, UsdcTransferParams, WalletAdapter } from './types'

/** Non-blocking stub when no injected wallet / wagmi not ready. */
export class NullWalletAdapter implements WalletAdapter {
  readonly id = 'null'
  readonly label = 'No wallet'

  isAvailable(): boolean {
    return false
  }

  getAddress(): string | null {
    return null
  }

  async connect(): Promise<string | null> {
    return null
  }

  async disconnect(): Promise<void> {}

  async transferUsdc(_params: UsdcTransferParams): Promise<TransferResult | null> {
    return null
  }
}
