/** 닉네임으로 그 캐릭터의 순위만 보는 필터의 상태.
 *
 * 넥슨 랭킹은 캐릭터 이름을 안 받고 `ocid`만 받으므로 한 번 바꿔서 보낸다.
 * 바꾸는 동안에는 랭킹 호출을 멈춘다(`waiting`) — 안 멈추면 1위부터의 목록이
 * 잠깐 보이고, 이름을 넣은 사람은 그걸 검색 결과로 읽는다.
 */

import { useState } from 'react'

import { useCharacterOcid } from '@/hooks/use-character'

export interface CharacterRankFilterState {
  /** 확정된 닉네임. 빈 문자열이면 필터를 안 쓰는 중이다. */
  name: string
  setName: (name: string) => void
  ocid: string | undefined
  /** ocid를 아직 못 구했다. 이 동안 랭킹 호출을 멈춘다. */
  waiting: boolean
  /** 그런 캐릭터가 없다. */
  notFound: boolean
}

export function useCharacterRankFilter(): CharacterRankFilterState {
  const [name, setName] = useState('')
  const query = useCharacterOcid(name)

  return {
    name,
    setName,
    ocid: name ? query.data : undefined,
    waiting: name.length > 0 && query.data === undefined && !query.isError,
    notFound: name.length > 0 && query.isError,
  }
}
