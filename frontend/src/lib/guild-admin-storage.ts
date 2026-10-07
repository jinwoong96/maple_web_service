/** 길드 관리 탭이 localStorage에 남기는 **이름 → ocid 캐시**.
 *
 * 다시 만들려면 수백 번의 API 호출이 드는 값이다. 그룹 결과는 2026-10-04
 * 브라우저 DB로 옮겼다(`grouping-store.ts`).
 *
 * 반대로 **조회 결과 자체(캐릭터 기본정보·장비 응답)는 저장하지 않는다.**
 * 1000명 × 2시점 응답은 `localStorage`의 5MB 한도를 쉽게 넘기고, 넘으면
 * 조용히 throw한다. 그쪽은 TanStack Query로 메모리에만 둔다(과거 날짜
 * 데이터는 불변이라 `staleTime: Infinity`가 안전하다).
 */

const OCID_CACHE_KEY = 'maple-log:guild-admin:ocid-cache:v1'

/** 캐시가 무한정 자라지 않게 상한을 둔다. 길드 하나가 1000명 규모이고 여러
 * 길드를 볼 수도 있어서 넉넉히 잡되, 넘으면 통째로 비운다 — LRU를 돌릴
 * 만큼 비싼 데이터가 아니다(다시 받으면 되고, 받는 김에 닉변도 반영된다). */
const OCID_CACHE_LIMIT = 5000

type OcidCache = Record<string, string>

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // 파싱 실패(손상된 값)나 저장소 접근 불가(사생활 보호 모드) 모두
    // "캐시가 없다"와 같게 다룬다.
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 실패는 조용히 무시 — 이번 세션은 메모리 상태로 그대로 동작한다.
  }
}

export function loadOcidCache(): OcidCache {
  return readJson<OcidCache>(OCID_CACHE_KEY, {})
}

export function saveOcidCache(cache: OcidCache): void {
  const entries = Object.entries(cache)
  writeJson(OCID_CACHE_KEY, entries.length > OCID_CACHE_LIMIT ? {} : cache)
}
