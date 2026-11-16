import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function InsightsSkeleton() {
  return (
    <div className="mf-insights-panel" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/80 shadow-sm">
            <CardHeader className="space-y-3 pb-0">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="size-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-32" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
