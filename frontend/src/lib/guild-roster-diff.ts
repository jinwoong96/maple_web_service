/** ① 길드 명단 변동 — 두 시점의 `guild/basic`을 비교해 가입/탈퇴/닉변을 가른다.
 *
 * DB가 필요 없다. 넥슨이 `date`로 과거 명단을 그대로 주기 때문이다
 * (2023-12-21까지).
 *
 * 단순 집합 차집합(`old - new` = 탈퇴, `new - old` = 가입)만으로는 **틀린다**.
 * 실측(길드 A, 2026-08-24 → 2026-09-24, 920 → 1023캐릭)에서 나온
 * 함정이 셋이다.
 *
 * 1. **닉변이 "탈퇴 1 + 가입 1"로 보인다.** `구름빵`가 사라지고 `솜사탕`가
 *    나타났는데, `솜사탕`의 ocid로 한 달 전을 조회하니 이름이 `구름빵`,
 *    길드가 `길드 A`였다 — 같은 캐릭터다.
 * 2. **명단에서 빠졌는데 탈퇴가 아닌 경우가 있다.** 탈퇴 후보 56명 중
 *    **8명**이 캐릭터 정보상 여전히 우리 길드였다. 오프접속(게임 내에서
 *    오프라인으로 표시되는 기능)을 쓰면 캐릭터 정보와 길드 정보 중 한쪽만
 *    갱신돼 어긋나는 일이 있다(사용자 제보, 실측으로 확인).
 * 3. **이름으로 받은 ocid가 남의 캐릭터일 수 있다.** `/id`는 그 이름을
 *    **지금** 들고 있는 캐릭터를 준다. 원래 주인이 닉네임을 바꾸거나 팔면
 *    그 이름을 다른 사람이 가져갈 수 있고, 그러면 생판 모르는 캐릭터의
 *    길드가 "탈퇴자의 새 길드"로 찍힌다.
 *
 *    실제로 처음엔 `초코칩`를 "다른 월드로 이동"으로 잘못 읽었다.
 *    두 월드 사이 월드 리프는 시스템상 불가능하고(사용자 확인), 닉네임만
 *    넘어간 경우였다.
 *
 *    그래서 사라진 이름은 **신원을 확인한 뒤에만** 쓴다 — 받은 ocid로 비교
 *    시작 시점을 조회해 그때 이름이 그 이름이었고 그때 우리 길드였는지 본다.
 *    아니면 남의 캐릭터다.
 *
 * 그래서 후보를 찾은 뒤 **양쪽 모두 캐릭터 정보로 한 번 더 확인**한다.
 */

import { nexonDirectGet, NexonDirectApiError } from '@/lib/nexon-direct-client'
import { buildCharacterGroups, type CharacterGroup } from '@/lib/guild-admin-grouping'
import { canLeapBetween } from '@/lib/maplestory-worlds'

interface CharacterBasicResponse {
  character_name: string
  world_name: string
  character_level: number
  character_guild_name: string | null
  /** 캐릭터 생성일. **월드 리프를 하면 리프한 날로 찍힌다** — 원래 생성일이
   * 아니다.
   *
   * 스카니아 283~291 레벨대(랭킹 2만~10만위) 300명을 뽑아보니 **90명(30%)이
   * 2026-06-18 생성**이었다. 이번 리프 이벤트 시작일이다. 그 다음으로 흔한
   * 2025-06-19(50명)·2025-12-18(20명)·2024-12-19(4명)도 6월·12월 중순으로,
   * 이전 리프 이벤트 날짜 패턴과 맞는다.
   *
   * (298~300 레벨대만 보면 이런 날짜가 한 명도 안 나온다 — 리프해서 올라온
   * 캐릭터는 최상위권에 아직 없기 때문이다. 표본을 잘못 잡으면 정반대
   * 결론이 나온다.)
   *
   * 다만 **판정의 필요조건으로는 쓰지 않는다.** 비교 구간이 리프일보다 뒤면
   * 생성일이 구간 시작보다 앞서게 되는데, 그렇다고 리프가 아닌 건 아니다.
   * 판정은 리프 가능 월드인지로 하고, 생성일은 화면에 같이 보여줘 사람이
   * 확인할 수 있게만 한다. */
  character_date_create: string | null
}

