import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { ToggleGroup } from '@/components/boss-profit/toggle-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type BossProfit, type PartyDraft, SETTLER_MEMBER_ID } from '@/hooks/use-boss-profit'
import {
  formatRatio,
  MAX_PARTY_SIZE,
  memberLabel,
  MIN_PARTY_SIZE,
  type PartyConfig,
  type PartyRatios,
  resolvePartyRatios,
} from '@/lib/boss-profit-split'

const PARTY_SIZES = Array.from(
  { length: MAX_PARTY_SIZE - MIN_PARTY_SIZE + 1 },
  (_, index) => MIN_PARTY_SIZE + index,
)

const IN_USE_MESSAGE = '이 파티에 아직 정산할 아이템이 있습니다'

function Badge({ tone, children }: { tone: 'primary' | 'muted' | 'warning' | 'destructive'; children: string }) {
  const toneClass = {
    primary: 'border border-primary/40 text-primary',
    muted: 'border text-muted-foreground',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone]
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>
}

/** 접힌 카드에 쓰는 한 줄 요약. */
function summarize(party: PartyConfig, settlerName: string): string {
  const size = `${party.members.length + 1}명`
  const names = party.members.map((member, index) => member.name.trim() || memberLabel(index))
  if (party.splitMode === 'equal') return [size, '균등', ...names].join(' · ')
  return [
    size,
    '자율',
    `${settlerName.trim() || '정산자'} ${formatRatio(party.settlerRatio)}`,
    ...names.map((name, index) => `${name} ${formatRatio(party.members[index].ratio)}`),
  ].join(' · ')
}

function RatioInput({
  value,
  normalized,
  label,
  onChange,
}: {
  value: number
  normalized: number | null
  label: string
  onChange: (ratio: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        aria-label={`${label} 분배 비율`}
        className="w-20 text-right"
      />
      <span className="text-xs text-muted-foreground">%</span>
      {normalized !== null && (
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">→ {formatRatio(normalized)}</span>
      )}
    </div>
  )
}

function RatioFooter({ ratios, onEvenOut }: { ratios: PartyRatios; onEvenOut: () => void }) {
  const total = Math.round(ratios.inputTotal * 10) / 10
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <Button type="button" variant="outline" size="sm" onClick={onEvenOut}>
        비율 균등하게
      </Button>
      {ratios.normalized && (
        <span className="text-xs text-amber-700 dark:text-amber-400">
          합계 {total}% → 100% 기준으로 맞춰 계산했습니다.
        </span>
      )}
      {ratios.invalid && <span className="text-xs text-destructive">비율 합계가 0%라 계산할 수 없습니다.</span>}
      <div className="grow" />
      <span className="text-xs text-muted-foreground">분배 비율 합계</span>
      <span
        className={`text-sm font-semibold ${
          ratios.invalid
            ? 'text-destructive'
            : ratios.normalized
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-foreground'
        }`}
      >
        {total}% / 100%
      </span>
    </div>
  )
}

