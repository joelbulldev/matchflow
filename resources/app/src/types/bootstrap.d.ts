export type MatchflowBootstrap = {
  restUrl: string
  restNonce: string
  siteUrl: string
  pluginUrl?: string
  assetsUrl?: string
  version: string
  nearNetwork?: 'mainnet' | 'testnet' | string
  user: null | {
    id: number
    email: string
    displayName: string
    nearAccountId?: string | null
    hasNearWallet?: boolean
  }
}

declare global {
  interface Window {
    MATCHFLOW_BOOTSTRAP?: MatchflowBootstrap
  }
}

export {}
