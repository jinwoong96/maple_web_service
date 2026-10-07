/** 길드 명단(캐릭터 1000개 규모)을 실제 사람 단위로 묶는다.
 *
 * 길드 정원은 200명이지만 1인당 6캐릭까지 넣을 수 있어서, `guild/basic`의
 * `guild_member`는 이름 1023개짜리 평면 배열로 온다(테스트 길드 실측).
 * 그런데 **누가 누구의 부캐인지는 응답에 없다** — `character/basic`에도 계정
 * 식별자가 없다.
 *
 * 유일하게 묶을 수 있는 단서가 `user/union-champion`이다. 유니온 챔피언은
 * 계정·월드 단위 데이터라 **그 사람이 가진 캐릭터들의 실제 닉네임**이 그대로
 * 나온다. 같은 계정의 캐릭터 셋으로 교차 검증했고(정답지는 `character/list`),
 * 길드 샘플 5캐릭이 서로를 가리키는 것도 확인했다(2026-09-25).
 *
 * 쓰면 안 되는 것들도 실측으로 걸러냈다:
 * - `user/union` / `user/union-artifact` 수치는 **같은 계정이어도 어긋난다**.
 *   캐릭터별 스냅샷 시점이 달라서, 한 사람의 캐릭터가 아티팩트 포인트
 *   18200 / 20000으로 갈렸다. 지문으로 쓰면 한 사람이 둘로 쪼개진다.
 * - `user/union-raider`도 같은 계정에서 캐릭터마다 응답이 달랐다.
 * - 닉네임 유사도 휴리스틱도 틀린다. `2달별` / `별달2` / `2별달`은 이름이
 *   뒤섞인 순열인데 셋 다 같은 사람이었다.
 *
 * 자세한 배경은 `docs/planning/features/guild-admin.md`.
 */

import { nexonDirectGet, NexonDirectApiError } from '@/lib/nexon-direct-client'

interface OcidResponse {
  ocid: string
}

interface UnionChampionEntry {
  champion_name: string
  champion_slot: number
  champion_grade: string
  champion_class: string
}

interface UnionChampionResponse {
  /** 챔피언 미개방은 에러가 아니라 **HTTP 200 + 빈 배열**로 온다(실측 확인). */
  union_champion: UnionChampionEntry[] | null
}

/** 한 번에 몇 명치를 동시에 조회할지.
 *
 * 순회는 원래 "미방문 캐릭터 하나를 골라 → 챔피언 목록을 받아 → 거기 나온
 * 이름들을 방문 처리"의 반복이라 본질적으로 순차다. 그대로 돌리면 캐릭터
 * 하나당 왕복 2회(ocid + 챔피언)가 직렬로 쌓여 느리다.
 *
 * `nexon-direct-client.ts`의 토큰 버킷(200/s)이 실제 상한을 잡으므로 이
 * 숫자는 레이트 리밋이 아니라 왕복 지연을 가리는 용도다. */
const GROUPING_CONCURRENCY = 8

/** 한 묶음에 같은 사람의 캐릭터가 둘 들어가면 그 조회는 낭비다 — 결과가
 * 틀리지는 않지만(union-find가 어차피 합친다) 호출만 늘어난다.
 *
 * 실측(테스트 길드 1024캐릭 / 199명, 2026-09-25)에서 이게 꽤 컸다. 명단을
 * **앞에서부터 연속으로** 집으면 1,562회가 들었는데, 순차로 하나씩 돌리면
 * 682회였다. 부캐가 명단에서 서로 붙어 있어서 한 묶음이 같은 사람으로
 * 채워졌던 것이다.
 *
 * 그래서 미방문 후보를 **명단 전체에 고르게 흩어서** 집는다. 같은 조건에서
 * 640회 / 7.2초로, 연속 방식보다 호출이 2.4배 적으면서 순차보다 4.7배
 * 빨랐다 — 낭비를 없애면서 동시성 이득은 그대로 가져간다. */
function pickSpreadBatch(remaining: string[], size: number): string[] {
  const stride = Math.max(1, Math.floor(remaining.length / size))
  const batch: string[] = []
  for (let i = 0; i < remaining.length && batch.length < size; i += stride) {
    batch.push(remaining[i])
  }
  return batch
}

/** 이름 기준 union-find. 캐릭터의 소유자는 바뀌지 않으므로 한 번 합쳐진
 * 묶음이 쪼개질 일이 없다 — 병합만 있고 분리가 없어서 union-find가 정확히
 * 맞는 자료구조다. */
class NameUnionFind {
  private readonly parent = new Map<string, string>()

