import { test, expect } from '@playwright/test'

test('SPA shell does not advertise platform generator in body when loaded', async ({ request }) => {
  const res = await request.get('/')
  const text = await res.text()
  // Soft check: Matchflow shell markup if plugin is active.
  if (res.status() === 200 && text.includes('matchflow-root')) {
    expect(text.toLowerCase()).not.toContain('powered by wordpress')
  } else {
    expect(res.status()).toBeLessThan(500)
  }
})
