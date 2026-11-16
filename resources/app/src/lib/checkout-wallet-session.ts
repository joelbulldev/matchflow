const REFUND_PREFIX = 'mf:checkout:refund:'
const PAY_PATH_PREFIX = 'mf:checkout:pay-path:'
const NEAR_ACCOUNT_PREFIX = 'mf:checkout:near-account:'

export function checkoutRefundKey(payToken: string): string {
  return `${REFUND_PREFIX}${payToken}`
}

export function readCheckoutRefund(payToken: string): string {
  try {
    return localStorage.getItem(checkoutRefundKey(payToken)) ?? ''
  } catch {
    return ''
  }
}

export function writeCheckoutRefund(payToken: string, address: string): void {
  try {
    const v = address.trim()
    if (!v) {
      localStorage.removeItem(checkoutRefundKey(payToken))
      return
    }
    localStorage.setItem(checkoutRefundKey(payToken), v)
  } catch {
    /* ignore */
  }
}

export function readCheckoutPayPath(payToken: string): 'near' | 'cross-chain' {
  try {
    const v = localStorage.getItem(`${PAY_PATH_PREFIX}${payToken}`)
    return v === 'cross-chain' ? 'cross-chain' : 'near'
  } catch {
    return 'near'
  }
}

export function writeCheckoutPayPath(payToken: string, path: 'near' | 'cross-chain'): void {
  try {
    localStorage.setItem(`${PAY_PATH_PREFIX}${payToken}`, path)
  } catch {
    /* ignore */
  }
}

export function readCheckoutNearAccount(payToken: string): string {
  try {
    return localStorage.getItem(`${NEAR_ACCOUNT_PREFIX}${payToken}`) ?? ''
  } catch {
    return ''
  }
}

export function writeCheckoutNearAccount(payToken: string, accountId: string): void {
  try {
    const v = accountId.trim()
    if (!v) {
      localStorage.removeItem(`${NEAR_ACCOUNT_PREFIX}${payToken}`)
      return
    }
    localStorage.setItem(`${NEAR_ACCOUNT_PREFIX}${payToken}`, v)
  } catch {
    /* ignore */
  }
}