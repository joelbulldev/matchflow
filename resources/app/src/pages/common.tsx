import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Building2, CheckCircle2, ClipboardList, FilePlus, LogIn, Package, Palette, Scale, ShoppingCart,
  RefreshCw, Sparkles, Truck, Upload, UserPlus, Wallet,
} from 'lucide-react'
import { BillMatchHistoryPanel, FinanceAiAnswerCard, MatchRunPanel } from '@/components/matchflow/structured-views'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/hooks/use-session'
import { toast } from '@/lib/toast'
import { mfToast } from '@/lib/mutation-feedback'
import { routes } from '@/lib/routes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ActionLinkCard, AmountDisplay, AuthShell, CreateLinkButton, DataTable, EmptyState, ErrorState, FormField, LoadingBlock,
  MetricCard, PageHeader, PageSkeleton, PayLinkActions, StatusBadge, WorkspacePage, FilterToolbar,
  PayablesInsights, ProcurementInsightsLoader, ReceivablesInsightsLoader, FinanceAiInsights, ModuleInsightsPanel,
} from '@/components/matchflow'
import { MetricPeriodTabs } from '@/components/matchflow/metric-period-tabs'
import { useMetricsPeriod } from '@/contexts/metrics-period'
import { api, getBootstrap } from '@/lib/api-client'
import { listItems, type Paginated } from '@/lib/paginated'
import { useCapabilities } from '@/hooks/use-capabilities'
import { CounterpartySelect } from '@/components/matchflow/counterparty-select'
import { OnboardingStepper } from '@/components/matchflow/onboarding-stepper'
import { nearWalletHelpMessage, validateLogin, validateRegister, type FieldErrors } from '@/lib/auth-validation'
import { Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { applyAuthSession, type LoginPayload } from '@/lib/session'
import { appNavigate } from '@/lib/navigation'
import { loginAsDemoUser } from '@/lib/demo-auth'
import { ListPageWithDrawer } from '@/components/matchflow/list-page-with-drawer'
import { BillCreateForm } from '@/components/matchflow/forms/bill-create-form'
import { PurchaseOrderCreateForm } from '@/components/matchflow/forms/po-create-form'
import { SupplierCreateForm } from '@/components/matchflow/forms/supplier-create-form'
import { CustomerCreateForm } from '@/components/matchflow/forms/customer-create-form'
import { GrnCreateForm } from '@/components/matchflow/forms/grn-create-form'

function useOrgId() {
  const q = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<{ currentOrganizationId: number | null }>('/bootstrap'),
  })
  return q.data?.currentOrganizationId ?? null
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [nearPending, setNearPending] = useState(false)
  const [nearRetryable, setNearRetryable] = useState(false)
  const [demoPending, setDemoPending] = useState(false)
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api<LoginPayload>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password, remember: true }) }),
    onSuccess: async (data) => {
      await applyAuthSession(qc, data)
      toast.success('Signed in')
      await appNavigate(routes.overview)
    },
    onError: (e: Error) => {
      setError(e.message)
      toast.error('Sign in failed', e.message)
    },
  })
  async function signInWithNear() {
    setNearPending(true)
    setError('')
    try {
      const { connectAndSignNear } = await import('@/lib/near-connector')
      const challenge = await api<{ challengeId: string; message: string; recipient: string; nonce: string }>('/auth/near/challenge', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'login' }),
      })
      const proof = await connectAndSignNear({
        message: challenge.message,
        recipient: challenge.recipient,
        nonce: challenge.nonce,
      })
      const session = await api<LoginPayload>('/auth/near/login', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          accountId: proof.accountId,
          publicKey: proof.publicKey,
          signature: proof.signature,
        }),
      })
      await applyAuthSession(qc, session)
      toast.success('NEAR wallet connected')
      await appNavigate(routes.overview)
    } catch (e) {
      const help = nearWalletHelpMessage(e)
      setError(help.message)
      setNearRetryable(help.retryable)
      toast.error('NEAR sign-in failed', help.message)
    } finally {
      setNearPending(false)
    }
  }

  function submitLogin() {
    const errs = validateLogin(login, password)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setError('')
    mutation.mutate()
  }

  async function signInAsDemo() {
    setDemoPending(true)
    setError('')
    try {
      await loginAsDemoUser(qc)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Demo sign-in failed'
      setError(message)
      toast.error('Demo sign-in failed', message)
    } finally {
      setDemoPending(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to MATCHFLOW"
      description="Email and password, demo workspace, or sign in with your connected wallet."
      footer={<div className="flex justify-between"><Link className="text-primary hover:underline" to={routes.forgotPassword}>Forgot password</Link><Link className="hover:underline" to={routes.register}>Create account</Link></div>}
    >
      <FormField label="Email or username" hint="Use the email or username from your invite.">
        <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" placeholder="admin or admin@site.com" aria-invalid={!!fieldErrors.login} />
        <FieldError message={fieldErrors.login} />
      </FormField>
      <FormField label="Password">
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={!!fieldErrors.password} />
        <FieldError message={fieldErrors.password} />
      </FormField>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            {nearRetryable ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void signInWithNear()} disabled={nearPending}>
                <RefreshCw className="size-4" aria-hidden />
                Try NEAR again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" onClick={submitLogin} disabled={mutation.isPending || nearPending || demoPending}><LogIn className="size-4" /> Sign in</Button>
      <Button className="w-full" variant="secondary" onClick={() => void signInAsDemo()} disabled={mutation.isPending || nearPending || demoPending}>
        <Sparkles className="size-4" aria-hidden />
        {demoPending ? 'Loading demo workspace…' : 'Login as demo user'}
      </Button>
      <div className="relative py-1 text-center text-xs text-muted-foreground">
        <span className="bg-card px-2 relative z-10">or</span>
        <div className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>
      <Button className="w-full" variant="outline" onClick={() => void signInWithNear()} disabled={mutation.isPending || nearPending || demoPending}>
        <Wallet className="size-4" /> {nearPending ? 'Connecting wallet…' : 'Continue with wallet'}
      </Button>
    </AuthShell>
  )
}

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [nearPending, setNearPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [nearRetryable, setNearRetryable] = useState(false)
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password, displayName }) }),
    onSuccess: async () => {
      toast.success('Account created', 'Sign in with your new credentials.')
      await appNavigate(routes.login)
    },
    onError: (e: Error) => {
      setError(e.message)
      toast.error('Registration failed', e.message)
    },
  })

  async function registerWithNear() {
    setNearPending(true)
    setError('')
    try {
      const { connectAndSignNear } = await import('@/lib/near-connector')
      const challenge = await api<{ challengeId: string; message: string; recipient: string; nonce: string }>('/auth/near/challenge', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'login' }),
      })
      const proof = await connectAndSignNear({
        message: challenge.message,
        recipient: challenge.recipient,
        nonce: challenge.nonce,
      })
      const session = await api<LoginPayload>('/auth/near/login', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          accountId: proof.accountId,
          publicKey: proof.publicKey,
          signature: proof.signature,
        }),
      })
      await applyAuthSession(qc, session)
      toast.success('NEAR account created')
      await appNavigate(routes.onboardingBusiness)
    } catch (e) {
      const help = nearWalletHelpMessage(e)
      setError(help.message)
      setNearRetryable(help.retryable)
      toast.error('NEAR registration failed', help.message)
    } finally {
      setNearPending(false)
    }
  }

  function submitRegister() {
    const errs = validateRegister({ displayName, username, email, password })
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setError('')
    mutation.mutate()
  }

  return (
    <AuthShell title="Create account" description="Email, username, and password — or register with a NEAR wallet." footer={<Link className="hover:underline" to={routes.login}>Already have an account? Sign in</Link>}>
      <OnboardingStepper active="account" />
      <FormField label="Display name"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-invalid={!!fieldErrors.displayName} /><FieldError message={fieldErrors.displayName} /></FormField>
      <FormField label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" aria-invalid={!!fieldErrors.username} /><FieldError message={fieldErrors.username} /></FormField>
      <FormField label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!fieldErrors.email} /><FieldError message={fieldErrors.email} /></FormField>
      <FormField label="Password" hint="At least 8 characters."><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!fieldErrors.password} /><FieldError message={fieldErrors.password} /></FormField>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            {nearRetryable ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void registerWithNear()} disabled={nearPending}>
                <RefreshCw className="size-4" aria-hidden />
                Try NEAR again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" onClick={submitRegister} disabled={mutation.isPending || nearPending}>
        <UserPlus className="size-4" aria-hidden />
        Create account
      </Button>
      <Button className="w-full" variant="outline" onClick={() => void registerWithNear()} disabled={mutation.isPending || nearPending}>
        <Wallet className="size-4" /> {nearPending ? 'Connecting…' : 'Sign up with NEAR wallet'}
      </Button>
    </AuthShell>
  )
}