/** 후보 확인은 캐릭터마다 독립적이라 그냥 동시에 던진다. ⓪의 순회와 달리
 * "누구를 다음에 볼지"가 앞선 결과에 안 달려 있어서 흩어 집기 같은 요령이
 * 필요 없다. 상한은 `nexon-direct-client.ts`의 토큰 버킷(200/s)이 잡는다. */
const DIFF_CONCURRENCY = 12

export type LeftReason =
  /** 길드를 나갔다. **확인된 사실이다** — 비교 시작 시점에 그 이름·그 월드의
   * 캐릭터였고, 지금은 우리 길드가 아니다. `currentGuildName`이 지금 소속. */
  | 'left'
  /** **이 이름으로는 더 이상 추적할 수 없다.**
   *
   * 원인이 여럿인데 **서로 구분되지 않는다** — 탈퇴 후 닉변, 캐릭터 삭제,
   * 월드 리프, 닉네임 이전이 모두 같은 모습으로 나타난다.
   *
   * 한동안 이걸 `world-moved` / `name-taken` / `unresolved`로 쪼개 보여줬는데,
   * 쪼갤수록 **확신할 수 없는 걸 확신하는 것처럼** 보였고 실제로 오보도 냈다
   * (길드원 6명을 동명이인과 묶어 "월드 이동"으로 표시). 구분이 안
   * 되면 구분하지 않는 편이 낫다(사용자 제안, 2026-09-26).
   *
   * 대신 **알아낸 단서는 그대로 보여준다** — `untraceableHint` 참고. */
  | 'untraceable'

/** `untraceable`일 때 화면에 보여줄 단서. 원인을 단정하지 않고 관측된 사실만
 * 말한다. */
export type UntraceableHint =
  /** 이 이름으로 조회되는 캐릭터가 아예 없다. */
  | 'not-found'
  /** 같은 이름의 캐릭터가 **리프로 갈 수 있는 다른 월드**에 있다. 그 사람이
   * 옮겨간 것일 수도, 원래 거기 있던 동명이인일 수도 있다. */
  | 'same-name-reachable-world'
  /** 같은 이름의 캐릭터가 있는데 **리프로는 갈 수 없는 월드**다. 이건
   * 확정적으로 **다른 사람**이다 — 우리 길드원이 그 월드로 갈 방법이 없다. */
  | 'same-name-unreachable-world'
  /** 그 이름을 쓰는 캐릭터가 비교 시작 시점에는 **다른 이름**이었다.
   * 닉네임이 넘어간 것이라 역시 다른 사람이다. */
  | 'name-reused'

export interface JoinedEntry {
  characterName: string
  level: number | null
  /** 비교 시작 시점의 닉네임. 지금과 다르면 그 사이 닉변한 것이다. */
  previousName: string | null
  /** 비교 시작 시점의 길드. `null`이면 길드 없음, `undefined`면 확인 못 함.
   *
   * 화면에서는 `null`을 `X`로 쓴다 — `무길드`라는 이름의 길드가 실제로 있을
   * 수 있어서 글자로 쓰면 구별되지 않는다. */
  previousGuildName: string | null | undefined
}

