import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  icon: LucideIcon
}

export function PlaceholderPage({ title, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
      <Icon className="size-10" />
      <h1 className="text-lg font-medium text-foreground">{title}</h1>
      <p className="text-sm">준비 중인 화면입니다.</p>
    </div>
  )
}
