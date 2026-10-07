import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'

import { PartyCard } from '@/components/boss-profit/party-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BossProfit } from '@/hooks/use-boss-profit'
import { loadPartySectionCollapsed, savePartySectionCollapsed } from '@/lib/boss-profit-storage'

/** 접힌 파티 영역에 쓰는 한 줄 요약. */
function summarize(profit: BossProfit): string {
  const settler = profit.settlerName.trim()
  const names = profit.parties.map((party) => party.name.trim() || '이름 없는 파티')
  return [settler ? `정산자 ${settler}` : null, `파티 ${profit.parties.length}개`, ...names]
    .filter(Boolean)
    .join(' · ')
}

export function PartySection({ profit }: { profit: BossProfit }) {
  // 고정팟이 갖춰지면 매번 펼쳐 볼 일이 적어서 접어 둘 수 있게 하고, 그
  // 상태를 다음 방문에도 남긴다. 기본은 펼침.
  const [collapsed, setCollapsed] = useState(loadPartySectionCollapsed)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    savePartySectionCollapsed(next)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-primary">01</span>
        <h2 className="text-base font-semibold">파티</h2>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {collapsed ? summarize(profit) : '고정팟은 이 브라우저에 저장됩니다.'}
        </span>
        {/* 제목 옆 작은 화살표만으로는 접히는 영역인지 알아보기 어려워서, 글자가
            있는 버튼을 오른쪽에 둔다. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="party-section-body"
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {collapsed ? '펼치기' : '접기'}
        </Button>
      </div>

      {!collapsed && (
        <div id="party-section-body" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5">
            <label htmlFor="settler-name" className="text-sm font-semibold">
              정산자
            </label>
            <Input
              id="settler-name"
              value={profit.settlerName}
              onChange={(event) => profit.setSettlerName(event.target.value)}
              placeholder="이름 (선택)"
              className="max-w-48"
            />
            <span className="text-xs text-muted-foreground">
              전리품을 팔고 분배하는 사람입니다. 모든 파티에 공통입니다.
            </span>
          </div>

          {profit.parties.map((party) => (
            <PartyCard key={party.id} party={party} profit={profit} />
          ))}

          <div>
            <Button type="button" variant="outline" size="sm" onClick={profit.addTempParty}>
              <Plus className="size-4" />
              임시 파티 추가
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