export interface LeftEntry {
  characterName: string
  level: number | null
  reason: LeftReason
  /** `left`일 때 지금 소속 길드. `null`이면 길드 없음, `undefined`면 알 수 없음. */
  currentGuildName: string | null | undefined
  /** 길드 명단에서는 빠졌는데 **캐릭터 정보는 아직 우리 길드**로 남아 있다.
   *
   * 예전엔 "명단 어긋남(탈퇴 아님)"으로 따로 뺐는데, 오프접속이면 갱신이 안 되는 쪽은
   * **캐릭터 정보**이고 길드 명단은 갱신된다(2026-10-04 사용자 판단). 그래서 길드 명단을
   * 믿고 탈퇴로 센다. 어디로 갔는지는 알 수 없어 `currentGuildName`은 비운다. */
  staleCharacterInfo?: boolean
  /** `untraceable`일 때의 단서. */
  hint?: UntraceableHint
  /** 단서로 찾은 캐릭터의 월드. 우리 길드원이라고 단정하지 않는다. */
  foundWorldName?: string | null
  /** 단서로 찾은 캐릭터의 생성일. 리프 이벤트 시작일이면 리프 가능성이
   * 높다는 정도의 참고 자료다. */
  foundCreatedAt?: string | null
}

export interface RenamedEntry {
  fromName: string
  toName: string
  level: number | null
}

export interface RosterDiffResult {
  joined: JoinedEntry[]
  left: LeftEntry[]
  /** 우리 길드 안에서 일어난 닉변. 가입/탈퇴 어느 쪽에도 세지 않는다. */
  renamed: RenamedEntry[]
  /** 이 함수가 직접 쏜 `character/basic` 조회 수. ocid 조회는 `resolveOcid`를
   * 주는 쪽이 따로 센다(캐시 적중을 호출로 세면 안 되기 때문). */
  basicCalls: number
  /** 챔피언 조회 수 — 아래 `personGroups`를 만드느라 쓴 것. */
  championCalls: number
  /** 가입/탈퇴한 캐릭터를 사람 단위로 묶은 결과.
   *
   * ⓪의 그룹만으로는 부족하다. ⓪은 **현재 명단** 기준이라 이미 나간
   * 캐릭터가 아예 없어서, 한 사람이 캐릭터 6개를 들고 나가도 6줄로 흩어진다
   * (실측: `곰돌` 외 5캐릭). 그래서 ⓪이 모르는 이름만 따로 챔피언 순회를
   * 돌려 묶는다 — 유니온 챔피언은 계정 단위 데이터라 길드를 나간 뒤에도
   * 서로를 가리킨다. */
  personGroups: CharacterGroup[]
}

export interface RosterDiffProgress {
  resolved: number
  total: number
  basicCalls: number
}

export interface RosterDiffOptions {
  /** ⓪에서 만들어둔 그룹. 현재 명단에 있는 캐릭터는 이걸로 공짜로 묶이고,
   * 여기 없는 이름만 추가로 순회한다. */
  knownGroups?: CharacterGroup[] | null
  /** 이름 → ocid. ⓪과 같은 캐시를 공유한다.
   *
   * 월드 리프로 ocid가 바뀌었을 수 있으므로, 캐시된 ocid로 조회가 실패하면
   * 캐시를 버리고 이름으로 다시 받아야 한다 — 그 재시도는 이 함수를 주는
   * 쪽에서 `forceRefresh`로 처리한다. */
  resolveOcid: (characterName: string, forceRefresh?: boolean) => Promise<string>
  onProgress?: (progress: RosterDiffProgress) => void
  signal?: AbortSignal
}

async function fetchBasic(
  ocid: string,
  apiKey: string,
  date?: string,
): Promise<CharacterBasicResponse> {
  return nexonDirectGet<CharacterBasicResponse>('/maplestory/v1/character/basic', apiKey, {
    ocid,
    date,
  })
}

/** 동시에 최대 `DIFF_CONCURRENCY`개씩 처리하는 작업 풀. */
async function mapPool<TIn, TOut>(
  items: TIn[],
  worker: (item: TIn) => Promise<TOut>,
  signal?: AbortSignal,
): Promise<TOut[]> {
  const results: TOut[] = new Array<TOut>(items.length)
  let cursor = 0
  async function drain() {
    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(DIFF_CONCURRENCY, items.length) }, () => drain()),
  )
  return results
}

interface AppearedProbe {
  name: string
  basic: CharacterBasicResponse | null
}

