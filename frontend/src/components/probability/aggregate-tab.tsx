import { useState } from 'react'

import { PotentialCubeCardGrid, StarforceCardGrid } from '@/components/probability/aggregate-cards'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  AggregateProgress,
  AggregateStatus,
  CategoryStat,
  GradeUpRow,
  ProbabilityAggregateResult,
  StarforceStarStat,
} from '@/hooks/use-probability-aggregate'
import { formatKoreanNumber } from '@/lib/korean-number'
import { gradeRank, type PotentialGrade, STARFORCE_THEORETICAL_RATES } from '@/lib/probability-theoretical-rates'

function sortRows(map: Map<string, CategoryStat>): [string, CategoryStat][] {
  return Array.from(map.entries()).sort((a, b) => {
    if (b[1].estimatedMesoSpent !== a[1].estimatedMesoSpent) {
      return b[1].estimatedMesoSpent - a[1].estimatedMesoSpent
    }
    const totalA = a[1].starforceAttempts + a[1].potentialAttempts + a[1].cubeAttempts
    const totalB = b[1].starforceAttempts + b[1].potentialAttempts + b[1].cubeAttempts
    return totalB - totalA
  })
}

function StatTable({ title, rows }: { title: string; rows: [string, CategoryStat][] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">표시할 이력이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-2.5 py-1.5 text-left font-medium">이름</th>
              <th className="px-2.5 py-1.5 text-right font-medium">스타포스</th>
              <th className="px-2.5 py-1.5 text-right font-medium">잠재능력</th>
              <th className="px-2.5 py-1.5 text-right font-medium">큐브</th>
              <th className="px-2.5 py-1.5 text-right font-medium">추정 사용 메소</th>
              <th className="px-2.5 py-1.5 text-right font-medium">감정 비용</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, stat]) => (
              <tr key={name} className="border-b last:border-0">
                <td className="px-2.5 py-1.5">{name}</td>
                <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                  {stat.starforceAttempts || '-'}
                </td>
                <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                  {stat.potentialAttempts || '-'}
                </td>
                <td className="px-2.5 py-1.5 text-right text-muted-foreground">{stat.cubeAttempts || '-'}</td>
                <td className="px-2.5 py-1.5 text-right font-medium">
                  {stat.estimatedMesoSpent > 0 ? formatKoreanNumber(stat.estimatedMesoSpent) : '-'}
                </td>
                <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                  {stat.cubeAppraisalCost > 0 ? formatKoreanNumber(stat.cubeAppraisalCost) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Green when `actual` is on the lucky side of `theoretical`, red on the
 * unlucky side — `higherIsLucky` flips which direction that is (higher
 * success rate is lucky; higher destroy rate is not). */
function getLuckColor(actual: number, theoretical: number, higherIsLucky: boolean): string {
  const diff = actual - theoretical
  if (Math.abs(diff) < 0.0001) return 'text-foreground'
  const lucky = higherIsLucky ? diff > 0 : diff < 0
  return lucky ? 'text-emerald-600' : 'text-red-600'
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function StarforceStarTable({ starforceByStar }: { starforceByStar: Map<number, StarforceStarStat> }) {
  const rows = Array.from(starforceByStar.values()).sort((a, b) => a.star - b.star)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">스타포스 단계별 확률 (실제 / 이론)</p>
        <p className="text-sm text-muted-foreground">표시할 스타포스 이력이 없습니다.</p>
      </div>
    )
  }

  const hasUnratedStar = rows.some((row) => !STARFORCE_THEORETICAL_RATES[row.star])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">스타포스 단계별 확률 (실제 / 이론)</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-2.5 py-1.5 text-left font-medium">별</th>
              <th className="px-2.5 py-1.5 text-right font-medium">시도</th>
              <th className="px-2.5 py-1.5 text-right font-medium">성공</th>
              <th className="px-2.5 py-1.5 text-right font-medium">실패</th>
              <th className="px-2.5 py-1.5 text-right font-medium">파괴</th>
              <th className="px-2.5 py-1.5 text-right font-medium">성공률</th>
              <th className="px-2.5 py-1.5 text-right font-medium">파괴율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const attempts = row.success + row.fail + row.destroy
              const theoretical = STARFORCE_THEORETICAL_RATES[row.star] as
                | { success: number; fail: number; destroy: number }
                | undefined
              const actualSuccess = attempts > 0 ? row.success / attempts : 0
              const actualDestroy = attempts > 0 ? row.destroy / attempts : 0

              return (
                <tr key={row.star} className="border-b last:border-0">
                  <td className="px-2.5 py-1.5 font-medium">
                    {row.star}→{row.star + 1}성
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{attempts}</td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{row.success || '-'}</td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{row.fail || '-'}</td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{row.destroy || '-'}</td>
                  <td
                    className={`px-2.5 py-1.5 text-right font-medium ${
                      theoretical ? getLuckColor(actualSuccess, theoretical.success, true) : ''
                    }`}
                  >
                    {formatPercent(actualSuccess)}
                    {theoretical && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({formatPercent(theoretical.success)})
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2.5 py-1.5 text-right font-medium ${
                      theoretical ? getLuckColor(actualDestroy, theoretical.destroy, false) : ''
                    }`}
                  >
                    {formatPercent(actualDestroy)}
                    {theoretical && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({formatPercent(theoretical.destroy)})
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasUnratedStar && (
        <p className="text-xs text-muted-foreground">
          30성 이상은 이론 확률 출처(나무위키)에 값이 없어 이론 확률 없이 실제 횟수만 표시됩니다.
        </p>
      )}
    </div>
  )
}

const NEXT_GRADE: Record<PotentialGrade, PotentialGrade | null> = {
  레어: '에픽',
  에픽: '유니크',
  유니크: '레전드리',
  레전드리: null,
}

function gradeRangeLabel(grade: PotentialGrade): string {
  const next = NEXT_GRADE[grade]
  return next ? `${grade} → ${next}` : `${grade} (최고 등급)`
}

function GradeUpTable({ rows }: { rows: GradeUpRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">잠재능력/큐브 등급업 확률 (실제 / 이론)</p>
        <p className="text-sm text-muted-foreground">표시할 이력이 없습니다.</p>
      </div>
    )
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category, 'ko')
    return gradeRank(a.grade) - gradeRank(b.grade)
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">잠재능력/큐브 등급업 확률 (실제 / 이론)</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-2.5 py-1.5 text-left font-medium">종류</th>
              <th className="px-2.5 py-1.5 text-left font-medium">등급 구간</th>
              <th className="px-2.5 py-1.5 text-right font-medium">시도</th>
              <th className="px-2.5 py-1.5 text-right font-medium">등급업</th>
              <th className="px-2.5 py-1.5 text-right font-medium">확률</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const actualRate = row.attempts > 0 ? row.gradeUps / row.attempts : 0
              return (
                <tr key={`${row.category}|${row.grade}`} className="border-b last:border-0">
                  <td className="px-2.5 py-1.5">{row.category}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{gradeRangeLabel(row.grade)}</td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{row.attempts}</td>
                  <td className="px-2.5 py-1.5 text-right text-muted-foreground">{row.gradeUps || '-'}</td>
                  <td
                    className={`px-2.5 py-1.5 text-right font-medium ${
                      row.theoreticalRate != null ? getLuckColor(actualRate, row.theoreticalRate, true) : ''
                    }`}
                  >
                    {row.theoreticalRate != null ? (
                      <>
                        {formatPercent(actualRate)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({formatPercent(row.theoreticalRate)})
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">등급업 불가</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        등급업 여부는 재설정 이후 첫 번째 옵션 줄의 등급이 이전 등급보다 높은지로 판단합니다
        (아이템의 잠재능력 등급은 항상 첫 줄 등급과 같음). "등급업 불가"는 이미 최고
        등급(레전드리)이거나, 그 큐브/재설정 종류가 애초에 그 등급까지밖에 못 만드는 경우입니다
        (예: 브론즈 에디셔널 큐브는 에픽까지만 가능 — 그 이상 등급에서 시도가 잡힌 건 이전에 다른
        방식으로 에픽 이상을 만든 아이템을 이 큐브로 계속 굴린 경우로 추정). 이름은 확인했지만
        넥슨 공식 확률표와 아예 매칭 못 한 큐브 종류는 애초에 이 표에 나타나지 않습니다(횟수는
        위 "가격 미반영 큐브 종류" 안내에서 확인 가능).
      </p>
    </div>
  )
}

interface AggregateTabProps {
  apiKey: string
  startDate: string
  endDate: string
  status: AggregateStatus
  progress: AggregateProgress
  result: ProbabilityAggregateResult | null
  error: Error | null
  run: (apiKey: string, startDate: string, endDate: string) => void
}

type AggregateSubTab = 'all' | 'starforce' | 'potential-cube'

/** "다시 불러오기" is a manual refresh — the first load happens
 * automatically when the 모아보기 tab is first entered (see
 * `probability-page.tsx`'s auto-fetch `useEffect`). For a wide date range
 * this can still mean hundreds of concurrent Nexon requests (one per
 * calendar day, `DATE_FETCH_CONCURRENCY`-limited — see
 * `lib/nexon-history-range.ts`), unlike the other tabs' smaller per-click
 * batches. See docs/planning/features/probability.md's "모아보기"/
 * "날짜 구간 조회" sections for the pricing-scope rationale — 스타포스
 * (공식 계산, 자체 아이템 레벨 DB 필요)와 잠재능력 재설정(나무위키
 * 가격표)만 값이 매겨지고, 큐브는 항상 count-only.
 *
 * `useProbabilityAggregate()` is called by the parent (`probability-
 * page.tsx`), not here — Radix `Tabs.Content` unmounts this component
 * whenever another tab is active, so owning the hook here would throw away
 * the result (and force a full re-fetch) every time the user switched tabs
 * and came back. Lifting it to the page, which never unmounts, keeps the
 * aggregate result alive across tab switches. */
export function AggregateTab({ apiKey, startDate, endDate, status, progress, result, error, run }: AggregateTabProps) {
  const [subTab, setSubTab] = useState<AggregateSubTab>('all')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          선택한 조회 구간({endDate} ~ {startDate})의 스타포스/잠재능력/큐브 이력을 전부 불러와
          아이템별·캐릭터별로 합산합니다. 구간이 넓으면 다소 시간이 걸릴 수 있어요. 이 탭에 처음 들어오면
          자동으로 한 번 불러옵니다.
        </p>
        <div>
          <Button type="button" onClick={() => run(apiKey, startDate, endDate)} disabled={status === 'loading'}>
            {status === 'loading' ? '불러오는 중...' : '다시 불러오기'}
          </Button>
        </div>
        {status === 'loading' && (
          <p className="text-xs text-muted-foreground">
            스타포스 {progress.starforce}% · 잠재능력 {progress.potential}% · 큐브 {progress.cube}% 조회 중
          </p>
        )}
      </div>

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>{error?.message ?? '집계 중 오류가 발생했습니다.'}</AlertDescription>
        </Alert>
      )}

      {status === 'done' && result && (
        <Tabs value={subTab} onValueChange={(value) => setSubTab(value as AggregateSubTab)}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="starforce">스타포스</TabsTrigger>
            <TabsTrigger value="potential-cube">잠재능력/큐브</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex flex-col gap-4 pt-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">추정 사용 메소</p>
              <p className="text-2xl font-bold text-primary">
                {formatKoreanNumber(result.total.estimatedMesoSpent)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                스타포스 {result.total.starforceAttempts.toLocaleString('ko-KR')}회 · 잠재능력{' '}
                {result.total.potentialAttempts.toLocaleString('ko-KR')}회 · 큐브{' '}
                {result.total.cubeAttempts.toLocaleString('ko-KR')}회
              </p>
              {result.total.cubeAppraisalCost > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  감정 비용(별도 합산): {formatKoreanNumber(result.total.cubeAppraisalCost)}
                </p>
              )}
            </div>

            {result.failures.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {result.failures.length}개 날짜 조회에 실패해 위 합계가 실제보다 적게 집계됐을 수 있습니다.
                  날짜 범위를 좁혀서 다시 집계해보세요.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-xs">
                <strong>스타포스</strong>는 공식 계산 비용(레벨별 강화 비용표, 파괴 방지 추가 비용 미반영)이고
                <strong> 잠재능력 재설정</strong>은 나무위키 가격표 기준 추정치입니다. 스타포스 비용은 자체
                수집한 아이템 레벨 DB에 등록된 아이템만 계산되며, 아직 등록 안 된 아이템은 시도 횟수만
                집계됩니다. 주문서(강화권)를 사용한 강화는 메소가 들지 않고 항상 성공하므로 비용·확률
                집계에서 제외하고 사용 횟수만 별도로 셉니다. <strong>큐브</strong> 자체(이벤트성 큐브)의
                가격은 매길 근거가 없어 제외했지만, 큐브 사용 시 아이템 레벨에 따라 붙는{' '}
                <strong>감정 비용</strong>은 별도로 계산해 위 "추정 사용 메소"와는 합산하지 않고 따로
                표시합니다. 가격표는 나무위키 등 커뮤니티 자료 기준(2026-09-21~22 조회) 스냅샷이라 실제
                인게임 가격과 다를 수 있습니다.
                {result.starforceItemsMissingLevel.size > 0 && (
                  <>
                    {' '}
                    레벨 미확인 아이템: {Array.from(result.starforceItemsMissingLevel).join(', ')}
                  </>
                )}
                {result.unpricedCubeTypes.size > 0 && (
                  <> 가격 미반영 큐브 종류: {Array.from(result.unpricedCubeTypes).join(', ')}</>
                )}
              </AlertDescription>
            </Alert>

            <StatTable title="캐릭터별 합산" rows={sortRows(result.byCharacter)} />
            <StatTable title="아이템별 합산" rows={sortRows(result.byItem)} />
            <StarforceStarTable starforceByStar={result.starforceByStar} />
            <GradeUpTable rows={result.gradeUpRows} />
          </TabsContent>

          <TabsContent value="starforce" className="pt-4">
            {result.scrollUsage.size > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                주문서 사용:{' '}
                {Array.from(result.scrollUsage.entries())
                  .map(([name, count]) => `${name} ×${count}`)
                  .join(', ')}
              </p>
            )}
            <StarforceCardGrid cards={result.starforceCards} />
          </TabsContent>

          <TabsContent value="potential-cube" className="pt-4">
            <PotentialCubeCardGrid cards={result.potentialCubeCards} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
