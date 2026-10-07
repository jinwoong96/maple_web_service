import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { allianceNeighbours, type LocalAlliance, type useAlliances } from '@/hooks/use-alliances'

const COLLAPSED_KEY = 'maple-log:guild-alliances:collapsed'

function loadCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function AllianceCard({
  alliance,
  guildName,
  actions,
}: {
  alliance: LocalAlliance
  guildName: string
  actions: ReturnType<typeof useAlliances>
}) {
  const [draft, setDraft] = useState('')

  function addGuild() {
    const name = draft.trim()
    if (!name) return
    actions.addGuild(alliance.id, name)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={alliance.name}
          onChange={(event) => actions.rename(alliance.id, event.target.value)}
          aria-label="연합 이름"
          className="max-w-52 font-semibold"
        />
        {alliance.guilds.includes(guildName) && (
          <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] text-primary">
            지금 길드 포함
          </span>
        )}
        <div className="grow" />
        <Button type="button" variant="outline" size="sm" onClick={() => actions.remove(alliance.id)}>
          연합 삭제
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {alliance.guilds.map((name) => (
          <span
            key={name}
            className={`flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs ${
              name === guildName ? 'border-primary/40 bg-primary/5 font-semibold' : ''
            }`}
          >
            {name}
            <button
              type="button"
              aria-label={`${name} 빼기`}
              onClick={() => actions.removeGuild(alliance.id, name)}
              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addGuild()
            }
          }}
          onBlur={addGuild}
          aria-label={`${alliance.name}에 길드 추가`}
          placeholder="길드 이름 + Enter"
          className="h-7 w-36 rounded-full border border-dashed bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
        />
      </div>
    </div>
  )
}

/** 명단 변동 탭 위쪽의 **연합 설정**. 이 브라우저에만 저장된다. */
export function AlliancePanel({
  guildName,
  actions,
}: {
  guildName: string
  actions: ReturnType<typeof useAlliances>
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [showAll, setShowAll] = useState(false)

  const mine = actions.alliances.filter((alliance) => alliance.guilds.includes(guildName))
  const others = actions.alliances.length - mine.length
  const neighbours = allianceNeighbours(actions.alliances, guildName)
  const shown = showAll ? actions.alliances : mine

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next))
    } catch {
      // 저장 못 해도 지금 화면에서는 접힌다.
    }
  }

  return (
    <section className="rounded-lg border">
      <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${collapsed ? '' : 'border-b'}`}>
        <h3 className="text-sm font-semibold">연합 설정</h3>
        <span className="text-xs text-muted-foreground">
          {mine.length > 0
            ? `${guildName}이(가) 든 연합 ${mine.length}개 · 연합 내 이동 판정에 길드 ${neighbours.size}개를 씁니다`
            : '이 길드가 든 연합이 없습니다'}
        </span>
        <div className="grow" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="alliance-panel-body"
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {collapsed ? '펼치기' : '접기'}
        </Button>
      </div>
      {!collapsed && (
        <div id="alliance-panel-body" className="flex flex-col gap-3 p-3">
          <p className="text-xs text-muted-foreground">
            이 브라우저에 저장됩니다. 길드 이름이 연합 목록에 있으면, 그 연합의 다른 길드로 옮긴 사람을
            탈퇴가 아니라 <strong>연합 내 이동</strong>으로 봅니다.
          </p>
          {shown.map((alliance) => (
            <AllianceCard key={alliance.id} alliance={alliance} guildName={guildName} actions={actions} />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => actions.add(guildName)}>
              <Plus className="size-4" />새 연합
            </Button>
            {others > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? '이 길드가 든 연합만 보기' : `${guildName}이(가) 없는 연합 ${others}개 · 모두 보기`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