interface DisappearedProbe {
  name: string
  /** 신원 확인을 통과한 경우의 **현재** 상태. */
  basic: CharacterBasicResponse | null
  /** 이름으로 조회가 아예 안 됨 — 닉변했거나 캐릭터가 사라졌다. */
  missing: boolean
  /** 그 이름을 쓰는 캐릭터가 비교 시작 시점엔 **다른 이름**이었다. 남의
   * 캐릭터가 확실하다. */
  nameTaken: boolean
  /** 비교 시작 시점 이력이 없다. 리프·삭제·닉변이 다 이 모습이라 원인을
   * 가릴 수 없다. */
  untraceable: boolean
}

export interface RosterDiffInput {
  guildName: string
  worldName: string
  /** 비교 시작 시점(과거)의 명단. */
  oldMembers: string[]
  /** 비교 끝 시점(최근)의 명단. */
  newMembers: string[]
  /** 비교 시작 시점의 날짜(`YYYY-MM-DD`). 가입자의 그 시절 이름·길드를
   * 되짚는 데 쓴다. */
  oldDate: string
}

export async function diffRoster(
  { guildName, worldName, oldMembers, newMembers, oldDate }: RosterDiffInput,
  apiKey: string,
  { resolveOcid, knownGroups, onProgress, signal }: RosterDiffOptions,
): Promise<RosterDiffResult> {
  const oldSet = new Set(oldMembers)
  const newSet = new Set(newMembers)
  const appeared = newMembers.filter((name) => !oldSet.has(name))
  const disappeared = oldMembers.filter((name) => !newSet.has(name))

  const total = appeared.length + disappeared.length
  let basicCalls = 0
  let resolved = 0
  function tick() {
    resolved += 1
    onProgress?.({ resolved, total, basicCalls })
  }
  onProgress?.({ resolved: 0, total, basicCalls })

  // 새로 나타난 이름 — **비교 시작 시점**의 모습을 본다. 그때 이름이 다르면
  // 그 사이 닉변한 것이고, 그때 길드가 우리 길드면 나간 적이 없는 것이다.
  const appearedProbes = await mapPool<string, AppearedProbe>(
    appeared,
    async (name) => {
      try {
        const ocid = await resolveOcid(name)
        basicCalls += 1
        const basic = await fetchBasic(ocid, apiKey, oldDate)
        return { name, basic }
      } catch {
        // 그 시점에 아직 없던 캐릭터이거나 조회 실패. 어느 쪽이든 "신규
        // 가입인데 이전 내력을 모름"으로 다룬다.
        return { name, basic: null }
      } finally {
        tick()
      }
    },
    signal,
  )

  /** 받은 ocid가 **정말 그 캐릭터**인지 본다.
   *
   * `/id`는 그 이름을 지금 들고 있는 캐릭터를 주므로, 닉네임이 넘어갔으면
   * 남이 나온다. 비교 시작 시점에 그 이름이었는지, 그리고 같은 월드인지
   * 확인한다.
   *
   * **길드는 보지 않는다.** 처음엔 "그때 우리 길드였는지"까지 봤는데 오탐이
   * 났다 — `두부조오림`은 그 시점 길드 명단에는 있었는데 캐릭터 정보상
   * 길드가 `null`이었다(함정 2의 어긋남이 반대 방향으로 나타난 것). 이름은
   * 한 월드 안에서 유일하므로 **이름 + 월드**만으로 충분하다. */
  type Verdict = 'same' | 'other' | 'no-history'
  async function verifyIdentity(ocid: string, name: string): Promise<Verdict> {
    let past: CharacterBasicResponse
    try {
      past = await fetchBasic(ocid, apiKey, oldDate)
      basicCalls += 1
    } catch {
      basicCalls += 1
      return 'no-history'
    }
    if (past.character_name === null) return 'no-history'
    return past.character_name === name && past.world_name === worldName ? 'same' : 'other'
  }

  // 사라진 이름 — 신원을 확인한 뒤 **지금**의 모습을 본다. 아직 우리 길드면
  // 탈퇴가 아니다.
  const disappearedProbes = await mapPool<string, DisappearedProbe>(
    disappeared,
    async (name) => {
      try {
        let ocid: string
        try {
          ocid = await resolveOcid(name)
        } catch (first) {
          // 서버 장애면 재시도해도 같은 결과다.
          if (first instanceof NexonDirectApiError && first.status >= 500) throw first
          throw first
        }

        let verdict = await verifyIdentity(ocid, name)
        if (verdict !== 'same') {
          // 캐시해둔 ocid가 오래됐을 수 있으니 이름으로 새로 받아 한 번 더 본다.
          const fresh = await resolveOcid(name, true)
          if (fresh !== ocid) {
            ocid = fresh
            verdict = await verifyIdentity(ocid, name)
          }
        }

        const basic = await fetchBasic(ocid, apiKey)
        basicCalls += 1

        if (verdict === 'other') {
          // 비교 시작 시점에 **다른 이름으로 존재하던** 캐릭터다. 이 ocid로
          // 알아낸 길드·월드는 남의 것이라 버린다(실측: `로키`의 과거 이름은
          // `덤블`이었다).
          return { name, basic: null, missing: false, nameTaken: true, untraceable: false }
        }
        if (verdict === 'no-history') {
          // 비교 시작 시점에 이 ocid가 **없었다**. 월드 리프도, 캐릭터 삭제
          // 후 누군가 그 이름을 새로 쓴 것도, 닉변도 전부 이 모습이라 원인을
          // 가릴 수 없다. 이름이 같으면 단서로 쓸 수 있게 넘기고, 다르면
          // 아예 남의 캐릭터라 넘기지 않는다.
          return basic.character_name === name
            ? { name, basic, missing: false, nameTaken: false, untraceable: true }
            : { name, basic: null, missing: false, nameTaken: true, untraceable: false }
        }

        return { name, basic, missing: false, nameTaken: false, untraceable: false }
      } catch {
        return { name, basic: null, missing: true, nameTaken: false, untraceable: false }
      } finally {
        tick()
      }
    },
    signal,
  )

  // 닉변 짝짓기: 새 이름의 과거 이름이 사라진 이름 목록에 있고, 그때 우리
  // 길드 소속이었다면 같은 캐릭터다.
  const disappearedSet = new Set(disappeared)
  const renamed: RenamedEntry[] = []
  const renamedFrom = new Set<string>()
  const renamedTo = new Set<string>()

  for (const probe of appearedProbes) {
    const past = probe.basic
    if (!past) continue
    if (past.character_name === probe.name) continue
    if (!disappearedSet.has(past.character_name)) continue
    if (past.character_guild_name !== guildName) continue
    renamed.push({
      fromName: past.character_name,
      toName: probe.name,
      level: past.character_level ?? null,
    })
    renamedFrom.add(past.character_name)
    renamedTo.add(probe.name)
  }

  const joined: JoinedEntry[] = appearedProbes
    .filter((probe) => !renamedTo.has(probe.name))
    .map((probe) => ({
      characterName: probe.name,
      level: probe.basic?.character_level ?? null,
      // 이름이 달랐다면 그 사이 닉변한 것이다. 우리 길드와 무관한 닉변이라
      // `renamed`에는 안 들어가지만, 누구인지 알아보는 데 도움이 된다.
      previousName:
        probe.basic && probe.basic.character_name !== probe.name
          ? probe.basic.character_name
          : null,
      previousGuildName: probe.basic ? probe.basic.character_guild_name : undefined,
    }))

  const left: LeftEntry[] = disappearedProbes
    .filter((probe) => !renamedFrom.has(probe.name))
    .map((probe): LeftEntry => {
      // 이름으로 아무것도 안 나온다 — 닉변했거나 캐릭터가 사라졌다.
      if (probe.missing) {
        return {
          characterName: probe.name,
          level: null,
          reason: 'untraceable',
          currentGuildName: null,
          hint: 'not-found',
        }
      }
      // 그 이름을 쓰는 캐릭터가 비교 시작 시점엔 다른 이름이었다.
      if (probe.nameTaken && !probe.basic) {
        return {
          characterName: probe.name,
          level: null,
          reason: 'untraceable',
          currentGuildName: null,
          hint: 'name-reused',
        }
      }
      const basic = probe.basic
      if (!basic) {
        return {
          characterName: probe.name,
          level: null,
          reason: 'untraceable',
          currentGuildName: null,
          hint: 'not-found',
        }
      }
      // 비교 시작 시점 이력이 없다 — 같은 이름이 다른 월드에 있는 경우.
      // 옮겨간 것인지 동명이인인지는 가릴 수 없다. 리프로 갈 수 없는
      // 월드라면 **확정적으로 다른 사람**이라는 것만 말해준다.
      if (probe.untraceable) {
        return {
          characterName: probe.name,
          level: basic.character_level ?? null,
          reason: 'untraceable',
          currentGuildName: null,
          hint: canLeapBetween(worldName, basic.world_name)
            ? 'same-name-reachable-world'
            : 'same-name-unreachable-world',
          foundWorldName: basic.world_name ?? null,
          foundCreatedAt: basic.character_date_create?.slice(0, 10) ?? null,
        }
      }
      return {
        characterName: probe.name,
        level: basic.character_level ?? null,
        reason: 'left',
        // 캐릭터 정보가 아직 우리 길드면 오프접속으로 갱신이 안 된 것 — 길드 명단을 믿고
        // 탈퇴로 세되, 지금 어디 있는지는 모른다.
        ...(basic.character_guild_name === guildName
          ? { currentGuildName: undefined, staleCharacterInfo: true }
          : { currentGuildName: basic.character_guild_name }),
      }
    })

  // 사람 단위로 묶는다. ⓪이 이미 아는 이름은 건너뛰고 나머지만 순회한다.
  const knownNames = new Set<string>()
  for (const group of knownGroups ?? []) {
    for (const name of group.members) knownNames.add(name)
  }
  const uncovered = [...joined.map((e) => e.characterName), ...left.map((e) => e.characterName)]
    .filter((name) => !knownNames.has(name))

  let championCalls = 0
  let personGroups: CharacterGroup[] = knownGroups ? [...knownGroups] : []
  if (uncovered.length > 0) {
    // **아는 그룹을 심어 두고** 모르는 이름만 순회한다. 그래야 탈퇴한 캐릭터의 챔피언 목록에
    // 아직 길드에 남은 같은 사람의 캐릭터가 나올 때 그 그룹에 붙는다 — 모르는 이름끼리만
    // 묶으면 "일부 캐릭터만 탈퇴"가 "사람이 떠남"으로 보인다(2026-10-04). 순회 대상은
    // 그대로라 호출 수는 같다.
    const extra = await buildCharacterGroups([...knownNames, ...uncovered], apiKey, {
      resolveOcid,
      preassigned: knownGroups ?? undefined,
      signal,
    })
    championCalls = extra.championCalls
    personGroups = [...extra.groups]
    // 미분류로 남은 건 혼자인 것으로 둔다 — 못 묶었을 뿐 화면에서 빠지면 안 된다.
    for (const name of extra.unclassified) {
      personGroups.push({ id: name, members: [name] })
    }
  }

  return { joined, left, renamed, basicCalls, championCalls, personGroups }
}

