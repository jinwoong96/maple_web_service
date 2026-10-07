import { ExternalLink } from 'lucide-react'

interface NoticeListItemProps {
  title: string
  url: string
  date: string | null
  thumbnailUrl?: string | null
}

export function NoticeListItem({ title, url, date, thumbnailUrl }: NoticeListItemProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="-mx-2 flex items-start gap-3 rounded-md p-2 hover:bg-accent"
    >
      {thumbnailUrl && (
        <img src={thumbnailUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        {date && <p className="text-xs text-muted-foreground">{date.slice(0, 10)}</p>}
      </div>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
    </a>
  )
}
