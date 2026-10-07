import { type FormEvent, useState } from 'react'
import { Webhook } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { NotificationChannel } from '@/hooks/use-notifications'

interface WebhookSectionProps {
  channel: NotificationChannel | null
  onRegister: (webhookUrl: string) => void
  isRegistering: boolean
  registerError: boolean
  onForget: () => void
  onUnregister: () => void
  isUnregistering: boolean
}

/** 알림을 받을 디스코드 웹훅. 사람마다 자기 웹훅을 등록하고, 대상 목록도
 * 웹훅(채널)마다 따로 가진다. */
export function WebhookSection({
  channel,
  onRegister,
  isRegistering,
  registerError,
  onForget,
  onUnregister,
  isUnregistering,
}: WebhookSectionProps) {
  const [url, setUrl] = useState('')
  const [confirmingUnregister, setConfirmingUnregister] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    onRegister(trimmed)
    setUrl('')
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Webhook className="size-4" />
          디스코드 웹훅
        </h2>
        <p className="text-xs text-muted-foreground">
          알림을 받을 디스코드 채널의 웹훅 URL을 등록하세요. 다른 기기에서도 같은 URL을 넣으면 등록한
          캐릭터 목록을 그대로 이어서 씁니다.
        </p>
      </div>

      {channel ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 truncate rounded bg-muted px-2 py-1 text-xs">
            {channel.webhookUrlMasked}
          </code>
          <div className="grow" />
          <Button type="button" variant="outline" size="sm" onClick={onForget}>
            다른 웹훅 쓰기
          </Button>
          {confirmingUnregister ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onUnregister}
                disabled={isUnregistering}
              >
                등록한 캐릭터까지 삭제
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingUnregister(false)}
              >
                취소
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingUnregister(true)}
            >
              등록 해제
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="font-mono text-xs"
          />
          <Button type="submit" disabled={isRegistering || !url.trim()}>
            등록
          </Button>
        </form>
      )}

      {registerError && (
        <Alert variant="destructive">
          <AlertDescription>디스코드 웹훅 URL이 아닙니다. 주소를 다시 확인해주세요.</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
