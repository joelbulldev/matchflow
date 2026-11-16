import { ExternalLink, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/matchflow'
import { openPayLinkPreview } from '@/lib/pay-link'

type Props = {
  settlementId: string | number
  status?: string
  receiptUrl?: string | null
  onRefresh?: () => void
  onRetry?: () => void
  onIssueReceipt?: () => void
  refreshPending?: boolean
  retryPending?: boolean
  receiptPending?: boolean
  canInitiate?: boolean
}

export function SettlementHubCard({
  settlementId,
  status = '',
  receiptUrl,
  onRefresh,
  onRetry,
  onIssueReceipt,
  refreshPending,
  retryPending,
  receiptPending,
  canInitiate = true,
}: Props) {
  const terminal = ['SUCCESS', 'FAILED', 'REFUNDED'].includes(String(status).toUpperCase())
  const success = String(status).toUpperCase() === 'SUCCESS'
  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Settlement controls</CardTitle>
        <CardDescription>
          Quote, deposit, status refresh, and receipt — wallet popups are never settlement proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status || 'pending'} />
          <span className="text-sm text-muted-foreground">#{settlementId}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <Button type="button" size="sm" variant="outline" disabled={refreshPending} onClick={onRefresh}>
              <RefreshCw className="size-4" />
              Refresh status
            </Button>
          ) : null}
          {onRetry && canInitiate && !success ? (
            <Button type="button" size="sm" variant="outline" disabled={retryPending || terminal} onClick={onRetry}>
              <RotateCcw className="size-4" />
              Retry quote
            </Button>
          ) : null}
          {success && (receiptUrl || onIssueReceipt) ? (
            receiptUrl ? (
              <Button type="button" size="sm" onClick={() => openPayLinkPreview(receiptUrl)}>
                <ExternalLink className="size-4" />
                Open receipt
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={receiptPending} onClick={onIssueReceipt}>
                Issue receipt link
              </Button>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
