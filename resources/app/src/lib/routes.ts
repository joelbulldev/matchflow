/** Marketing paths (site root). */
export const marketing = {
  home: '/',
  faq: '/faq',
  product: '/product',
  security: '/security',
} as const

const APP = '/app'

/** Dashboard & auth under `/app`. */
export const routes = {
  appEntry: APP,
  login: `${APP}/login`,
  register: `${APP}/register`,
  forgotPassword: `${APP}/forgot-password`,
  resetPassword: `${APP}/reset-password`,
  onboardingBusiness: `${APP}/onboarding/business`,
  onboardingWallet: `${APP}/onboarding/wallet`,
  onboardingComplete: `${APP}/onboarding/complete`,
  overview: `${APP}/overview`,
  invoices: `${APP}/receivables/invoices`,
  invoiceNew: `${APP}/receivables/invoices/new`,
  invoice: (id: string | number) => `${APP}/receivables/invoices/${id}`,
  invoiceEdit: (id: string | number) => `${APP}/receivables/invoices/${id}/edit`,
  customers: `${APP}/receivables/customers`,
  customerNew: `${APP}/receivables/customers/new`,
  payablesInbox: `${APP}/payables/inbox`,
  billNew: `${APP}/payables/bills/new`,
  poList: `${APP}/procurement/purchase-orders`,
  poNew: `${APP}/procurement/purchase-orders/new`,
  approvals: `${APP}/approvals`,
  payments: `${APP}/payments`,
  settingsWallets: `${APP}/settings/wallets`,
  settingsOrg: `${APP}/settings/organization`,
  settingsCheckout: `${APP}/settings/checkout`,
  reports: `${APP}/reports`,
} as const

export function appPath(path: string): string {
  if (path.startsWith('/pay/') || path.startsWith('/receipt/') || path.startsWith('/supplier/')) {
    return path
  }
  if (path === marketing.home || path === marketing.faq || path.startsWith('/faq')) {
    return path
  }
  if (path.startsWith(APP)) return path
  return `${APP}${path.startsWith('/') ? path : `/${path}`}`
}

/** Legacy workspace paths → `/app/...` (for redirects). */
export const legacyAppPrefixes = [
  '/overview',
  '/receivables',
  '/payables',
  '/procurement',
  '/approvals',
  '/payments',
  '/reconciliation',
  '/finance-ai',
  '/reports',
  '/settings',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
] as const
