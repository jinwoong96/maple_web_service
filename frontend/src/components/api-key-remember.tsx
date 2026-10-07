/** API 키를 이 컴퓨터에 저장할지 고르는 자리.
 *
 * **되묻는 이유**: 한 번 누르면 브라우저를 닫아도 키가 남는다. 공용 PC에서
 * 무심코 누르면 다음 사람이 그대로 쓸 수 있다. 되돌리기 어려운 선택이라
 * 무엇을 감수하는지 읽고 한 번 더 누르게 한다.
 *
 * **삭제는 바로 하는 이유**: 지우는 건 안전한 방향이라 막을 일이 아니다.
 * 다만 아무 반응이 없으면 지워졌는지 알 수 없어 확인 창을 띄운다.
 *
 * 브라우저 기본 `confirm()`/`alert()`을 쓰지 않는다 — 창이 뜨는 동안 페이지가
 * 통째로 멈추고, 문구를 우리가 원하는 만큼 자세히 쓸 수도 없다.
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

interface ApiKeyRememberProps {
  /** 지금 입력돼 있는 키. 비어 있으면 저장할 것이 없다. */
  apiKey: string
  /** 이 컴퓨터에 저장해둔 키가 있는가. */
  remembered: boolean
  onRemember: () => void
  onForget: () => void
}

export function ApiKeyRemember({
  apiKey,
  remembered,
  onRemember,
  onForget,
}: ApiKeyRememberProps) {
  const [asking, setAsking] = useState(false)
  const [erased, setErased] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {remembered ? (
          <>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              이 컴퓨터에 저장됨
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onForget()
                setErased(true)
              }}
            >
              저장된 키 삭제
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!apiKey}
            onClick={() => setAsking(true)}
          >
            이 컴퓨터에 저장
          </Button>
        )}
      </div>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>이 컴퓨터에 API 키를 저장할까요?</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-3 text-sm">
              <p className="rounded-md bg-destructive/10 p-3 font-medium text-destructive">
                공용 컴퓨터에서는 절대 저장하지 마세요. PC방, 학교·회사의 공용 자리, 남이
                쓰는 계정이라면 여기서 멈추세요.
              </p>
              <p>
                저장하면 <strong>브라우저를 닫았다 켜도 키가 남습니다.</strong> 이 브라우저를
                쓸 수 있는 사람은 누구나 그 키로 <strong>당신 계정의 캐릭터 정보 전체</strong>를
                조회할 수 있습니다.
              </p>
              <p className="text-muted-foreground">
                키는 이 브라우저에만 저장되고 이 서비스 서버로는 전송되지 않습니다. 넥슨 API를
                부를 때만 쓰입니다.
              </p>
              <p className="text-muted-foreground">
                <strong>언제든 지울 수 있습니다.</strong> 저장한 뒤에는 이 자리에 "저장된 키
                삭제" 버튼이 생기고, 누르면 바로 지워집니다.
              </p>
            </div>
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAsking(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onRemember()
                setAsking(false)
              }}
            >
              내 개인 컴퓨터입니다 — 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={erased} onOpenChange={setErased}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>저장된 API 키를 지웠습니다</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2 text-sm">
              <p>이 컴퓨터에 남아 있던 키를 지웠습니다. 다음에 켤 때 다시 물어봅니다.</p>
              <p className="text-muted-foreground">
                지금 보고 있는 화면은 그대로 쓸 수 있습니다 — 이번 탭을 닫을 때까지만
                유지됩니다.
              </p>
            </div>
          </DialogDescription>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setErased(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
