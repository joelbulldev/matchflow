import { useCallback, useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf'

export function ApInvoiceUpload({ file, onFileChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = useCallback(
    (next: File | null) => {
      if (!next) {
        onFileChange(null)
        return
      }
      const allowed = ['application/pdf', 'image/png', 'image/jpeg']
      if (!allowed.includes(next.type)) {
        setError('Use PDF, PNG, or JPEG.')
        return
      }
      if (next.size > 10 * 1024 * 1024) {
        setError('File must be 10 MB or smaller.')
        return
      }
      setError(null)
      onFileChange(next)
    },
    [onFileChange],
  )

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'flex min-h-[7rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border/80 bg-muted/30 hover:bg-muted/50',
          disabled && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onPick(e.dataTransfer.files?.[0] ?? null)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <FileUp className="mb-2 size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Drop supplier invoice (PDF or image)</p>
        <p className="mt-1 text-xs text-muted-foreground">Stored privately; you confirm line items before match.</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>
      {file ? (
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-card px-3 py-2 text-sm">
          <span className="truncate font-medium">{file.name}</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove file" onClick={() => onPick(null)}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}