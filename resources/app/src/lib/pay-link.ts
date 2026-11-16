import { mfToast } from '@/lib/mutation-feedback'

export function normalizePayUrl(url: string): string {
  const t = url.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('/')) return `${window.location.origin}${t}`
  return t
}

export async function copyPayLink(url: string): Promise<boolean> {
  const href = normalizePayUrl(url)
  if (!href) return false
  try {
    await navigator.clipboard.writeText(href)
    mfToast.success('Payment link copied')()
    return true
  } catch {
    mfToast.error('Could not copy link')()
    return false
  }
}

export function openPayLinkPreview(url: string): boolean {
  const href = normalizePayUrl(url)
  if (!href) return false
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}