/** 사람 수와 캐릭터 수. 같은 그룹(⓪) 캐릭터는 합쳐 1명, 그룹에 없는 캐릭터는 각자 1명. */
export interface HeadCount {
  people: number
  characters: number
}

/** 이름들을 사람 단위로 센다. */
export function countPeople(names: readonly string[], groups: CharacterGroup[] | null): HeadCount {
  const groupIdByName = new Map<string, string>()
  for (const group of groups ?? []) for (const name of group.members) groupIdByName.set(name, group.id)
  return {
    people: new Set(names.map((name) => groupIdByName.get(name) ?? `solo:${name}`)).size,
    characters: names.length,
  }
}

/** 가입·탈퇴한 캐릭터를 **사람 단위로 갈라** 본다(2026-10-04 사용자 요청).
 *
 * - 가입: 그 사람(⓪ 그룹)의 다른 캐릭터가 **이미 길드에 있었으면** 기존 길드원이 캐릭터를
 *   더한 것, 없으면 새로 온 사람(새 그룹).
 * - 탈퇴: 그 사람의 다른 캐릭터가 **아직 길드에 남아 있으면** 일부 캐릭터만 빠진 것, 아니면
 *   사람이 떠난 것(그룹이 없어짐).
 *
 * `roster`는 견줄 명단 — 가입이면 이전 명단, 탈퇴면 이후 명단. 그룹에 없는 캐릭터는 견줄
 * 다른 캐릭터를 몰라 새로 온 사람/떠난 사람으로 본다. 돌려주는 `others`는 그 명단에 있는
 * 같은 사람의 다른 캐릭터다. */
