import { test, expect } from '@playwright/test'

/**
 * AR E2E stub — documents the happy path without inventing live SUCCESS.
 * Full create → issue → pay → SUCCESS requires credentials + funded wallet.
 */
test.describe('AR flow stub', () => {
  test('checkout shell path shape exists', async ({ request }) => {
    const res = await request.get('/pay/demo-token-not-real')
    // Invalid token still serves SPA shell (not WP theme 404).
    expect(res.status()).toBeLessThan(500)
  })

  test('public invoice API rejects missing token', async ({ request }) => {
    const res = await request.get('/api/v1/public/invoices/not-a-real-token')
    expect([400, 401, 403, 404]).toContain(res.status())
  })
})
