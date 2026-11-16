import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { api, getBootstrap, type BootstrapUser, patchBootstrap } from '@/lib/api-client'
import { appPath, legacyAppPrefixes, routes } from '@/lib/routes'
import type { AuthUser } from '@/auth/NearAuthContext'

export type LoginPayload = {
  user: AuthUser
  restNonce?: string
}

export type BootstrapPayload = {
  authenticated: boolean
  user: AuthUser | null
  restNonce?: string
  currentOrganizationId?: number | null
}

function toBootstrapUser(user: AuthUser): BootstrapUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    nearAccountId: user.nearAccountId ?? null,
    hasNearWallet: !!user.hasNearWallet || !!user.nearAccountId,
  }
}

export async function applyAuthSession(qc: QueryClient, payload: LoginPayload) {
  patchBootstrap({
    user: toBootstrapUser(payload.user),
    restNonce: payload.restNonce,
  })
  qc.setQueryData(['auth', 'me'], payload.user)
  try {
    const boot = await api<BootstrapPayload & { organizations?: Array<{ id: number; name: string }> }>('/bootstrap')
    if (boot.restNonce) {
      patchBootstrap({ restNonce: boot.restNonce })
    }
    qc.setQueryData(['bootstrap'], boot)
    if (!boot.currentOrganizationId && (boot.organizations?.length ?? 0) > 0) {
      const orgId = boot.organizations![0].id
      await api('/organizations/select', {
        method: 'POST',
        body: JSON.stringify({ organization_id: orgId }),
      })
      const refreshed = await api<BootstrapPayload>('/bootstrap')
      qc.setQueryData(['bootstrap'], refreshed)
    }
  } catch {
    qc.setQueryData(['bootstrap'], (prev: BootstrapPayload | undefined) => ({
      ...(prev ?? { authenticated: true, user: null }),
      authenticated: true,
      user: payload.user,
      restNonce: payload.restNonce ?? prev?.restNonce,
    }))
  }
}

export function clearAuthSession(qc: QueryClient) {
  patchBootstrap({ user: null, restNonce: '' })
  qc.setQueryData(['auth', 'me'], null)
  qc.setQueryData(['bootstrap'], { authenticated: false, user: null, organizations: [] })
  qc.removeQueries({
    predicate: (query) => {
      const root = query.queryKey[0]
      return root !== 'router' && root !== 'auth'
    },
  })
}

export async function refreshSessionFromApi(qc?: QueryClient): Promise<boolean> {
  if (getBootstrap().user?.id) {
    return true
  }
  try {
    const fetchBootstrap = () => api<BootstrapPayload>('/bootstrap')
    const data = qc
      ? await qc.fetchQuery({ queryKey: ['bootstrap', 'session'], queryFn: fetchBootstrap, staleTime: 0 })
      : await fetchBootstrap()

    if (data.authenticated && data.user) {
      patchBootstrap({
        user: toBootstrapUser(data.user),
        restNonce: data.restNonce,
      })
      qc?.setQueryData(['auth', 'me'], data.user)
      return true
    }
  } catch {
    /* session absent */
  }
  return false
}

export async function requireWorkspaceAuth(qc: QueryClient) {
  const ok = await refreshSessionFromApi(qc)
  if (!ok || !getBootstrap().user?.id) {
    throw redirect({ to: routes.login })
  }
}

export async function requireWorkspaceOrg(qc: QueryClient) {
  await requireWorkspaceAuth(qc)
  try {
    const boot = await qc.fetchQuery({
      queryKey: ['bootstrap'],
      queryFn: () => api<BootstrapPayload & { organizations?: Array<{ id: number }> }>('/bootstrap'),
      staleTime: 0,
    })
    if (boot.currentOrganizationId) {
      return
    }
    if ((boot.organizations?.length ?? 0) > 0) {
      await api('/organizations/select', {
        method: 'POST',
        body: JSON.stringify({ organization_id: boot.organizations![0].id }),
      })
      await qc.invalidateQueries({ queryKey: ['bootstrap'] })
      return
    }
  } catch {
    /* fall through */
  }
  throw redirect({ to: routes.onboardingBusiness })
}

export async function redirectAppEntry(qc: QueryClient) {
  await refreshSessionFromApi(qc)
  const user = getBootstrap().user
  throw redirect({ to: user?.id ? routes.overview : routes.login })
}

export async function redirectIfAuthenticated(qc: QueryClient) {
  const ok = await refreshSessionFromApi(qc)
  if (ok && getBootstrap().user?.id) {
    throw redirect({ to: routes.overview })
  }
}

export function redirectLegacyWorkspacePath(pathname: string) {
  for (const prefix of legacyAppPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      throw redirect({ to: appPath(pathname) })
    }
  }
}
