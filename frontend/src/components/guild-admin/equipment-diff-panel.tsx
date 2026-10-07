import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useEquipmentDiff } from '@/hooks/use-equipment-diff'
import type { SlotDiff } from '@/lib/equipment-diff'

const KIND_STYLE: Record<SlotDiff['kind'], string> = {
  replaced: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  equipped: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  removed: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  changed: 'bg-muted',
}

const KIND_LABEL: Record<SlotDiff['kind'], string> = {
  replaced: '교체',
  equipped: '착용',
  removed: '해제',
  changed: '변경',
}

/** 아이템 아이콘. 없거나 깨지면 자리만 비운다 — 넥슨 CDN이라 우리 쪽에서
 * 보장할 수 없고, 아이콘 하나 때문에 줄이 어긋나면 안 된다. */
function ItemIcon({ src, name }: { src: string | null; name: string | null }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      title={name ?? undefined}
      loading="lazy"
      className="size-6 shrink-0 object-contain"
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

function SlotRow({ diff }: { diff: SlotDiff }) {
  const [open, setOpen] = useState(false)
  const expandable = diff.changes.length > 0
  return (
    <li className="rounded-lg border p-2">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        disabled={!expandable}
      >
        <span className={`rounded px-2 py-0.5 text-xs ${KIND_STYLE[diff.kind]}`}>
          {KIND_LABEL[diff.kind]}
        </span>
        <span className="text-xs text-muted-foreground">{diff.slot}</span>
        {/* 아이템명은 종류와 무관하게 **항상** 보여준다 — 슬롯만 있으면
            "반지1에 뭐가 바뀐 건지"를 알 수 없다. */}
        {diff.kind === 'replaced' ? (
          <span className="flex flex-wrap items-center gap-1 text-sm">
            <ItemIcon src={diff.beforeIcon} name={diff.beforeName} />
            <span className="text-muted-foreground line-through">{diff.beforeName}</span>
            <span className="mx-1">→</span>
            <ItemIcon src={diff.afterIcon} name={diff.afterName} />
            <span className="font-medium">{diff.afterName}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm">
            <ItemIcon src={diff.afterIcon ?? diff.beforeIcon} name={diff.afterName ?? diff.beforeName} />
            <span className="font-medium">{diff.afterName ?? diff.beforeName}</span>
          </span>
        )}
        {diff.summary && <span className="text-xs text-muted-foreground">{diff.summary}</span>}
        {expandable && (
          <span className="ml-auto text-xs text-muted-foreground">{open ? '접기' : '펼치기'}</span>
        )}
      </button>
      {open && expandable && (
        <dl className="mt-2 flex flex-col gap-1 border-t pt-2">
          {diff.changes.map((change) => (
            <div key={change.label} className="flex flex-wrap items-baseline gap-2 text-xs">
              <dt className="w-28 shrink-0 text-muted-foreground">{change.label}</dt>
              <dd className="flex flex-wrap items-baseline gap-2">
                <span className="text-muted-foreground line-through">{change.before}</span>
                <span>→</span>
                <span className="font-medium">{change.after}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

interface EquipmentDiffPanelProps {
  characterName: string
  apiKey: string
  oldDate: string
  newDate: string
}

export function EquipmentDiffPanel({
  characterName,
  apiKey,
  oldDate,
  newDate,
}: EquipmentDiffPanelProps) {
  const { status, result, error, run } = useEquipmentDiff(apiKey)

  if (status === 'idle') {
    // 부모가 세로 flex라 `self-start`가 없으면 버튼이 가로로 꽉 찬다.
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => void run(characterName, oldDate, newDate)}
        disabled={!apiKey}
      >
        장비 비교
      </Button>
    )
  }

  if (status === 'loading') {
    return <p className="text-xs text-muted-foreground">장비 조회 중…</p>
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription>장비 조회에 실패했습니다: {error}</AlertDescription>
      </Alert>
    )
  }

  if (!result) return null

  const presetChanged =
    result.presetBefore !== null &&
    result.presetAfter !== null &&
    result.presetBefore !== result.presetAfter

  return (
    <div className="flex flex-col gap-2">
      {presetChanged && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          장비 프리셋이 {result.presetBefore}번 → {result.presetAfter}번으로 바뀌었습니다. 장비를
          실제로 갈아끼운 게 아니라 프리셋만 전환한 것일 수 있습니다.
        </p>
      )}
      {result.diffs.length === 0 ? (
        <p className="text-xs text-muted-foreground">이 기간에 바뀐 장비가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {result.diffs.map((diff) => (
            <SlotRow key={`${diff.part}-${diff.slot}-${diff.beforeName ?? diff.afterName}`} diff={diff} />
          ))}
        </ul>
      )}
    </div>
  )
}