export function OnboardingPage() {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [nameError, setNameError] = useState('')
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api<{ id: number }>('/organizations', { method: 'POST', body: JSON.stringify({ name, reporting_currency: currency, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }),
    onSuccess: async (org) => {
      const orgId = org?.id != null ? Number(org.id) : 0
      if (!orgId) {
        setNameError('Workspace was not created. Deactivate and reactivate MATCHFLOW in WordPress, then try again.')
        return
      }
      await api('/organizations/select', { method: 'POST', body: JSON.stringify({ organization_id: orgId }) })
      await qc.invalidateQueries({ queryKey: ['bootstrap'] })
      await appNavigate(routes.onboardingWallet)
    },
    onError: (e: Error) => setNameError(e.message),
  })
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <OnboardingStepper active="business" />
      <PageHeader title="Create your business workspace" description="Legal name and reporting currency — you can refine branding and settlement next." />
      <Card>
        <CardContent className="space-y-4 pt-5">
          <FormField label="Business name" hint="Shown on invoices and checkout unless you override checkout branding.">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
            {nameError ? <FieldError message={nameError} /> : null}
            {!name.trim() && !nameError ? <FieldError message="Enter your organization name to continue." /> : null}
          </FormField>
          <FormField label="Reporting currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['USD', 'EUR', 'GBP', 'NGN'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <Button className="w-full" onClick={() => { if (!name.trim()) { setNameError('Enter your organization name to continue.'); return }; mutation.mutate() }} disabled={mutation.isPending}>
            <Wallet className="size-4" aria-hidden />
            Continue to wallet
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function OverviewPage() {
  const { orgId, isAuthenticated, needsWorkspace, user } = useSession()
  const { period } = useMetricsPeriod()
  const summary = useQuery({
    queryKey: ['dashboard', orgId, period],
    enabled: !!orgId,
    queryFn: () =>
      api<{
        receivablesOutstanding?: string
        payablesOutstanding?: string
        collected?: string
        paid?: string
        pendingApprovals?: number
        exceptions?: number
        pendingSettlements?: number
        recentPaymentLinks?: Array<{
          id: number
          invoiceNumber: string
          status: string
          outstanding: string
          currency: string
          paymentUrl: string
        }>
      }>(`/dashboard/summary?period=${encodeURIComponent(period)}`, {}, orgId),
  })
  return (
    <WorkspacePage>
      <PageHeader
        title="Financial overview"
        description="What is owed, what has settled, and what needs attention."
        kpiPeriod={<MetricPeriodTabs />}
      />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to load live metrics" description="Dashboard values come from organization records only — never fabricated." action={<Button asChild><Link to={routes.login}><LogIn className="size-4" aria-hidden />Sign in</Link></Button>} />
      ) : null}
      {isAuthenticated && needsWorkspace ? (
        <EmptyState
          title="Set up your workspace"
          description={`Hi ${user?.displayName || 'there'} — create an organization to unlock receivables, payables, and settlement.`}
          action={<Button asChild><Link to={routes.onboardingBusiness}><Building2 className="size-4" aria-hidden />Create workspace</Link></Button>}
        />
      ) : null}
      {orgId ? (
        summary.isLoading ? (
          <PageSkeleton />
        ) : summary.isError ? (
          <ErrorState message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
        ) : (
        <>
          {summary.data ? (
            <ModuleInsightsPanel className="mb-6">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={ArrowUpRight} label="Receivables outstanding" value={<AmountDisplay value={String(summary.data.receivablesOutstanding)} />} hint="Open obligations (void & cancelled excluded)" />
                <MetricCard icon={ArrowDownLeft} label="Payables outstanding" value={<AmountDisplay value={String(summary.data.payablesOutstanding)} />} hint="Open obligations (void & cancelled excluded)" />
                <MetricCard icon={Banknote} label="Collected" value={<AmountDisplay value={String(summary.data.collected)} />} hint={period === 'all' ? 'All recorded invoice payments' : `Payments recorded · ${period.toUpperCase()} window`} />
                <MetricCard icon={CheckCircle2} label="Paid" value={<AmountDisplay value={String(summary.data.paid)} />} hint={period === 'all' ? 'Outbound payments confirmed' : `Payments recorded · ${period.toUpperCase()} window`} />
              </div>
            </ModuleInsightsPanel>
          ) : null}
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Action required</CardTitle>
                <CardDescription className="leading-relaxed">
                  Triage items that block cash movement or compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-border bg-muted/40 px-2 py-3">
                    <dt className="text-muted-foreground">Approvals</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{String(summary.data?.pendingApprovals ?? 0)}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-2 py-3">
                    <dt className="text-muted-foreground">Exceptions</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{String(summary.data?.exceptions ?? 0)}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-2 py-3">
                    <dt className="text-muted-foreground">Settlements</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{String(summary.data?.pendingSettlements ?? 0)}</dd>
                  </div>
                </dl>
                <div className="grid gap-2.5">
                  <ActionLinkCard layout="list" to="/app/approvals" title="Review approvals" icon={ClipboardList} description="Policies waiting for a decision" />
                  <ActionLinkCard layout="list" to="/app/reconciliation/unmatched" title="Resolve exceptions" icon={AlertTriangle} description="Unmatched ledger lines" />
                  <ActionLinkCard layout="list" to="/app/payments" title="Track settlements" icon={Banknote} description="Payments in flight" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick actions</CardTitle>
                <CardDescription className="leading-relaxed">
                  Start a document flow or tune customer-facing checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <ActionLinkCard layout="tile" to={routes.invoiceNew} title="Create invoice" icon={FilePlus} description="Issue a payment link" variant="default" />
                <ActionLinkCard layout="tile" to={routes.billNew} title="Upload bill" icon={Upload} description="Evidence for payables" />
                <ActionLinkCard layout="tile" to={routes.poNew} title="Create PO" icon={ShoppingCart} description="Procurement intake" />
                <ActionLinkCard layout="tile" to="/app/settings/checkout" title="Checkout branding" icon={Palette} description="Logo, colors, copy" />
              </CardContent>
            </Card>
          </div>
          {summary.data?.recentPaymentLinks?.length ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Recent payment links</CardTitle>
                <CardDescription>Preview branded checkout or copy links for collections.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  paginate={false}
                  rows={summary.data.recentPaymentLinks as unknown as Array<Record<string, unknown>>}
                  columns={[
                    {
                      key: 'invoiceNumber',
                      label: 'Invoice',
                      render: (r) => (
                        <Link className="font-medium text-primary hover:underline" to="/app/receivables/invoices/$invoiceId" params={{ invoiceId: String(r.id) }}>
                          {String(r.invoiceNumber)}
                        </Link>
                      ),
                    },
                    {
                      key: 'outstanding',
                      label: 'Due',
                      render: (r) => <AmountDisplay value={String(r.outstanding)} currency={String(r.currency || 'USD')} />,
                    },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                    {
                      key: 'paymentUrl',
                      label: 'Pay link',
                      render: (r) => (
                        <PayLinkActions paymentUrl={String(r.paymentUrl)} invoiceNumber={String(r.invoiceNumber)} />
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}
        </>
        )
      ) : null}
    </WorkspacePage>
  )
}

export function InvoicesPage() {
  const orgId = useOrgId()
  const { can } = useCapabilities()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (tab !== 'all') p.set('status', tab)
    if (q.trim()) p.set('q', q.trim())
    if (customerId) p.set('customer_id', String(customerId))
    p.set('limit', String(pageSize))
    p.set('offset', String(page * pageSize))
    return p.toString()
  }, [tab, q, customerId, page, pageSize])
  const invoices = useQuery({
    queryKey: ['invoices', orgId, params],
    enabled: !!orgId,
    queryFn: () => api<Paginated<Record<string, string>>>(`/receivables/invoices?${params}`, {}, orgId),
  })
  const rows = listItems(invoices.data)
  const filterActive = tab !== 'all' || !!q.trim() || customerId !== null
  const clearFilters = () => {
    setTab('all')
    setQ('')
    setCustomerId(null)
    setPage(0)
  }
  return (
    <WorkspacePage>
      <PageHeader
        title="Invoices"
        description="Issue branded payment links, track collections, and send reminders from one place."
        actions={can('ar.write') ? <CreateLinkButton to="/app/receivables/invoices/new">Create invoice</CreateLinkButton> : undefined}
      />
      <ReceivablesInsightsLoader orgId={orgId} />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0) }} className="mb-4">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="issued">Open</TabsTrigger>
          <TabsTrigger value="overdue">Past due</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterToolbar className="mb-4">
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <FormField label="Search">
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Invoice #, customer name or email" />
          </FormField>
          <FormField label="Customer">
            <CounterpartySelect orgId={orgId} type="customer" value={customerId} onChange={(id) => { setCustomerId(id); setPage(0) }} />
          </FormField>
        </div>
      </FilterToolbar>
      {invoices.isLoading ? (
        <PageSkeleton />
      ) : invoices.isError ? (
        <ErrorState message={(invoices.error as Error).message} onRetry={() => invoices.refetch()} />
      ) : (
        <DataTable
          rows={rows as Array<Record<string, unknown>>}
          emptyTitle="No invoices yet"
          emptyDescription="Create your first invoice to issue a branded payment link."
          filterActive={filterActive}
          filteredEmptyTitle="No invoices match these filters"
          filteredEmptyDescription="Clear filters or pick another status tab."
          onClearFilters={clearFilters}
          paginate={false}
          server={invoices.data ? {
            total: invoices.data.total,
            page,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (n) => { setPageSize(n); setPage(0) },
          } : undefined}
          columns={[
            { key: 'invoice_number', label: 'Number', render: (r) => <Link className="font-medium text-primary hover:underline" to="/app/receivables/invoices/$invoiceId" params={{ invoiceId: String(r.id) }}>{String(r.invoice_number)}</Link> },
            { key: 'customer_name', label: 'Customer', render: (r) => String(r.customer_name || `#${r.customer_id}`) },
            { key: 'due_date', label: 'Due', render: (r) => String(r.due_date || '—') },
            { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal)} currency={String(r.currency || 'USD')} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            {
              key: 'payment_url',
              label: 'Pay link',
              render: (r) => (
                <PayLinkActions paymentUrl={String(r.payment_url || '')} invoiceNumber={String(r.invoice_number || '')} />
              ),
            },
          ]}
        />
      )}
    </WorkspacePage>
  )
}

