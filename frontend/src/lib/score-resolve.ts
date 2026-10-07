/** 줄마다 따로 고르지 않고 **판 전체를 보고** 고른다.
 *
 * 명단 대조는 한 줄씩 독립적으로 돈다. 그래서 `배부른아기`와
 * `배부른참새` 사이에서 못 고른 줄이, 사실은 참치가 **다른 줄에서 이미
 * 확정된** 경우에도 그대로 애매한 채 남았다.
 *
 * 점수표에는 같은 캐릭터가 두 번 나오지 않는다. 그러니 한 줄이 이름을
 * 가져가면 다른 줄의 후보에서는 빠져야 하고, 그러다 후보가 하나만 남으면
 * 그 줄도 정해진다. 그게 또 다른 줄의 후보를 줄인다 — 더 줄어들 게 없을
 * 때까지 돌린다.
 *
 * **같은 사람의 캐릭터를 묶어 빼는 것은 조건부다**(`groupExclusive`). 한
 * 사람이 캐릭터를 여럿 넣어두면 그 캐릭터들이 각각 한 줄씩 올라올 수 있고,
 * 그때 묶어서 빼면 멀쩡한 줄의 후보가 사라진다. 그래서 **그룹화가 빈틈없이
 * 끝났고 그룹 수가 길드 슬롯 수와 맞을 때만** 쓴다 — 그때는 한 줄이 곧 한
 * 그룹이다.
 *
 * 실측(길드 A)에서 확정된 198줄이 194그룹에 떨어졌고, 겹친 4건 중
 * 3건은 같은 줄이 두 장에 걸쳐 들어온 중복, 1건은 이미 알고 있던 오매칭
 * (`re하늘`/`re구름`)이었다. 즉 제대로 읽힌 줄끼리는 그룹이 겹치지 않는다.
 *
 * 예전에는 표가 닉네임순이면 **자리**로도 후보를 좁혔다. 2026-10-04부터 촬영
 * 안내를 지하수로 점수순으로 바꾸면서 걷어냈다 — 접속 중인 사람은 표시 닉네임이
 * `메인(접속캐릭)`으로 바뀌어, 닉네임순은 찍는 도중에도 순서가 바뀐다.
 */

/** 무엇으로 정해졌는지. 화면에 그대로 보여줘서 조용히 넘어가지 않게 한다. */
export type PickReason =
  /** 다른 줄이 가져가서 후보가 하나만 남았다. */
  | 'eliminated'
  /** 직업·레벨을 조회해 가려냈다. */
  | 'profile'
  /** 후보가 전부 한 사람의 캐릭터라 그중 가장 닮은 이름으로 정했다. */
  | 'same-group'

export interface Pick {
  name: string
  reason: PickReason
}

export interface ResolveInput {
  rows: readonly {
    matched: string | null
    suggestions: readonly string[]
  }[]
  /** 사람이 직접 고른 것. 가장 세다. */
  overrides: Readonly<Record<number, string>>
  /** 직업·레벨 조회로 가려낸 것. */
  profilePicks: Readonly<Record<number, string>>
  /** 이름 → 그룹 id. 그룹화를 안 돌렸으면 비어 있다. */
  groupOf: ReadonlyMap<string, string>
  /** 한 줄이 곧 한 그룹이라고 볼 수 있는가.
   *
   * 그룹화에 미분류가 없고 그룹 수가 길드 슬롯 수와 같을 때만 참이다. 그때는
   * 한 이름이 정해지면 **그 사람의 다른 캐릭터는 다른 줄에 올 수 없다.** */
  groupExclusive: boolean
}

export interface ResolveResult {
  /** 자동으로 정해진 줄. 사람이 고른 것과 명단 대조가 맞춘 것은 안 들어간다. */
  picks: Record<number, Pick>
  /** 줄마다 아직 살아 있는 후보. 화면의 후보 버튼이 이걸 쓴다. */
  remaining: Record<number, string[]>
  /** **같은 사람의 캐릭터로 정해진 두 줄.**
   *
   * 한 줄이 곧 한 사람인 길드에서는 있을 수 없는 일이다. 후보를 거를 때는
   * 그룹째 빼지만, **양쪽 다 명단에 그대로 맞아떨어진 경우**에는 거를 기회가
   * 없다 — 그때 이게 남는다. 둘 중 하나는 남의 이름을 달고 있다.
   *
   * 같은 이름이 두 줄인 것(겹쳐 찍힌 중복)은 여기 넣지 않는다. 그건 중복
   * 의심으로 따로 짚는다. */
  groupClash: number[]
}

