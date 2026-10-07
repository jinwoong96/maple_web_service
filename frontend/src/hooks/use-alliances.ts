import { useCallback, useEffect, useState } from 'react'

/** 연합길드 — **이 브라우저에만** 남기는 `{ 연합 이름, 길드명 목록 }` 묶음들.
 *
 * 넥슨 API는 연합을 알려주지 않는다. 예전에는 서버에 연합을 만들고 운영진
 * 인증으로 지켰는데, 2026-10-04 운영진 인증을 없애면서 브라우저로 옮겼다.
 * 쓰는 곳이 "명단 변동에서 연합 안의 다른 길드로 옮긴 사람을 탈퇴로 세지
 * 않기" 하나라, 길드 이름만 있으면 된다.
 *
 * 한 사람이 연합을 여럿 셀 수 있다. 지금 불러온 길드가 들어 있는 연합을 모두
 * 찾아, 그 연합들의 다른 길드 이름을 합쳐 쓴다.
 */

const STORAGE_KEY = 'maple-log:guild-alliances'

export interface LocalAlliance {
  id: string
  name: string
  guilds: string[]
}

function load(): LocalAlliance[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): LocalAlliance[] => {
      if (typeof item !== 'object' || item === null) return []
      const { id, name, guilds } = item as Record<string, unknown>
      if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(guilds)) return []
      return [{ id, name, guilds: guilds.filter((guild): guild is string => typeof guild === 'string') }]
    })
  } catch {
    return []
  }
}

function save(alliances: LocalAlliance[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alliances))
  } catch {
    // 저장 실패는 조용히 넘긴다 — 이번 화면에서는 그대로 쓴다.
  }
}

function newId(): string {
  return `alliance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function useAlliances() {
  const [alliances, setAlliances] = useState<LocalAlliance[]>(load)

  useEffect(() => {
    save(alliances)
  }, [alliances])

  const update = useCallback((id: string, change: (alliance: LocalAlliance) => LocalAlliance) => {
    setAlliances((prev) => prev.map((alliance) => (alliance.id === id ? change(alliance) : alliance)))
  }, [])

  return {
    alliances,
    /** 새 연합. 지금 길드를 처음부터 넣어 둔다 — 대개 그 길드의 연합을 만든다. */
    add: (firstGuild: string) =>
      setAlliances((prev) => [...prev, { id: newId(), name: `연합 ${prev.length + 1}`, guilds: [firstGuild] }]),
    remove: (id: string) => setAlliances((prev) => prev.filter((alliance) => alliance.id !== id)),
    rename: (id: string, name: string) => update(id, (alliance) => ({ ...alliance, name })),
    addGuild: (id: string, guild: string) =>
      update(id, (alliance) =>
        alliance.guilds.includes(guild) ? alliance : { ...alliance, guilds: [...alliance.guilds, guild] },
      ),
    removeGuild: (id: string, guild: string) =>
      update(id, (alliance) => ({ ...alliance, guilds: alliance.guilds.filter((name) => name !== guild) })),
  }
}

/** 이 길드가 든 연합들의 **다른** 길드 이름. 명단 변동의 "연합 내 이동" 판정에 쓴다. */
export function allianceNeighbours(alliances: readonly LocalAlliance[], guildName: string): Set<string> {
  const names = new Set<string>()
  for (const alliance of alliances) {
    if (!alliance.guilds.includes(guildName)) continue
    for (const name of alliance.guilds) if (name !== guildName) names.add(name)
  }
  return names
}
