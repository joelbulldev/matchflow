import { verifyQuoteSignature, quoteHash } from '../.tmp-sdk/package/dist/index.mjs' // 0.1.26 after npm pack

const q = {
  quote: {
    amountIn: '2525252526',
    amountInFormatted: '0.000000000000002525252526',
    amountInUsd: '0.000000000000',
    minAmountIn: '2500000000',
    amountOut: '2500000000',
    amountOutFormatted: '0.0000000000000025',
    amountOutUsd: '0.000000000000',
    minAmountOut: '2500000000',
    timeEstimate: 20,
    refundFee: '0',
    withdrawFee: '0',
    deadline: '2026-11-17T10:15:29.000Z',
    timeWhenInactive: '2026-11-17T10:15:29.000Z',
    depositAddress: '3ac46da448018925df0b75bd639aa9445efcafe1fab472c1474ec5bf7a34be30',
  },
  quoteRequest: {
    dry: false,
    depositMode: 'SIMPLE',
    swapType: 'EXACT_OUTPUT',
    slippageTolerance: 100,
    originAsset: 'nep141:wrap.near',
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: 'nep141:wrap.near',
    amount: '2500000000',
    refundTo: 'earnfidotfun.near',
    refundType: 'ORIGIN_CHAIN',
    recipient: 'earnfidotfun.near',
    recipientType: 'DESTINATION_CHAIN',
    deadline: '2026-11-14T10:15:29.000Z',
    confidentiality: 'public',
    quoteWaitingTimeMs: 0,
    insured: false,
    appFees: [],
  },
  signature: 'ed25519:3Xga2nMqvKS6KiNQU4PmBFM4BexaLRyQzkQ5Xwgwjc5L19XzWxyLxiW25ikZDZZChW9zNbi3EMgoYq9UV55EjwM5',
  timestamp: '2026-11-14T09:15:29.682Z',
  correlationId: 'faa46e94-6d9d-42a4-9588-e726da962991',
}

console.log('valid', verifyQuoteSignature(q))
console.log('hash', quoteHash(q))