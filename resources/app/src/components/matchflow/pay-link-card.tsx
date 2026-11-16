import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PayLinkActions } from '@/components/matchflow/pay-link-actions'
import { normalizePayUrl } from '@/lib/pay-link'

type Props = {
  paymentUrl?: string | null
  invoiceNumber?: string
  title?: string
  description?: string
}

export function PayLinkCard({
  paymentUrl,
  invoiceNumber,
  title = 'Customer payment link',
  description = 'Opens your branded checkout in a new tab. Share only with the payer.',
}: Props) {
  const url = normalizePayUrl(String(paymentUrl || ''))
  return (
    <Card className="min-w-0 max-w-full overflow-hidden border-primary/15 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {url ? (
          <p className="break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {url}
          </p>
        ) : null}
        <PayLinkActions paymentUrl={paymentUrl} invoiceNumber={invoiceNumber} size="default" />
      </CardContent>
    </Card>
  )
}
