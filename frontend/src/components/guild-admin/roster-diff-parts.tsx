/** 명단 변동 결과를 그리는 조각들 — 색 구분 카드, 요약 타일, 길드별 흐름, 사람 단위 목록.
 *
 * 닉네임 변경·가입·탈퇴·연합 내 이동이 한 화면에 같이 나와서 글자만으로는 가르기 어려웠다
 * (2026-10-04 사용자 요청). 종류마다 색을 하나씩 정해 요약 타일, 카드 머리, 길드 칩에 같은 색을
 * 쓴다: 가입 초록 · 탈퇴 빨강 · 연합 내 이동 파랑 · 닉네임 변경 보라 · 일부 회색 · 추적 불가 노랑.
 */

import { useMemo, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { headCount, TONE, type Tone } from '@/components/guild-admin/roster-diff-tone'
import { clusterByPerson, type HeadCount } from '@/lib/guild-roster-diff'

/** 그 섹션으로 스크롤한다. 접힌 카드(`<details>`)면 펼친 뒤 옮긴다. */
function jumpTo(targetId: string) {
  const target = document.getElementById(targetId)
  if (!target) return
  if (target instanceof HTMLDetailsElement) target.open = true
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 요약 타일 — 큰 숫자 하나와 작은 설명. `targetId`가 있으면 누르면 그 섹션으로 옮겨 간다
 * (2026-10-04 사용자 요청). 섹션이 안 그려진 경우(0건)는 누를 수 없다. */
export function StatTile({
  tone,
  icon: Icon,
  label,
  value,
  sub,
  targetId,
}: {
  tone: Tone
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  targetId?: string
}) {
  const content = (
    <>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${TONE[tone].accent}`}>
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-2xl leading-none font-semibold tabular-nums">{value}</span>
      <span className="min-h-4 text-xs text-muted-foreground">{sub ?? ''}</span>
    </>
  )
  if (!targetId) {
    return <div className={`flex flex-col gap-1 rounded-lg border p-3 ${TONE[tone].tile}`}>{content}</div>
  }
  return (
    <button
      type="button"
      onClick={() => jumpTo(targetId)}
      title={`${label} 목록으로 이동`}
      className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${TONE[tone].tile}`}
    >
      {content}
    </button>
  )
}

/** 색 머리가 붙은 카드. `collapsible`이면 머리를 눌러 접고 편다(기본 접힘). */
export function SectionCard({
  id,
  tone,
  icon: Icon,
  title,
  count,
  description,
  collapsible = false,
  children,
}: {
  /** 요약 타일이 옮겨 갈 자리. */
  id?: string
  tone: Tone
  icon: LucideIcon
  title: string
  count?: string
  description?: ReactNode
  collapsible?: boolean
  children: ReactNode
}) {
  const header = (
    <span className="flex flex-wrap items-center gap-2">
      <Icon className="size-4 shrink-0" />
      <span className="font-semibold">{title}</span>
      {count && (
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
      )}
    </span>
  )
  const body = (
    <div className="flex flex-col gap-3 p-3">
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  )
  if (collapsible) {
    return (
      <details id={id} className="scroll-mt-20 overflow-hidden rounded-lg border">
        <summary className={`cursor-pointer border-b px-3 py-2.5 text-sm ${TONE[tone].header}`}>{header}</summary>
        {body}
      </details>
    )
  }
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-lg border">
      <div className={`border-b px-3 py-2.5 text-sm ${TONE[tone].header}`}>{header}</div>
      {body}
    </section>
  )
}

/** 길드별로 몇 명 오갔는지 — 칩으로. 많은 길드부터. */
export function GuildChips({
  tone,
  label,
  rows,
}: {
  tone: Tone
  label: string
  rows: { guildName: string; count: HeadCount }[]
}) {
  const shown = rows.filter((row) => row.count.characters > 0).sort((a, b) => b.count.people - a.count.people)
  if (shown.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {shown.slice(0, 12).map((row) => (
        <span key={row.guildName} className={`rounded-full border px-2 py-0.5 text-xs ${TONE[tone].chip}`}>
          {row.guildName} <span className="font-semibold tabular-nums">{headCount(row.count)}</span>
        </span>
      ))}
      {shown.length > 12 && <span className="text-xs text-muted-foreground">외 {shown.length - 12}곳</span>}
    </div>
  )
}

interface Character {
  characterName: string
  level: number | null
}

function PersonItem<T extends Character>({
  entries,
  main,
  collapse,
  renderDetail,
}: {
  entries: T[]
  main: string
  collapse: boolean
  renderDetail: (entry: T) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  // 메인을 맨 앞에, 나머지는 레벨 높은 순.
  const ordered = [...entries].sort((a, b) =>
    a.characterName === main ? -1 : b.characterName === main ? 1 : (b.level ?? 0) - (a.level ?? 0),
  )
  const [first, ...rest] = ordered
  const showRest = !collapse || open
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{first.characterName}</span>
        {first.level !== null && <span className="text-xs text-muted-foreground tabular-nums">Lv.{first.level}</span>}
        {renderDetail(first)}
        <span className="grow" />
        {rest.length > 0 &&
          (collapse ? (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {open ? '접기' : `+${rest.length}캐릭`}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">1명 · {entries.length}캐릭</span>
          ))}
      </div>
      {showRest && rest.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 border-l-2 pl-3">
          {rest.map((entry) => (
            <li key={entry.characterName} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="text-foreground">{entry.characterName}</span>
              {entry.level !== null && <span className="tabular-nums">Lv.{entry.level}</span>}
              {renderDetail(entry)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** 사람 단위로 묶은 목록. `collapse`면 사람마다 메인 캐릭터 한 줄만 보이고 `+N캐릭`으로 편다. */
export function PersonList<T extends Character>({
  entries,
  groups,
  mainOf,
  collapse = false,
  renderDetail,
  empty = '없습니다.',
}: {
  entries: T[]
  groups: { id: string; members: string[] }[] | null
  /** 그 캐릭터가 속한 사람의 메인(대표) 이름. 모르면 `null`. */
  mainOf: (name: string) => string | null
  collapse?: boolean
  renderDetail: (entry: T) => ReactNode
  empty?: string
}) {
  const clusters = useMemo(() => clusterByPerson(entries, groups), [entries, groups])
  if (clusters.length === 0) return <p className="px-1 text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y rounded-md border bg-background">
      {clusters.map((cluster) => {
        const names = cluster.entries.map((entry) => entry.characterName)
        const representative = mainOf(names[0])
        // 대표가 이 묶음에 없으면(그룹에서 이미 빠졌거나 대표는 남았거나) 레벨 높은 캐릭터.
        const main =
          representative && names.includes(representative)
            ? representative
            : [...cluster.entries].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0].characterName
        return (
          <PersonItem
            key={cluster.entries[0].characterName}
            entries={cluster.entries}
            main={main}
            collapse={collapse}
            renderDetail={renderDetail}
          />
        )
      })}
    </ul>
  )
}

/** 작은 길드 칩. 가입이면 "어디서", 탈퇴면 "어디로". */
export function GuildTag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE[tone].chip}`}>{children}</span>
}