  find(name: string): string {
    const seen = this.parent.get(name)
    if (seen === undefined) {
      this.parent.set(name, name)
      return name
    }
    if (seen === name) return name
    const root = this.find(seen)
    this.parent.set(name, root)
    return root
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootB, rootA)
  }

  /** 루트별로 모은 묶음. 입력에 한 번이라도 등장한 이름만 나온다. */
  groups(): Map<string, string[]> {
    const grouped = new Map<string, string[]>()
    for (const name of this.parent.keys()) {
      const root = this.find(name)
      const bucket = grouped.get(root)
      if (bucket) bucket.push(name)
      else grouped.set(root, [name])
    }
    return grouped
  }
}

export interface CharacterGroup {
  /** union-find 루트 이름. 식별자일 뿐 "대표 캐릭터"가 아니다 — 대표는
   * 레벨로 정한다(`representativeOf`). */
  id: string
  /** 이 사람이 이 길드에 넣어둔 캐릭터 이름들. 길드 명단 순서를 따른다. */
  members: string[]
}

export interface GroupingFailure {
  characterName: string
  message: string
}

export interface GroupingProgress {
  /** 방문 처리된 캐릭터 수(조회한 수가 아니라 소속이 정해진 수). */
  resolved: number
  total: number
  championCalls: number
}

export interface GroupingResult {
  groups: CharacterGroup[]
  /** 챔피언 목록이 비어 있고, 다른 누구의 챔피언 목록에도 안 나온 캐릭터.
   * 소속을 **모르는** 것이지 "1인 그룹"이 아니라서 따로 둔다. */
  unclassified: string[]
  failures: GroupingFailure[]
  /** 이 함수가 직접 쏜 챔피언 조회 수. ocid 조회는 `resolveOcid`를 주는
   * 쪽(=`useOcidResolver`)이 따로 센다 — 캐시 적중을 호출로 세면 안 되기
   * 때문이다. */
  championCalls: number
}

export interface BuildGroupsOptions {
  /** 이름 → ocid 변환. 캐시를 끼우려고 주입받는다. 캐시 적중은 호출 수에
   * 잡히지 않아야 하므로 `apiCalls` 증가는 이 함수 바깥에서 세지 않는다. */
  resolveOcid: (characterName: string) => Promise<string>
  /** 지난 순회에서 이미 확정된 묶음. 증분 갱신용이다.
   *
   * 캐릭터의 소유자는 **바뀌지 않는다**. 그래서 한 번 확정된 묶음은 쪼개지거나
   * 뒤집힐 일이 없고, 다시 조회할 이유도 없다 — 새로 나타난 이름만 순회하면
   * 된다. 길드 명단은 거의 매일 바뀌는데 한 명 들어올 때마다 수백 번을 다시
   * 쏘면 캐시가 없는 것과 같아진다.
   *
   * 지난번 미분류였던 이름은 여기 넣지 않고 다시 순회한다 — 그 사이 챔피언을
   * 개방했거나 남의 목록에 등장했을 수 있고, 수가 적어 비용도 작다. */
  preassigned?: CharacterGroup[]
  onProgress?: (progress: GroupingProgress) => void
  signal?: AbortSignal
}

function errorMessage(error: unknown): string {
  if (error instanceof NexonDirectApiError) return `${error.code}: ${error.message}`
  if (error instanceof Error) return error.message
  return String(error)
}

/** 한 캐릭터의 챔피언 이름 목록. 미개방이면 빈 배열이다. */
async function fetchChampionNames(ocid: string, apiKey: string): Promise<string[]> {
  const data = await nexonDirectGet<UnionChampionResponse>('/maplestory/v1/user/union-champion', apiKey, {
    ocid,
  })
  return (data.union_champion ?? []).map((entry) => entry.champion_name)
}

/** 길드 명단을 사람 단위로 묶는다.
 *
 * 호출 수는 캐릭터 수가 아니라 **사람 수**에 비례한다. 캐릭터 하나를 조회하면
 * 그 사람의 캐릭터가 최대 6개까지 한꺼번에 방문 처리되기 때문이다. 실측
 * (1024캐릭 / 199명, 2026-09-25): **640회 / 7.2초**로 199명 전원을 묶었고
 * 미분류·실패가 0이었다. 캐릭터당 1회씩 도는 것보다 3배 넘게 적다.
 *
 * 챔피언 5칸에 못 들어간 6번째 캐릭터는 미방문으로 남는데, 그 캐릭터를
 * 조회하면 자기 챔피언 목록이 나오고 기존 그룹과 겹치므로 union-find가 자동
 * 병합한다 — 정확도 손실이 없다.
 */
