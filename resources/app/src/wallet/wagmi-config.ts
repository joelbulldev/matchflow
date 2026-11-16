import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

/**
 * Minimal wagmi config for Base USDC transfer confirm UI.
 * Keep non-blocking: connectors fail soft when no extension is present.
 */
export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [base.id]: http(),
  },
  ssr: false,
})
