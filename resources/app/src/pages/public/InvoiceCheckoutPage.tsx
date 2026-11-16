import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, CheckCircle2, ChevronDown, CreditCard, FileText, Loader2, Receipt, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AmountDisplay, LoadingBlock, StatusBadge } from '@/components/matchflow'
import { SettlementQuotePanel } from '@/components/matchflow/structured-views'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { NearCheckoutWallet, WalletTransferConfirmation } from '@/wallet'
import {
  isNearOriginChainAsset,
  parseSettlementDepositFields,
} from '@/lib/near-intents-deposit'
import { payInvoiceWithNearWallet } from '@/lib/checkout-pay-now'
import { readQuotePricing } from '@/lib/checkout-quote-display'
import { originNeedsEvmRefund, refundMatchesOrigin, refundHintForOrigin } from '@/lib/checkout-refund'
import { CheckoutBrandHeader, checkoutBrandStyle } from '@/components/matchflow/checkout-brand-header'
import { checkoutThemeStyle, labelOriginAsset, resolveCheckoutAccent, type SupportedToken } from '@/lib/checkout-theme'
import {
  readCheckoutNearAccount,
  readCheckoutPayPath,
  readCheckoutRefund,
  writeCheckoutNearAccount,
  writeCheckoutPayPath,
  writeCheckoutRefund,
} from '@/lib/checkout-wallet-session'
import { restoreNearCheckoutSession } from '@/lib/near-connector'
import { useWalletAdapter } from '@/wallet'

const NEAR_WRAP = 'nep141:wrap.near'

type PublicInvoice = {
  kind?: 'invoice' | 'payment_request'
  invoiceNumber: string
  label?: string
  currency: string
  outstanding: string
  status: string
  dueDate?: string
  checkoutMessage?: string
  brandTheme?: 'classic' | 'minimal' | 'bold'
  organizationName?: string
  checkoutAccentColor?: string
  checkoutLogoUrl?: string
  checkoutSupportEmail?: string
  checkoutTagline?: string
}

type PublicConfig = {
  nearIntentsConfigured: boolean
  popularOriginAssets?: string[]
  checkoutBrandName?: string
}