export function SimpleListPage({ title, description, path, columns, createTo }: { title: string; description: string; path: string; columns: string[]; createTo?: string }) {
  const orgId = useOrgId()
  const q = useQuery({
    queryKey: [path, orgId],
    enabled: !!orgId,
    queryFn: () => api<Array<Record<string, unknown>>>(path, {}, orgId),
  })
  return (
    <WorkspacePage>
      <PageHeader title={title} description={description} actions={createTo ? <CreateLinkButton to={createTo}>Create</CreateLinkButton> : undefined} />
      {q.isLoading ? (
        <PageSkeleton />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          rows={q.data || []}
          emptyTitle="Nothing here yet"
          emptyDescription="Create a record to populate this list."
          columns={columns.map((c) => ({ key: c, label: c.replaceAll('_', ' '), render: (row) => String(row[c] ?? '—') }))}
        />
      )}
    </WorkspacePage>
  )
}

export function PayablesInboxPage({ initialCreate = false }: { initialCreate?: boolean }) {
  const navigate = useNavigate()
  const orgId = useOrgId()

  return (
    <ListPageWithDrawer
      initialOpen={initialCreate}
      title="Supplier bills"
      description="Capture vendor invoices, run three-way match, and route for approval."
      insights={<PayablesInsights orgId={orgId} />}
      emptyTitle="No supplier bills yet"
      emptyDescription="Capture a supplier invoice, then run three-way match against PO and goods receipt."
      emptySecondaryActions={
        <>
          <Button asChild variant="outline">
            <RouterLink to="/app/payables/suppliers/new"><Building2 className="size-4" aria-hidden />Add supplier</RouterLink>
          </Button>
          <Button asChild variant="outline">
            <RouterLink to="/app/procurement/purchase-orders/new"><ShoppingCart className="size-4" aria-hidden />Create PO</RouterLink>
          </Button>
          <Button asChild variant="outline">
            <RouterLink to="/app/procurement/goods-received/new"><Truck className="size-4" aria-hidden />Record GRN</RouterLink>
          </Button>
        </>
      }
      path="/payables/bills"
      columns={[
        { key: 'invoice_number', label: 'Bill', render: (r) => (
          <RouterLink className="font-medium text-primary hover:underline" to="/app/payables/bills/$billId" params={{ billId: String(r.id) }}>
            {String(r.invoice_number || r.id)}
          </RouterLink>
        ) },
        { key: 'supplier_name', label: 'Supplier', render: (r) => String(r.supplier_name || `#${r.supplier_id}`) },
        { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal)} /> },
        { key: 'match_status', label: 'Match', render: (r) => <StatusBadge status={String(r.match_status)} /> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      ]}
      createTitle="New supplier bill"
      createDescription="Capture vendor invoice, then route to three-way match."
      renderCreateForm={({ orgId, close }) => (
        <BillCreateForm
          orgId={orgId}
          onCancel={close}
          onDone={(id) => {
            close()
            void navigate({ to: '/app/payables/bills/$billId/match', params: { billId: String(id) } })
          }}
        />
      )}
    />
  )
}

