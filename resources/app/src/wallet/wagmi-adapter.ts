import { getAccount, getWalletClient, connect, disconnect, switchChain } from 'wagmi/actions'
import { encodeFunctionData, erc20Abi, type Hex } from 'viem'
import { base } from 'wagmi/chains'
import { wagmiConfig } from './wagmi-config'
import type { TransferResult, UsdcTransferParams, WalletAdapter } from './types'

/**
 * Wagmi/viem WalletAdapter for one verified EVM route (Base USDC).
 * Wallet popup success is never settlement proof.
 */
export class WagmiWalletAdapter implements WalletAdapter {
  readonly id = 'wagmi-injected'
  readonly label = 'Browser wallet'

  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof (window as { ethereum?: unknown }).ethereum !== 'undefined'
  }

  getAddress(): string | null {
    try {
      const account = getAccount(wagmiConfig)
      return account.address ?? null
    } catch {
      return null
    }
  }

  async connect(): Promise<string | null> {
    if (!this.isAvailable()) return null
    try {
      const result = await connect(wagmiConfig, { connector: wagmiConfig.connectors[0] })
      if (result.chainId !== base.id) {
        await switchChain(wagmiConfig, { chainId: base.id })
      }
      return result.accounts[0] ?? null
    } catch {
      return null
    }
  }

  async disconnect(): Promise<void> {
    try {
      await disconnect(wagmiConfig)
    } catch {
      /* ignore */
    }
  }

  async transferUsdc(params: UsdcTransferParams): Promise<TransferResult | null> {
    if (!this.isAvailable()) return null
    try {
      let account = getAccount(wagmiConfig)
      if (!account.address) {
        await this.connect()
        account = getAccount(wagmiConfig)
      }
      if (!account.address) return null

      if (account.chainId !== params.chainId) {
        await switchChain(wagmiConfig, { chainId: params.chainId as typeof base.id })
      }

      const client = await getWalletClient(wagmiConfig)
      if (!client) return null

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.to, params.amountAtomic],
      })

      const hash = await client.request({
        method: 'eth_sendTransaction',
        params: [{
          from: account.address,
          to: params.tokenAddress,
          data: data as Hex,
        }],
      })

      return { hash: hash as `0x${string}` }
    } catch {
      return null
    }
  }
}
