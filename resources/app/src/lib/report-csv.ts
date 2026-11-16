export function triggerCsvDownload(data: { csv?: string; filename?: string }) {
  if (!data.csv) return false
  const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = data.filename || 'report.csv'
  a.click()
  URL.revokeObjectURL(url)
  return true
}