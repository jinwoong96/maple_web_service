/** 월드 리프(월드 이동) 가능 조합.
 *
 * 아무 월드에서 아무 월드로나 갈 수 있는 게 아니다. 이걸 모르면 **같은 이름의
 * 남의 캐릭터를 "월드 이동한 우리 길드원"으로 오인한다** — `/id`는 월드
 * 파라미터가 없어서, 같은 이름이 여러 월드에 있으면 엉뚱한 월드의 캐릭터를
 * 돌려주기 때문이다.
 *
 * 실제로 그렇게 오인했었다. 에오스 길드에서 사라진 이름 6개를
 * 스카니아·크로아·엘리시움·루나·베라의 동명 캐릭터와 묶어 "월드 이동"으로
 * 표시했는데, **에오스에서 그 월드들로는 애초에 갈 수 없다.**
 *
 * 규칙 (사용자 제공, 2026-09-26):
 * - 에오스 ↔ 핼리오스 : 서로 가능
 * - 그 외 일반 월드끼리 : 서로 가능 (에오스·핼리오스와는 불가)
 * - 이벤트 월드(버닝, 챌린저스N) : **일방적으로 나가는 것만** 가능.
 *   목적지는 이벤트마다 다르다 — 이번 이벤트는 챌린저스4가 에오스·핼리오스로,
 *   챌린저스3까지가 나머지 월드로 갈 수 있었다. 이벤트마다 바뀌므로 여기서는
 *   "나갈 수 있다"까지만 보고 목적지는 제한하지 않는다.
 */

/** 에오스·핼리오스는 자기들끼리만 오간다. */
const EOS_GROUP = ['에오스', '핼리오스']

/** 이벤트 월드는 한 방향으로만 나갈 수 있고, 들어올 수는 없다. */
export function isEventWorld(worldName: string): boolean {
  return worldName.startsWith('버닝') || worldName.startsWith('챌린저스')
}

/** `from`에서 `to`로 월드 리프가 가능한가.
 *
 * 리부트/스페셜 같은 특수 월드는 사용자가 따로 말하지 않아 일반 월드와 같은
 * 규칙으로 둔다 — 틀렸다면 오탐이 아니라 **누락** 쪽으로 기우는 방향이라
 * (있는 이동을 못 잡는 것) 잘못 보고하는 것보다는 낫다. */
export function canLeapBetween(from: string | null, to: string | null): boolean {
  if (!from || !to || from === to) return false
  if (isEventWorld(to)) return false
  if (isEventWorld(from)) return true
  return EOS_GROUP.includes(from) === EOS_GROUP.includes(to)
}