export function splitByPersonPresence(
  names: readonly string[],
  groups: readonly { id: string; members: string[] }[] | null,
  roster: ReadonlySet<string>,
): { whole: string[]; partial: string[]; others: Map<string, string[]> } {
  const groupOf = new Map<string, { id: string; members: string[] }>()
  for (const group of groups ?? []) for (const name of group.members) groupOf.set(name, group)
  const moving = new Set(names)
  const whole: string[] = []
  const partial: string[] = []
  const others = new Map<string, string[]>()
  for (const name of names) {
    const group = groupOf.get(name)
    const remaining = (group?.members ?? []).filter((member) => !moving.has(member) && roster.has(member))
    if (remaining.length > 0) {
      partial.push(name)
      others.set(name, remaining)
    } else whole.push(name)
  }
  return { whole, partial, others }
}

/** 들어오거나 나간 사람을 "사람 전체"와 "일부 캐릭터"로 나눈 수. */
export interface FlowCount extends HeadCount {
  /** 들어옴: 새로 온 사람(새 그룹) / 나감: 떠난 사람(그룹이 없어짐). */
  whole: HeadCount
  /** 들어옴: 기존 길드원의 캐릭터 추가 / 나감: 일부 캐릭터만 탈퇴. */
  partial: HeadCount
}

