import stringify from 'json-stable-stringify'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sample = JSON.parse(readFileSync(new URL('./quote-sample.json', import.meta.url), 'utf8'))

// Mirror @defuse-protocol/one-click-sdk-typescript@0.1.26
function buildSignedQuoteRequest(response) {
  const { quoteRequest } = response
  return {
    dry: quoteRequest.dry,
    swapType: quoteRequest.swapType,
    slippageTolerance: quoteRequest.slippageTolerance,
    originAsset: quoteRequest.originAsset,
    depositType: quoteRequest.depositType,
    destinationAsset: quoteRequest.destinationAsset,
    amount: quoteRequest.amount,
    refundTo: quoteRequest.refundTo,
    refundType: quoteRequest.refundType,
    recipient: quoteRequest.recipient,
    recipientType: quoteRequest.recipientType,
    deadline: quoteRequest.deadline,
    quoteWaitingTimeMs: quoteRequest.quoteWaitingTimeMs ? quoteRequest.quoteWaitingTimeMs : undefined,
    referral: quoteRequest.referral ? quoteRequest.referral : undefined,
    virtualChainRecipient: quoteRequest.virtualChainRecipient ? quoteRequest.virtualChainRecipient : undefined,
    virtualChainRefundRecipient: quoteRequest.virtualChainRefundRecipient ? quoteRequest.virtualChainRefundRecipient : undefined,
    customRecipientMsg: quoteRequest.customRecipientMsg ? quoteRequest.customRecipientMsg : undefined,
    sessionId: undefined,
    connectedWallets: undefined,
    correlationId: undefined,
    appFees: undefined,
    partnerId: undefined,
    userAccountId: undefined,
    depositMode: undefined,
  }
}

function buildSignedQuote(response) {
  const { quote } = response
  const dry = response.quoteRequest.dry
  if (dry) {
    return {
      amountIn: quote.amountIn,
      amountInFormatted: quote.amountInFormatted,
      amountInUsd: quote.amountInUsd,
      minAmountIn: quote.minAmountIn,
      amountOut: quote.amountOut,
      amountOutFormatted: quote.amountOutFormatted,
      amountOutUsd: quote.amountOutUsd,
      minAmountOut: quote.minAmountOut,
    }
  }
  return {
    amountIn: quote.amountIn,
    amountInFormatted: quote.amountInFormatted,
    amountInUsd: quote.amountInUsd,
    minAmountIn: quote.minAmountIn,
    amountOut: quote.amountOut,
    amountOutFormatted: quote.amountOutFormatted,
    amountOutUsd: quote.amountOutUsd,
    minAmountOut: quote.minAmountOut,
    depositAddress: quote.depositAddress || undefined,
    depositMemo: quote.depositMemo || undefined,
    deadline: quote.deadline || undefined,
    timeWhenInactive: quote.timeWhenInactive || undefined,
    timeEstimate: quote.timeEstimate || undefined,
    refundFee: quote.refundFee || undefined,
    withdrawFee: quote.withdrawFee || undefined,
  }
}

const req = buildSignedQuoteRequest(sample)
const q = buildSignedQuote(sample)
const payload = { ...req, ...q, timestamp: sample.timestamp }
const json = stringify(payload)
console.log(json)