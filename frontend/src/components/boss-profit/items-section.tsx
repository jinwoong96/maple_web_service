import { Plus, X } from 'lucide-react'

import { ToggleGroup } from '@/components/boss-profit/toggle-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BossProfit } from '@/hooks/use-boss-profit'
import { AUCTION_FEE_RATES } from '@/lib/boss-profit-split'
import { formatKoreanNumber } from '@/lib/korean-number'

function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  return Math.min(Number(digits), Number.MAX_SAFE_INTEGER)
}

/** 판매 아이템 목록. 예전의 "합계로 입력" 모드는 없앴다 — 이름 없이 금액만
 * 한 줄 넣으면 같은 일이다. */
export function ItemsSection({ profit }: { profit: BossProfit }) {
  const { items, parties } = profit

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-primary">02</span>
        <h2 className="text-base font-semibold">판매 아이템</h2>
        <span className="text-xs text-muted-foreground">
          판 금액(수수료 차감 전)과 그 아이템을 먹은 파티를 고르세요.
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              <Input
                value={item.name}
                onChange={(event) => profit.updateItem(item.id, { name: event.target.value })}
                placeholder="아이템 이름 (선택)"
                aria-label={`${index + 1}번 아이템 이름`}
                className="min-w-40 flex-[1.2]"
              />
              <Input
                inputMode="numeric"
                value={item.amount ? item.amount.toLocaleString('ko-KR') : ''}
                onChange={(event) => profit.updateItem(item.id, { amount: parseAmount(event.target.value) })}
                placeholder="판매 금액"
                aria-label={`${index + 1}번 판매 금액`}
                className="min-w-36 flex-1"
              />
              <select
                value={item.partyId ?? ''}
                onChange={(event) => profit.updateItem(item.id, { partyId: event.target.value || null })}
                aria-label={`${index + 1}번 아이템 파티`}
                className="h-8 w-36 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.partyId === null && <option value="">파티 선택</option>}
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name.trim() || '이름 없는 파티'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => profit.removeItem(item.id)}
                disabled={items.length <= 1}
                aria-label={`${index + 1}번 아이템 삭제`}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={profit.addItem}>
            <Plus className="size-4" />
            아이템 추가
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={profit.resetItems}>
            초기화
          </Button>
          <div className="grow" />
          <span className="text-xs text-muted-foreground">합계</span>
          <span className="text-sm font-semibold">{formatKoreanNumber(profit.itemsTotal)}</span>
          <span className="ml-2 text-xs text-muted-foreground">경매장 수수료</span>
          <ToggleGroup
            options={AUCTION_FEE_RATES}
            value={profit.feeRate}
            onChange={profit.setFeeRate}
            label={(rate) => `${Math.round(rate * 100)}%`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          수수료는 정산자가 전리품을 팔 때와, 파티원이 자기 몫을 경매장으로 받을 때 각각 붙습니다.
        </p>
      </div>
    </section>
  )
}
