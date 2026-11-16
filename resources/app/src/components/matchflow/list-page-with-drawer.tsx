import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { DataTable, ErrorState, ListTableSkeleton, PageHeader, WorkspacePage, FilterToolbar } from '@/components/matchflow'
import { MetricPeriodTabs } from '@/components/matchflow/metric-period-tabs'
import { mfToast } from '@/lib/mutation-feedback'
import { ResponsiveFormSurface } from '@/components/matchflow/responsive-form-surface'
import { api } from '@/lib/api-client'
import { searchQueryHasFilters } from '@/lib/list-filters'
import { listItems, type Paginated } from '@/lib/paginated'

function useOrgId() {
  const q = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<{ currentOrganizationId: number | null }>('/bootstrap'),
  })
  return q.data?.currentOrganizationId ?? null
}

type Col = { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode; className?: string }

export function ListPageWithDrawer({
  title,
  description,
  path,
  columns,
  createTitle,
  createDescription,
  renderCreateForm,
  initialOpen = false,
  searchQuery,
  filterControls,
  onClearFilters,
  insights,
  emptyTitle = 'No records yet',
  emptyDescription = 'Create one to get started.',
  emptySecondaryActions,
  filteredEmptyTitle = 'No matches for these filters',
  filteredEmptyDescription = 'Clear filters or create a new record.',
  defaultPageSize = 25,
}: {
  title: string
  description: string
  path: string
  columns: Col[]
  createTitle: string
  createDescription?: string
  renderCreateForm: (ctx: { orgId: number | null; close: () => void }) => ReactNode
  initialOpen?: boolean
  searchQuery?: string
  filterControls?: ReactNode
  onClearFilters?: () => void
  insights?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptySecondaryActions?: ReactNode
  filteredEmptyTitle?: string
  filteredEmptyDescription?: string
  defaultPageSize?: number
}) {
  const orgId = useOrgId()
  const [open, setOpen] = useState(initialOpen)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    setPage(0)
  }, [searchQuery])

  const normalizedPath = useMemo(() => {
    const joiner = path.includes('?') ? '&' : '?'
    const extra = searchQuery ? (searchQuery.startsWith('?') ? searchQuery.slice(1) : searchQuery) : ''
    const p = new URLSearchParams(extra)
    p.set('limit', String(pageSize))
    p.set('offset', String(page * pageSize))
    const qs = p.toString()
    return qs ? `${path}${joiner}${qs}` : path
  }, [path, searchQuery, page, pageSize])

  const q = useQuery({
    queryKey: [normalizedPath, orgId],
    enabled: !!orgId,
    queryFn: () => api<Paginated<Record<string, unknown>> | Array<Record<string, unknown>>>(normalizedPath, {}, orgId),
  })

  const rows = listItems(q.data)
  const paginated = q.data && !Array.isArray(q.data) && 'total' in q.data
    ? q.data
  : !Array.isArray(q.data) && q.data && listItems(q.data).length
    ? { items: listItems(q.data), total: listItems(q.data).length, limit: pageSize, offset: page * pageSize }
    : Array.isArray(q.data)
      ? { items: q.data, total: q.data.length, limit: pageSize, offset: 0 }
      : null
  const filterActive = searchQueryHasFilters(searchQuery)

  useEffect(() => {
    if (q.isError) {
      mfToast.error('Request failed')(q.error as Error)
    }
  }, [q.isError, q.error])

  return (
    <WorkspacePage>
      <PageHeader
        title={title}
        description={description}
        kpiPeriod={insights ? <MetricPeriodTabs /> : undefined}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> Create
          </Button>
        }
      />
      {insights}
      <section className="flex flex-col gap-4">
      {filterControls ? <FilterToolbar className="mb-0">{filterControls}</FilterToolbar> : null}
      {q.isLoading ? (
        <ListTableSkeleton />
      ) : !q.isError ? (
        <DataTable
          rows={rows}
          columns={columns}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          filterActive={filterActive && rows.length === 0}
          filteredEmptyTitle={filteredEmptyTitle}
          filteredEmptyDescription={filteredEmptyDescription}
          onClearFilters={onClearFilters}
          emptyAction={
            <>
              <Button type="button" onClick={() => setOpen(true)}>
                <Plus className="size-4" aria-hidden /> {createTitle}
              </Button>
              {emptySecondaryActions}
            </>
          }
          paginate={false}
          server={paginated ? {
            total: paginated.total,
            page,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (n) => { setPageSize(n); setPage(0) },
          } : undefined}
        />
      ) : null}
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : null}
      </section>

      <ResponsiveFormSurface
        open={open}
        onOpenChange={setOpen}
        title={createTitle}
        description={createDescription}
      >
        {renderCreateForm({ orgId, close: () => setOpen(false) })}
      </ResponsiveFormSurface>
    </WorkspacePage>
  )
}
