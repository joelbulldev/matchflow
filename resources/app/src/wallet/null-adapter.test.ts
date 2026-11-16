import { describe, expect, it } from 'vitest'
import { NullWalletAdapter } from './null-adapter'
import { BASE_USDC } from './types'

describe('NullWalletAdapter', () => {
  it('is non-blocking when wallet missing', async () => {
    const wallet = new NullWalletAdapter()
    expect(wallet.isAvailable()).toBe(false)
    expect(await wallet.connect()).toBeNull()
    expect(
      await wallet.transferUsdc({
        to: '0x0000000000000000000000000000000000000001',
        amountAtomic: 1n,
        chainId: BASE_USDC.chainId,
        tokenAddress: BASE_USDC.tokenAddress,
      }),
    ).toBeNull()
  })
})
