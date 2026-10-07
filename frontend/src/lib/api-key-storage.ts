/** 넥슨 API 키를 어디에 둘지.
 *
 * 기본은 `sessionStorage`다. 키는 **유출되면 그 사람의 모든 캐릭터 데이터가
 * 열리는 살아있는 비밀**이라, 공용 PC에 무기한 남기는 것보다 다음 세션에 다시
 * 묻는 편이 낫다.
 *
 * 다만 자기 컴퓨터에서 매번 다시 붙여넣는 건 번거롭다. 그래서 **사용자가
 * 직접 고를 때만** `localStorage`에 남긴다. 고르는 순간 무엇을 감수하는지
 * 분명히 알리고(공용 PC 금지), 언제든 지울 수 있게 한다.
 *
 * 이 모듈은 저장 자리만 다룬다. 경고와 되묻기는 화면 쪽
 * (`components/api-key-remember.tsx`)이 맡는다.
 */

/** 읽기는 **저장해둔 것 먼저**. 저장해뒀다면 그게 이 사람의 뜻이다. */
export function readApiKey(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey) ?? ''
  } catch {
    // 사생활 보호 모드 등으로 저장소를 못 쓰는 경우. 화면 상태로는 그대로 돈다.
    return ''
  }
}

/** 이 컴퓨터에 저장해둔 키가 있는가. */
export function hasRememberedKey(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== null
  } catch {
    return false
  }
}

/** 이번 세션에만 둔다. 탭을 닫으면 사라진다.
 *
 * **저장해둔 키가 있으면 그쪽도 같이 갱신한다** — 키를 바꿔 넣었는데 다음에
 * 켤 때 옛 키가 돌아오면 무슨 일이 벌어졌는지 알기 어렵다. */
export function writeSessionKey(storageKey: string, value: string): void {
  try {
    if (value) sessionStorage.setItem(storageKey, value)
    else sessionStorage.removeItem(storageKey)
    if (localStorage.getItem(storageKey) !== null) {
      if (value) localStorage.setItem(storageKey, value)
      else localStorage.removeItem(storageKey)
    }
  } catch {
    // 저장소를 못 써도 이번 렌더에서는 동작한다.
  }
}

/** 이 컴퓨터에 남긴다. 브라우저를 닫아도 지울 때까지 남는다. */
export function rememberKey(storageKey: string, value: string): void {
  try {
    if (value) localStorage.setItem(storageKey, value)
  } catch {
    // 저장에 실패해도 이번 세션 동작은 막지 않는다.
  }
}

/** 저장해둔 것만 지운다. **이번 세션은 그대로 쓴다** — 지우자마자 화면이
 * 인증 전으로 돌아가면, 지운 것이 아니라 고장 난 것처럼 보인다. */
export function forgetKey(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // 지울 게 없거나 저장소를 못 쓰는 경우.
  }
}
