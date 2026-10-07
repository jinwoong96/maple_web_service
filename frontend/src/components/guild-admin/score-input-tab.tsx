import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AttentionList,
  type AttentionCell,
  type AttentionKind,
  type AttentionRow,
} from '@/components/guild-admin/attention-list'
import { ScoreSheetList } from '@/components/guild-admin/score-sheet-list'
import { ScoreStepsBar } from '@/components/guild-admin/score-steps-bar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useGuildGroups, type GuildIdentity } from '@/hooks/use-guild-groups'
import { useOcidResolver } from '@/hooks/use-ocid-resolver'
import { useScoreOcr } from '@/hooks/use-score-ocr'
import { useScoreRecords } from '@/hooks/use-score-records'
import { useScoreSteps } from '@/hooks/use-score-steps'
import { sortAttentionRows } from '@/lib/attention-order'
import { lastDayOfWeek, useWeekRoster } from '@/hooks/use-week-roster'
import {
  fetchProfile,
  narrowByProfile,
  type CharacterProfile,
} from '@/lib/candidate-profile'
import { matchToRoster, recentWeeks, weekStartOf, type NameMatch } from '@/lib/guild-score'
import { truncatedAwareSimilarity } from '@/lib/hangul-similarity'
import { currentNameResolver, GROUPING_SAVED_EVENT, listRenames, representativeName } from '@/lib/grouping-store'
import { claimName, takenRows } from '@/lib/name-claims'
import { resolveRows } from '@/lib/score-resolve'
import { recordKey, type ScoreRecord } from '@/lib/score-records'
import {
  COLUMN_LABEL,
  duplicateSuspects,
  emptyValues,
  MANUAL_GROUP,
  placeByScore,
  newRowId,
  NUMERIC_COLUMNS,
  numberOf,
  numberSignature,
  ORDER_COLUMN,
  rowsFromPaste,
  SCORE_COLUMNS,
  scoreOrderCheck,
  type ScoreColumn,
  type SheetRow,
} from '@/lib/score-sheet'

interface ScoreInputTabProps {
  guild: GuildIdentity
  /** 넥슨 조회용 키. 직업·레벨로 후보를 가려낼 때만 쓴다. */
  apiKey: string
  /** 주차 기록 탭에서 "점수 입력에서 열기"를 누른 기록. `nonce`가 바뀌면 새 요청이다. */
  openRequest: { record: ScoreRecord; nonce: number } | null
}

/** v2: 기본 열을 바꾸면서(레벨·직위 제외) 한 번 새 기본값에서 시작하게 했다. */
const COLUMNS_KEY = 'maple-log:guild-scores:columns:v2'
const OLD_COLUMNS_KEYS = ['maple-log:guild-scores:columns']

/** 처음 쓸 때 고른 상태인 열. 레벨·직위는 주마다 거의 안 바뀌고 점수 비교에도
 * 안 써서 기본에서 뺀다(2026-10-04 사용자 요청). */
const DEFAULT_COLUMNS: readonly ScoreColumn[] = ['job', 'weekly', 'underground', 'flag']

/** 고른 열은 브라우저에 기억한다. */
function loadColumns(): ScoreColumn[] {
  try {
    for (const key of OLD_COLUMNS_KEYS) window.localStorage.removeItem(key)
    const raw = window.localStorage.getItem(COLUMNS_KEY)
    if (!raw) return [...DEFAULT_COLUMNS]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_COLUMNS]
    return SCORE_COLUMNS.filter((column) => parsed.includes(column))
  } catch {
    return [...DEFAULT_COLUMNS]
  }
}

/** 이름 칸이 물고 있을 `<datalist>`의 id. */
const ROSTER_LIST_ID = 'guild-roster-names'

/** 명단에 없는 이름을 쳤을 때 내놓을 닮은 이름 수. */
const SIMILAR_LIMIT = 5

const PICK_KIND: Record<string, AttentionKind> = {
  eliminated: 'eliminated',
  profile: 'profile',
  'same-group': 'same-group',
}

