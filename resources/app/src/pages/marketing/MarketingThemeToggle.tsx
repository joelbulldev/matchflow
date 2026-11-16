import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { applyMarketingTheme, readMarketingTheme, type MarketingTheme } from './marketing-theme'

export function MarketingThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<MarketingTheme>(() => readMarketingTheme())

  useEffect(() => {
    applyMarketingTheme(theme)
  }, [theme])

  return (
    <button
      type="button"
      className={cn('mf-mkt-theme-toggle', className)}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'light' ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} />}
    </button>
  )
}