export function BillCreatePage() {
  return <PayablesInboxPage initialCreate />
}

export function ProcurementPurchaseOrdersPage({ initialCreate = false }: { initialCreate?: boolean }) {
  const navigate = useNavigate()
  const orgId = useOrgId()
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (status !== 'all') p.set('status', status)
    if (q.trim()) p.set('q', q.trim())
    return p.toString()
  }, [status, q])
  return (
    <ListPageWithDrawer
      initialOpen={initialCreate}
      title="Purchase orders"
      description="Procurement commitments, receipts, and linked payables."
      insights={<ProcurementInsightsLoader orgId={orgId} />}
      emptyTitle="No purchase orders yet"
      emptyDescription="Issue a PO first — then record deliveries and match supplier bills."
      emptySecondaryActions={
        <>
          <Button asChild variant="outline">
            <RouterLink to="/app/procurement/goods-received/new"><Truck className="size-4" aria-hidden />Record GRN</RouterLink>
          </Button>
          <Button asChild variant="outline">
            <RouterLink to="/app/payables/bills/new"><FilePlus className="size-4" aria-hidden />New supplier bill</RouterLink>
          </Button>
        </>
      }
      path="/procurement/purchase-orders"
      searchQuery={query}
      onClearFilters={() => { setStatus('all'); setQ('') }}
      filterControls={
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <FormField label="Search PO or supplier"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="PO-1024 or Acme Corp" /></FormField>
          <FormField label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      }
      columns={[
        { key: 'po_number', label: 'PO', render: (r) => (
          <RouterLink to="/app/procurement/purchase-orders/$poId" params={{ poId: String(r.id) }} className="text-primary hover:underline">
            {String(r.po_number || r.id)}
          </RouterLink>
        ) },
        { key: 'supplier_name', label: 'Supplier', render: (r) => String(r.supplier_name || '—') },
        { key: 'total_decimal', label: 'Amount', render: (r) => <AmountDisplay value={String(r.total_decimal || '0')} /> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      ]}
      createTitle="Create purchase order"
      createDescription="Desktop drawer · mobile bottom sheet."
      renderCreateForm={({ orgId, close }) => (
        <PurchaseOrderCreateForm
          orgId={orgId}
          onCancel={close}
          onDone={(id) => {
            close()
            void navigate({ to: '/app/procurement/purchase-orders/$poId', params: { poId: String(id) } })
          }}
        />
      )}
    />
  )
}

