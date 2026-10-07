/** IndexedDB를 약속(Promise)으로 감싼 얇은 층.
 *
 * 주간 점수를 서버에 저장하지 않게 되면서 **브라우저가 그 자리를 맡는다.**
 * localStorage는 문자열만 받고 용량이 5MB 남짓이라, 길드원 200명 × 주차 수십
 * 개를 담기엔 빠듯하다. 게다가 CSV 저장 폴더 핸들(`FileSystemDirectoryHandle`)은
 * 문자열로 바꿀 수 없어서 IndexedDB에만 넣을 수 있다.
 *
 * 라이브러리(idb 등)를 들이지 않았다. 쓰는 일이 "열쇠로 넣고/꺼내고/지우고/다
 * 꺼내기" 넷뿐이라 이 정도로 충분하다.
 */

const DB_NAME = 'maple-log'
const DB_VERSION = 2

/** 저장소 이름. 늘릴 때는 `DB_VERSION`을 올리고 `upgrade`에 추가한다. */
export const STORES = {
  /** 주간 점수 기록. 열쇠는 `월드|길드|주차`. */
  scoreRecords: 'score-records',
  /** 이것저것 설정값. 열쇠는 이름. */
  settings: 'settings',
  /** ⓪ 그룹화 저장본. 열쇠는 `oguildId`. */
  groupings: 'groupings',
  /** 그룹화 때 감지한 닉변 내역. 열쇠는 `ocid|감지 시각`. */
  renames: 'renames',
} as const

type StoreName = (typeof STORES)[keyof typeof STORES]

let opening: Promise<IDBDatabase> | null = null

/** 이만큼 기다려도 안 열리면 막힌 것으로 본다. 보통은 수십 ms 안에 열린다. */
const OPEN_TIMEOUT_MS = 4000

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    /** 열렸거나 막힌 것으로 정했는가. 둘 중 하나만 일어나게 한다. */
    let settled = false
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
    }
    request.onsuccess = () => {
      // 막힌 것으로 정한 뒤에 늦게 열렸다(업그레이드는 끝났다). 이 연결은 닫고, 다음 호출이
      // 새로 연다.
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      const db = request.result
      // 다른 탭이 새 버전으로 열려고 하면 비켜 준다. 안 그러면 그쪽 업그레이드가 막힌다.
      db.onversionchange = () => {
        db.close()
        opening = null
      }
      resolve(db)
    }
    request.onerror = () => {
      settled = true
      // 다음에 다시 열어볼 수 있게 실패한 약속은 버린다.
      opening = null
      reject(request.error ?? new Error('브라우저 저장소를 열지 못했습니다.'))
    }
    // 저장소 구조를 올리는데(버전 업) 예전 버전으로 열린 다른 탭이 있으면 막힌다. 그 탭이
    // 닫히면 업그레이드는 알아서 이어지지만, 그동안 조용히 멈춰 있으면 "저장된 것이 없다"로
    // 보인다. 막혔다고 알린다.
    const blocked = () => {
      if (settled) return
      settled = true
      opening = null
      reject(
        new Error(
          '이 사이트가 열린 다른 탭이 브라우저 저장소 업데이트를 막고 있습니다. 다른 탭을 닫거나 새로고침한 뒤 다시 열어 주세요.',
        ),
      )
    }
    request.onblocked = blocked
    // 크롬은 다른 탭이 잠들어 있으면 `blocked`조차 안 보내고 그냥 기다린다(2026-10-04
    // 실측). 몇 초 안에 열리지 않으면 막힌 것으로 본다. 이미 열렸으면 아무 일도 없다.
    window.setTimeout(blocked, OPEN_TIMEOUT_MS)
  })
  return opening
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(store, mode).objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('브라우저 저장소 작업에 실패했습니다.'))
      }),
  )
}

export function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run(store, 'readonly', (objectStore) => objectStore.get(key) as IDBRequest<T | undefined>)
}

export function idbPut(store: StoreName, key: string, value: unknown): Promise<void> {
  return run(store, 'readwrite', (objectStore) => objectStore.put(value, key)).then(() => undefined)
}

export function idbDelete(store: StoreName, key: string): Promise<void> {
  return run(store, 'readwrite', (objectStore) => objectStore.delete(key)).then(() => undefined)
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return run(store, 'readonly', (objectStore) => objectStore.getAll() as IDBRequest<T[]>)
}
