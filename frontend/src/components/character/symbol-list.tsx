import { RichDialogContent } from '@/components/character/equipment-tooltip'
import { ItemCardGrid } from '@/components/character/item-card'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { getSymbolLevelCap } from '@/lib/symbol-level-cap'
import type { components } from '@/lib/api-types'

type SymbolEquipment = components['schemas']['SymbolEquipment']

function getSymbolGroup(name: string): string {
  const separatorIndex = name.indexOf(' : ')
  return separatorIndex === -1 ? name : name.slice(0, separatorIndex)
}

function getSymbolRegion(name: string): string {
  const separatorIndex = name.indexOf(' : ')
  return separatorIndex === -1 ? name : name.slice(separatorIndex + 3)
}

function getSymbolForceLabel(group: string): string {
  return group.startsWith('아케인심볼') ? 'ARC' : 'AUT'
}

function isZeroRate(rate: string | null | undefined): boolean {
  return !rate || rate === '0%'
}

const STAT_FIELDS = [
  ['symbol_str', 'STR'],
  ['symbol_dex', 'DEX'],
  ['symbol_int', 'INT'],
  ['symbol_luk', 'LUK'],
  ['symbol_hp', 'HP'],
] as const

/** 아케인심볼/어센틱심볼 grant one main stat (STR/DEX/INT/LUK, matching the
 * character's class) or HP; 그랜드 어센틱심볼 grants none (all four zero) and
 * carries the 경험치/메소/드롭률 rates instead — confirmed from live API
 * data across 3 classes (메카닉=DEX, 라라=INT, 은월=STR). At most one field
 * is ever non-zero. */
function getSymbolStatLine(symbol: SymbolEquipment): { label: string; value: string } | null {
  for (const [field, label] of STAT_FIELDS) {
    const value = symbol[field]
    if (value && value !== '0') return { label, value }
  }
  return null
}

interface SymbolListProps {
  symbols: SymbolEquipment[]
}

/** Groups `symbol[]` by name prefix (region split on `" : "`) into its
 * buckets — confirmed 3 in the sample data: 아케인심볼, 어센틱심볼, 그랜드
 * 어센틱심볼. See docs/planning/features/character.md's "Symbol tooltip
 * content". */
export function SymbolList({ symbols }: SymbolListProps) {
  if (symbols.length === 0) return null

  const groups = new Map<string, SymbolEquipment[]>()
  for (const symbol of symbols) {
    const group = getSymbolGroup(symbol.symbol_name)
    const list = groups.get(group)
    if (list) {
      list.push(symbol)
    } else {
      groups.set(group, [symbol])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {group} (Lv.{items[0]?.symbol_level})
          </p>
          <ItemCardGrid>
            {items.map((symbol) => (
              <SymbolCard key={symbol.symbol_name} symbol={symbol} />
            ))}
          </ItemCardGrid>
        </div>
      ))}
    </div>
  )
}

/** Mirrors `item-card.tsx`'s `ItemCard` shell (icon + name/subtitle + badge
 * row) for the same "see the basics before opening the modal" reason, but
 * as its own component — symbols don't have equipment's rarity/starforce/
 * potential/exceptional concepts, so they don't map onto `ItemCard`'s
 * props. Badges: level (or MAX), the main-stat bonus if any, and the
 * force value if any — 그랜드 어센틱심볼 (no stat, has force) still gets a
 * badge row from the force value alone. */
function SymbolCard({ symbol }: { symbol: SymbolEquipment }) {
  const group = getSymbolGroup(symbol.symbol_name)
  const cap = getSymbolLevelCap(group)
  const forceLabel = getSymbolForceLabel(group)
  const isMax = symbol.symbol_level >= cap
  const requireCount = symbol.symbol_require_growth_count ?? 0
  const growthPercent =
    requireCount > 0 ? Math.round(((symbol.symbol_growth_count ?? 0) / requireCount) * 100) : 0

  const statLine = getSymbolStatLine(symbol)
  const rates: { label: string; value: string }[] = []
  if (!isZeroRate(symbol.symbol_exp_rate)) {
    rates.push({ label: '경험치 획득량', value: symbol.symbol_exp_rate! })
  }
  if (!isZeroRate(symbol.symbol_meso_rate)) {
    rates.push({ label: '메소 획득량', value: symbol.symbol_meso_rate! })
  }
  if (!isZeroRate(symbol.symbol_drop_rate)) {
    rates.push({ label: '아이템 드롭률', value: symbol.symbol_drop_rate! })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-accent"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-muted/40">
            {symbol.symbol_icon && (
              <img src={symbol.symbol_icon} alt={symbol.symbol_name} className="h-9 w-9" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div>
              <p className="line-clamp-1 text-sm font-medium">{getSymbolRegion(symbol.symbol_name)}</p>
              <p className="text-xs text-muted-foreground">{group}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {isMax ? 'MAX' : `Lv.${symbol.symbol_level}`}
              </span>
              {statLine && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {statLine.label} +{statLine.value}
                </span>
              )}
              {symbol.symbol_force && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {forceLabel}+{symbol.symbol_force}
                </span>
              )}
            </div>
          </div>
        </button>
      </DialogTrigger>
      <RichDialogContent title={symbol.symbol_name}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            {symbol.symbol_icon && (
              <img src={symbol.symbol_icon} alt={symbol.symbol_name} className="h-10 w-10" />
            )}
            <p className="text-sm font-semibold">{symbol.symbol_name}</p>
          </div>

          <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
            <div className="flex gap-3.5">
              <span className="w-[70px] shrink-0 text-muted-foreground">성장 레벨</span>
              <span>
                {isMax
                  ? `Lv.${symbol.symbol_level} EXP : MAX`
                  : `Lv.${symbol.symbol_level} EXP: ${symbol.symbol_growth_count ?? 0}/${requireCount} (${growthPercent}%)`}
              </span>
            </div>
            {statLine && (
              <div className="flex gap-3.5">
                <span className="w-[70px] shrink-0 text-muted-foreground">{statLine.label}</span>
                <span>+{statLine.value}</span>
              </div>
            )}
            {symbol.symbol_force && (
              <div className="flex gap-3.5">
                <span className="w-[70px] shrink-0 text-muted-foreground">{forceLabel}</span>
                <span>+{symbol.symbol_force}</span>
              </div>
            )}
            {rates.map((rate) => (
              <div key={rate.label} className="flex gap-3.5">
                <span className="w-[70px] shrink-0 text-muted-foreground">{rate.label}</span>
                <span>+{rate.value}</span>
              </div>
            ))}
          </div>

          {symbol.symbol_other_effect_description && (
            <p className="border-t pt-2.5 text-[11px] text-muted-foreground">
              {symbol.symbol_other_effect_description}
            </p>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}