export function CustomersListPage({ initialCreate = false }: { initialCreate?: boolean }) {
  const navigate = useNavigate()
  const orgId = useOrgId()
  return (
    <ListPageWithDrawer
      initialOpen={initialCreate}
      title="Customers"
      description="Customer directory for invoicing and collections."
      insights={<ReceivablesInsightsLoader orgId={orgId} context="customers" />}
      path="/counterparties?type=customer"
      columns={[
        { key: 'name', label: 'Name', render: (r) => (
          <RouterLink className="font-medium text-primary hover:underline" to="/app/receivables/customers/$customerId" params={{ customerId: String(r.id) }}>
            {String(r.name)}
          </RouterLink>
        ) },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      ]}
      createTitle="Add customer"
      renderCreateForm={({ orgId, close }) => (
        <CustomerCreateForm
          orgId={orgId}
          onCancel={close}
          onDone={(id) => {
            close()
            void navigate({ to: '/app/receivables/customers/$customerId', params: { customerId: String(id) } })
          }}
        />
      )}
    />
  )
}

export function GoodsReceiptsListPage({ initialCreate = false }: { initialCreate?: boolean }) {
  const navigate = useNavigate()
  const orgId = useOrgId()
  const [status, setStatus] = useState('all')
  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (status !== 'all') p.set('status', status)
    return p.toString()
  }, [status])
  return (
    <ListPageWithDrawer
      initialOpen={initialCreate}
      title="Goods received"
      description="Delivery records linked to purchase orders."
      insights={<ProcurementInsightsLoader orgId={orgId} context="grn" />}
      emptyTitle="No goods receipts yet"
      emptyDescription="Record what arrived against a PO — this completes the three-way match path."
      emptySecondaryActions={
        <>
          <Button asChild variant="outline" size="sm">
            <RouterLink to="/app/procurement/purchase-orders/new"><ShoppingCart className="size-3.5" aria-hidden />Create PO</RouterLink>
          </Button>
          <Button asChild variant="outline" size="sm">
            <RouterLink to="/app/payables/bills/new"><Scale className="size-3.5" aria-hidden />Match a bill</RouterLink>
          </Button>
        </>
      }
      path="/procurement/goods-receipts"
      searchQuery={query}
      onClearFilters={() => setStatus('all')}
      filterControls={
        <FormField label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="recorded">Recorded</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      }
      columns={[
        { key: 'receipt_reference', label: 'Reference', render: (r) => (
          <RouterLink to="/app/procurement/goods-received/$receiptId" params={{ receiptId: String(r.id) }} className="text-primary hover:underline">
            {String(r.receipt_reference || r.id)}
          </RouterLink>
        ) },
        { key: 'po_number', label: 'PO', render: (r) => String(r.po_number || r.po_id || '—') },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      ]}
      createTitle="Record delivery"
      renderCreateForm={({ orgId, close }) => (
        <GrnCreateForm
          orgId={orgId}
          onCancel={close}
          onDone={(id) => {
            close()
            void navigate({ to: '/app/procurement/goods-received/$receiptId', params: { receiptId: String(id) } })
          }}
        />
      )}
    />
  )
}

