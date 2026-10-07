import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { deleteRecord, listRecords, putRecord, type ScoreRecord } from '@/lib/score-records'

const QUERY_KEY = ['guild-admin', 'score-records'] as const

/** 브라우저(IndexedDB)에 저장한 주차 기록.
 *
 * 점수 입력 탭(저장)과 주차 기록 탭(목록·표)이 같은 목록을 본다. 서버가 아니라
 * 브라우저에서 읽지만, 두 탭이 같은 캐시를 나눠 쓰고 저장 뒤 다시 읽는 일을
 * TanStack Query에 맡긴다. */
export function useScoreRecords() {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listRecords,
    // 다른 탭에서 바뀔 일은 거의 없고, 바꾸는 쪽이 늘 무효화한다.
    staleTime: Infinity,
  })

  const invalidate = () => client.invalidateQueries({ queryKey: QUERY_KEY })

  const save = useMutation({
    mutationFn: async (records: ScoreRecord[]) => {
      for (const record of records) await putRecord(record)
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteRecord,
    onSuccess: invalidate,
  })

  return {
    records: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? '브라우저에 저장한 기록을 읽지 못했습니다.' : null,
    save: (records: ScoreRecord[]) => save.mutateAsync(records),
    remove: (key: string) => remove.mutateAsync(key),
  }
}
