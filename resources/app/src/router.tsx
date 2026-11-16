import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { WorkspaceShell } from '@/shells/WorkspaceShell'
import { routes, marketing } from '@/lib/routes'
import { redirectAppEntry, redirectIfAuthenticated, redirectLegacyWorkspacePath, requireWorkspaceAuth, requireWorkspaceOrg } from '@/lib/app-guard'
import { MarketingLayout } from '@/pages/marketing/MarketingLayout'
import { MarketingHome } from '@/pages/marketing/MarketingHome'
import { MarketingFaqPage } from '@/pages/marketing/MarketingFaq'
import { MarketingProductPage } from '@/pages/marketing/MarketingProduct'
import { MarketingSecurityPage } from '@/pages/marketing/MarketingSecurity'
import {
  LoginPage,
  OnboardingPage,
  OverviewPage,
  InvoicesPage,
  PayablesInboxPage,
  BillCreatePage,
  BillMatchPage,
  CheckoutPage,
  FinanceAiPage,
  SimpleListPage,
  RegisterPage,
  ProcurementPurchaseOrdersPage,
  SuppliersListPage,
  CustomersListPage,
  GoodsReceiptsListPage,
} from '@/pages/common'
import {
  InvoiceDetailPage,
  CustomerFormPage,
  SupplierFormPage,
  PaymentLinksPage,
  RemindersPage,
  BillDetailPage,
  BillReviewPage,
  PurchaseOrderFormPage,
  GoodsReceiptFormPage,
  ApprovalsQueuePage,
  ApprovalDetailPage,
  PaymentsListPage,
  PaymentDetailPage,
  ReconciliationPage,
  UnmatchedPage,
  ReportsHubPage,
  ReportPage,
  SettingsPage,
  PaymentStatusPage,
  ReceiptPage,
  SupplierSubmitPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  OnboardingWalletPage,
  OnboardingCompletePage,
} from '@/pages/workspace'
import { InvoiceCreatePage } from '@/pages/invoices/InvoiceCreatePage'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const marketingRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'marketing',
  component: MarketingLayout,
})

const marketingHome = createRoute({
  getParentRoute: () => marketingRoute,
  path: '/',
  component: MarketingHome,
})

const marketingFaq = createRoute({
  getParentRoute: () => marketingRoute,
  path: marketing.faq,
  component: MarketingFaqPage,
})

const marketingProduct = createRoute({
  getParentRoute: () => marketingRoute,
  path: marketing.product,
  component: MarketingProductPage,
})

const marketingSecurity = createRoute({
  getParentRoute: () => marketingRoute,
  path: marketing.security,
  component: MarketingSecurityPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => <Outlet />,
})

const appIndex = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: ({ context }) => redirectAppEntry(context.queryClient),
})

const loginRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: ({ context }) => redirectIfAuthenticated(context.queryClient),
})
const registerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/register',
  component: RegisterPage,
  beforeLoad: ({ context }) => redirectIfAuthenticated(context.queryClient),
})
const forgotRoute = createRoute({ getParentRoute: () => appRoute, path: '/forgot-password', component: ForgotPasswordPage })
const resetRoute = createRoute({ getParentRoute: () => appRoute, path: '/reset-password', component: ResetPasswordPage })
const onboardingBusiness = createRoute({
  getParentRoute: () => appRoute,
  path: '/onboarding/business',
  component: OnboardingPage,
  beforeLoad: ({ context }) => requireWorkspaceAuth(context.queryClient),
})
const onboardingWallet = createRoute({
  getParentRoute: () => appRoute,
  path: '/onboarding/wallet',
  component: OnboardingWalletPage,
  beforeLoad: ({ context }) => requireWorkspaceAuth(context.queryClient),
})
const onboardingComplete = createRoute({
  getParentRoute: () => appRoute,
  path: '/onboarding/complete',
  component: OnboardingCompletePage,
  beforeLoad: ({ context }) => requireWorkspaceAuth(context.queryClient),
})

const workspaceRoute = createRoute({
  getParentRoute: () => appRoute,
  id: 'workspace',
  component: WorkspaceShell,
  beforeLoad: ({ context }) => requireWorkspaceOrg(context.queryClient),
})

const overview = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/overview',
  component: OverviewPage,
})

const invoices = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/invoices', component: InvoicesPage })
const invoicesNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/invoices/new', component: InvoiceCreatePage })
const invoiceDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/invoices/$invoiceId', component: InvoiceDetailPage })
const invoiceEdit = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/invoices/$invoiceId/edit', component: InvoiceCreatePage })
const customers = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/customers', component: CustomersListPage })
const customersNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/customers/new', component: () => <CustomersListPage initialCreate /> })
const customerDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/customers/$customerId', component: () => <CustomerFormPage mode="detail" /> })
const paymentLinks = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/payment-links', component: PaymentLinksPage })
const reminders = createRoute({ getParentRoute: () => workspaceRoute, path: '/receivables/reminders', component: RemindersPage })

const payablesInbox = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/inbox', component: PayablesInboxPage })
const billNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/bills/new', component: BillCreatePage })
const billDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/bills/$billId', component: BillDetailPage })
const billReview = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/bills/$billId/review', component: BillReviewPage })
const billMatch = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/payables/bills/$billId/match',
  component: function BillMatch() {
    const { billId } = billMatch.useParams()
    return <BillMatchPage billId={billId} />
  },
})
const suppliers = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/suppliers', component: SuppliersListPage })
const suppliersNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/suppliers/new', component: () => <SuppliersListPage initialCreate /> })
const supplierDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/payables/suppliers/$supplierId', component: () => <SupplierFormPage mode="detail" /> })

