import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import type { QueryClient } from '@tanstack/react-query'
import { wagmiConfig } from './wagmi-config'
import { NullWalletAdapter } from './null-adapter'
import { WagmiWalletAdapter } from './wagmi-adapter'
import type { WalletAdapter } from './types'

const WalletAdapterContext = createContext<WalletAdapter>(new NullWalletAdapter())

export function useWalletAdapter(): WalletAdapter {
  return useContext(WalletAdapterContext)
}

/**
 * Nested under app QueryClientProvider. Wagmi uses the outer React Query client.
 * Missing injected wallet → NullWalletAdapter (non-blocking).
 */
export function MatchflowWalletProvider({
  children,
  queryClient: _queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  /** NEAR-first: never auto-open browser EVM wallets on app load — optional assist is manual on payment screens. */
  const [adapter] = useState<WalletAdapter>(() => new NullWalletAdapter())

  const value = useMemo(() => adapter, [adapter])

  return (
    <WagmiProvider config={wagmiConfig}>
      <WalletAdapterContext.Provider value={value}>{children}</WalletAdapterContext.Provider>
    </WagmiProvider>
  )
}