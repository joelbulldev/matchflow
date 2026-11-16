import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { quoteHash, verifyQuoteSignature } from '../.tmp-sdk/package/dist/index.mjs'

// Mirror QuoteSignature.php stableJson for regression checks.
const sample = JSON.parse(readFileSync(new URL('./quote-sample.json', import.meta.url), 'utf8'))
console.log('sdk valid', verifyQuoteSignature(sample))
console.log('sdk hash', quoteHash(sample))
console.log('expected hash CboiVM67TwxER7uGG5sdNiNbqDW2d9xN8n8FaitV3nCt')