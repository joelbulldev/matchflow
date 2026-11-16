export type Paginated<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export function listItems<T>(data: T[] | Paginated<T> | undefined | null): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export function paginatedMeta(data: Paginated<unknown> | unknown[] | undefined | null): Pick<Paginated<unknown>, 'total' | 'limit' | 'offset'> | null {
  if (!data || Array.isArray(data)) return null
  if (typeof data === 'object' && 'items' in data) {
    const p = data as Paginated<unknown>
    return { total: p.total, limit: p.limit, offset: p.offset }
  }
  return null
}
