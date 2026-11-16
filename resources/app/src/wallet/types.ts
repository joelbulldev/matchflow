export type WalletChain = {
  id: number
  name: string
}

export type UsdcTransferParams = {
  to: `0x${string}`
  amountAtomic: bigint
  chainId: number
  /** ERC-20 USDC on the origin chain */
  tokenAddress: `0x${string}`
}

export type TransferResult = {
  hash: `0x${string}`
}

/**
 * WalletAdapter — keep wallet SDKs behind this interface.
 * Missing wallet must not block checkout (manual deposit still works).
 */
export interface WalletAdapter {
  readonly id: string
  readonly label: string
  isAvailable(): boolean
  getAddress(): string | null
  connect(): Promise<string | null>
  disconnect(): Promise<void>
  transferUsdc(params: UsdcTransferParams): Promise<TransferResult | null>
}

/** Base mainnet USDC (intersected with NEAR Intents Base USDC route). */
export const BASE_USDC = {
  chainId: 8453,
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  decimals: 6,
  nearAssetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
}
