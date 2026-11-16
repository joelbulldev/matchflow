export type MarketingTheme = 'light' | 'dark'

const STORAGE_KEY = 'mf-mkt-theme'

export function readMarketingTheme(): MarketingTheme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyMarketingTheme(theme: MarketingTheme) {
  document.documentElement.dataset.mktTheme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f6f7f9' : '#050608')
  }
}

export function bindMarketingBody(active: boolean) {
  document.body.classList.toggle('mf-marketing-active', active)
}
