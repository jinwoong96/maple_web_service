import { Star, XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { getItemRarityColors } from '@/lib/item-rarity'
import { getMaxStarforce } from '@/lib/starforce'
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api-types'

type ItemEquipmentPiece = components['schemas']['ItemEquipmentPiece']
type CashItemEquipmentPiece = components['schemas']['CashItemEquipmentPiece']

// Confirmed against 3 real in-game tooltip screenshots — see
// docs/planning/features/character.md's "Item tooltip content". This order
// does not match ItemOptionSummary's field declaration order.
const FIELD_ORDER = [
  'str',
  'dex',
  'int',
  'luk',
  'all_stat',
  'max_hp',
  'max_mp',
  'attack_power',
  'magic_power',
  'armor',
  'speed',
  'jump',
  'damage',
  'boss_damage',
  'ignore_monster_armor',
  'max_hp_rate',
  'max_mp_rate',
  'equipment_level_decrease',
] as const

const FIELD_LABEL: Record<(typeof FIELD_ORDER)[number], string> = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  all_stat: '올스탯',
  max_hp: '최대 HP',
  max_mp: '최대 MP',
  attack_power: '공격력',
  magic_power: '마력',
  armor: '방어력',
  speed: '이동속도',
  jump: '점프력',
  damage: '데미지',
  boss_damage: '보스 몬스터 데미지',
  ignore_monster_armor: '몬스터 방어율 무시',
  max_hp_rate: '최대 HP',
  max_mp_rate: '최대 MP',
  equipment_level_decrease: '장비 레벨 감소',
}

const PERCENT_FIELDS = new Set<(typeof FIELD_ORDER)[number]>([
  'all_stat',
  'boss_damage',
  'ignore_monster_armor',
  'damage',
  'max_hp_rate',
  'max_mp_rate',
])

