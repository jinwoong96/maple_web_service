import { useEffect, useState } from 'react'

/** 길드 관리에서 자주 여는 길드. **이 브라우저에만** 저장한다.
 *
 * 길드 관리는 운영하는 길드 몇 개만 계속 쓰게 된다(2026-10-04 사용자 요청). 매번 길드명과
 * 월드명을 다시 치지 않도록, 눌러서 바로 불러오게 한다. 길드명은 바뀔 수 있지만 그때는
 * 새 이름으로 다시 추가하면 된다 — 몇 개 안 되는 값이라 식별자(oguild_id)까지 들고 있지 않는다.
 */

const STORAGE_KEY = 'maple-log:guild-admin:favorites'

export interface GuildFavorite {
  guildName: string
  worldName: string
}

function load(): GuildFavorite[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): GuildFavorite[] => {
      if (typeof item !== 'object' || item === null) return []
      const { guildName, worldName } = item as Record<string, unknown>
      return typeof guildName === 'string' && typeof worldName === 'string' ? [{ guildName, worldName }] : []
    })
  } catch {
    return []
  }
}

function sameGuild(a: GuildFavorite, b: GuildFavorite): boolean {
  return a.guildName === b.guildName && a.worldName === b.worldName
}

export function useGuildFavorites() {
  const [favorites, setFavorites] = useState<GuildFavorite[]>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      // 저장 못 해도 이번 화면에서는 그대로 쓴다.
    }
  }, [favorites])

  return {
    favorites,
    isFavorite: (guild: GuildFavorite) => favorites.some((favorite) => sameGuild(favorite, guild)),
    toggle: (guild: GuildFavorite) =>
      setFavorites((prev) =>
        prev.some((favorite) => sameGuild(favorite, guild))
          ? prev.filter((favorite) => !sameGuild(favorite, guild))
          : [...prev, guild],
      ),
    remove: (guild: GuildFavorite) => setFavorites((prev) => prev.filter((favorite) => !sameGuild(favorite, guild))),
  }
}
