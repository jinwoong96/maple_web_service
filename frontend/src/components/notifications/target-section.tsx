import { X } from 'lucide-react'

import { CharacterSearchForm } from '@/components/character/character-search-form'
import { Skeleton } from '@/components/ui/skeleton'
import type { NotificationItemType } from '@/hooks/use-notifications'

interface TargetSectionProps {
  itemType: NotificationItemType
  title: string
  description: string
  targets: { id: number; character_name: string }[]
  isLoading: boolean
  onAdd: (itemType: NotificationItemType, characterName: string) => void
  onRemove: (targetId: number) => void
}

/** 항목 하나(심볼업 / 아티팩트 만료)의 감시 캐릭터 목록.
 * 항목마다 따로 등록한다 — 같은 캐릭터라도 받고 싶은 알림이 다를 수 있다. */
export function TargetSection({
  itemType,
  title,
  description,
  targets,
  isLoading,
  onAdd,
  onRemove,
}: TargetSectionProps) {
  function handleSubmit(characterName: string) {
    const trimmed = characterName.trim()
    if (!trimmed) return
    onAdd(itemType, trimmed)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="max-w-sm">
        {/* 한 번에 여러 캐릭터를 연달아 넣는 경우가 대부분이라, 추가한 뒤에도
            입력칸에 포커스를 남긴다. */}
        <CharacterSearchForm onSubmit={handleSubmit} placeholder="캐릭터 이름으로 추가" resetOnSubmit />
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 캐릭터가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {targets.map((target) => (
            <span
              key={target.id}
              className="flex items-center gap-1.5 rounded-full border bg-background py-1 pr-1.5 pl-3 text-sm"
            >
              {target.character_name}
              <button
                type="button"
                onClick={() => onRemove(target.id)}
                aria-label={`${target.character_name} 삭제`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
