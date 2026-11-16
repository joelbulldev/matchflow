const EVM = /^0x[a-fA-F0-9]{40}$/
const NEAR_ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$|^[a-f0-9]{64}$/i

export function isEvmRefundAddress(value: string): boolean {
  return EVM.test(value.trim())
}

export function isNearRefundAddress(value: string): boolean {
  const v = value.trim()
  return NEAR_ACCOUNT.test(v) && !v.startsWith('0x')
}

export function originNeedsEvmRefund(originAssetId: string): boolean {
  const id = originAssetId.toLowerCase()
  return id.includes('base-0x') || id.includes('eth-0x') || id.includes('arb-0x') || id.includes('ethereum.omft')
}

export function refundMatchesOrigin(originAssetId: string, refundAddress: string): boolean {
  const refund = refundAddress.trim()
  if (!refund) return false
  if (originNeedsEvmRefund(originAssetId)) return isEvmRefundAddress(refund)
  return isNearRefundAddress(refund)
}

export function refundHintForOrigin(originAssetId: string): string {
  return originNeedsEvmRefund(originAssetId)
    ? 'Connect an Ethereum wallet — refunds use the same 0x address.'
    : 'Connect your NEAR wallet — refunds return there if needed.'
}