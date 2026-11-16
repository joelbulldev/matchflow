import type { RegisteredRouter } from '@tanstack/react-router'

let router: RegisteredRouter | null = null

export function registerAppRouter(instance: RegisteredRouter) {
  router = instance
}

export async function appNavigate(to: string) {
  if (!router) {
    return
  }
  await router.navigate({ to })
}
