import { useId, useRef } from 'react'
import { Pipette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (hex: string) => void
  className?: string
  placeholder?: string
}

function normalizeHex(raw: string): string {
  const v = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`
  return v
}

const DEFAULT_SWATCH = '#138d67'

export function ColorPickerField({ value, onChange, className, placeholder = 'Optional — e.g. #138d67' }: Props) {
  const pickerId = useId()
  const nativeRef = useRef<HTMLInputElement>(null)
  const swatch = /^#[0-9a-fA-F]{6}$/i.test(value) ? value : DEFAULT_SWATCH

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative size-10 shrink-0 overflow-hidden rounded-lg border-border p-0"
        aria-label="Open color picker"
        onClick={() => nativeRef.current?.click()}
      >
        <span
          className={cn('size-6 rounded-md border border-border/80 shadow-inner', !/^#[0-9a-fA-F]{6}$/i.test(value) && 'bg-primary')}
          style={/^#[0-9a-fA-F]{6}$/i.test(value) ? { backgroundColor: swatch } : undefined}
        />
        <input
          ref={nativeRef}
          id={pickerId}
          type="color"
          className="sr-only"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
        />
      </Button>
      <Pipette className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        className="font-mono"
        value={value}
        onChange={(e) => onChange(normalizeHex(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  )
}
