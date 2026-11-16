type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> }

export type BootstrapUser = {
  id: number
  email: string
  displayName: string
  nearAccountId?: string | null
  hasNearWallet?: boolean
}

export type MatchflowBootstrap = {
  restUrl: string
  restUrlAlias?: string
  restNonce: string
  siteUrl: string
  pluginUrl: string
  version: string
  nearNetwork?: string
  nearRpcProxyPath?: string
  user: BootstrapUser | null
}

declare global {
  interface Window {
    MATCHFLOW_BOOTSTRAP?: MatchflowBootstrap
  }
}

const API_FALLBACK = '/api/v1'

function bootstrap(): MatchflowBootstrap {
  return window.MATCHFLOW_BOOTSTRAP ?? {
    restUrl: API_FALLBACK,
    restNonce: '',
    siteUrl: '/',
    pluginUrl: '/',
    version: '0.0.0',
    user: null,
  }
}

/** Public API alias — nginx must rewrite /api/v1 → rest_route=/matchflow/v1/… */
export function resolveRestBaseUrl(): string {
  const boot = bootstrap()
  let raw = (boot.restUrl || '').trim()
  if (raw.includes('/wp-json/')) {
    if (typeof window !== 'undefined') {
      raw = `${window.location.origin}/api/v1`
    } else {
      raw = '/api/v1'
    }
  }
  if (!raw) {
    raw = typeof window !== 'undefined' ? `${window.location.origin}${API_FALLBACK}` : API_FALLBACK
  }
  return raw.replace(/\/$/, '')
}

export function patchBootstrap(partial: Partial<Pick<MatchflowBootstrap, 'user' | 'restNonce'>>) {
  const current = bootstrap()
  window.MATCHFLOW_BOOTSTRAP = {
    ...current,
    ...partial,
    user: partial.user !== undefined ? partial.user : current.user,
  }
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}, orgId?: number | null): Promise<T> {
  const boot = bootstrap()
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (boot.restNonce) headers.set('X-WP-Nonce', boot.restNonce)
  if (orgId) headers.set('X-Matchflow-Organization', String(orgId))

  const base = resolveRestBaseUrl()
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  })

  const json = await res.json().catch(() => ({}))
  const errCode = json?.code || json?.data?.code
  const errMessage = json?.message || json?.data?.message || res.statusText || 'Request failed'
  const errStatus = json?.data?.status || res.status
  if (!res.ok || json?.success === false || errCode) {
    throw new ApiError(errCode || 'matchflow_http_error', errMessage, errStatus)
  }
  if (json?.success === true && json.data === null && res.status >= 400) {
    throw new ApiError('matchflow_empty_response', 'Server returned an empty payload.', res.status)
  }
  return (json as ApiSuccess<T>).data
}

export function getBootstrap() {
  return bootstrap()
}