export function PartyCard({ party, profit }: { party: PartyDraft; profit: BossProfit }) {
  const [expanded, setExpanded] = useState(!party.saved)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const ratios = resolvePartyRatios(party)
  const nameError = profit.partyNameError(party.id)
  const dirty = profit.isPartyDirty(party.id)
  const inUse = profit.isPartyInUse(party.id)
  const custom = party.splitMode === 'custom'
  const nameErrorId = `party-name-error-${party.id}`

  function handleDelete() {
    // 고정팟은 저장본까지 지우니 한 번 더 누르게 한다. 모달 대신 버튼 문구를
    // 바꾼다.
    if (party.saved && !confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    profit.deleteParty(party.id)
  }

  return (
    <div className="rounded-lg border">
      <div className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${expanded ? 'border-b' : ''}`}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={`${party.name || '이름 없는 파티'} ${expanded ? '접기' : '펼치기'}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Badge tone={party.saved ? 'primary' : 'muted'}>{party.saved ? '고정팟' : '임시'}</Badge>

        {expanded ? (
          <Input
            value={party.name}
            onChange={(event) => profit.setPartyName(party.id, event.target.value)}
            aria-label="파티 이름"
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? nameErrorId : undefined}
            className="max-w-44 font-semibold"
          />
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold">{party.name || '이름 없는 파티'}</span>
        )}

        {dirty && <Badge tone="warning">저장 안 됨</Badge>}
        {custom && ratios.normalized && <Badge tone="warning">비율 맞춤</Badge>}
        {custom && ratios.invalid && <Badge tone="destructive">비율 0%</Badge>}
        {!expanded && nameError && <Badge tone="destructive">이름 확인</Badge>}

        {!expanded && (
          <span className="min-w-0 basis-full truncate pl-9 text-xs text-muted-foreground sm:basis-auto sm:pl-0">
            {summarize(party, profit.settlerName)}
          </span>
        )}

        <div className="grow" />

        {/* 고정팟은 고친 게 있을 때만 "저장"이 보인다. */}
        {party.saved ? (
          dirty && (
            <Button type="button" size="sm" onClick={() => profit.saveParty(party.id)} disabled={nameError !== null}>
              저장
            </Button>
          )
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => profit.saveParty(party.id)}
            disabled={nameError !== null}
          >
            고정팟으로 저장
          </Button>
        )}
        {/* 막힌 버튼은 hover 이벤트를 받지 않는 브라우저가 있어 감싼 쪽에 title을 둔다. */}
        <span title={inUse ? IN_USE_MESSAGE : undefined}>
          <Button
            type="button"
            variant={confirmingDelete ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleDelete}
            onBlur={() => setConfirmingDelete(false)}
            disabled={inUse}
          >
            {confirmingDelete ? '한 번 더 누르면 삭제' : party.saved ? '고정팟 삭제' : '삭제'}
          </Button>
        </span>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 p-3">
          {nameError && (
            <p id={nameErrorId} className="text-xs text-destructive">
              {nameError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              options={PARTY_SIZES}
              value={party.members.length + 1}
              onChange={(size) => profit.setPartySize(party.id, size)}
              label={(size) => `${size}명`}
            />
            <div className="grow" />
            <ToggleGroup
              options={['equal', 'custom'] as const}
              value={party.splitMode}
              onChange={(mode) => profit.setPartySplitMode(party.id, mode)}
              label={(mode) => (mode === 'equal' ? '균등 분배' : '자율 분배')}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {custom
              ? '수수료를 뺀 실수령액의 비율을 직접 정합니다. 합계가 100%가 아니면 100% 기준으로 맞춰 계산합니다.'
              : '수수료를 뺀 실수령액이 모두 같아지도록 계산합니다.'}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-semibold text-primary">정산자</span>
              <span className="w-full max-w-56 truncate text-sm text-muted-foreground">
                {profit.settlerName.trim() || '위에서 입력한 정산자'}
              </span>
              {custom && (
                <RatioInput
                  value={party.settlerRatio}
                  normalized={ratios.normalized ? ratios.ratios[0] : null}
                  label="정산자"
                  onChange={(ratio) => profit.setMemberRatio(party.id, SETTLER_MEMBER_ID, ratio)}
                />
              )}
            </div>
            {party.members.map((member, index) => (
              <div key={member.id} className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{memberLabel(index)}</span>
                <Input
                  value={member.name}
                  onChange={(event) => profit.setMemberName(party.id, member.id, event.target.value)}
                  placeholder="이름 (선택)"
                  aria-label={`${memberLabel(index)} 이름`}
                  className="max-w-56"
                />
                {custom && (
                  <RatioInput
                    value={member.ratio}
                    normalized={ratios.normalized ? ratios.ratios[index + 1] : null}
                    label={memberLabel(index)}
                    onChange={(ratio) => profit.setMemberRatio(party.id, member.id, ratio)}
                  />
                )}
              </div>
            ))}
          </div>

          {custom && <RatioFooter ratios={ratios} onEvenOut={() => profit.evenOutRatios(party.id)} />}

          {(inUse || (party.saved && dirty)) && (
            <p className="text-xs text-muted-foreground">
              {[
                inUse ? `${IN_USE_MESSAGE}.` : null,
                party.saved && dirty ? '고친 내용은 "저장"을 눌러야 고정팟에 남습니다.' : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
