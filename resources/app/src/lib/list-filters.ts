/** True when a list query string has user-facing filters (not paging). */
export function searchQueryHasFilters(searchQuery?: string): boolean {
  if (!searchQuery?.trim()) return false
  const raw = searchQuery.startsWith('?') ? searchQuery.slice(1) : searchQuery
  const p = new URLSearchParams(raw)
  for (const [key, value] of p.entries()) {
    if (['limit', 'offset', 'page', 'page_size'].includes(key)) continue
    if (value && value !== 'all') return true
  }
  return false
}
