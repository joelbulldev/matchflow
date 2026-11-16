import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getBootstrap } from '@/lib/api-client'
import { applyAuthSession, clearAuthSession, type LoginPayload } from '@/lib/session'
import { appNavigate } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { connectAndSignNear, disconnectNear } from '@/lib/near-connector'
import { toast } from '@/lib/toast'

export type AuthUser = {
  id: number
  email: string
  displayName: string
  nearAccountId?: string | null
  nearLinkedAt?: string | null
  hasNearWallet?: boolean
  authMethods?: string[]
}

type NearChallenge = {
  challengeId: string
  message: string
  recipient: string
  nonce: string
  purpose: 'login' | 'link'
}

type NearAuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  needsNearLink: boolean
  connecting: boolean
  error: string | null
  refresh: () => Promise<void>
  loginWithNear: () => Promise<void>
  linkNearWallet: () => Promise<void>
  unlinkNearWallet: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const NearAuthContext = createContext<NearAuthContextValue | null>(null)

function bootUser(): AuthUser | null {
  const u = getBootstrap().user
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    nearAccountId: (u as AuthUser).nearAccountId ?? null,
    hasNearWallet: !!(u as AuthUser).hasNearWallet || !!(u as AuthUser).nearAccountId,
  }
}

export function NearAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api<AuthUser>('/auth/me')
      } catch {
        return null
      }
    },
    initialData: bootUser,
    staleTime: 30_000,
  })

  const user = me.data ?? null
  const isAuthenticated = !!user?.id
  const needsNearLink = isAuthenticated && !user?.hasNearWallet && !user?.nearAccountId

  const refresh = useCallback(async () => {
    await me.refetch()
    await qc.invalidateQueries({ queryKey: ['bootstrap'] })
  }, [me, qc])

  const runNearFlow = useCallback(
    async (purpose: 'login' | 'link') => {
      setConnecting(true)
      setError(null)
      try {
        const challenge = await api<NearChallenge>('/auth/near/challenge', {
          method: 'POST',
          body: JSON.stringify({ purpose }),
        })
        const proof = await connectAndSignNear({
          message: challenge.message,
          recipient: challenge.recipient,
          nonce: challenge.nonce,
        })
        const path = purpose === 'link' ? '/auth/near/link' : '/auth/near/login'
        const result = await api<{ user: AuthUser; restNonce?: string }>(path, {
          method: 'POST',
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            accountId: proof.accountId,
            publicKey: proof.publicKey,
            signature: proof.signature,
          }),
        })
        await applyAuthSession(qc, result as LoginPayload)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'NEAR wallet request failed'
        setError(message)
        if (!message.toLowerCase().includes('closed') && !message.toLowerCase().includes('cancel')) {
          throw e
        }
      } finally {
        setConnecting(false)
      }
    },
    [qc],
  )

  const loginWithNear = useCallback(async () => {
    await runNearFlow('login')
  }, [runNearFlow])

  const linkNearWallet = useCallback(async () => {
    await runNearFlow('link')
  }, [runNearFlow])

  const unlinkNearWallet = useCallback(async () => {
    setError(null)
    const result = await api<{ user: AuthUser }>('/auth/near/unlink', { method: 'POST' })
    await disconnectNear()
    qc.setQueryData(['auth', 'me'], result.user)
  }, [qc])

  const finishLogout = useCallback(async () => {
    setError(null)
    await disconnectNear().catch(() => undefined)
    clearAuthSession(qc)
    toast.success('Signed out')
    await appNavigate(routes.login)
  }, [qc])

  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      void finishLogout()
    },
  })

  const value = useMemo<NearAuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      needsNearLink,
      connecting,
      error,
      refresh,
      loginWithNear,
      linkNearWallet,
      unlinkNearWallet,
      logout: async () => {
        await logoutMutation.mutateAsync()
      },
      clearError: () => setError(null),
    }),
    [
      user,
      isAuthenticated,
      needsNearLink,
      connecting,
      error,
      refresh,
      loginWithNear,
      linkNearWallet,
      unlinkNearWallet,
      logoutMutation,
      finishLogout,
    ],
  )

  return <NearAuthContext.Provider value={value}>{children}</NearAuthContext.Provider>
}

export function useNearAuth() {
  const ctx = useContext(NearAuthContext)
  if (!ctx) throw new Error('useNearAuth must be used within NearAuthProvider')
  return ctx
}
