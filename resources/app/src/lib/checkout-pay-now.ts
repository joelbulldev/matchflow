import { api } from '@/lib/api-client'
import { depositWrapNearToIntents, isNearOriginChainAsset, parseSettlementDepositFields } from '@/lib/near-intents-deposit'
import { refundMatchesOrigin } from '@/lib/checkout-refund'

export type CheckoutQuoteInput = {
  token: string
  originAssetId: string
  refundAddress: string
  destinationDecimals?: number
}

export async function fetchExecutableQuote(input: CheckoutQuoteInput): Promise<unknown> {
  if (!refundMatchesOrigin(input.originAssetId, input.refundAddress)) {
    throw new Error('Connect the right wallet for your payment method, then try again.')
  }
  const body: Record<string, unknown> = {
    dry: false,
    origin_asset_id: input.originAssetId,
    refund_address: input.refundAddress.trim(),
    swapType: 'EXACT_OUTPUT',
  }
  if (input.destinationDecimals != null && input.destinationDecimals > 0) {
    body.destination_decimals = input.destinationDecimals
  }
  return api(`/public/invoices/${input.token}/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** NEAR origin: firm quote + wallet transfer + notify 1Click. */
export async function payInvoiceWithNearWallet(input: CheckoutQuoteInput): Promise<{ txHash: string; settlementId: number }> {
  const settlement = await fetchExecutableQuote(input)
  const fields = parseSettlementDepositFields(settlement)
  if (!fields || !isNearOriginChainAsset(fields.originAssetId)) {
    throw new Error('This payment method needs a different wallet.')
  }
  const txHash = await depositWrapNearToIntents({
    depositAddress: fields.depositAddress,
    amountAtomic: fields.amountAtomic,
    amountInAtomic: fields.amountInAtomic,
  })
  await api(`/public/payments/${input.token}/settlements/${fields.settlementId}/confirm-deposit`, {
    method: 'POST',
    body: JSON.stringify({
      txHash,
      nearSenderAccount: input.refundAddress.trim(),
    }),
  })
  return { txHash, settlementId: fields.settlementId }
}