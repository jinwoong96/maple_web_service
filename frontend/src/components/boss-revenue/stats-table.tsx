import {
  type CharacterSummary,
  type PlannerCharacter,
  getFourWeekRevenue,
  getMonthlyAverageRevenue,
} from '@/hooks/use-boss-revenue'
import { formatKoreanNumber } from '@/lib/korean-number'

const EMPTY_SUMMARY: CharacterSummary = {
  weeklyRevenue: 0,
  monthlyRevenue: 0,
  weeklyCount: 0,
  monthlyCount: 0,
}

interface StatsTableProps {
  characters: PlannerCharacter[]
  summaries: Map<string, CharacterSummary>
}

export function StatsTable({ characters, summaries }: StatsTableProps) {
  if (characters.length === 0) return null

  // 합계도 같은 공식을 타도록 캐릭터 요약을 먼저 합친 뒤 파생값을 구한다 —
  // 캐릭터별로 구한 값을 더하면 내림 오차가 쌓인다.
  const totals = characters.reduce<CharacterSummary>((acc, character) => {
    const summary = summaries.get(character.id)
    if (!summary) return acc
    return {
      weeklyCount: acc.weeklyCount + summary.weeklyCount,
      monthlyCount: acc.monthlyCount + summary.monthlyCount,
      weeklyRevenue: acc.weeklyRevenue + summary.weeklyRevenue,
      monthlyRevenue: acc.monthlyRevenue + summary.monthlyRevenue,
    }
  }, EMPTY_SUMMARY)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-primary">01</span>
        <h2 className="text-base font-semibold">총 수익</h2>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">캐릭터</th>
              <th className="px-3 py-2 text-right font-medium">주간 결정</th>
              <th className="px-3 py-2 text-right font-medium">주간 수익</th>
              <th className="px-3 py-2 text-right font-medium">월간 수익(4주)</th>
              <th className="px-3 py-2 text-right font-medium">월평균 수익</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((character) => {
              const summary = summaries.get(character.id) ?? EMPTY_SUMMARY
              return (
                <tr key={character.id} className="border-b">
                  <td className="px-3 py-2">{character.name}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{summary.weeklyCount}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatKoreanNumber(summary.weeklyRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatKoreanNumber(getFourWeekRevenue(summary))}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatKoreanNumber(getMonthlyAverageRevenue(summary))}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-primary/5 font-semibold">
              <td className="px-3 py-2">총합</td>
              <td className="px-3 py-2 text-right">{totals.weeklyCount}</td>
              <td className="px-3 py-2 text-right text-primary">
                {formatKoreanNumber(totals.weeklyRevenue)}
              </td>
              <td className="px-3 py-2 text-right">{formatKoreanNumber(getFourWeekRevenue(totals))}</td>
              <td className="px-3 py-2 text-right">
                {formatKoreanNumber(getMonthlyAverageRevenue(totals))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        월간 수익(4주)은 주간 수익 ×4에 월간 보스 수익을 더한 값이고, 월평균 수익은 1년(365일 ÷ 7 ≈
        52.1주) 수익을 12로 나눈 값입니다.
      </p>
    </section>
  )
}