export async function buildCharacterGroups(
  guildMembers: string[],
  apiKey: string,
  { resolveOcid, preassigned, onProgress, signal }: BuildGroupsOptions,
): Promise<GroupingResult> {
  const guildSet = new Set(guildMembers)
  const unionFind = new NameUnionFind()
  const visited = new Set<string>()
  const failures: GroupingFailure[] = []

  // 이미 확정된 묶음을 먼저 심어둔다. 길드를 떠난 이름은 빼고 심는다 —
  // 남겨두면 지금 명단에 없는 사람이 그룹에 섞인다.
  for (const group of preassigned ?? []) {
    const present = group.members.filter((name) => guildSet.has(name))
    if (present.length === 0) continue
    for (const name of present) {
      unionFind.union(present[0], name)
      visited.add(name)
    }
  }

  /** 챔피언 목록이 비어서 소속을 모르는 캐릭터 후보. 나중에 남의 목록에
   * 등장하면 여기서 빠진다. */
  const emptyChampionNames = new Set<string>()
  /** 누군가의 챔피언 목록에 등장한 적 있는 이름. */
  const appearedInSomeoneList = new Set<string>()
  /** 이름 → 그 계정의 챔피언 목록 지문.
   *
   * 챔피언 목록은 **계정 단위**라 같은 계정의 캐릭터면 어느 쪽으로 조회해도
   * 목록이 완전히 같다(정답지 계정과 실제 길드 양쪽으로 확인). 그래서 목록
   * 자체가 계정 지문이 된다. */
  const fingerprints = new Map<string, string>()

  let championCalls = 0

  function reportProgress() {
    onProgress?.({ resolved: visited.size, total: guildMembers.length, championCalls })
  }

  reportProgress()

  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // 앞선 묶음의 결과로 방문 처리된 이름은 여기서 자연히 빠진다.
    const remaining = guildMembers.filter((name) => !visited.has(name))
    if (remaining.length === 0) break
    const batch = pickSpreadBatch(remaining, GROUPING_CONCURRENCY)

    const settled = await Promise.all(
      batch.map(async (name) => {
        try {
          const ocid = await resolveOcid(name)
          const championNames = await fetchChampionNames(ocid, apiKey)
          return { name, championNames, error: null as string | null }
        } catch (error) {
          return { name, championNames: [] as string[], error: errorMessage(error) }
        }
      }),
    )
    championCalls += batch.length

    for (const { name, championNames, error } of settled) {
      visited.add(name)

      if (error !== null) {
        // 한 캐릭터가 실패해도 순회는 계속한다 — 1000명짜리 조회가 한 명의
        // 400 때문에 통째로 날아가면 안 된다(`nexon-history-range.ts`가
        // 날짜별 실패를 격리하는 것과 같은 이유).
        failures.push({ characterName: name, message: error })
        continue
      }

      if (championNames.length === 0) {
        // 챔피언 미개방. 지금은 소속을 모르지만, 뒤에서 남의 목록에 나올 수
        // 있으므로 후보로만 담아둔다.
        emptyChampionNames.add(name)
        continue
      }

      fingerprints.set(name, JSON.stringify([...championNames].sort()))

      // 챔피언 목록이 비지 않았다면 이 캐릭터의 소속은 확정이다. 길드 밖
      // 챔피언은 무시한다 — 같은 사람이긴 하지만 이 길드의 명단이 아니다.
      // 길드 안 챔피언이 하나도 없으면 "이 길드엔 이 캐릭터 하나뿐인 사람"이
      // 되고, union-find에 혼자 들어가 1인 그룹이 된다.
      unionFind.find(name)
      for (const championName of championNames) {
        if (championName === name) continue
        appearedInSomeoneList.add(championName)
        if (!guildSet.has(championName)) continue
        unionFind.union(name, championName)
        visited.add(championName)
      }
    }

    reportProgress()
  }

  // 지문이 같은 캐릭터끼리 한 번 더 묶는다. **추가 호출이 없다** — 순회
  // 중에 이미 받아둔 목록을 다시 쓰는 것뿐이다.
  //
  // 순회만으로는 과분할이 생긴다. 챔피언은 5칸뿐이라, 길드에 넣은 부캐가
  // 그 5칸 밖이면 서로를 못 가리켜 따로 놀게 된다. 실측에서 키스 길드가
  // 83그룹으로 쪼개졌는데 지문으로 묶으니 48그룹이 됐다(길드 B 64 → 53).
  // 이미 정확했던 길드 A는 199 그대로였다 — 과병합은 만들지 않는다.
  const byFingerprint = new Map<string, string[]>()
  for (const [name, fingerprint] of fingerprints) {
    const bucket = byFingerprint.get(fingerprint)
    if (bucket) bucket.push(name)
    else byFingerprint.set(fingerprint, [name])
  }
  for (const names of byFingerprint.values()) {
    for (let i = 1; i < names.length; i++) unionFind.union(names[0], names[i])
  }

  // 끝까지 아무의 챔피언 목록에도 안 나온 "미개방" 캐릭터만 미분류로 남는다.
  const unclassified = [...emptyChampionNames].filter((name) => !appearedInSomeoneList.has(name))
  const unclassifiedSet = new Set(unclassified)

  // 남의 목록에 등장해 소속이 밝혀진 미개방 캐릭터는 그 그룹에 합쳐준다.
  for (const name of emptyChampionNames) {
    if (unclassifiedSet.has(name)) continue
    unionFind.find(name)
  }

  const memberOrder = new Map(guildMembers.map((name, index) => [name, index]))
  const groups: CharacterGroup[] = []
  for (const [id, members] of unionFind.groups()) {
    const visible = members.filter((name) => guildSet.has(name) && !unclassifiedSet.has(name))
    if (visible.length === 0) continue
    visible.sort((a, b) => (memberOrder.get(a) ?? 0) - (memberOrder.get(b) ?? 0))
    groups.push({ id, members: visible })
  }

  // 캐릭터를 많이 넣어둔 사람이 위로. 같은 크기면 명단 순서를 따른다.
  groups.sort((a, b) => {
    if (b.members.length !== a.members.length) return b.members.length - a.members.length
    return (memberOrder.get(a.members[0]) ?? 0) - (memberOrder.get(b.members[0]) ?? 0)
  })

  unclassified.sort((a, b) => (memberOrder.get(a) ?? 0) - (memberOrder.get(b) ?? 0))

  return { groups, unclassified, failures, championCalls }
}