export function SuppliersListPage({ initialCreate = false }: { initialCreate?: boolean }) {
  const navigate = useNavigate()
  const orgId = useOrgId()
  return (
    <ListPageWithDrawer
      initialOpen={initialCreate}
      title="Suppliers"
      description="Approved vendors and verified settlement addresses."
      insights={<PayablesInsights orgId={orgId} context="suppliers" />}
      path="/counterparties?type=supplier"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      ]}
      createTitle="Add supplier"
      renderCreateForm={({ orgId, close }) => (
        <SupplierCreateForm
          orgId={orgId}
          onCancel={close}
          onDone={(id) => {
            close()
            void navigate({ to: '/app/payables/suppliers/$supplierId', params: { supplierId: String(id) } })
          }}
        />
      )}
    />
  )
}

export function BillMatchPage({ billId }: { billId: string }) {
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { can } = useCapabilities()
  const bill = useQuery({
    queryKey: ['bill-match-meta', orgId, billId],
    enabled: !!orgId,
    queryFn: () => api<Record<string, unknown>>(`/payables/bills/${billId}`, {}, orgId),
  })
  const match = useMutation({
    mutationFn: () =>
      api<{ result?: string; rule_version?: string; match_status?: string; discrepancies?: Array<Record<string, unknown>> }>(
        `/payables/bills/${billId}/match`,
        { method: 'POST' },
        orgId,
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['bill-match-meta', orgId, billId] })
      void qc.invalidateQueries({ queryKey: ['bill', orgId, billId] })
      const ok = data.match_status === 'matched'
      mfToast.success(ok ? 'Match passed' : 'Match exception', ok ? 'Submit for approval when ready.' : 'Correct lines on the bill, save, then re-run match.')()
    },
    onError: mfToast.error('Match failed'),
  })
  const matchStatus = String(bill.data?.match_status || 'unknown')
  const poId = bill.data?.purchase_order_id ? String(bill.data.purchase_order_id) : ''
  const livePanel =
    match.data ??
    (Array.isArray(bill.data?.match_runs) && (bill.data.match_runs as Array<Record<string, unknown>>)[0]
      ? (() => {
        const latest = (bill.data.match_runs as Array<Record<string, unknown>>)[0]
        let discrepancies: Array<Record<string, unknown>> = []
        try {
          const raw = latest.discrepancies_json
          discrepancies =
            typeof raw === 'string' ? (JSON.parse(raw) as Array<Record<string, unknown>>) : ((raw as Array<Record<string, unknown>>) ?? [])
        } catch {
          discrepancies = []
        }
        return {
          result: String(latest.result ?? ''),
          rule_version: String(latest.rule_version ?? ''),
          match_status: matchStatus,
          discrepancies,
        }
      })()
      : null)
  return (
    <WorkspacePage>
      <PageHeader
        title="Three-way match"
        description="PO (ordered) · GRN (received) · supplier bill (invoiced). Same line description on all three records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><RouterLink to="/app/payables/bills/$billId" params={{ billId }}>Bill detail</RouterLink></Button>
            {poId ? (
              <Button asChild variant="outline"><RouterLink to="/app/procurement/purchase-orders/$poId" params={{ poId }}>Open PO</RouterLink></Button>
            ) : null}
            {can('ap.write') ? (
              <Button onClick={() => match.mutate()} disabled={match.isPending}>
                <Scale className="size-4" aria-hidden />
                Run match
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Bill</CardDescription><CardTitle className="text-lg">{String(bill.data?.invoice_number || `#${billId}`)}</CardTitle></CardHeader>
          <CardContent><StatusBadge status={matchStatus} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Supplier</CardDescription><CardTitle className="text-lg">{String(bill.data?.supplier_name || '—')}</CardTitle></CardHeader>
          <CardContent><AmountDisplay value={String(bill.data?.total_decimal || '0')} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Linked PO</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {poId ? (
              <RouterLink className="font-medium text-primary hover:underline" to="/app/procurement/purchase-orders/$poId" params={{ poId }}>
                PO #{poId}
              </RouterLink>
            ) : (
              'Link a PO on the bill before matching.'
            )}
          </CardContent>
        </Card>
      </div>
      {livePanel ? (
        <MatchRunPanel data={livePanel} />
      ) : (
        <EmptyState
          title="Ready to match"
          description="Run matching to detect quantity, price, and duplicate discrepancies. Exceptions block approval until resolved."
          action={can('ap.write') ? (
            <Button onClick={() => match.mutate()} disabled={match.isPending}>
              <Scale className="size-4" aria-hidden />
              Run match
            </Button>
          ) : undefined}
        />
      )}
      {Array.isArray(bill.data?.match_runs) && (bill.data.match_runs as unknown[]).length > 1 ? (
        <div className="mt-6">
          <BillMatchHistoryPanel matchRuns={bill.data.match_runs} />
        </div>
      ) : null}
    </WorkspacePage>
  )
}

export { InvoiceCheckoutPage as CheckoutPage } from '@/pages/public/InvoiceCheckoutPage'

export function FinanceAiPage() {
  const orgId = useOrgId()
  const [prompt, setPrompt] = useState('Which supplier invoices need attention?')
  const [tool, setTool] = useState('summarize')
  const ask = useMutation({
    mutationFn: () => api<Record<string, unknown>>('/finance-ai/query', { method: 'POST', body: JSON.stringify({ prompt, tool }) }, orgId),
    onError: mfToast.error('AI query failed'),
  })
  return (
    <WorkspacePage>
      <PageHeader title="Finance AI" description="Grounded answers from organization data. High-impact actions require confirmation." kpiPeriod={<MetricPeriodTabs />} />
      <FinanceAiInsights orgId={orgId} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card className="h-fit border-border/80 shadow-sm">
          <CardContent className="space-y-3 pt-5">
            <FormField label="Allowlisted tool">
              <Select value={tool} onValueChange={setTool}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="summarize">Workspace snapshot</SelectItem>
                  <SelectItem value="get_payables">Payables & exceptions</SelectItem>
                  <SelectItem value="get_overdue_invoices">Overdue receivables</SelectItem>
                  <SelectItem value="get_pending_approvals">Pending approvals</SelectItem>
                  <SelectItem value="explain_match_result">Match guidance</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Prompt"><Input value={prompt} onChange={(e) => setPrompt(e.target.value)} /></FormField>
            <Button onClick={() => ask.mutate()} disabled={ask.isPending || !orgId}>
              <Sparkles className="size-4" /> Ask
            </Button>
          </CardContent>
        </Card>
        {ask.data ? <FinanceAiAnswerCard data={ask.data} /> : (
          <Card className="flex items-center justify-center border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Answers cite live dashboard metrics — never fabricated figures.
            </CardContent>
          </Card>
        )}
      </div>
    </WorkspacePage>
  )
}
