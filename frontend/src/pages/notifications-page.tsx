import { BellRing, Send } from 'lucide-react'

import { TargetSection } from '@/components/notifications/target-section'
import { WebhookSection } from '@/components/notifications/webhook-section'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  NOTIFICATION_ITEM_LABELS,
  useAddNotificationTarget,
  useNotificationTargets,
  useNotificationChannel,
  useRemoveNotificationTarget,
  useRunNotificationCheck,
} from '@/hooks/use-notifications'

/** `detectors.py`의 `format_meso`와 같은 표기(`11억 8,800만`). */
function formatMeso(amount: number): string {
  const man = Math.floor(amount / 10_000)
  const eok = Math.floor(man / 10_000)
  const rest = man % 10_000
  if (eok && rest) return `${eok.toLocaleString()}억 ${rest.toLocaleString()}만`
  if (eok) return `${eok.toLocaleString()}억`
  return `${rest.toLocaleString()}만`
}

export function NotificationsPage() {
  const { channel, register, unregister, forget } = useNotificationChannel()
  const accessKey = channel?.accessKey ?? null
  const targetsQuery = useNotificationTargets(accessKey)
  const addTarget = useAddNotificationTarget(accessKey)
  const removeTarget = useRemoveNotificationTarget(accessKey)
  const runCheck = useRunNotificationCheck(accessKey)

  const targets = targetsQuery.data ?? []
  const result = runCheck.data
  const pendingNow = (result?.detected ?? [])
    .filter((entry) => entry.ready_now)
    .reduce((sum, entry) => sum + (entry.meso_cost ?? 0), 0)
  const pendingTotal = (result?.detected ?? []).reduce(
    (sum, entry) => sum + (entry.meso_cost ?? 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">알림</h1>
        <p className="text-sm text-muted-foreground">
          등록한 캐릭터를 검사해서 심볼업 가능 여부와 유니온 아티팩트 만료를 알려줍니다. 알림은 직접
          등록한 디스코드 웹훅으로 나갑니다.
        </p>
      </div>

      <WebhookSection
        channel={channel}
        onRegister={(webhookUrl) => register.mutate(webhookUrl)}
        isRegistering={register.isPending}
        registerError={register.isError}
        onForget={() => {
          forget()
          runCheck.reset()
        }}
        onUnregister={() => {
          if (!accessKey) return
          unregister.mutate(accessKey)
          runCheck.reset()
        }}
        isUnregistering={unregister.isPending}
      />

      {channel && targetsQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            이 브라우저에 저장된 웹훅 등록이 더 이상 유효하지 않습니다. "다른 웹훅 쓰기"를 누르고 웹훅
            URL을 다시 등록해주세요.
          </AlertDescription>
        </Alert>
      )}

      {channel && (
        <>
          <TargetSection
            itemType="symbol_growth"
            title={NOTIFICATION_ITEM_LABELS.symbol_growth}
            description="가장 최근 심볼 상태를 보고, 이미 요구치를 넘긴 심볼과 일일 퀘스트 1회면 요구치에 닿는 심볼을 강화 비용과 함께 알립니다."
            targets={targets.filter((target) => target.item_type === 'symbol_growth')}
            isLoading={targetsQuery.isLoading}
            onAdd={(item_type, character_name) => addTarget.mutate({ item_type, character_name })}
            onRemove={(targetId) => removeTarget.mutate(targetId)}
          />

          <TargetSection
            itemType="artifact_expiry"
            title={NOTIFICATION_ITEM_LABELS.artifact_expiry}
            description="유니온 아티팩트 크리스탈 만료가 7일 이내로 남으면 연장하라고 알립니다."
            targets={targets.filter((target) => target.item_type === 'artifact_expiry')}
            isLoading={targetsQuery.isLoading}
            onAdd={(item_type, character_name) => addTarget.mutate({ item_type, character_name })}
            onRemove={(targetId) => removeTarget.mutate(targetId)}
          />

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">지금 검사</h2>
              <div className="grow" />
              <Button
                type="button"
                variant="outline"
                onClick={() => runCheck.mutate(false)}
                disabled={runCheck.isPending || targets.length === 0}
              >
                <BellRing className="size-4" />
                미리보기
              </Button>
              <Button
                type="button"
                onClick={() => runCheck.mutate(true)}
                disabled={runCheck.isPending || targets.length === 0}
              >
                <Send className="size-4" />
                검사하고 보내기
              </Button>
            </div>

            {runCheck.isPending && <p className="text-sm text-muted-foreground">조회 중...</p>}

            {runCheck.isError && (
              <Alert variant="destructive">
                <AlertDescription>검사에 실패했습니다. 서버 상태를 확인해주세요.</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  감지 {result.detected.length}건 · 발송 {result.sent.length}건 · 발송 횟수 상한으로 생략{' '}
                  {result.suppressed.length}건
                </p>

                {pendingTotal > 0 && (
                  <p className="text-sm">
                    {pendingNow > 0 ? (
                      <>
                        밀린 심볼 강화 비용{' '}
                        <span className="font-semibold tabular-nums">{formatMeso(pendingNow)} 메소</span>
                        {pendingNow !== pendingTotal && (
                          <span className="text-muted-foreground">
                            {' '}
                            (일퀘 후 포함 {formatMeso(pendingTotal)})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        일퀘 후 심볼 강화 비용{' '}
                        <span className="font-semibold tabular-nums">
                          {formatMeso(pendingTotal)} 메소
                        </span>
                      </>
                    )}
                  </p>
                )}

                {Object.keys(result.failures).length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">
                      {Object.entries(result.failures).map(([who, why]) => (
                        <span key={who} className="block">
                          {who}: {why}
                        </span>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                {result.detected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">알릴 내용이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {result.detected.map((entry, index) => (
                      <div key={`${entry.character_name}-${index}`} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{entry.title}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {NOTIFICATION_ITEM_LABELS[
                              entry.item_type as keyof typeof NOTIFICATION_ITEM_LABELS
                            ] ?? entry.item_type}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{entry.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
