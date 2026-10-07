/** 수정 영역 줄의 종류와 **못 믿는 순서**. 화면(`attention-list.tsx`)과 점수 입력의 단계 이동
 * (`use-score-steps.ts`)이 같은 순서를 쓴다. */

/** 무엇 때문에 손이 필요한지. 배열 순서가 곧 **못 믿는 순서**다.
 *
 * 세우는 일은 여기서 한다 — 부르는 쪽이 순서를 알 필요가 없고, 순서를 고칠
 * 때 한 곳만 보면 된다. */
export const ATTENTION_ORDER = [
  'taken',
  'duplicate',
  'group-clash',
  'score-order',
  'none',
  'ambiguous',
  'same-group',
  'profile',
  'eliminated',
  'corrected',
] as const

export type AttentionKind = (typeof ATTENTION_ORDER)[number]

/** 못 믿을 순서로 세운다. */
export function sortAttentionRows<T extends { kind: AttentionKind }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => ATTENTION_ORDER.indexOf(a.kind) - ATTENTION_ORDER.indexOf(b.kind))
}
