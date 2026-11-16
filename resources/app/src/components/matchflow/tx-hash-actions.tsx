import { Check, Copy, Globe } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { isNearTransactionHash, nearExplorerTxUrl, truncateHash } from '@/lib/settlement-labels'

type Props = {
  hash: string
  title?: string
}

export function TxHashActions({ hash, title = 'Transaction hash' }: Props) {
  const [copied, setCopied] = useState(false)
  const trimmed = hash.trim()
  if (!trimmed) return <span className="text-muted-foreground">—</span>

  async function copy() {
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const near = isNearTransactionHash(trimmed)

  return (
    <div className="flex items-center justify-end gap-1 sm:justify-end">
      <span className="font-mono text-xs tabular-nums" title={title}>
        {truncateHash(trimmed)}
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => void copy()} aria-label="Copy transaction hash">
        {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </Button>
      {near ? (
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" asChild>
          <a href={nearExplorerTxUrl(trimmed)} target="_blank" rel="noopener noreferrer" aria-label="View on Nearblocks">
            <Globe className="size-3.5" aria-hidden />
          </a>
        </Button>
      ) : null}
    </div>
  )
}