const FALLBACK_ASSETS = [NEAR_WRAP, 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near']

const themeShell: Record<string, string> = {
  classic: 'border-primary/25 shadow-[0_24px_80px_-40px_hsl(var(--primary)/0.5)]',
  minimal: 'border-border shadow-sm',
  bold: 'border-foreground/20 shadow-xl ring-1 ring-primary/15',
}

export function InvoiceCheckoutPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const invoice = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => api<PublicInvoice>(`/public/invoices/${token}`),
  })
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => api<PublicConfig>('/public/config'),
  })
  const assets = useQuery({
    queryKey: ['supported-assets'],
    queryFn: () => api<Array<{ assetId?: string; id?: string }>>('/supported-assets'),
    retry: 1,
  })

  const [originAsset, setOriginAsset] = useState(NEAR_WRAP)
  const [refundAddress, setRefundAddress] = useState(() => readCheckoutRefund(token))
  const [payPath, setPayPath] = useState<'near' | 'other'>(() =>
    readCheckoutPayPath(token) === 'cross-chain' ? 'other' : 'near',
  )
  const [settlementData, setSettlementData] = useState<unknown>(null)
  const evmWallet = useWalletAdapter()

  useEffect(() => {
    void (async () => {
      const wallet = await restoreNearCheckoutSession()
      if (wallet) {
        setRefundAddress((prev) => (payPath === 'near' ? prev.trim() || wallet : prev))
        writeCheckoutNearAccount(token, wallet)
      }
    })()
  }, [token, payPath])

  useEffect(() => {
    writeCheckoutRefund(token, refundAddress)
  }, [token, refundAddress])

  const supportedTokens = useMemo(() => (assets.data || []) as SupportedToken[], [assets.data])
  const assetOptions = useMemo(() => {
    const popular = config.data?.popularOriginAssets?.length ? config.data.popularOriginAssets! : FALLBACK_ASSETS
    return popular.slice(0, 8)
  }, [config.data])

  const activeOrigin = payPath === 'near' ? NEAR_WRAP : originAsset || NEAR_WRAP
  const isNearPay = payPath === 'near' && isNearOriginChainAsset(activeOrigin)

  const depositFields = useMemo(
    () => (settlementData ? parseSettlementDepositFields(settlementData) : null),
    [settlementData],
  )

  const refundOk = refundMatchesOrigin(activeOrigin, refundAddress)

  const payNear = useMutation({
    mutationFn: () =>
      payInvoiceWithNearWallet({
        token,
        originAssetId: activeOrigin,
        refundAddress: refundAddress.trim(),
      }),
    onSuccess: () => {
      toast.success('Payment sent', 'We will confirm your invoice as soon as settlement succeeds.')
      void navigate({ to: '/pay/$token/status', params: { token } })
    },
    onError: (e: Error) => toast.error('Could not complete payment', e.message),
  })

  const payEvm = useMutation({
    mutationFn: async () => {
      const settlement = await api(`/public/invoices/${token}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          dry: false,
          origin_asset_id: activeOrigin,
          refund_address: refundAddress.trim(),
          swapType: 'EXACT_OUTPUT',
        }),
      })
      setSettlementData(settlement)
      return settlement
    },
    onError: (e: Error) => toast.error('Could not prepare payment', e.message),
  })

  const theme = invoice.data?.brandTheme ?? 'classic'
  const brandAccent = resolveCheckoutAccent(invoice.data?.checkoutAccentColor)
  const brandStyle = brandAccent ? { ...checkoutThemeStyle(brandAccent), ...checkoutBrandStyle(brandAccent) } : undefined
  const merchant = invoice.data?.organizationName ?? config.data?.checkoutBrandName ?? ''
  const paid = ['paid', 'void', 'cancelled'].includes(String(invoice.data?.status))
  const intentsReady = config.isSuccess && config.data?.nearIntentsConfigured

  const nearQuotePreview = useQuery({
    queryKey: ['checkout-near-quote', token, refundAddress, invoice.data?.outstanding],
    enabled: Boolean(isNearPay && refundOk && intentsReady && refundAddress.trim() && invoice.data),
    staleTime: 60_000,
    queryFn: () =>
      api<unknown>(`/public/invoices/${token}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          dry: true,
          origin_asset_id: NEAR_WRAP,
          refund_address: refundAddress.trim(),
          swapType: 'EXACT_OUTPUT',
        }),
      }),
  })
  const quotePricing = useMemo(() => readQuotePricing(nearQuotePreview.data), [nearQuotePreview.data])

  if (invoice.isLoading) {
    return <div className="min-h-screen px-4 py-12"><LoadingBlock rows={4} /></div>
  }

  if (invoice.isError || !invoice.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-6 text-sm text-muted-foreground">This payment link is invalid or has expired.</Card>
      </div>
    )
  }

  const inv = invoice.data

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background" style={brandStyle}>
      <CheckoutBrandHeader
        organizationName={merchant}
        checkoutTagline={inv.checkoutTagline}
        checkoutAccentColor={brandAccent ?? undefined}
        checkoutLogoUrl={inv.checkoutLogoUrl}
        checkoutSupportEmail={inv.checkoutSupportEmail}
        invoiceNumber={inv.invoiceNumber}
      />

      <main className="mx-auto max-w-lg space-y-5 px-4 py-8">
        <Card className={cn('overflow-hidden', themeShell[theme] ?? themeShell.classic)}>
          <div className="h-1 bg-primary" style={brandAccent ? { backgroundColor: brandAccent } : undefined} aria-hidden />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg font-semibold">
                {inv.kind === 'payment_request' ? inv.label || inv.invoiceNumber : `Invoice ${inv.invoiceNumber}`}
              </CardTitle>
              <StatusBadge status={inv.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 pb-6 text-center">
            <p className="text-xs text-muted-foreground">{inv.dueDate ? `Due ${inv.dueDate}` : null}</p>
            <p className="text-4xl font-semibold tracking-tight">
              <AmountDisplay value={inv.outstanding} currency={inv.currency} />
            </p>
          </CardContent>
        </Card>

        {paid ? (
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
              Payment complete
            </div>
            <Button asChild className="w-full">
              <Link to="/receipt/$token" params={{ token }}>View receipt</Link>
            </Button>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 pt-6">
              {payPath === 'near' ? (
                <NearCheckoutWallet
                  initialAccountId={readCheckoutNearAccount(token) || refundAddress || undefined}
                  persistKey={`mf:checkout:near-account:${token}`}
                  onAccount={(id) => {
                    setRefundAddress(id)
                    writeCheckoutNearAccount(token, id)
                  }}
                />
              ) : null}

              {!refundOk && refundAddress.trim() ? (
                <Alert variant="destructive">
                  <AlertDescription>{refundHintForOrigin(activeOrigin)}</AlertDescription>
                </Alert>
              ) : null}

              {isNearPay ? (
                <div className="space-y-2">
                  {quotePricing.amountInUsd || quotePricing.amountInFormatted ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {quotePricing.amountInFormatted ? (
                        <>
                          Estimated wallet deposit:{' '}
                          <span className="font-mono font-medium text-foreground">{quotePricing.amountInFormatted}</span> NEAR
                        </>
                      ) : null}
                      {quotePricing.amountInUsd ? (
                        <>
                          {quotePricing.amountInFormatted ? ' ' : null}(≈ ${quotePricing.amountInUsd} USD){' '}
                        </>
                      ) : null}
                      — merchant receives USDC for this invoice total.
                    </p>
                  ) : nearQuotePreview.isFetching ? (
                    <p className="text-center text-xs text-muted-foreground">Calculating live rate…</p>
                  ) : null}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!refundOk || !intentsReady || payNear.isPending || nearQuotePreview.isError}
                    onClick={() => payNear.mutate()}
                  >
                    {payNear.isPending ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <CreditCard className="size-5" aria-hidden />
                    )}
                    Pay <AmountDisplay value={inv.outstanding} currency={inv.currency} className="inline font-semibold" />
                  </Button>
                </div>
              ) : (
                <>
                  {!refundOk ? (
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      variant="secondary"
                      disabled={!evmWallet.isAvailable()}
                      onClick={async () => {
                        const addr = await evmWallet.connect()
                        if (addr) setRefundAddress(addr)
                      }}
                    >
                      <Wallet className="size-5" aria-hidden />
                      Connect wallet to pay
                    </Button>
                  ) : null}
                  {!settlementData && refundOk ? (
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!intentsReady || payEvm.isPending}
                      onClick={() => payEvm.mutate()}
                    >
                      {payEvm.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CreditCard className="size-5" aria-hidden />}
                      Pay <AmountDisplay value={inv.outstanding} currency={inv.currency} className="inline font-semibold" />
                    </Button>
                  ) : null}
                  {settlementData ? (
                    <WalletTransferConfirmation
                      depositAddress={depositFields?.depositAddress ?? null}
                      amountDecimal={inv.outstanding}
                      showEvmAssist
                      onTxHash={(txHash) => {
                        if (!depositFields) return
                        void api(`/public/payments/${token}/settlements/${depositFields.settlementId}/confirm-deposit`, {
                          method: 'POST',
                          body: JSON.stringify({ txHash }),
                        }).then(() => {
                          toast.success('Payment sent', 'Tracking settlement…')
                          void navigate({ to: '/pay/$token/status', params: { token } })
                        })
                      }}
                    />
                  ) : null}
                </>
              )}

              <Button asChild variant="ghost" className="w-full text-muted-foreground" size="sm">
                <Link to="/pay/$token/status" params={{ token }}>
                  <Receipt className="size-4" aria-hidden />
                  Payment status
                </Link>
              </Button>

              <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between py-1 font-medium [&::-webkit-details-marker]:hidden">
                  Other payment options
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                </summary>
                <div className="space-y-3 pb-2 pt-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={payPath === 'near' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setPayPath('near')
                        writeCheckoutPayPath(token, 'near')
                        setOriginAsset(NEAR_WRAP)
                        setSettlementData(null)
                      }}
                    >
                      NEAR
                    </Button>
                    <Button
                      type="button"
                      variant={payPath === 'other' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setPayPath('other')
                        writeCheckoutPayPath(token, 'cross-chain')
                        setSettlementData(null)
                        if (originNeedsEvmRefund(originAsset) && isNearRefundOnly(refundAddress)) {
                          setRefundAddress('')
                        }
                      }}
                    >
                      Other asset
                    </Button>
                  </div>
                  {payPath === 'other' ? (
                    <Select value={activeOrigin} onValueChange={(v) => { setOriginAsset(v); setRefundAddress('') }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetOptions.map((id) => (
                          <SelectItem key={id} value={id}>{labelOriginAsset(id, supportedTokens)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {settlementData ? (
                    <details className="rounded-md bg-muted/40 p-2 text-xs">
                      <summary className="cursor-pointer font-medium">Manual transfer (advanced)</summary>
                      <div className="mt-2">
                        <SettlementQuotePanel quote={settlementData} />
                      </div>
                    </details>
                  ) : null}
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {!intentsReady && config.isFetched ? (
          <p className="text-center text-xs text-muted-foreground">Payments are temporarily unavailable. Try again later.</p>
        ) : null}
      </main>
    </div>
  )
}

function isNearRefundOnly(refund: string): boolean {
  return refund.includes('.near') || (!refund.startsWith('0x') && refund.length > 0)
}