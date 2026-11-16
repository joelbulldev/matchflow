import { Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { copyPayLink, normalizePayUrl, openPayLinkPreview } from '@/lib/pay-link'

type Props = {
  paymentUrl?: string | null
  invoiceNumber?: string
  size?: 'sm' | 'default'
  className?: string
  /** When true, primary action is preview checkout in a new tab. */
  emphasizePreview?: boolean
}

export function PayLinkActions({
  paymentUrl,
  invoiceNumber,
  size = 'sm',
  className,
  emphasizePreview = true,
}: Props) {
  const url = normalizePayUrl(String(paymentUrl || ''))
  if (!url) {
    return <span className="text-sm text-muted-foreground">Issue invoice to get a pay link</span>
  }

  const previewLabel = invoiceNumber ? `Preview checkout · ${invoiceNumber}` : 'Preview checkout'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {emphasizePreview ? (
        <Button
          type="button"
          size={size}
          onClick={() => openPayLinkPreview(url)}
          aria-label={previewLabel}
        >
          <ExternalLink className="size-4" />
          Preview pay link
        </Button>
      ) : null}
      <Button
        type="button"
        size={size}
        variant={emphasizePreview ? 'outline' : 'default'}
        onClick={() => void copyPayLink(url)}
        aria-label={invoiceNumber ? `Copy payment link for ${invoiceNumber}` : 'Copy payment link'}
      >
        <Copy className="size-4" />
        Copy
      </Button>
      {!emphasizePreview ? (
        <Button type="button" size={size} variant="outline" onClick={() => openPayLinkPreview(url)}>
          <ExternalLink className="size-4" />
          Open
        </Button>
      ) : null}
    </div>
  )
}
