import type { UseQueryResult } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { NoticeListItem } from '@/pages/notice-list-item'

interface NoticeSectionEntry {
  title: string
  url: string
  notice_id: number
  date?: string | null
  thumbnail_url?: string | null
}

interface NoticeSectionProps<T extends NoticeSectionEntry> {
  title: string
  query: UseQueryResult<T[]>
}

export function NoticeSection<T extends NoticeSectionEntry>({ title, query }: NoticeSectionProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>

      {query.isLoading && (
        <div className="flex flex-col gap-3 py-1">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-muted-foreground">불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      )}

      {query.data && query.data.length === 0 && (
        <p className="text-sm text-muted-foreground">표시할 소식이 없습니다.</p>
      )}

      {query.data && query.data.length > 0 && (
        <div className="flex flex-col">
          {query.data.slice(0, 5).map((entry) => (
            <NoticeListItem
              key={entry.notice_id}
              title={entry.title}
              url={entry.url}
              date={entry.date ?? null}
              thumbnailUrl={entry.thumbnail_url}
            />
          ))}
        </div>
      )}
    </div>
  )
}
