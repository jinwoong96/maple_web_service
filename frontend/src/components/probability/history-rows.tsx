import { formatHistoryTimestamp } from '@/lib/format-time'
import { getItemRarityColors } from '@/lib/item-rarity'
import { formatKoreanNumber } from '@/lib/korean-number'
import type {
  CubeHistoryEntry,
  PotentialHistoryEntry,
  PotentialOptionEntry,
  StarforceHistoryEntry,
} from '@/lib/nexon-probability-types'
import { getStarforceEntryCost, isScrollBasedStarforceEntry } from '@/lib/probability-cost-reference'

// "성공"/"실패"/"실패(유지)" confirmed live (2026-09-21, across cube and
// starforce history) — other Nexon result strings (e.g. a starforce 파괴)
// still aren't confirmed, so unknown values just fall through with no
// color rather than guessing. See docs/planning/features/probability.md's
// "Known debt" section.
const RESULT_COLOR: Record<string, string> = {
  성공: 'text-emerald-600',
  실패: 'text-muted-foreground',
  '실패(유지)': 'text-muted-foreground',
}

function UpgradeResultBadge({ result }: { result: string | null }) {
  if (!result) return null
  return (
    <span className={`text-xs font-medium ${RESULT_COLOR[result] ?? 'text-foreground'}`}>{result}</span>
  )
}

export function OptionList({ options }: { options: PotentialOptionEntry[] }) {
  if (options.length === 0) return <span className="text-xs text-muted-foreground">-</span>
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {options.map((option, index) => (
        <span key={index} className={getItemRarityColors(option.grade).text}>
          {option.value}
        </span>
      ))}
    </div>
  )
}

export function StarforceHistoryRow({
  entry,
  itemLevel,
}: {
  entry: StarforceHistoryEntry
  /** The item's required level, for the meso cost formula — `undefined`/
   * `null` when not yet looked up or not found in our reference table (the
   * cost line is simply omitted then, same as a scroll-based entry not
   * needing one). */
  itemLevel?: number | null
}) {
  const timestamp = formatHistoryTimestamp(entry.date_create)
  const hasStarforceCounts =
    entry.before_starforce_count != null || entry.after_starforce_count != null
  const isScroll = isScrollBasedStarforceEntry(entry)
  const cost = getStarforceEntryCost(entry, itemLevel ?? null)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{entry.target_item ?? entry.upgrade_item ?? '알 수 없음'}</span>
        <UpgradeResultBadge result={entry.item_upgrade_result} />
      </div>
      <p className="text-xs text-muted-foreground">
        {[entry.character_name, entry.world_name, timestamp].filter(Boolean).join(' · ')}
      </p>
      {hasStarforceCounts && (
        <p className="text-sm font-medium">
          {entry.before_starforce_count ?? '?'}성 → {entry.after_starforce_count ?? '?'}성
        </p>
      )}
      {isScroll ? (
        <p className="text-xs text-muted-foreground">주문서 사용: {entry.upgrade_item} (메소 소모 없음)</p>
      ) : (
        cost != null && <p className="text-xs text-muted-foreground">강화비용: {formatKoreanNumber(cost)} 메소</p>
      )}
    </div>
  )
}

/** Shared row shape for 잠재능력/큐브 history — `PotentialHistoryEntry`
 * and `CubeHistoryEntry` are identical apart from the `potential_type`/
 * `cube_type` field, passed in separately as `subtitle`. */
export function PotentialCubeHistoryRow({
  entry,
  subtitle,
  appraisalCost,
}: {
  entry: PotentialHistoryEntry | CubeHistoryEntry
  subtitle: string
  /** 큐브 이력에서만 전달 — 아이템 레벨별 감정 비용, 잠재능력 재설정 비용과는
   * 별개로 표시한다(사용자 요청, 2026-09-22). */
  appraisalCost?: number | null
}) {
  const timestamp = formatHistoryTimestamp(entry.date_create)
  const additionalBefore = entry.before_additional_potential_option
  const additionalAfter = entry.after_additional_potential_option

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{entry.target_item ?? '알 수 없음'}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <UpgradeResultBadge result={entry.item_upgrade_result} />
      </div>
      <p className="text-xs text-muted-foreground">
        {[
          entry.character_name,
          entry.item_equipment_part,
          entry.item_level != null ? `Lv.${entry.item_level}` : null,
          timestamp,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {appraisalCost != null && (
        <p className="text-xs text-muted-foreground">감정 비용: {formatKoreanNumber(appraisalCost)} 메소</p>
      )}
      <div className="grid grid-cols-2 gap-3 border-t pt-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">이전</p>
          <OptionList options={entry.before_potential_option} />
          {additionalBefore.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">에디셔널</p>
              <OptionList options={additionalBefore} />
            </>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">이후</p>
          <OptionList options={entry.after_potential_option} />
          {additionalAfter.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">에디셔널</p>
              <OptionList options={additionalAfter} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