export interface GuildFlow {
  guildName: string
  incoming: FlowCount
  outgoing: FlowCount
  /** 연합 안의 길드인가. 그러면 유입·유출이 아니라 **연합 내 이동**이다. */
  alliance: boolean
}

/** 어느 길드와 사람이 오갔는지. 운영진이 제일 먼저 보고 싶어하는 정보라
 * 따로 뽑는다 — 실측에서 한 달 사이 `길드 C`와 27명 들어오고 17명 나갔다.
 *
 * **사람 단위로 센다**(2026-10-04). 한 사람이 캐릭터 6개를 데리고 옮기면 예전엔
 * "6명"으로 셌다. 캐릭터 수는 같이 둔다. */
export function summarizeGuildFlow(
  result: RosterDiffResult,
  allianceGuildNames: ReadonlySet<string> = new Set(),
  /** 일부 캐릭터만 움직인 이름 — 가입이면 기존 그룹에 더해진 캐릭터, 탈퇴면 그룹에 다른
   * 캐릭터가 남은 캐릭터(`splitByPersonPresence`의 `partial`). */
  partial: { joined: ReadonlySet<string>; left: ReadonlySet<string> } = { joined: new Set(), left: new Set() },
): GuildFlow[] {
  const names = new Map<string, { incoming: string[]; outgoing: string[] }>()
  function bump(guildName: string | null | undefined, key: 'incoming' | 'outgoing', characterName: string) {
    if (!guildName) return // 길드 없음/확인 불가는 흐름이 아니다
    const entry = names.get(guildName) ?? { incoming: [], outgoing: [] }
    entry[key].push(characterName)
    names.set(guildName, entry)
  }
  for (const entry of result.joined) bump(entry.previousGuildName, 'incoming', entry.characterName)
  for (const entry of result.left) {
    // 확인된 탈퇴만 흐름에 센다. 추적 불가는 어디로 갔는지 모른다.
    if (entry.reason === 'left') bump(entry.currentGuildName, 'outgoing', entry.characterName)
  }
  const flowCount = (list: string[], partialNames: ReadonlySet<string>): FlowCount => ({
    ...countPeople(list, result.personGroups),
    whole: countPeople(
      list.filter((name) => !partialNames.has(name)),
      result.personGroups,
    ),
    partial: countPeople(
      list.filter((name) => partialNames.has(name)),
      result.personGroups,
    ),
  })
  return [...names.entries()]
    .map(([guildName, entry]) => ({
      guildName,
      incoming: flowCount(entry.incoming, partial.joined),
      outgoing: flowCount(entry.outgoing, partial.left),
      alliance: allianceGuildNames.has(guildName),
    }))
    .sort((a, b) => b.incoming.people + b.outgoing.people - (a.incoming.people + a.outgoing.people))
}