/** 레벨로 대표를 고른다 — 가장 높은 캐릭터, 같으면 명단 순서가 앞인 쪽.
 * 그룹 멤버는 길드 명단 순서라 첫 캐릭터가 본캐라는 보장이 없다(2026-10-04
 * 확인). 레벨을 하나도 모르면 `null`. */
export function pickByLevel(
  members: readonly string[],
  levels: Readonly<Record<string, number>>,
): string | null {
  let best: string | null = null
  for (const name of members) {
    const level = levels[name]
    if (level === undefined) continue
    if (best === null || level > levels[best]) best = name
  }
  return best
}

export interface LevelProgress {
  done: number
  total: number
}

/** 한 캐릭터를 받아온 그때의 레벨·직업. 그룹 탭에 작게 보여준다. */
export interface CharacterProfileSnapshot {
  level: number
  job: string
  /** 받아온 때(ISO). 레벨은 계속 바뀌니 언제 값인지 같이 둔다. */
  checkedAt: string
}

/** 캐릭터들의 **지금 레벨·직업**을 받아온다. 대표가 없는 그룹의 대표를 고를 때와,
 * 그룹 탭에서 모르는 캐릭터를 채울 때 쓴다. 받은 값은 그룹 저장본에 남긴다.
 *
 * ocid는 그룹화 때 캐시돼 있어 캐릭터당 기본 정보 1회다. 실패한 캐릭터는
 * 건너뛴다 — 한 명 때문에 수백 명분이 날아가면 안 된다. */
export async function fetchProfiles(
  names: readonly string[],
  apiKey: string,
  {
    resolveOcid,
    onProgress,
    signal,
  }: {
    resolveOcid: (characterName: string) => Promise<string>
    onProgress?: (progress: LevelProgress) => void
    signal?: AbortSignal
  },
): Promise<{ profiles: Record<string, CharacterProfileSnapshot>; calls: number; failures: string[] }> {
  const profiles: Record<string, CharacterProfileSnapshot> = {}
  const failures: string[] = []
  const checkedAt = new Date().toISOString()
  let done = 0
  onProgress?.({ done, total: names.length })
  for (let start = 0; start < names.length; start += GROUPING_CONCURRENCY) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const batch = names.slice(start, start + GROUPING_CONCURRENCY)
    await Promise.all(
      batch.map(async (name) => {
        try {
          const ocid = await resolveOcid(name)
          const data = await nexonDirectGet<{ character_level: number | null; character_class: string | null }>(
            '/maplestory/v1/character/basic',
            apiKey,
            { ocid },
          )
          if (typeof data.character_level === 'number') {
            profiles[name] = { level: data.character_level, job: data.character_class ?? '', checkedAt }
          } else failures.push(name)
        } catch {
          failures.push(name)
        }
      }),
    )
    done += batch.length
    onProgress?.({ done, total: names.length })
  }
  return { profiles, calls: names.length, failures }
}

/** 이름으로 ocid 하나를 받아온다. `resolveOcid`에 캐시를 끼울 때 실제 조회
 * 부분으로 쓴다. */
export async function fetchOcid(characterName: string, apiKey: string): Promise<string> {
  const data = await nexonDirectGet<OcidResponse>('/maplestory/v1/id', apiKey, {
    character_name: characterName,
  })
  return data.ocid
}
