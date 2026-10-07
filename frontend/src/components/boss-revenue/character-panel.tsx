import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy, X } from 'lucide-react'

import { CharacterSearchForm } from '@/components/character/character-search-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacterBasic, useCharacterOcid } from '@/hooks/use-character'
import {
  type CharacterSummary,
  type PlannerCharacter,
  type SelectionClipboard,
} from '@/hooks/use-boss-revenue'
import { formatKoreanNumber } from '@/lib/korean-number'

interface AddCharacterFormProps {
  searchTerm: string
  /** 캐릭터가 추가될 때마다 바뀌는 값 — 검색 폼을 리마운트해 입력칸을 비운다
   * (`CharacterSearchForm`이 입력값을 자체 상태로 들고 있어서, 부모가
   * 검색어를 비우는 것만으로는 칸이 안 비워진다). */
  resetKey: number
  onSearch: (name: string) => void
  onAdded: (name: string, level: number | null, image: string | null) => void
}

/** 닉네임 → ocid → basic 두 단계는 기존 Character 도메인 훅을 그대로 쓴다.
 * 조회가 끝나면 부모에게 넘기고 검색어를 비워, 같은 이름을 다시 넣어도
 * 쿼리가 다시 돈다. */
function AddCharacterForm({ searchTerm, resetKey, onSearch, onAdded }: AddCharacterFormProps) {
  const ocidQuery = useCharacterOcid(searchTerm)
  const basicQuery = useCharacterBasic(ocidQuery.data)
  const basic = basicQuery.data

  useEffect(() => {
    if (!searchTerm || !basic) return
    onAdded(basic.character_name, basic.character_level, basic.character_image ?? null)
    onSearch('')
  }, [searchTerm, basic, onAdded, onSearch])

  const isSearching = Boolean(searchTerm) && (ocidQuery.isLoading || basicQuery.isLoading)
  const isNotFound = Boolean(searchTerm) && (ocidQuery.isError || basicQuery.isError)

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <CharacterSearchForm key={resetKey} onSubmit={onSearch} placeholder="캐릭터 이름으로 추가" />
      {isSearching && <Skeleton className="h-4 w-24" />}
      {isNotFound && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            캐릭터를 찾을 수 없습니다. 이름을 다시 확인해주세요.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

interface CharacterPanelProps {
  characters: PlannerCharacter[]
  activeCharacterId: string | null
  summaries: Map<string, CharacterSummary>
  searchTerm: string
  clipboard: SelectionClipboard | null
  onSearch: (name: string) => void
  onAdd: (name: string, level: number | null, image: string | null) => void
  onSelect: (characterId: string) => void
  onRemove: (characterId: string) => void
  onMove: (characterId: string, offset: -1 | 1) => void
  onCopy: (characterId: string) => void
  onPaste: (characterId: string) => void
  onClearClipboard: () => void
}

export function CharacterPanel({
  characters,
  activeCharacterId,
  summaries,
  searchTerm,
  clipboard,
  onSearch,
  onAdd,
  onSelect,
  onRemove,
  onMove,
  onCopy,
  onPaste,
  onClearClipboard,
}: CharacterPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-primary">02</span>
        <h2 className="text-base font-semibold">캐릭터</h2>
        <div className="grow" />
        <AddCharacterForm
          searchTerm={searchTerm}
          resetKey={characters.length}
          onSearch={onSearch}
          onAdded={onAdd}
        />
      </div>

      {clipboard && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <Copy className="size-4 shrink-0 text-primary" />
          <span>
            <strong>{clipboard.sourceName}</strong>의 보스 설정 {clipboard.selections.length}개를 복사했습니다.
          </span>
          <span className="text-xs text-muted-foreground">
            다른 캐릭터의 붙여넣기 버튼을 누르거나, 새 캐릭터를 추가하면 이 설정으로 만들어집니다.
          </span>
          <div className="grow" />
          <Button type="button" variant="outline" size="sm" onClick={onClearClipboard}>
            복사 취소
          </Button>
        </div>
      )}

      {characters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          캐릭터를 추가하면 보스를 골라 수익을 계산할 수 있어요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character, index) => {
            const summary = summaries.get(character.id)
            const isActive = character.id === activeCharacterId
            return (
              <div
                key={character.id}
                className={`relative flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                  isActive ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40'
                }`}
              >
                {/* 카드 전체를 선택 영역으로 쓰되, 안에 복사/삭제 버튼이 있어
                    버튼을 중첩할 수는 없다. 그래서 선택용 버튼을 카드 크기로
                    깔고, 아이콘 버튼 묶음만 그 위로 올린다. */}
                <button
                  type="button"
                  onClick={() => onSelect(character.id)}
                  aria-label={`${character.name} 선택`}
                  aria-pressed={isActive}
                  className="absolute inset-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 grow items-center gap-2 text-left">
                    {character.image ? (
                      <img src={character.image} alt="" className="size-10 shrink-0 rounded bg-muted/60" />
                    ) : (
                      <div className="size-10 shrink-0 rounded bg-muted/60" />
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{character.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {character.level != null ? `Lv.${character.level}` : '레벨 미확인'} · 주간{' '}
                        {summary?.weeklyCount ?? 0}개
                      </span>
                    </span>
                  </div>
                  <div className="relative z-10 flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onMove(character.id, -1)}
                      disabled={index === 0}
                      aria-label={`${character.name} 앞으로 이동`}
                      title="앞으로 이동"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(character.id, 1)}
                      disabled={index === characters.length - 1}
                      aria-label={`${character.name} 뒤로 이동`}
                      title="뒤로 이동"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopy(character.id)}
                      disabled={character.selections.length === 0}
                      aria-label={`${character.name} 설정 복사`}
                      title="보스 설정 복사"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <Copy className="size-4" />
                    </button>
                    {clipboard && clipboard.sourceId !== character.id && (
                      <button
                        type="button"
                        onClick={() => onPaste(character.id)}
                        aria-label={`${character.name}에 복사한 설정 붙여넣기`}
                        title={`${clipboard.sourceName}의 설정 붙여넣기`}
                        className="text-primary hover:text-primary/80"
                      >
                        <ClipboardPaste className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(character.id)}
                      aria-label={`${character.name} 삭제`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">주간</span>
                  <span className="text-lg font-bold text-primary">
                    {formatKoreanNumber(summary?.weeklyRevenue ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 border-t pt-2">
                  <span className="text-xs text-muted-foreground">월간</span>
                  <span className="text-sm font-medium">
                    {summary && summary.monthlyCount > 0
                      ? formatKoreanNumber(summary.monthlyRevenue)
                      : '선택 없음'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
