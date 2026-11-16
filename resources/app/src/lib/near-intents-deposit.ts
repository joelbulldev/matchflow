import { getNearConnector } from '@/lib/near-connector'

const WRAP_NEAR = 'wrap.near'

export function isNearOriginChainAsset(assetId: string): boolean {
  const id = assetId.toLowerCase()
  return id === 'nep141:wrap.near' || id.endsWith(':wrap.near')
}

/** 1Click ORIGIN_CHAIN deposit addresses are implicit NEAR accounts (64 hex chars). */
export function isImplicitNearDepositAddress(address: string): boolean {
  return /^[a-f0-9]{64}$/i.test(address.trim())
}

async function connectedWallet() {
  const connector = await getNearConnector()
  await connector.whenManifestLoaded
  try {
    return await connector.wallet()
  } catch {
    return await connector.connect()
  }
}

/**
 * 1Click NEAR-origin deposits: send native NEAR to the implicit deposit account.
 * wNEAR `ft_transfer` fails with "account is not registered" on implicit receivers.
 */
async function sendNativeNearToDeposit(wallet: Awaited<ReturnType<typeof connectedWallet>>, depositAddress: string, amountAtomic: string): Promise<string> {
  const result = await wallet.signAndSendTransaction({
    receiverId: depositAddress,
    actions: [
      {
        type: 'Transfer',
        params: {
          deposit: amountAtomic,
        },
      },
    ],
  })
  const hash = result.transaction?.hash
  if (!hash) throw new Error('Wallet did not return a transaction hash.')
  return String(hash)
}

async function sendWrappedNearFtTransfer(
  wallet: Awaited<ReturnType<typeof connectedWallet>>,
  depositAddress: string,
  amountAtomic: string,
): Promise<string> {
  const result = await wallet.signAndSendTransaction({
    receiverId: WRAP_NEAR,
    actions: [
      {
        type: 'FunctionCall',
        params: {
          methodName: 'ft_transfer',
          args: {
            receiver_id: depositAddress,
            amount: amountAtomic,
          },
          gas: '50000000000000',
          deposit: '1',
        },
      },
    ],
  })
  const hash = result.transaction?.hash
  if (!hash) throw new Error('Wallet did not return a transaction hash.')
  return String(hash)
}

/**
 * Pay a 1Click quote from a connected NEAR wallet (per NEAR Intents making-a-request).
 */
export async function depositWrapNearToIntents(params: {
  depositAddress: string
  /** Use minAmountIn from quote; amountIn optional buffer when provided. */
  amountAtomic: string
  amountInAtomic?: string
  /** @deprecated Implicit deposit addresses always use native NEAR transfer. */
  preferWrapFromNative?: boolean
}): Promise<string> {
  const depositAddress = params.depositAddress.trim()
  const minAmount = params.amountAtomic.trim()
  const sendAmount = (params.amountInAtomic?.trim() || minAmount).trim()
  if (!depositAddress || !minAmount || !/^\d+$/.test(minAmount)) {
    throw new Error('Deposit details are incomplete. Request a new quote.')
  }

  const wallet = await connectedWallet()
  const accounts = await wallet.getAccounts()
  if (!accounts[0]?.accountId) {
    throw new Error('Connect a NEAR wallet to pay.')
  }

  try {
    if (isImplicitNearDepositAddress(depositAddress)) {
      return await sendNativeNearToDeposit(wallet, depositAddress, sendAmount)
    }
    return await sendWrappedNearFtTransfer(wallet, depositAddress, sendAmount)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('not registered')) {
      throw new Error(
        'This payment route needs native NEAR to the deposit address, not wNEAR. Refresh the page and pay again.',
      )
    }
    if (msg.includes('mobile_bridge_wallet_declined') || msg.includes('User rejected')) {
      throw new Error('Payment was cancelled in your wallet.')
    }
    throw e instanceof Error ? e : new Error(msg)
  }
}

export function parseSettlementDepositFields(data: unknown): {
  settlementId: number
  depositAddress: string
  amountAtomic: string
  amountInAtomic: string
  depositMemo: string | null
  originAssetId: string
} | null {
  const row = (data ?? {}) as Record<string, unknown>
  const id = Number(row.id)
  if (!Number.isFinite(id) || id <= 0) return null

  let innerQuote: Record<string, unknown> = {}
  const rawJson = row.quote_json
  if (typeof rawJson === 'string' && rawJson !== '') {
    try {
      const parsed = JSON.parse(rawJson) as { quote?: Record<string, unknown> }
      innerQuote = parsed.quote ?? {}
    } catch {
      innerQuote = {}
    }
  } else if (row.quote && typeof row.quote === 'object') {
    const nested = row.quote as Record<string, unknown>
    innerQuote = (nested.quote as Record<string, unknown>) ?? nested
  }

  const depositAddress = String(row.deposit_address ?? innerQuote.depositAddress ?? '').trim()
  const minAmountIn = String(innerQuote.minAmountIn ?? row.source_amount_atomic ?? innerQuote.amountIn ?? '').trim()
  const amountIn = String(innerQuote.amountIn ?? minAmountIn).trim()
  const depositMemo =
    row.deposit_memo != null
      ? String(row.deposit_memo)
      : innerQuote.depositMemo != null
        ? String(innerQuote.depositMemo)
        : null
  const originAssetId = String(row.origin_asset_id ?? 'nep141:wrap.near')

  if (!depositAddress || !minAmountIn) return null
  return {
    settlementId: id,
    depositAddress,
    amountAtomic: minAmountIn,
    amountInAtomic: amountIn,
    depositMemo,
    originAssetId,
  }
}