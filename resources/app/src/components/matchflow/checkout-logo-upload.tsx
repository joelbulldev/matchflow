import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getBootstrap } from '@/lib/api-client'

type Props = {
  value: string
  onChange: (url: string) => void
  orgId: number | null
}

export function CheckoutLogoUpload({ value, onChange, orgId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (file: File) => {
      if (!orgId) {
        setError('Select an organization first.')
        return
      }
      setError(null)
      setUploading(true)
      setProgress(12)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const base = getBootstrap().restUrl.replace(/\/$/, '')
        const res = await fetch(`${base}/settings/checkout-logo`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-WP-Nonce': getBootstrap().restNonce,
            'X-Matchflow-Organization': String(orgId),
          },
          body: fd,
        })
        setProgress(85)
        const json = (await res.json()) as { success?: boolean; data?: { url?: string }; message?: string }
        if (!res.ok || !json.success || !json.data?.url) {
          throw new Error(json.message || 'Upload failed')
        }
        onChange(json.data.url)
        setPendingFile(null)
        setProgress(100)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
        window.setTimeout(() => setProgress(0), 600)
      }
    },
    [orgId, onChange],
  )

  function onPick(file: File | null) {
    if (!file) return
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
      setError('Use PNG, JPEG, WebP, or SVG.')
      return
    }
    setPendingFile(file)
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
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
        className={cn(
          'flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        {value ? (
          <img src={value} alt="" className="max-h-16 max-w-[180px] object-contain" />
        ) : (
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        )}
        <p className="text-sm text-muted-foreground">
          Drag and drop your logo, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or SVG · max 2 MB</p>
      </div>

      {pendingFile ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => setPendingFile(null)}>
            <Trash2 className="size-4" />
            Remove
          </Button>
          <Button type="button" size="sm" disabled={uploading} onClick={() => void upload(pendingFile)}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Upload
          </Button>
        </div>
      ) : null}

      {value ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
          <Trash2 className="size-4" />
          Remove logo from checkout
        </Button>
      ) : null}

      {uploading && progress > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