export function ScoreInputTab({ guild, apiKey, openRequest }: ScoreInputTabProps) {
  const { resolve, flush } = useOcidResolver(apiKey)
  const ocr = useScoreOcr()
  const records = useScoreRecords()
  /** 탭 전체. 단계 이동이 이 안에서 칸을 찾는다. */
  const rootRef = useRef<HTMLDivElement>(null)

  const [rows, setRows] = useState<SheetRow[]>([])
  /** 기본은 **지난 주차**(이번 목요일보다 7일 전). 점수는 수요일 자정에 확정돼서 스크린샷은 대개
   * 그 뒤(새 주차가 시작된 다음)에 찍는다(2026-10-04 사용자 요청). */
  const [week, setWeek] = useState(() => {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    return weekStartOf(lastWeek)
  })
  /** 대조할 명단 — 그 주차 마지막 수요일의 길드 명단. 진행 중인 주차면 최신 명단. */
  const roster = useWeekRoster(guild.oguildId, week, guild)
  const [columns, setColumns] = useState<ScoreColumn[]>(loadColumns)
  /** 사람이 직접 고른 이름. 줄 id → 이름. */
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  /** 사람이 확정해 둔 이름을 **나중 확정에 빼앗긴** 줄. 줄 id → 빼앗긴 이름.
   *
   * 빼앗긴 줄은 자동 판정으로 돌아가는데, 그 판정이 멀쩡해 보이면 수정 영역에서
   * 조용히 사라진다. 사람이 한 번 틀렸다고 본 줄이니 다시 정할 때까지 붙들어 둔다. */
  const [robbed, setRobbed] = useState<Readonly<Record<string, string>>>({})
  /** 사람이 고친 칸. 줄 id → 열 → 값. 읽은 값은 그대로 두고 덮어쓰기만 한다. */
  const [cellEdits, setCellEdits] = useState<Record<string, Partial<Record<ScoreColumn, string>>>>({})
  /** "점수 확인"에서 맞다고 한 줄. */
  const [orderConfirmed, setOrderConfirmed] = useState<ReadonlySet<string>>(new Set())
  /** 전체 목록에서 체크한 줄. */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  /** 직업·레벨 조회로 가려낸 것. 줄 id → 이름. */
  const [profilePicksById, setProfilePicksById] = useState<Record<string, string>>({})
  /** 받아온 직업·레벨. 자동으로 못 골랐어도 후보 옆에 보여준다. */
  const [profiles, setProfiles] = useState<Record<string, CharacterProfile | null>>({})
  const [narrowing, setNarrowing] = useState(false)
  const [narrowNote, setNarrowNote] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteCount, setPasteCount] = useState(0)
  /** 저장하기 전에 물어볼 것. 있으면 확인 칸을 띄운다. */
  const [saveConfirm, setSaveConfirm] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  /** 기록을 열어 달라는 요청이 왔는데 입력 중인 줄이 있어 물어보는 중. */
  const [pendingOpen, setPendingOpen] = useState<ScoreRecord | null>(null)

  function saveColumns(next: ScoreColumn[]) {
    setColumns(next)
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next))
    } catch {
      // 저장 못 해도 지금 화면에서는 그대로 쓴다.
    }
  }

  function resetEdits() {
    steps.reset()
    setNameOverrides({})
    setRobbed({})
    setCellEdits({})
    setOrderConfirmed(new Set())
    setSelected(new Set())
    setProfilePicksById({})
    setSaveConfirm(null)
  }

  /** 기록을 점수 입력 목록으로 가져온다. 그림은 없다. */
  function openRecord(record: ScoreRecord) {
    const group = { key: `record-${record.key}`, label: `저장된 기록 · ${record.week}`, shot: null }
    setRows(
      record.rows.map((row) => {
        const values = emptyValues()
        for (const column of SCORE_COLUMNS) values[column] = row.values[column] ?? ''
        return { id: newRowId(), group, read: row.name, values, strips: {} }
      }),
    )
    setWeek(record.week)
    if (record.columns.length > 0) saveColumns(record.columns)
    resetEdits()
    setPendingOpen(null)
    setSaveMessage({ tone: 'ok', text: `${record.week} 기록을 열었습니다. 고친 뒤 다시 저장하면 대체됩니다.` })
  }

  const lastNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!openRequest || openRequest.nonce === lastNonce.current) return
    lastNonce.current = openRequest.nonce
    // 기록 열기 요청은 다른 탭의 버튼에서 온다. 입력 중인 줄이 있으면 덮어쓰기 전에 묻는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rows.length > 0) setPendingOpen(openRequest.record)
    else openRecord(openRequest.record)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest])

  async function handleImages(files: File[]) {
    const lastShot = rows.reduce((max, row) => Math.max(max, row.group.shot ?? 0), 0)
    const fresh = await ocr.recognize(files, roster.members, lastShot + 1)
    if (fresh.length > 0) {
      setRows((prev) => [...prev, ...fresh])
      // 결과가 나오면 ② 첫 경계로 — 중복부터 지우게.
      steps.showFirstBoundary()
    }
  }

  function handlePasteAdd() {
    const count = pasteCount + 1
    const fresh = rowsFromPaste(pasteText, { key: `paste-${count}`, label: `붙여넣은 줄 ${count}`, shot: null })
    if (fresh.length === 0) return
    setPasteCount(count)
    setRows((prev) => [...prev, ...fresh])
    setPasteText('')
    setPasteOpen(false)
  }

  // --- 명단 대조 ---------------------------------------------------------

  /** 읽은 글자 → 대조 결과. 1,024명과 자모 유사도를 재는 일이 비싸서 기억해 둔다.
   * 명단이 바뀌면 통째로 새로 만든다. */
  const matchCacheRef = useRef<{ members: readonly string[]; matches: Map<string, NameMatch> }>({
    members: [],
    matches: new Map(),
  })
  const matches = useMemo(() => {
    const cache = matchCacheRef.current
    if (cache.members !== roster.members) {
      cache.members = roster.members
      cache.matches = new Map()
    }
    return rows.map((row) => {
      let match = cache.matches.get(row.read)
      if (!match) {
        match = matchToRoster(row.read, roster.members)
        cache.matches.set(row.read, match)
      }
      return match
    })
  }, [rows, roster.members])

  const memberSet = useMemo(() => new Set(roster.members), [roster.members])

  /** 줄 번호로 본 사람의 선택. 아래 계산은 번호로 말하는 편이 읽기 쉽다.
   * **명단에 있는 이름만** 넘긴다. 친 것 자체는 지우지 않고 화면에 빨갛게 남는다. */
  const overrides = useMemo(() => {
    const map: Record<number, string> = {}
    rows.forEach((row, index) => {
      const name = nameOverrides[row.id]
      if (name && memberSet.has(name)) map[index] = name
    })
    return map
  }, [rows, nameOverrides, memberSet])

  /** 사람이 쳤는데 명단에 없는 이름. 줄 번호 → 친 글자. */
  const typedUnknown = useMemo(() => {
    const map: Record<number, string> = {}
    rows.forEach((row, index) => {
      const name = nameOverrides[row.id]
      if (name && !memberSet.has(name)) map[index] = name
    })
    return map
  }, [rows, nameOverrides, memberSet])

  const similarToTyped = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const [key, typed] of Object.entries(typedUnknown)) {
      map[Number(key)] = roster.members
        .map((name) => ({ name, score: truncatedAwareSimilarity(typed, name) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, SIMILAR_LIMIT)
        .map((entry) => entry.name)
    }
    return map
  }, [typedUnknown, roster.members])

  /** ⓪에서 만들어 저장해둔 그룹. 읽기만 하므로 호출이 붙지 않는다. */
  const { summary: grouping } = useGuildGroups(guild.oguildId, apiKey)

  /** 한 줄이 곧 한 사람이라고 볼 수 있는가. 그룹화에 미분류가 없고 그룹 수가
   * 길드 슬롯 수와 같을 때만 — 슬롯 수만 믿으면 안 된다(길드 B 158슬롯에 53그룹). */
  const groupExclusive =
    grouping !== null &&
    grouping.unclassified.length === 0 &&
    grouping.userCount !== null &&
    grouping.groups.length === grouping.userCount

  /** 닉변 내역(그룹화 때 ocid로 감지). 수요일 명단의 옛 이름을 그룹의 지금 이름으로 잇는다. */
  const client = useQueryClient()
  const renames = useQuery({ queryKey: ['guild-admin', 'renames'], queryFn: listRenames, staleTime: Infinity })
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: ['guild-admin', 'renames'] })
    window.addEventListener(GROUPING_SAVED_EVENT, refresh)
    return () => window.removeEventListener(GROUPING_SAVED_EVENT, refresh)
  }, [client])
  const toCurrent = useMemo(() => currentNameResolver(renames.data ?? []), [renames.data])

  /** 캐릭터 이름 → 그룹 id. 그룹은 지금 이름으로 저장돼 있으니, 수요일 명단에만 있는 옛 이름도
   * 지금 이름을 거쳐 같은 그룹으로 잇는다. */
  const groupOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of grouping?.groups ?? []) {
      for (const member of group.members) map.set(member.name, group.id)
    }
    for (const name of roster.members) {
      if (map.has(name)) continue
      const id = map.get(toCurrent(name))
      if (id !== undefined) map.set(name, id)
    }
    return map
  }, [grouping, roster.members, toCurrent])

  /** 명단 대조가 붙인 이름을 **사람이 다른 줄에 확정한** 줄. 이쪽이 틀린 것이다. */
  const takenByPick = useMemo(
    () =>
      takenRows(
        matches.map((match, index) => (typedUnknown[index] !== undefined ? null : match.matched)),
        overrides,
      ),
    [matches, typedUnknown, overrides],
  )
  const autoMatched = useMemo(
    () =>
      matches.map((match, index) =>
        typedUnknown[index] !== undefined || takenByPick.has(index) ? null : match.matched,
      ),
    [matches, typedUnknown, takenByPick],
  )

  const profilePicks = useMemo(() => {
    const map: Record<number, string> = {}
    rows.forEach((row, index) => {
      if (profilePicksById[row.id] !== undefined) map[index] = profilePicksById[row.id]
    })
    return map
  }, [rows, profilePicksById])

  /** 판 전체를 보고 정한다 — 다른 줄이 가져간 이름을 후보에서 지우고, 하나만
   * 남으면 확정한다. 자세한 규칙은 `lib/score-resolve.ts`. */
  const { picks: autoPicks, remaining, groupClash } = useMemo(
    () =>
      resolveRows({
        rows: matches.map((match, index) => ({ matched: autoMatched[index], suggestions: match.suggestions })),
        overrides,
        profilePicks,
        groupOf,
        groupExclusive,
      }),
    [matches, autoMatched, overrides, profilePicks, groupOf, groupExclusive],
  )
  const groupClashSet = useMemo(() => new Set(groupClash), [groupClash])

  const resolved = rows.map((_, index) =>
    typedUnknown[index] !== undefined
      ? null
      : (overrides[index] ?? autoMatched[index] ?? autoPicks[index]?.name ?? null),
  )

  /** 캐릭터 → 그 그룹의 **대표**의 지금 이름. 대표가 자기 자신이면 넣지 않는다.
   *
   * 점수표에는 사람마다 한 캐릭터가 찍히는데, 그게 본캐라는 보장이 없다(접속
   * 캐릭이나 길드에 가입한 캐릭이 찍힌다). 대표 이름으로 저장해야 주마다 다른
   * 캐릭터로 찍혀도 주차 기록에서 한 사람으로 이어진다. 대표는 ⓪ 그룹 탭에서
   * 정하고 확정한다(ocid로 기억해 닉변해도 이어진다). */
  const representativeByName = useMemo(() => {
    const map = new Map<string, { name: string; confirmed: boolean }>()
    for (const group of grouping?.groups ?? []) {
      const representative = representativeName(group)
      if (!representative) continue
      for (const member of group.members) {
        if (member.name !== representative) map.set(member.name, { name: representative, confirmed: group.confirmed })
      }
    }
    return map
  }, [grouping])
  const representativeInfo = resolved.map((name) =>
    name === null ? null : (representativeByName.get(name) ?? representativeByName.get(toCurrent(name)) ?? null),
  )
  const representatives = representativeInfo.map((info) => info?.name ?? null)
  /** 대표를 아직 못 정한 그룹 수. */
  const unpickedGroups = grouping
    ? grouping.groups.filter((group) => group.representative === null && group.members.length > 1).length
    : 0
  /** 그룹화 뒤 명단이 바뀌었는가. 닉변·합류·탈퇴는 그룹 탭에서 갱신해야 반영된다. */
  const rosterChange = useMemo(() => {
    if (!grouping) return null
    const before = new Set(grouping.memberSnapshot)
    const now = new Set(guild.members)
    const added = guild.members.filter((name) => !before.has(name)).length
    const removed = grouping.memberSnapshot.filter((name) => !now.has(name)).length
    return added + removed > 0 ? { added, removed } : null
  }, [grouping, guild.members])

  // --- 칸 값 -------------------------------------------------------------

  const valueOf = (index: number, column: ScoreColumn): string =>
    cellEdits[rows[index].id]?.[column] ?? rows[index].values[column]

  const editCell = (index: number, column: ScoreColumn, value: string | null) => {
    const row = rows[index]
    const id = row?.id
    if (!id) return
    setCellEdits((prev) => {
      const next = { ...prev, [id]: { ...prev[id] } }
      if (value === null) delete next[id][column]
      else next[id][column] = value
      return next
    })

    // 직접 추가한 줄의 칸을 **다 채우면** 수로 점수순 자리로 옮긴다(2026-10-04 사용자 요청).
    if (row.group.key !== MANUAL_GROUP.key || !columns.includes(ORDER_COLUMN)) return
    const edits = { ...cellEdits[id] }
    if (value === null) delete edits[column]
    else edits[column] = value
    const filled = columns.every((key) => (edits[key] ?? row.values[key]).trim() !== '')
    if (!filled) return
    const scoreOf = (other: SheetRow) =>
      numberOf((other.id === id ? edits : cellEdits[other.id])?.[ORDER_COLUMN] ?? other.values[ORDER_COLUMN])
    const placed = placeByScore(rows, id, scoreOf)
    if (!placed) return
    setRows(placed)
    // 옮긴 자리로 간다. 엔터로 채웠어도 "아래 칸"으로 가지 않게 표시해 둔다.
    movedRef.current = id
    setFocusRowId(id)
  }
  /** 방금 자리를 옮긴 줄. 그 칸의 엔터 처리(아래 칸으로)를 한 번 건너뛴다. */
  const movedRef = useRef<string | null>(null)

  /** 지하수로 점수순인지, 순서를 깨는 줄은 어디인지. */
  const order = useMemo(
    () =>
      scoreOrderCheck(
        rows.map((row) => ({
          groupKey: row.group.key,
          value: numberOf(cellEdits[row.id]?.[ORDER_COLUMN] ?? row.values[ORDER_COLUMN]),
        })),
        // "맞음"으로 확인한 칸은 믿는다 — 깨진 쌍이 남으면 그 이웃을 짚는다.
        new Set(rows.flatMap((row, index) => (orderConfirmed.has(row.id) ? [index] : []))),
      ),
    [rows, cellEdits, orderConfirmed],
  )
  const orderSuspect = (index: number) =>
    order.suspects.has(index) && !orderConfirmed.has(rows[index].id)

  /** 겹쳐 보이는 줄 → 짝. 지우지 않고 짚기만 한다. */
  const duplicates = duplicateSuspects(
    rows.map((row, index) => ({
      group: row.group,
      name: resolved[index],
      read: row.read,
      numbers: numberSignature({ ...row.values, ...cellEdits[row.id] }),
    })),
  )
  const pairSet = new Set(duplicates.values())

  // --- 이름 정하기·지우기 ----------------------------------------------

  /** 이름을 확정한다. 빈 값이면 자동으로 정한 값으로 되돌린다. 같은 이름을
   * 확정해 둔 다른 줄이 있으면 **이쪽이 가져온다**(`claimName`). */
  const pickName = (index: number, name: string) => {
    const id = rows[index]?.id
    if (id === undefined) return
    const { next, robbed: lost } = claimName(nameOverrides, id, name)
    setNameOverrides(next)
    setRobbed((prev) => {
      const updated = { ...prev }
      for (const key of lost) updated[key] = name
      if (name) delete updated[id]
      return updated
    })
  }

  function removeIds(ids: ReadonlySet<string>) {
    if (ids.size === 0) return
    setRows((prev) => prev.filter((row) => !ids.has(row.id)))
    setSelected((prev) => new Set([...prev].filter((id) => !ids.has(id))))
  }

  /** 그 장의 첫 줄부터 이 줄까지 지운다. 겹친 부분은 언제나 다음 장 맨 위다. */
  function removeUpTo(index: number) {
    const target = rows[index]
    if (!target) return
    const ids = new Set<string>()
    for (let i = 0; i <= index; i++) if (rows[i].group.key === target.group.key) ids.add(rows[i].id)
    removeIds(ids)
  }

  // --- 직업·레벨로 가려내기 ---------------------------------------------

  const ambiguousRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => {
      if (overrides[index] !== undefined || autoMatched[index] !== null) return false
      if (profilePicks[index] !== undefined) return false
      if (autoPicks[index]?.reason === 'eliminated') return false
      return (remaining[index]?.length ?? 0) > 1
    })

  /** 후보들의 직업·레벨을 받아와 한 명으로 좁힌다. **버튼을 눌러야 돈다** —
   * 넥슨 호출이 붙는 일이라 조용히 수십 번 쏘면 곤란하다. */
  async function narrowCandidates() {
    setNarrowing(true)
    setNarrowNote(null)
    try {
      const fetched: Record<string, CharacterProfile | null> = { ...profiles }
      const picked: Record<string, string> = {}
      for (const { row, index } of ambiguousRows) {
        const candidates = []
        for (const name of remaining[index] ?? matches[index].suggestions) {
          if (!(name in fetched)) fetched[name] = await fetchProfile(name, apiKey, resolve, week)
          candidates.push({ name, profile: fetched[name] })
        }
        const choice = narrowByProfile(
          { job: valueOf(index, 'job'), level: numberOf(valueOf(index, 'level')) },
          candidates,
        )
        if (choice) picked[row.id] = choice
      }
      flush()
      setProfiles(fetched)
      setProfilePicksById((prev) => ({ ...prev, ...picked }))
      const count = Object.keys(picked).length
      setNarrowNote(
        count > 0
          ? `${ambiguousRows.length}줄 중 ${count}줄을 가려냈습니다.`
          : '직업·레벨로는 가리지 못했습니다. 후보 옆 값과 그림을 보고 직접 골라주세요.',
      )
    } finally {
      setNarrowing(false)
    }
  }

  // --- 수정 영역 ---------------------------------------------------------

  /** 줄이 어느 묶음의 몇 번째인지. */
  const positionOf = useMemo(() => {
    const counts = new Map<string, number>()
    return rows.map((row) => {
      const next = (counts.get(row.group.key) ?? 0) + 1
      counts.set(row.group.key, next)
      return next
    })
  }, [rows])

  const cellsOf = (index: number): AttentionCell[] =>
    columns.map((column) => ({
      key: column,
      label: COLUMN_LABEL[column],
      value: valueOf(index, column),
      edited: cellEdits[rows[index].id]?.[column] !== undefined,
      numeric: NUMERIC_COLUMNS.has(column),
      warn: column === ORDER_COLUMN && orderSuspect(index),
      strip: rows[index].strips[column] ?? null,
    }))

  const compareOf = (title: string, other: number | undefined) =>
    other === undefined || other < 0
      ? undefined
      : {
          title,
          name: resolved[other] ?? rows[other].read,
          strip: rows[other].strips.name ?? null,
          cells: cellsOf(other),
        }

  const attentionRows: AttentionRow[] = rows.flatMap((row, index) => {
    const match = matches[index]
    const picked = resolved[index]
    const lostName = takenByPick.has(index) ? (match.matched ?? undefined) : robbed[row.id]
    let kind: AttentionKind | null = null
    // 수정 영역은 **닉네임 전용**(2026-10-04) — 중복 의심은 ② 전체 목록의 경계에서, 점수 확인은
    // ④ 전체 목록의 의심 칸에서 처리한다.
    if (lostName !== undefined) kind = 'taken'
    else if (groupClashSet.has(index)) kind = 'group-clash'
    else if (overrides[index] !== undefined) kind = null
    else if (picked === null) kind = (remaining[index]?.length ?? match.suggestions.length) > 0 ? 'ambiguous' : 'none'
    else if (autoPicks[index]) kind = PICK_KIND[autoPicks[index].reason] ?? null
    else if (match.confidence !== 'exact') kind = 'corrected'
    if (kind === null) return []
    return [
      {
        index,
        kind,
        where: `${row.group.label} · ${positionOf[index]}번 줄`,
        read: match.cleaned || row.read,
        picked,
        typed: typedUnknown[index],
        candidates:
          typedUnknown[index] !== undefined
            ? (similarToTyped[index] ?? [])
            : (remaining[index] ?? match.suggestions).filter((name) => name !== picked),
        strip: row.strips.name ?? null,
        cells: cellsOf(index),
        compareWith:
          lostName !== undefined
            ? compareOf(
                '가져간 줄',
                rows.findIndex((_, other) => overrides[other] === lostName),
              )
            : undefined,
      },
    ]
  })

  // --- 단계 이동 ----------------------------------------------------------

  const suspectRows = rows.flatMap((_, index) => (orderSuspect(index) ? [index] : []))
  const steps = useScoreSteps({
    rootRef,
    rows,
    attentionOrder: sortAttentionRows(attentionRows).map((row) => row.index),
    suspects: suspectRows,
    duplicateCount: duplicates.size,
    orderConflicts: order.conflicts.length,
    orderColumn: ORDER_COLUMN,
  })

  /** 직접 추가한 줄로 옮겨 갈 때 — 다시 그린 뒤 그 줄의 첫 점수 칸에 포커스. */
  const [focusRowId, setFocusRowId] = useState<string | null>(null)
  useEffect(() => {
    if (!focusRowId) return
    const column = columns.find((value) => NUMERIC_COLUMNS.has(value)) ?? columns[0]
    const input = rootRef.current?.querySelector<HTMLInputElement>(
      `[data-score-cell="${CSS.escape(focusRowId)}"][data-column="${column}"] input`,
    )
    if (input) {
      input.focus({ preventScroll: true })
      input.scrollIntoView({ block: 'center' })
      input.select()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 한 번 옮기고 끝낸다.
    setFocusRowId(null)
  }, [focusRowId, columns])

  /** OCR이 놓친 줄을 직접 넣는다(2026-10-04 사용자 요청 — 장 맨 아랫줄이 자꾸 빠졌다). 맨 아래
   * "직접 추가한 줄" 묶음에 붙이고, 그룹화 때 받아 둔 직업·레벨이 있으면 채운 뒤 첫 점수 칸으로 간다. */
  function addManualRow(name: string) {
    const member = grouping?.groups
      .flatMap((group) => group.members)
      .find((candidate) => candidate.name === name || candidate.name === toCurrent(name))
    const values = emptyValues()
    if (member?.profile) {
      values.job = member.profile.job
      values.level = String(member.profile.level)
    }
    const row: SheetRow = { id: newRowId(), group: MANUAL_GROUP, read: name, values, strips: {} }
    setRows((prev) => [...prev, row])
    setFocusRowId(row.id)
  }

  const confirmScore = (index: number) => setOrderConfirmed((prev) => new Set([...prev, rows[index].id]))

  /** 전체 목록 칸에서 엔터. 점수 의심 칸이 남아 있으면 지하수로 칸에서는 다음 의심 칸으로(값을 안
   * 바꿨으면 "맞음"), 다 본 뒤에는 같은 열 아래 칸으로(2026-10-04 사용자 요청). */
  function handleCellEnter(index: number, column: ScoreColumn, changed: boolean) {
    const row = rows[index]
    if (movedRef.current === row.id) {
      movedRef.current = null
      return
    }
    if (column === ORDER_COLUMN && suspectRows.length > 0) {
      if (!changed && orderSuspect(index)) confirmScore(index)
      steps.afterSuspectEnter(row.id)
    } else {
      steps.afterCellEnter(row.id, column)
    }
  }

  /** 명단에 있는데 **최종 명단에 한 캐릭터도 없는 사람들.** 사람 단위로만 센다.
   * 그 주 수요일에 길드에 없던 사람(그 뒤에 들어온 사람)은 빼고, 이름은 지금 이름으로 견준다. */
  const finalNames = new Set(resolved.flatMap((name) => (name === null ? [] : [toCurrent(name)])))
  const weekNames = new Set(roster.members.map(toCurrent))
  const missingPeople = grouping
    ? grouping.groups
        .filter(
          (group) =>
            group.members.some((member) => weekNames.has(member.name)) &&
            !group.members.some((member) => finalNames.has(member.name)),
        )
        .map((group) => group.members.map((member) => member.name))
    : null

  /** 그 당시 명단 인원과 스크린샷 줄 수 대조(2026-10-04 사용자 요청). 명단은 캐릭터 단위다. */
  const matchedCount = new Set(resolved.filter((name): name is string => name !== null)).size

  // --- 저장 --------------------------------------------------------------

  const unresolvedCount = resolved.filter((name) => name === null).length
  const existing = records.records.find(
    (record) => record.key === recordKey(guild.worldName, guild.guildName, week),
  )

  function buildRecord(): ScoreRecord {
    return {
      key: recordKey(guild.worldName, guild.guildName, week),
      world: guild.worldName,
      guild: guild.guildName,
      week,
      columns,
      rows: rows.map((row, index) => {
        const values: Partial<Record<ScoreColumn, string>> = {}
        for (const column of columns) values[column] = valueOf(index, column)
        return {
          // 이름을 못 정한 줄은 **읽은 이름 그대로** 저장한다(2026-10-04 결정).
          // 아예 못 읽은 줄은 빈 이름 대신 자리표를 단다 — 빈 이름은 CSV를 다시
          // 불러올 때 버려진다.
          // 그룹 대표가 따로 있으면 **대표 이름으로** 저장한다.
          name:
            representatives[index] ??
            resolved[index] ??
            typedUnknown[index] ??
            (matches[index].cleaned || row.read || `(이름 못 읽음 · ${row.group.label} ${positionOf[index]}번 줄)`),
          unresolved: resolved[index] === null,
          values,
        }
      }),
      savedAt: new Date().toISOString(),
    }
  }

  async function doSave() {
    setSaveConfirm(null)
    try {
      await records.save([buildRecord()])
      setSaveMessage({
        tone: 'ok',
        text: `${week} 주차로 ${rows.length}줄을 이 브라우저에 저장했습니다. 내려받기는 주차 기록 탭에서 합니다.`,
      })
    } catch {
      setSaveMessage({ tone: 'error', text: '브라우저에 저장하지 못했습니다.' })
    }
  }

  function handleSave() {
    setSaveMessage(null)
    const issues: string[] = []
    if (existing) issues.push(`${week} 주차 기록이 이미 있습니다(${existing.rows.length}줄). 대체합니다.`)
    const remains: string[] = []
    if (duplicates.size > 0) remains.push(`중복 의심 ${duplicates.size}줄`)
    if (unresolvedCount > 0) remains.push(`이름을 못 정한 줄 ${unresolvedCount}줄`)
    if (remains.length > 0) {
      issues.push(
        `${remains.join(', ')}이 남아 있습니다.${unresolvedCount > 0 ? ' 이름을 못 정한 줄은 읽은 이름 그대로 저장됩니다.' : ''}`,
      )
    }
    if (issues.length > 0) setSaveConfirm(`${issues.join(' ')} 그대로 저장할까요?`)
    else void doSave()
  }

  const weekOptions = [...new Set([...recentWeeks(8), week, ...records.records.map((record) => record.week)])]
    .sort()
    .reverse()

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      {/* 자동으로 돌리지 않는다 — 넥슨 호출이 붙는 일이라 사람이 눌러야 한다. */}
      {rosterChange && (
        <Alert>
          <AlertDescription>
            그룹화한 뒤 명단이 바뀌었습니다(새 {rosterChange.added} · 사라진 {rosterChange.removed}). 닉변한
            캐릭터와 새 캐릭터를 그룹·대표에 반영하려면 그룹 탭에서 "새 캐릭터만 갱신"을 눌러 주세요.
          </AlertDescription>
        </Alert>
      )}
      {pendingOpen && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              {pendingOpen.week} 기록을 열면 지금 입력 중인 {rows.length}줄이 사라집니다. 열까요?
            </span>
            <span className="grow" />
            <Button type="button" size="sm" variant="outline" onClick={() => setPendingOpen(null)}>
              취소
            </Button>
            <Button type="button" size="sm" onClick={() => openRecord(pendingOpen)}>
              열기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="score-week" className="text-xs text-muted-foreground">
              주차 (목요일 기준)
            </label>
            <select
              id="score-week"
              value={week}
              onChange={(event) => setWeek(event.target.value)}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {weekOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <p className="pb-2 text-xs text-muted-foreground" aria-live="polite">
            {roster.loading
              ? `${lastDayOfWeek(week)}(수) 명단 불러오는 중… 그동안 최신 명단으로 대조합니다.`
              : roster.failed
                ? `${lastDayOfWeek(week)}(수) 명단을 받지 못해 최신 명단으로 대조합니다.`
                : roster.date
                  ? `${roster.date} 명단 ${roster.members.length.toLocaleString()}캐릭과 대조`
                  : `진행 중인 주차라 최신 명단 ${roster.members.length.toLocaleString()}캐릭과 대조`}
          </p>
          <div className="grow" />
          <Button type="button" variant="outline" onClick={() => setPasteOpen((prev) => !prev)}>
            표 붙여넣기
          </Button>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
            스크린샷에서 읽어오기
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                // 같은 파일을 다시 골라도 onChange가 뜨게 비워둔다.
                event.target.value = ''
                void handleImages(files)
              }}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            길드 &gt; 길드원 &gt; 컨텐츠 참여 현황 탭을 <span className="text-primary">지하수로 점수순(▼)</span>
            으로 정렬하고, 위에서부터 스크롤하며 찍어주세요.
          </span>
          <span>
            1366 × 768 해상도에서 인게임 스크린샷 기능으로 촬영해주세요. 찍은 순서대로 올리면 겹친 줄을 찾아
            표시합니다. 이미지는 브라우저 안에서만 처리됩니다.
          </span>
          <span className="font-medium text-foreground">
            앞 장과 몇 줄씩 겹치게 넉넉히 찍어 주세요. 아슬아슬하게 이어 찍으면 장 맨 아랫줄이 잘려 인식이 안 될 때가
            있습니다 — 겹친 줄은 ② 경계 중복 단계에서 쉽게 지울 수 있습니다. 그래도 빠진 캐릭터는 전체 목록의 "줄
            추가"로 넣을 수 있습니다.
          </span>
          <span>
            닉네임순 정렬은 권장하지 않습니다. 다른 캐릭터로 접속하거나 나가는 사람이 있으면 찍는 도중에 순서가
            바뀝니다. 주차는 스크린샷이 언제 찍혔는지 알 수 없어 직접 고릅니다. 기본은 지난 주차입니다(점수는 수요일 자정에 확정).
          </span>
        </div>

        {pasteOpen && (
          <div className="flex flex-col gap-2">
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              onPaste={(event) => {
                const images = Array.from(event.clipboardData.files).filter((file) =>
                  file.type.startsWith('image/'),
                )
                if (images.length === 0) return
                // 이미지를 붙여넣은 것이므로 기본 붙여넣기는 막는다.
                event.preventDefault()
                void handleImages(images)
              }}
              rows={5}
              placeholder={'게임 표를 줄 단위로 붙여넣거나, 이미지를 붙여넣으세요(Ctrl+V).\n부서진별(부..\t소울마스터\t297\t물결\t10\t294,791\t0'}
              className="w-full rounded-md border bg-transparent p-2 font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handlePasteAdd} disabled={!pasteText.trim()}>
                목록에 추가
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        )}

        {ocr.status === 'loading' && (
          <p className="text-xs text-muted-foreground">한글 인식 데이터를 내려받는 중입니다. 처음 한 번만 오래 걸립니다.</p>
        )}
        {ocr.status === 'recognizing' && ocr.progress && (
          <p className="text-xs text-muted-foreground">
            {ocr.progress.current}/{ocr.progress.total}번째 이미지{' '}
            {ocr.progress.phase === 'reading'
              ? `인식 중 · ${Math.round(ocr.progress.ratio * 100)}%`
              : '이름 다시 확인 중'}
          </p>
        )}
        {ocr.error && <p className="text-xs text-destructive">이미지를 읽지 못했습니다 — {ocr.error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-sm font-medium">보여주고 저장할 열</span>
          <span className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary">
            닉네임 · 항상
          </span>
          {SCORE_COLUMNS.map((column) => {
            const on = columns.includes(column)
            return (
              <label
                key={column}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  on ? 'border-primary/40 bg-primary/5 text-primary' : 'text-muted-foreground'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    saveColumns(on ? columns.filter((value) => value !== column) : SCORE_COLUMNS.filter((value) => value === column || columns.includes(value)))
                  }
                />
                {COLUMN_LABEL[column]}
              </label>
            )
          })}
          <span className="text-xs text-muted-foreground">
            모든 열을 읽고, 고른 열만 보여주고 저장합니다. 행은 전부 저장합니다.
          </span>
        </div>

        {rows.length > 0 && (
          <p
            className={`rounded-md border px-3 py-2 text-xs ${
              order.sorted
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-muted-foreground'
            }`}
          >
            {order.sorted
              ? `지하수로 점수순으로 정렬돼 있습니다. ${
                  order.suspects.size > 0
                    ? `순서를 깨는 칸 ${order.suspects.size}개를 전체 목록에 노랗게 표시했습니다(④ 점수).`
                    : '순서를 깨는 칸이 없습니다.'
                }${
                  order.conflicts.length > 0
                    ? ` "맞음"으로 확인한 칸끼리 순서가 어긋난 곳이 ${order.conflicts.length}곳 있습니다 — 줄 순서(겹친 줄·직접 추가한 줄의 자리)나 확인한 값을 다시 봐 주세요.`
                    : ''
                }`
              : order.checked < 5
                ? '지하수로 점수가 적어 정렬을 확인하지 못했습니다.'
                : '지하수로 점수순이 아닌 것 같습니다. 점수순으로 찍으면 숫자를 잘못 읽은 줄을 더 잘 찾습니다. 다른 기능은 그대로 쓸 수 있습니다.'}
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <>
          <ScoreStepsBar
            steps={steps.steps}
            current={steps.current}
            nextLabel={steps.nextLabel}
            onStep={steps.goToStep}
            onPrev={steps.prev}
            onNext={steps.next}
          />

          {/* 이름 칸에서 바로 고를 수 있게 명단을 한 벌 깔아 둔다. 줄마다
              만들면 1,024개짜리 목록이 수백 벌 생긴다. */}
          <datalist id={ROSTER_LIST_ID}>
            {roster.members.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <AttentionList
            rows={attentionRows}
            profiles={profiles}
            listId={ROSTER_LIST_ID}
            onPick={pickName}
            onCell={(index, key, value) => editCell(index, key as ScoreColumn, value)}
            onRemove={(index) => removeIds(new Set([rows[index].id]))}
            onLastEnter={() => steps.goToStep('scores')}
            onAddMissing={addManualRow}
            missing={missingPeople}
            unclassifiedCount={grouping?.unclassified.length ?? 0}
          />

          {ambiguousRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
              <span className="font-medium">후보가 여럿인 줄 {ambiguousRows.length}개</span>
              <span className="text-muted-foreground">
                스크린샷에 찍힌 직업·레벨을 후보들의 실제 값과 견줘 가려냅니다.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={narrowing || !apiKey}
                onClick={() => void narrowCandidates()}
              >
                {narrowing ? '가려내는 중…' : '직업·레벨로 가려내기'}
              </Button>
              {narrowNote && <span className="w-full text-muted-foreground">{narrowNote}</span>}
            </div>
          )}

          <ScoreSheetList
            rows={rows}
            columns={columns}
            names={rows.map((_, index) => typedUnknown[index] ?? resolved[index] ?? '')}
            representatives={representatives}
            representativeConfirmed={representativeInfo.map((info) => info?.confirmed ?? false)}
            unknownNames={new Set(Object.keys(typedUnknown).map(Number))}
            unresolved={new Set(resolved.flatMap((name, index) => (name === null ? [index] : [])))}
            valueOf={valueOf}
            editedOf={(index, column) => cellEdits[rows[index].id]?.[column] !== undefined}
            warnOf={(index, column) => column === ORDER_COLUMN && orderSuspect(index)}
            duplicates={duplicates}
            pairs={pairSet}
            selected={selected}
            onSelectedChange={setSelected}
            listId={ROSTER_LIST_ID}
            onPick={pickName}
            onCell={editCell}
            onRemoveSelected={() => removeIds(selected)}
            onRemoveUpTo={removeUpTo}
            onRemoveOne={(index) => removeIds(new Set([rows[index].id]))}
            suspectOf={orderSuspect}
            onConfirmScore={confirmScore}
            onCellEnter={handleCellEnter}
            onAddRow={addManualRow}
            activeBoundary={
              steps.activeBoundary
                ? { key: steps.activeBoundary, position: steps.boundaryPosition, count: steps.boundaryCount }
                : null
            }
          />

          <section className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{week} 주</span>
              <span className="text-xs text-muted-foreground">
                {representatives.some(Boolean) &&
                  `그룹 대표 이름으로 바꿔 저장 ${representatives.filter(Boolean).length}줄 · `}
                {rows.length}줄 · 열 {columns.length + 1}개(닉네임
                {columns.map((column) => `, ${COLUMN_LABEL[column]}`).join('')}) · 이 브라우저에 저장됩니다.
                내려받기는 주차 기록 탭에서 합니다.
              </span>
              <div className="grow" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRows([])
                  resetEdits()
                }}
              >
                목록 비우기
              </Button>
              <Button type="button" onClick={handleSave} data-score-save>
                이 주차로 저장
              </Button>
            </div>
            <RosterCountCheck
              userCount={roster.userCount}
              characterCount={roster.members.length}
              rosterDate={roster.date}
              rowCount={rows.length}
              matchedCount={matchedCount}
            />
            {grouping === null ? (
              <p className="text-xs text-muted-foreground">
                그룹 탭에서 그룹화를 돌려 두면, 같은 사람의 다른 캐릭터로 찍혀도 그룹 대표 이름으로 저장합니다.
              </p>
            ) : (
              unpickedGroups > 0 && (
                <p className="text-xs text-muted-foreground">
                  대표를 아직 못 정한 그룹 {unpickedGroups}개는 매칭된 이름 그대로 저장합니다. 그룹 탭에서 "새
                  캐릭터만 갱신"을 누르면 대표를 고릅니다.
                </p>
              )
            )}
            {saveConfirm && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <span>{saveConfirm}</span>
                <div className="grow" />
                <Button type="button" size="sm" variant="outline" onClick={() => setSaveConfirm(null)}>
                  돌아가서 고치기
                </Button>
                <Button type="button" size="sm" onClick={() => void doSave()}>
                  그대로 저장
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      {saveMessage && (
        <Alert variant={saveMessage.tone === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{saveMessage.text}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** 그 당시 길드 인원(사람)과 스크린샷 줄 수를 맞대 본다(2026-10-04 사용자 요청). 점수판(컨텐츠
 * 참여 현황)은 사람마다 한 줄이라 캐릭터 수가 아니라 `guild_user_count`와 견준다 — 명단에 있는
 * 부캐가 스크린샷에 없는 건 정상이다. 다르면 빠진 스크린샷이나 겹쳐 찍힌 줄을 의심한다. */
function RosterCountCheck({
  userCount,
  characterCount,
  rosterDate,
  rowCount,
  matchedCount,
}: {
  userCount: number | null
  characterCount: number
  rosterDate: string | null
  rowCount: number
  matchedCount: number
}) {
  const gap = userCount === null ? null : userCount - rowCount
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-sm ${
        gap === null || gap === 0 ? '' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
      }`}
    >
      <span>
        <span className="text-xs text-muted-foreground">{rosterDate ? `${rosterDate} 길드 인원` : '지금 길드 인원'}</span>{' '}
        <span className="font-semibold tabular-nums">{userCount === null ? '알 수 없음' : `${userCount.toLocaleString()}명`}</span>
        <span className="ml-1 text-xs text-muted-foreground">({characterCount.toLocaleString()}캐릭)</span>
      </span>
      <span>
        <span className="text-xs text-muted-foreground">스크린샷</span>{' '}
        <span className="font-semibold tabular-nums">{rowCount.toLocaleString()}줄</span>
        <span className="ml-1 text-xs text-muted-foreground">(명단과 맞춘 {matchedCount.toLocaleString()})</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {gap === null
          ? '그 당시 인원 수를 받지 못해 대조하지 못했습니다.'
          : gap === 0
            ? '길드 인원과 줄 수가 같습니다.'
            : gap > 0
              ? `길드 인원보다 ${gap.toLocaleString()}줄 적습니다 — 빠진 스크린샷이 없는지 확인해 주세요.`
              : `길드 인원보다 ${(-gap).toLocaleString()}줄 많습니다 — 겹쳐 찍힌 줄이 남았는지 확인해 주세요.`}
      </span>
    </div>
  )
}
