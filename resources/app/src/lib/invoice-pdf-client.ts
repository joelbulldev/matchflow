/** Download invoice bytes; HTML path uses a blob tab (not noopener — that blocks document.write). */
export function downloadInvoicePdfFromBase64(pdfBase64: string, filename: string): void {
  const bin = atob(pdfBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  triggerBlobDownload(new Blob([bytes], { type: 'application/pdf' }), filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/** Open branded invoice HTML and trigger the browser print dialog (Save as PDF). */
export function openInvoicePrintablePdf(html: string, title = 'Invoice'): void {
  const doc = html.includes('<!DOCTYPE') || html.includes('<html') ? html : wrapFragment(html, title)
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    URL.revokeObjectURL(url)
    triggerBlobDownload(blob, sanitizeFilename(title) + '.html')
    throw new Error('Allow pop-ups to download the invoice PDF.')
  }
  const cleanup = () => URL.revokeObjectURL(url)
  w.addEventListener('load', () => {
    cleanup()
    w.focus()
    w.print()
  })
  w.addEventListener('beforeunload', cleanup)
  setTimeout(cleanup, 120_000)
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'invoice'
}

function wrapFragment(body: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}