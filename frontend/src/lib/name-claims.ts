/** 사람이 줄에 이름을 **확정할 때의 규칙**.
 *
 * 점수표에는 같은 캐릭터가 두 번 나오지 않는다. 그러니 한 줄에 이름을 확정하면
 * 그 이름을 달고 있던 다른 줄은 **빼앗긴 것**이고, 그 줄은 다시 사람이 봐야
 * 한다 — 조용히 남으면 같은 사람 점수가 두 줄이 되거나, 한쪽이 저장에서 빠진
 * 채 아무도 모른다.
 *
 * **나중에 확정한 쪽이 이긴다.** 사람이 방금 그림을 보고 고른 것이 더 믿을
 * 만하다. 먼저 확정해 둔 줄이 틀렸다는 걸 알고 옮기는 경우가 대부분이다.
 */

export interface ClaimResult {
  /** 새 확정 목록. 줄 열쇠 → 이름. */
  next: Record<string, string>
  /** 이번 확정으로 이름을 빼앗긴 줄의 열쇠들. */
  robbed: string[]
}

/** `key` 줄에 `name`을 확정한다. 빈 이름이면 그 줄의 확정을 물린다.
 *
 * 같은 이름을 들고 있던 **다른 확정 줄**은 확정을 잃고 `robbed`로 돌아온다.
 * 확정 없이 자동으로 그 이름이 붙어 있던 줄은 여기서 알 수 없다 — 부르는 쪽이
 * `takenRows`로 따로 가려낸다. */
export function claimName(
  overrides: Readonly<Record<string, string>>,
  key: string,
  name: string,
): ClaimResult {
  const next: Record<string, string> = {}
  const robbed: string[] = []
  for (const [other, claimed] of Object.entries(overrides)) {
    if (other === key) continue
    if (name && claimed === name) {
      robbed.push(other)
      continue
    }
    next[other] = claimed
  }
  if (name) next[key] = name
  return { next, robbed }
}

/** 확정하지 않은 줄 중, **자동으로 붙은 이름을 확정 줄이 가져간** 줄.
 *
 * 명단 대조가 그대로 맞춘 줄(`exact`)이라도 사람이 다른 줄에 그 이름을
 * 확정했으면 둘 중 하나는 틀린 것이다. 사람이 고른 쪽을 믿고, 이쪽은 이름을
 * 비운 채 다시 보게 한다. */
export function takenRows(
  autoNames: readonly (string | null)[],
  confirmed: Readonly<Record<number, string>>,
): Set<number> {
  const claimed = new Set(Object.values(confirmed))
  const taken = new Set<number>()
  autoNames.forEach((name, index) => {
    if (confirmed[index] !== undefined || name === null) return
    if (claimed.has(name)) taken.add(index)
  })
  return taken
}
