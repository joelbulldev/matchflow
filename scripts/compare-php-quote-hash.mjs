import stringify from 'json-stable-stringify'
import { readFileSync } from 'node:fs'
import { sha256 } from '@noble/hashes/sha2'
import { base58 } from '@scure/base'
import { quoteHash, verifyQuoteSignature } from '../.tmp-sdk/package/dist/index.mjs'

const sample = JSON.parse(readFileSync(new URL('./quote-sample.json', import.meta.url), 'utf8'))

const REQUEST_KEYS = [
  'dry', 'swapType', 'slippageTolerance', 'originAsset', 'depositType', 'destinationAsset',
  'amount', 'refundTo', 'refundType', 'recipient', 'recipientType', 'deadline',
  'quoteWaitingTimeMs', 'referral', 'virtualChainRecipient', 'virtualChainRefundRecipient', 'customRecipientMsg',
]
const DRY_QUOTE_KEYS = [
  'amountIn', 'amountInFormatted', 'amountInUsd', 'minAmountIn',
  'amountOut', 'amountOutFormatted', 'amountOutUsd', 'minAmountOut',
]

function phpStringify(value) {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      const isList = value.length === 0 || value.every((_, i) => Object.prototype.hasOwnProperty.call(value, i))
      if (isList) {
        return '[' + value.map(phpStringify).join(',') + ']'
      }
    }
    const keys = Object.keys(value).sort()
    return '{' + keys.map((k) => phpStringify(String(k)) + ':' + phpStringify(value[k])).join(',') + '}'
  }
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value === null) return 'null'
  if (typeof value === 'number') return JSON.stringify(value)
  return JSON.stringify(String(value))
}

function buildSignedQuoteRequestPhp(quoteResponse) {
  const quoteRequest = quoteResponse.quoteRequest ?? {}
  const optionalOnlyIfTruthy = new Set([
    'quoteWaitingTimeMs', 'referral', 'virtualChainRecipient', 'virtualChainRefundRecipient', 'customRecipientMsg',
  ])
  const out = {}
  for (const key of REQUEST_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(quoteRequest, key)) continue
    let value = quoteRequest[key]
    if (optionalOnlyIfTruthy.has(key)) {
      if (value === null || value === '' || value === false || value === 0 || (Array.isArray(value) && value.length === 0)) continue
    } else if (value === null) continue
    if (key === 'slippageTolerance' && (typeof value === 'number' || typeof value === 'string')) {
      out[key] = parseInt(String(value), 10)
      continue
    }
    if (key === 'dry') {
      out[key] = Boolean(value)
      continue
    }
    out[key] = value
  }
  return out
}

function buildSignedQuotePhp(quoteResponse) {
  const quote = quoteResponse.quote ?? {}
  const dry = Boolean(quoteResponse.quoteRequest?.dry ?? true)
  const out = {}
  for (const key of DRY_QUOTE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(quote, key)) continue
    const value = quote[key]
    if (value === null) continue
    out[key] = value
  }
  if (dry) return out
  const liveKeys = ['depositAddress', 'depositMemo', 'deadline', 'timeWhenInactive', 'timeEstimate', 'refundFee', 'withdrawFee']
  for (const key of liveKeys) {
    if (!Object.prototype.hasOwnProperty.call(quote, key)) continue
    const value = quote[key]
    if (value === null || value === '' || value === false) continue
    if (key === 'timeEstimate' && value === 0) continue
    out[key] = value
  }
  return out
}

function phpQuoteHash(quoteResponse) {
  const request = buildSignedQuoteRequestPhp(quoteResponse)
  const quote = buildSignedQuotePhp(quoteResponse)
  const timestamp = String(quoteResponse.timestamp ?? '')
  const payload = { ...request, ...quote, timestamp }
  const json = phpStringify(payload)
  const hash = base58.encode(sha256(new TextEncoder().encode(json)))
  return { hash, json }
}

const sdkHash = quoteHash(sample)
const php = phpQuoteHash(sample)
const sdkJson = stringify({
  ...buildSignedQuoteRequestPhp(sample),
  ...buildSignedQuotePhp(sample),
  timestamp: String(sample.timestamp ?? ''),
})

// SDK uses timestamp as-is (not string cast)
const sdkJsonRawTs = stringify({
  ...buildSignedQuoteRequestPhp(sample),
  ...buildSignedQuotePhp(sample),
  timestamp: sample.timestamp,
})

console.log('sdk verify', verifyQuoteSignature(sample))
console.log('sdk hash', sdkHash)
console.log('php hash', php.hash)
const manualPhpJsonHash = base58.encode(sha256(new TextEncoder().encode(php.json)))
const manualSdkJsonHash = base58.encode(sha256(new TextEncoder().encode(sdkJson)))
console.log('match', sdkHash === php.hash)
console.log('manual hash php.json', manualPhpJsonHash)
console.log('manual hash sdkJson', manualSdkJsonHash)
console.log('json-stable vs phpStringify', sdkJson === php.json)
console.log('json match (str ts)', sdkJson === php.json)
console.log('json match (raw ts)', sdkJsonRawTs === php.json)
if (sdkJson !== php.json) {
  console.log('--- sdk json length', sdkJson.length, 'php', php.json.length)
  for (let i = 0; i < Math.max(sdkJson.length, php.json.length); i++) {
    if (sdkJson[i] !== php.json[i]) {
      console.log('diff at', i, JSON.stringify(sdkJson.slice(Math.max(0, i - 20), i + 40)))
      break
    }
  }
}