/** 이 줄이 이미 정해졌는가. */
function settledName(
  input: ResolveInput,
  picks: Record<number, Pick>,
  index: number,
): string | null {
  return (
    input.overrides[index] ??
    input.rows[index].matched ??
    input.profilePicks[index] ??
    picks[index]?.name ??
    null
  )
}

export function resolveRows(input: ResolveInput): ResolveResult {
  const picks: Record<number, Pick> = {}
  for (const [key, name] of Object.entries(input.profilePicks)) {
    const index = Number(key)
    // 그 줄이 이미 사람의 선택이나 명단 대조로 정해졌으면 조회 결과는 쓰지
    // 않는다. 안 그러면 이름은 맞게 나오는데 "직업·레벨로 확정"이라는 엉뚱한
    // 꼬리표가 붙는다.
    if (input.overrides[index] !== undefined || input.rows[index]?.matched !== null) continue
    picks[index] = { name, reason: 'profile' }
  }

  /** 그룹 id → 그 그룹의 캐릭터들. 묶어서 뺄 때 쓴다. */
  const membersOf = new Map<string, string[]>()
  if (input.groupExclusive) {
    for (const [name, id] of input.groupOf) {
      const list = membersOf.get(id)
      if (list) list.push(name)
      else membersOf.set(id, [name])
    }
  }

  const claimed = new Set<string>()
  /** 이름을 가져간다. 한 줄이 곧 한 그룹인 길드에서는 **그 사람의 다른
   * 캐릭터까지** 가져간 것으로 본다. */
  const claim = (name: string) => {
    claimed.add(name)
    const id = input.groupOf.get(name)
    if (id === undefined) return
    for (const other of membersOf.get(id) ?? []) claimed.add(other)
  }
  input.rows.forEach((_, index) => {
    const name = settledName(input, picks, index)
    if (name !== null) claim(name)
  })

  const remainingOf = (index: number) =>
    input.rows[index].suggestions.filter((name) => !claimed.has(name))

  /** 후보가 하나만 남은 줄을 확정한다. 확정이 또 다른 줄을 줄이므로 반복한다. */
  const eliminate = () => {
    for (let guard = 0; guard < input.rows.length + 1; guard++) {
      let changed = false
      input.rows.forEach((row, index) => {
        if (settledName(input, picks, index) !== null || row.suggestions.length === 0) return
        const left = remainingOf(index)
        if (left.length !== 1) return
        picks[index] = { name: left[0], reason: 'eliminated' }
        claim(left[0])
        changed = true
      })
      if (!changed) return
    }
  }

  eliminate()

  // **맨 마지막**에 본다. 같은 사람의 캐릭터라도 줄이 다르면 점수가 다르니,
  // 후보 지우기로 갈릴 수 있는 것을 여기서 먼저 삼키면 안 된다.
  if (input.groupOf.size > 0) {
    let changed = false
    input.rows.forEach((row, index) => {
      if (settledName(input, picks, index) !== null || row.suggestions.length < 2) return
      const left = remainingOf(index)
      if (left.length < 2) return
      const ids = left.map((name) => input.groupOf.get(name))
      if (ids.some((id) => id === undefined)) return
      if (new Set(ids).size !== 1) return
      // 후보는 이미 닮은 순으로 온다.
      picks[index] = { name: left[0], reason: 'same-group' }
      claim(left[0])
      changed = true
    })
    // 여기서 가져간 이름도 다른 줄의 후보를 줄인다.
    if (changed) eliminate()
  }

  /** 같은 그룹에 **서로 다른 이름**으로 들어간 줄들을 찾는다. */
  const groupClash: number[] = []
  if (input.groupExclusive) {
    const byGroup = new Map<string, { index: number; name: string }[]>()
    input.rows.forEach((_, index) => {
      const name = settledName(input, picks, index)
      if (name === null) return
      const id = input.groupOf.get(name)
      if (id === undefined) return
      const list = byGroup.get(id)
      if (list) list.push({ index, name })
      else byGroup.set(id, [{ index, name }])
    })
    for (const rows of byGroup.values()) {
      if (rows.length < 2) continue
      // 같은 이름이면 겹쳐 찍힌 중복이다. 이름이 다를 때만 짚는다.
      if (new Set(rows.map((row) => row.name)).size < 2) continue
      for (const row of rows) groupClash.push(row.index)
    }
  }

  const remaining: Record<number, string[]> = {}
  input.rows.forEach((row, index) => {
    // 정해진 줄의 후보도 그대로 둔다 — 사람이 되돌릴 때 봐야 한다.
    if (settledName(input, picks, index) !== null) {
      if (row.suggestions.length > 0) remaining[index] = [...row.suggestions]
      return
    }
    const left = remainingOf(index)
    if (left.length > 0) remaining[index] = left
  })

  return { picks, remaining, groupClash }
}
