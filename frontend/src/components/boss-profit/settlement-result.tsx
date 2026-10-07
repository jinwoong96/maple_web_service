import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  buildSettlementText,
  formatRatio,
  type MultiSettlement,
  type PersonSettlement,
} from '@/lib/boss-profit-split'
import { formatKoreanNumber } from '@/lib/korean-number'

function CopyButton({
  value,
  label,
  text,
}: {
  value: string | number
  label: string
  /** 버튼에 쓸 말. 기본은 "복사". */
  text?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드가 막힌 환경(비보안 컨텍스트 등)에서는 조용히 넘어간다 —
      // 금액은 화면에 그대로 보이니 복사가 안 돼도 쓰는 데 지장은 없다.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copied ? '복사됨' : (text ?? '복사')}
    </button>
  )
}

function PersonRow({ person }: { person: PersonSettlement }) {
  return (
    <div className={`flex flex-col gap-2 border-b px-3 py-2.5 last:border-0 ${person.isSettler ? 'bg-primary/5' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-36 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{person.name || '정산자'}</span>
          {person.isSettler && person.name && <span className="shrink-0 text-xs text-primary">정산자</span>}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{person.isSettler ? '정산 후 총 보유' : '총 등록 금액'}</span>
          <span className={`text-sm font-semibold ${person.isSettler ? 'text-primary' : ''}`}>
            {person.total.toLocaleString('ko-KR')} 메소
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{formatKoreanNumber(person.total)}</span>
        <div className="grow" />
        {/* 파티원은 정산자와의 1쌍마다 총액으로 한 번만 등록한다 — 그래서 총액만
            복사한다. 아이템별 금액은 확인용이다. */}
        {!person.isSettler && (
          <CopyButton value={person.total} label={`${person.name} 총 등록 금액 복사`} />
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-0.5 text-xs text-muted-foreground md:pl-39">
        {person.shares.map((share) => (
          <div key={share.itemId} className="contents">
            <span className="truncate">{share.itemLabel}</span>
            <span className={share.normalized ? 'text-amber-700 dark:text-amber-400' : ''}>
              {share.partyName} {formatRatio(share.ratio)}
            </span>
            <span className="text-right tabular-nums">{share.amount.toLocaleString('ko-KR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SettlementResultProps {
  settlement: MultiSettlement
  feeRate: number
}

export function SettlementResult({ settlement, feeRate }: SettlementResultProps) {
  const blocked = settlement.blockedParties.length > 0
  const hasResult = !blocked && settlement.people.length > 0

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-primary">03</span>
        <h2 className="text-base font-semibold">정산 결과</h2>
        {hasResult && (
          <span className="text-xs text-muted-foreground">
            아이템 {settlement.itemCount}개 · 파티 {settlement.partyCount}개 · 수수료 {Math.round(feeRate * 100)}%
          </span>
        )}
        {/* 링크로 공유하는 대신 **글로 복사**한다. 정작 필요한 건 파티
            채팅이나 디스코드에 던질 몇 줄이라, 링크를 만들어 열게 하는 것보다
            짧다. */}
        {hasResult && (
          <span className="ml-auto">
            <CopyButton
              value={buildSettlementText(settlement, feeRate)}
              label="정산 결과 전체 복사"
              text="정산 결과 복사"
            />
          </span>
        )}
      </div>

      {blocked && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            비율 합계가 0%인 파티가 있어 정산할 수 없습니다: {settlement.blockedParties.join(', ')}. 비율을
            입력해주세요.
          </AlertDescription>
        </Alert>
      )}

      {hasResult && settlement.normalizedParties.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          비율을 맞춰 계산한 파티: {settlement.normalizedParties.join(', ')}
        </p>
      )}

      {!blocked && !hasResult && (
        <p className="text-sm text-muted-foreground">
          판매 금액과 파티를 입력하면 파티원별 경매장 등록 금액을 계산해드립니다.
        </p>
      )}

      {hasResult && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">판매 금액 (수수료 전)</p>
              <p className="text-lg font-semibold">{formatKoreanNumber(settlement.grossAmount)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">실수령액 (수수료 후)</p>
              <p className="text-lg font-semibold">{formatKoreanNumber(settlement.netAmount)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">파티원에게 지출</p>
              <p className="text-lg font-semibold">{formatKoreanNumber(settlement.totalListingPrice)}</p>
            </div>
          </div>

          <div className="rounded-lg border">
            {settlement.people.map((person) => (
              <PersonRow key={person.key} person={person} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            파티원은 "총 등록 금액" 그대로 경매장에 한 번 올리고, 정산자가 그걸 사주면 됩니다. 정산자 보유액에는
            1메소 단위로 생긴 잔액도 포함됩니다.
          </p>
        </>
      )}
    </section>
  )
}