const pos = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/purchase-orders', component: ProcurementPurchaseOrdersPage })
const poNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/purchase-orders/new', component: () => <ProcurementPurchaseOrdersPage initialCreate /> })
const poDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/purchase-orders/$poId', component: () => <PurchaseOrderFormPage mode="detail" /> })
const grns = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/goods-received', component: GoodsReceiptsListPage })
const grnNew = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/goods-received/new', component: () => <GoodsReceiptsListPage initialCreate /> })
const grnDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/procurement/goods-received/$receiptId', component: () => <GoodsReceiptFormPage mode="detail" /> })

const approvals = createRoute({ getParentRoute: () => workspaceRoute, path: '/approvals', component: ApprovalsQueuePage })
const approvalDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/approvals/$approvalId', component: ApprovalDetailPage })
const payments = createRoute({ getParentRoute: () => workspaceRoute, path: '/payments', component: PaymentsListPage })
const paymentDetail = createRoute({ getParentRoute: () => workspaceRoute, path: '/payments/$paymentId', component: PaymentDetailPage })
const reconciliation = createRoute({ getParentRoute: () => workspaceRoute, path: '/reconciliation', component: ReconciliationPage })
const unmatched = createRoute({ getParentRoute: () => workspaceRoute, path: '/reconciliation/unmatched', component: UnmatchedPage })
const financeAi = createRoute({ getParentRoute: () => workspaceRoute, path: '/finance-ai', component: FinanceAiPage })
const reports = createRoute({ getParentRoute: () => workspaceRoute, path: '/reports', component: ReportsHubPage })
const reportRecv = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/reports/receivables-aging',
  component: () => <ReportPage path="/reports/receivables-aging" title="Customer balances" description="Open receivables grouped by due date and customer." />,
})
const reportPay = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/reports/payables-aging',
  component: () => <ReportPage path="/reports/payables-aging" title="Supplier balances" description="Open payables grouped by due date and supplier." />,
})
const reportCol = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/reports/collections',
  component: () => <ReportPage path="/reports/collections" title="Collections" description="Collection performance." />,
})
const reportExc = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/reports/exceptions',
  component: () => <ReportPage path="/reports/exceptions" title="Match exceptions" description="Supplier bills that failed three-way match." />,
})

const settingsProfile = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/profile', component: () => <SettingsPage kind="profile" /> })
const settingsOrg = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/organization', component: () => <SettingsPage kind="organization" /> })
const settingsCheckout = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/checkout', component: () => <SettingsPage kind="checkout" /> })
const settingsMembers = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/members', component: () => <SettingsPage kind="members" /> })
const settingsWallets = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/wallets', component: () => <SettingsPage kind="wallets" /> })
const settingsSettlement = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/settlement', component: () => <SettingsPage kind="settlement" /> })
const settingsPolicies = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/policies', component: () => <SettingsPage kind="policies" /> })
const settingsNotifications = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/notifications', component: () => <SettingsPage kind="notifications" /> })
const settingsSecurity = createRoute({ getParentRoute: () => workspaceRoute, path: '/settings/security', component: () => <SettingsPage kind="security" /> })
const settingsSystemRedirect = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/settings/system',
  beforeLoad: () => {
    throw redirect({ to: '/app/settings/organization' })
  },
})

const payRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pay/$token',
  component: function Pay() {
    const { token } = payRoute.useParams()
    return <CheckoutPage token={token} />
  },
})
const payStatus = createRoute({ getParentRoute: () => rootRoute, path: '/pay/$token/status', component: PaymentStatusPage })
const receipt = createRoute({ getParentRoute: () => rootRoute, path: '/receipt/$token', component: ReceiptPage })
const supplierSubmit = createRoute({ getParentRoute: () => rootRoute, path: '/supplier/submit/$token', component: SupplierSubmitPage })

const legacyWorkspaceCatch = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$',
  beforeLoad: ({ location }) => {
    redirectLegacyWorkspacePath(location.pathname)
    throw redirect({ to: marketing.home })
  },
})

export const routeTree = rootRoute.addChildren([
  marketingRoute.addChildren([marketingHome, marketingFaq, marketingProduct, marketingSecurity]),
  appRoute.addChildren([
    appIndex,
    loginRoute,
    registerRoute,
    forgotRoute,
    resetRoute,
    onboardingBusiness,
    onboardingWallet,
    onboardingComplete,
    workspaceRoute.addChildren([
      overview,
      invoices,
      invoicesNew,
      invoiceDetail,
      invoiceEdit,
      customers,
      customersNew,
      customerDetail,
      paymentLinks,
      reminders,
      payablesInbox,
      billNew,
      billDetail,
      billReview,
      billMatch,
      suppliers,
      suppliersNew,
      supplierDetail,
      pos,
      poNew,
      poDetail,
      grns,
      grnNew,
      grnDetail,
      approvals,
      approvalDetail,
      payments,
      paymentDetail,
      reconciliation,
      unmatched,
      financeAi,
      reports,
      reportRecv,
      reportPay,
      reportCol,
      reportExc,
      settingsProfile,
      settingsOrg,
      settingsCheckout,
      settingsMembers,
      settingsWallets,
      settingsSettlement,
      settingsPolicies,
      settingsNotifications,
      settingsSecurity,
      settingsSystemRedirect,
    ]),
  ]),
  payRoute,
  payStatus,
  receipt,
  supplierSubmit,
  legacyWorkspaceCatch,
])

export type AppRouter = ReturnType<typeof createRouter>
