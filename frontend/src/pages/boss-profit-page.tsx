import { ItemsSection } from '@/components/boss-profit/items-section'
import { PartySection } from '@/components/boss-profit/party-section'
import { SettlementResult } from '@/components/boss-profit/settlement-result'
import { useBossProfit } from '@/hooks/use-boss-profit'

export function BossProfitPage() {
  const profit = useBossProfit()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">보상 분배금 계산기</h1>
        <p className="text-sm text-muted-foreground">
          여러 파티가 판 전리품을 한 번에 정산합니다. 파티원이 경매장에 올릴 금액을 사람별로 합쳐드립니다.
        </p>
      </div>

      <PartySection profit={profit} />
      <ItemsSection profit={profit} />
      <SettlementResult settlement={profit.settlement} feeRate={profit.feeRate} />
    </div>
  )
}
