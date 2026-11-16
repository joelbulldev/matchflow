import { NearConnector } from '@hot-labs/near-connect'
import { getBootstrap } from '@/lib/api-client'

let connectorPromise: Promise<NearConnector> | null = null

export function getNearNetwork(): 'mainnet' | 'testnet' {
  const n = (getBootstrap() as { nearNetwork?: string }).nearNetwork
  return n === 'testnet' ? 'testnet' : 'mainnet'
}

function nearRpcProxyUrl(): string | undefined {
  const b = getBootstrap() as { restUrl?: string; nearRpcProxyPath?: string }
  const base = (b.restUrl ?? '/api/v1').replace(/\/$/, '')
  const path = b.nearRpcProxyPath ?? '/near-rpc'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function restoreNearCheckoutSession(): Promise<string | null> {
  try {
    const connector = await getNearConnector()
    await connector.whenManifestLoaded
    const { accounts } = await connector.getConnectedWallet()
    return accounts[0]?.accountId ?? null
  } catch {
    return null
  }
}

export async function getNearConnector(): Promise<NearConnector> {
  if (!connectorPromise) {
    const proxy = nearRpcProxyUrl()
    const network = getNearNetwork()
    connectorPromise = Promise.resolve(
      new NearConnector({
        network,
        autoConnect: true,
        footerBranding: null,
        providers: proxy
          ? {
              mainnet: [proxy],
              testnet: [proxy],
            }
          : undefined,
      }),
    )
  }
  return connectorPromise
}

export type NearSignedProof = {
  accountId: string
  publicKey: string
  signature: string
}

function encodeNonce(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function isWalletDismissed(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lower = msg.toLowerCase()
  return lower.includes('wallet closed') || lower.includes('user rejected') || lower.includes('cancel')
}

/** Connect-only for public checkout refund address (no staff message signing). */
export async function connectNearWalletOnly(): Promise<string | null> {
  const connector = await getNearConnector()
  try {
    const wallet = await connector.connect()
    const accounts = await wallet.getAccounts()
    return accounts[0]?.accountId ?? null
  } catch (e) {
    if (isWalletDismissed(e)) {
      return null
    }
    throw e
  }
}

export async function connectAndSignNear(params: {
  message: string
  recipient: string
  nonce: string
}): Promise<NearSignedProof> {
  const connector = await getNearConnector()
  let wallet
  try {
    wallet = await connector.connect({
      signMessageParams: {
        message: params.message,
        recipient: params.recipient,
        nonce: encodeNonce(params.nonce),
      },
    })
  } catch (e) {
    if (isWalletDismissed(e)) {
      throw new Error('Wallet request was closed. Open your NEAR wallet and try again when ready.')
    }
    throw e
  }

  const accounts = await wallet.getAccounts()
  const accountId = accounts[0]?.accountId
  if (!accountId) throw new Error('No NEAR account returned from wallet')

  let publicKey = ''
  let signature = ''

  // Prefer signed payload from connect({ signMessageParams }) when present on account
  const signed = (accounts[0] as { signedMessage?: { publicKey?: string; signature?: string; accountId?: string } })
    ?.signedMessage
  if (signed?.signature) {
    publicKey = String(signed.publicKey || '')
    signature = String(signed.signature)
  } else if (typeof wallet.signMessage === 'function') {
    const result = await wallet.signMessage({
      message: params.message,
      recipient: params.recipient,
      nonce: encodeNonce(params.nonce),
    })
    publicKey = String((result as { publicKey?: string })?.publicKey || '')
    signature = String((result as { signature?: string })?.signature || JSON.stringify(result))
  } else {
    // Fallback: connect-only proof for environments that skip message signing
    signature = `connected:${accountId}:${params.nonce}`
  }

  if (!signature) throw new Error('Wallet did not return a signature')

  return { accountId, publicKey, signature }
}

export async function disconnectNear(): Promise<void> {
  try {
    const connector = await getNearConnector()
    await connector.disconnect()
  } catch {
    /* ignore */
  }
}