function getFieldValue(option: Record<string, unknown> | null | undefined, field: string): number {
  if (!option) return 0
  const raw = option[field]
  if (raw == null) return 0
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

interface StatRow {
  field: string
  label: string
  total: number
  base: number
  starforce: number
  etc: number
  add: number
  isPercent: boolean
}

function buildStatRows(item: ItemEquipmentPiece): StatRow[] {
  const total = item.item_total_option as Record<string, unknown> | null | undefined
  const base = item.item_base_option as Record<string, unknown> | null | undefined
  const starforce = item.item_starforce_option as Record<string, unknown> | null | undefined
  const etc = item.item_etc_option as Record<string, unknown> | null | undefined
  const add = item.item_add_option as Record<string, unknown> | null | undefined

  const rows: StatRow[] = []
  for (const field of FIELD_ORDER) {
    const totalValue = getFieldValue(total, field)
    if (totalValue === 0) continue
    rows.push({
      field,
      label: FIELD_LABEL[field],
      total: totalValue,
      base: getFieldValue(base, field),
      starforce: getFieldValue(starforce, field),
      etc: getFieldValue(etc, field),
      add: getFieldValue(add, field),
      isPercent: PERCENT_FIELDS.has(field),
    })
  }
  return rows
}

interface CollapsedLine {
  label: string
  value: string
}

/** Renders one option object (e.g. item_exceptional_option) as a list of
 * lines, collapsing STR/DEX/INT/LUK into "올스탯" and 최대 HP/최대 MP or
 * 공격력/마력 into one "A / B" line when their values match — confirmed
 * against this character's own 벨트 data. Only used for 익셉셔널 today;
 * not applied to the main per-field stat breakdown (untested there). */
function buildCollapsedLines(option: Record<string, unknown> | null | undefined): CollapsedLine[] {
  const lines: CollapsedLine[] = []
  const str = getFieldValue(option, 'str')
  const dex = getFieldValue(option, 'dex')
  const int_ = getFieldValue(option, 'int')
  const luk = getFieldValue(option, 'luk')
  if (str !== 0 && str === dex && str === int_ && str === luk) {
    lines.push({ label: '올스탯', value: `+${str}` })
  } else {
    if (str) lines.push({ label: 'STR', value: `+${str}` })
    if (dex) lines.push({ label: 'DEX', value: `+${dex}` })
    if (int_) lines.push({ label: 'INT', value: `+${int_}` })
    if (luk) lines.push({ label: 'LUK', value: `+${luk}` })
  }

  const maxHp = getFieldValue(option, 'max_hp')
  const maxMp = getFieldValue(option, 'max_mp')
  if (maxHp !== 0 && maxHp === maxMp) {
    lines.push({ label: '최대 HP / 최대 MP', value: `+${maxHp}` })
  } else {
    if (maxHp) lines.push({ label: '최대 HP', value: `+${maxHp}` })
    if (maxMp) lines.push({ label: '최대 MP', value: `+${maxMp}` })
  }

  const attackPower = getFieldValue(option, 'attack_power')
  const magicPower = getFieldValue(option, 'magic_power')
  if (attackPower !== 0 && attackPower === magicPower) {
    lines.push({ label: '공격력 / 마력', value: `+${attackPower}` })
  } else {
    if (attackPower) lines.push({ label: '공격력', value: `+${attackPower}` })
    if (magicPower) lines.push({ label: '마력', value: `+${magicPower}` })
  }

  return lines
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

function StarforceStars({ current, max }: { current: number; max: number }) {
  if (max <= 0) return null
  const stars = Array.from({ length: max }, (_, i) => i < current)
  const rows = max > 15 ? [stars.slice(0, 15), stars.slice(15)] : [stars]

  return (
    <div className="flex flex-col items-center gap-1">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-2">
          {chunk(row, 5).map((group, groupIndex) => (
            <div key={groupIndex} className="flex gap-px">
              {group.map((filled, i) => (
                <Star
                  key={i}
                  className="h-[11px] w-[11px]"
                  fill={filled ? '#f59e0b' : 'none'}
                  stroke={filled ? '#f59e0b' : 'oklch(0.85 0 0)'}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function StatRowLine({ row }: { row: StatRow }) {
  const unit = row.isPercent ? '%' : ''
  const showBreakdown = row.starforce !== 0 || row.etc !== 0 || row.add !== 0

  return (
    <div className="flex gap-3.5">
      <span className="w-[92px] shrink-0">{row.label}</span>
      <span>
        +{row.total}
        {unit}
        {showBreakdown && (
          <>
            {' ('}
            {row.base}
            {unit}
            {row.starforce !== 0 && (
              <span className="text-amber-600">
                {' '}
                +{row.starforce}
                {unit}
              </span>
            )}
            {row.etc !== 0 && (
              <span className="text-slate-600">
                {' '}
                +{row.etc}
                {unit}
              </span>
            )}
            {row.add !== 0 && (
              <span className="text-teal-600">
                {' '}
                +{row.add}
                {unit}
              </span>
            )}
            )
          </>
        )}
      </span>
    </div>
  )
}

function PotentialBlock({
  label,
  grade,
  lines,
}: {
  label: string
  grade: string | null | undefined
  lines: (string | null | undefined)[]
}) {
  const filtered = lines.filter((line): line is string => Boolean(line))
  if (filtered.length === 0) return null
  const rarity = getItemRarityColors(grade)

  return (
    <div className="flex flex-col gap-1 border-t pt-2.5">
      <p className={cn('text-xs font-semibold', rarity.text)}>
        {label}: {grade ?? '-'}
      </p>
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {filtered.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  )
}

/** Shared wide/white modal card shell — the default shadcn `DialogContent`
 * is centered but sized for forms, not a stat-heavy detail card, so this
 * bypasses it and uses `DialogPrimitive` directly. Always centered on
 * screen (was an anchored `Popover` — anchoring near a viewport edge could
 * push/clip the content, which is what made the cash-item popover seem to
 * not open at all; a centered modal has no such edge case). Closes on
 * outside click/Escape by default, has an explicit X. `title` is a
 * screen-reader-only label (Radix requires a `Dialog.Title`); the visible
 * name is rendered separately inside `children`. Reused by
 * symbol-list.tsx too. */
export function RichDialogContent({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[340px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card p-3.5 text-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">
          {title} 상세 옵션 정보
        </DialogPrimitive.Description>
        {/* Closes on any click inside the card too, not just the overlay/X —
         * requested so re-clicking the item (which visually sits right
         * behind the modal) dismisses it instead of doing nothing. */}
        <DialogPrimitive.Close asChild>
          <div>{children}</div>
        </DialogPrimitive.Close>
        <DialogPrimitive.Close className="absolute top-3 right-3 rounded-sm text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
          <span className="sr-only">닫기</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

interface SimpleDetailTooltipProps {
  /** sr-only dialog title — see `RichDialogContent`. */
  title: string
  iconUrl?: string | null
  name: string
  /** Small line under the name — e.g. a level or nickname/type. */
  subtitle?: string | null
  description?: string | null
  children: React.ReactNode
}

/** Single-block detail modal for things that are just "an icon, a name, and
 * a description" — 칭호/훈장/반지 스킬/안드로이드/펫, none of which have
 * stat breakdowns or options like equipment/cash items do. Reused by
 * `equipment-tab.tsx` and `cash-tab.tsx`. */
export function SimpleDetailTooltip({
  title,
  iconUrl,
  name,
  subtitle,
  description,
  children,
}: SimpleDetailTooltipProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <RichDialogContent title={title}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            {iconUrl && <img src={iconUrl} alt={name} className="h-10 w-10 shrink-0" />}
            <div>
              <p className="text-sm font-semibold">{name}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {description && (
            <p className="border-t pt-2.5 text-xs whitespace-pre-line text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}

interface EquipmentItemTooltipProps {
  item: ItemEquipmentPiece
  children: React.ReactNode
}

/** Full item tooltip — starforce stars, stat breakdown, potential,
 * additional potential, exceptional, soul. See docs/planning/features/
 * character.md's "Item tooltip content" for the field-by-field rationale. */
export function EquipmentItemTooltip({ item, children }: EquipmentItemTooltipProps) {
  const rarity = getItemRarityColors(item.potential_option_grade)
  const starforce = Number(item.starforce ?? 0)
  const maxStars = getMaxStarforce(item.item_base_option?.base_equipment_level)
  const statRows = buildStatRows(item)
  const exceptionalLines = buildCollapsedLines(
    item.item_exceptional_option as Record<string, unknown> | null | undefined,
  )
  const exceptionalCount = item.item_exceptional_option?.exceptional_upgrade ?? 0

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <RichDialogContent title={item.item_name}>
        <div className="flex flex-col gap-2.5">
          <StarforceStars current={starforce} max={maxStars} />

          <div className="flex items-center gap-2.5">
            {item.item_icon && (
              <img src={item.item_icon} alt={item.item_name} className="h-10 w-10 shrink-0" />
            )}
            <div>
              <p className={cn('text-sm font-semibold', rarity.text)}>{item.item_name}</p>
              {item.potential_option_grade && (
                <p className="text-xs text-muted-foreground">
                  {item.potential_option_grade} 잠재능력
                </p>
              )}
            </div>
          </div>

          {statRows.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
              {statRows.map((row) => (
                <StatRowLine key={row.field} row={row} />
              ))}
            </div>
          )}

          <PotentialBlock
            label="잠재능력"
            grade={item.potential_option_grade}
            lines={[item.potential_option_1, item.potential_option_2, item.potential_option_3]}
          />
          <PotentialBlock
            label="에디셔널 잠재능력"
            grade={item.additional_potential_option_grade}
            lines={[
              item.additional_potential_option_1,
              item.additional_potential_option_2,
              item.additional_potential_option_3,
            ]}
          />

          {exceptionalLines.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2.5">
              <p className="text-xs font-semibold text-red-600">
                익셉셔널: {exceptionalCount}회 (최대 1회)
              </p>
              <div className="flex flex-col gap-0.5 text-xs text-red-600">
                {exceptionalLines.map((line) => (
                  <div key={line.label}>
                    {line.label} {line.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.soul_name && (
            <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
              <p className="font-medium">소울: {item.soul_name}</p>
              {item.soul_option && <p className="text-muted-foreground">{item.soul_option}</p>}
            </div>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}

/** `date_option_expire` comes back as e.g. `2026-11-04T17:00+09:00` — the
 * real in-game tooltip shows it as `2026년 11월 4일 17시 00분 (연장 불가)`,
 * confirmed from 2 reference screenshots (both 마스터라벨 items). "(연장
 * 불가)" is shown as a fixed suffix here since both examples had it, but
 * the API gives no field to tell renewable items apart — see
 * REVIEW_NOTES.md. Parsed as a plain string (not `Date`) since the offset
 * is always `+09:00` (KST, same as every other Nexon timestamp) and this
 * sidesteps the viewer's browser timezone entirely. */
function formatExpiry(isoDateTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoDateTime)
  if (!match) return isoDateTime
  const [, year, month, day, hour, minute] = match
  return `${year}년 ${Number(month)}월 ${Number(day)}일 ${hour}시 ${minute}분`
}

interface CashItemTooltipProps {
  item: CashItemEquipmentPiece
  children: React.ReactNode
}

/** Simpler cash-item variant — no rarity, no starforce, no potential/
 * exceptional/soul (CashItemEquipmentPiece doesn't carry any of those
 * fields), just the flat option list + expiry. Confirmed against 2
 * reference screenshots (마스터라벨 cash weapon, with and without stat
 * options) — layout matches, but the real tooltip also shows a combat-power
 * delta, 세트 효과, and 착용 직업, none of which the API returns, so those
 * are left out; see REVIEW_NOTES.md. */
export function CashItemTooltip({ item, children }: CashItemTooltipProps) {
  const options = item.cash_item_option ?? []
  const expiry = item.date_option_expire ? formatExpiry(item.date_option_expire) : null

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <RichDialogContent title={item.cash_item_name}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <img src={item.cash_item_icon} alt={item.cash_item_name} className="h-10 w-10 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{item.cash_item_name}</p>
              {item.cash_item_label && (
                <p className="text-xs font-medium text-violet-600">{item.cash_item_label}</p>
              )}
              {item.cash_item_description && (
                <p className="text-xs text-muted-foreground">{item.cash_item_description}</p>
              )}
            </div>
          </div>

          {options.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
              {options.map((option) => (
                <div key={option.option_type} className="flex gap-3.5">
                  <span className="w-[60px] shrink-0 text-muted-foreground">
                    {option.option_type}
                  </span>
                  <span>+{option.option_value}</span>
                </div>
              ))}
            </div>
          )}

          {expiry && (
            <p className="border-t pt-2.5 text-[11px] text-muted-foreground">
              능력치 유효 기간: {expiry} (연장 불가)
            </p>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}
