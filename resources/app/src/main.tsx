import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AppBootOverlay } from '@/components/matchflow/app-boot-overlay'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NearAuthProvider } from '@/auth/NearAuthContext'
import { MatchflowWalletProvider } from '@/wallet'
import { Toaster } from '@/components/ui/sonner'
import { routeTree } from './router'
import { registerAppRouter } from '@/lib/navigation'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
})
registerAppRouter(router)

router.subscribe('onResolved', () => {
  for (const selector of ['.mf-m-content', '.mf-d-main']) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) el.scrollTop = 0
  }
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String((event.reason as Error)?.message ?? event.reason ?? '')
    if (msg.toLowerCase().includes('wallet closed')) {
      event.preventDefault()
    }
  })
}

const root = document.getElementById('matchflow-root')
const bootEl = document.getElementById('mf-app-skeleton')
function dismissBootSplash() {
  if (!bootEl) return
  bootEl.style.opacity = '0'
  bootEl.style.pointerEvents = 'none'
  bootEl.style.transition = 'opacity 120ms ease'
  window.setTimeout(() => bootEl.remove(), 140)
}

function AppRoot() {
  const [booting, setBooting] = useState(true)
  useEffect(() => {
    const unsub = router.subscribe('onResolved', () => {
      dismissBootSplash()
      setBooting(false)
    })
    return () => unsub()
  }, [])
  return (
    <>
      {booting ? <AppBootOverlay /> : null}
      <RouterProvider router={router} />
      <Toaster richColors />
    </>
  )
}

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <MatchflowWalletProvider queryClient={queryClient}>
          <NearAuthProvider>
            <TooltipProvider delayDuration={200}>
              <AppRoot />
            </TooltipProvider>
          </NearAuthProvider>
        </MatchflowWalletProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}
