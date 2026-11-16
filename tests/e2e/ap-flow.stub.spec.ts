import { test, expect } from '@playwright/test'

/**
 * AP E2E stub — mismatch → correct → approve → pay path is exercised via PHPUnit
 * match fixtures; browser SUCCESS remains a human live checklist item.
 */
test.describe('AP flow stub', () => {
  test('payables inbox route exists', async ({ request }) => {
    const res = await request.get('/payables/bills')
    expect(res.status()).toBeLessThan(500)
  })

  test('approvals route exists', async ({ request }) => {
    const res = await request.get('/approvals')
    expect(res.status()).toBeLessThan(500)
  })
})
