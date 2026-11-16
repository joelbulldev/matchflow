import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/matchflow'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type Notif = {
  id: number
  type: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

function useOrgId() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<{ currentOrganizationId: number | null }>('/bootstrap'),
  }).data?.currentOrganizationId ?? null
}

export function NotificationsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const orgId = useOrgId()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['notifications', orgId],
    enabled: open && !!orgId,
    queryFn: () => api<{ items: Notif[]; unread: number }>('/notifications', {}, orgId),
  })

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }, orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOne = useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: 'POST' }, orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="size-4" /> Notifications
          </SheetTitle>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" disabled={markAll.isPending || !list.data?.unread} onClick={() => markAll.mutate()}>
              <CheckCheck className="size-4" aria-hidden />
              Mark all read
            </Button>
          </div>
        </SheetHeader>
        <SheetBody className="space-y-2 pt-0">
          {list.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : null}
          {!list.isLoading && !list.data?.items?.length ? (
            <EmptyState title="You're all caught up" description="Settlement and approval alerts will appear here." />
          ) : null}
          {list.data?.items?.map((n) => (
            <button
              key={n.id}
              type="button"
              className={cn(
                'w-full rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-muted/60',
                !n.readAt && 'border-primary/25 bg-primary/5',
              )}
              onClick={() => {
                if (!n.readAt) markOne.mutate(n.id)
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                {!n.readAt ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.createdAt + 'Z').toLocaleString()}</p>
            </button>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

export function useUnreadNotifications() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['notifications', orgId],
    enabled: !!orgId,
    queryFn: () => api<{ items: Notif[]; unread: number }>('/notifications', {}, orgId),
    refetchInterval: 60_000,
  })
}