export interface PersonCluster<T> {
  /** ⓪ 그룹에서 찾은 같은 사람의 캐릭터들. 못 찾으면 캐릭터 하나짜리다. */
  entries: T[]
  /** 묶인 근거가 ⓪ 그룹인지(아니면 그냥 개별 캐릭터인지). */
  grouped: boolean
}

/** 가입/탈퇴를 사람 단위로 묶는다. 한 사람이 나가면 캐릭터가 6줄로
 * 늘어나는데, 운영진이 알고 싶은 건 "누가 나갔나"지 "캐릭터 몇 개가
 * 사라졌나"가 아니다. */
export function clusterByPerson<T extends { characterName: string }>(
  entries: T[],
  groups: CharacterGroup[] | null,
): PersonCluster<T>[] {
  if (!groups || groups.length === 0) {
    return entries.map((entry) => ({ entries: [entry], grouped: false }))
  }
  const groupIdByName = new Map<string, string>()
  for (const group of groups) {
    for (const name of group.members) groupIdByName.set(name, group.id)
  }

  const clustered = new Map<string, T[]>()
  const loose: PersonCluster<T>[] = []
  for (const entry of entries) {
    const groupId = groupIdByName.get(entry.characterName)
    if (groupId === undefined) {
      loose.push({ entries: [entry], grouped: false })
      continue
    }
    const bucket = clustered.get(groupId)
    if (bucket) bucket.push(entry)
    else clustered.set(groupId, [entry])
  }

  const result = [...clustered.values()].map((group) => ({ entries: group, grouped: true }))
  result.push(...loose)
  // 캐릭터를 많이 들고 움직인 사람이 위로.
  result.sort((a, b) => b.entries.length - a.entries.length)
  return result
}


/** 연합 내 길드 간 이동인가.
 *
 * 운영진이 명단 변동을 보는 이유는 "몇 명 빠졌나"인데, **옆 길드로 옮긴
 * 사람이 탈퇴로 잡히면 그 숫자가 거짓이 된다.** 그래서 가입/탈퇴 집계에서
 * 빼고 따로 묶는다. 양쪽 길드 화면에서 같은 사건이 같은 이름으로 보인다.
 *
 * **길드명으로 맞춘다.** 진단이 돌려주는 것이 `oguild_id`가 아니라 길드명이기
 * 때문이다. 연합 목록의 길드명도 스냅샷이라, 길드가 이름을 바꾸고 연합
 * 목록이 아직 갱신되지 않은 짧은 동안에는 이동이 탈퇴로 보일 수 있다.
 * 그 경우 사람이 다시 인증하면 스냅샷이 갱신된다.
 */
export function isAllianceMove(
  guildName: string | null | undefined,
  allianceGuildNames: ReadonlySet<string>,
): boolean {
  return typeof guildName === 'string' && allianceGuildNames.has(guildName)
}
