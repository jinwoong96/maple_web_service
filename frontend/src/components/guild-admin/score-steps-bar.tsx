/** 점수 입력 단계 표시줄 — 결과 위에 붙어 스크롤해도 따라온다. 단계마다 남은 일을 보여주고,
 * 누르면 그 단계의 첫 할 곳으로 간다. 강제하지는 않는다(남아도 다음 단계로 갈 수 있다).
 * 흐름은 `hooks/use-score-steps.ts`. */

import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ScoreStep, ScoreStepKey } from '@/hooks/use-score-steps'

interface ScoreStepsBarProps {
  steps: readonly ScoreStep[]
  current: ScoreStepKey | null
  nextLabel: string
  onStep: (step: ScoreStepKey) => void
  onPrev: () => void
  onNext: () => void
}

export function ScoreStepsBar({ steps, current, nextLabel, onStep, onPrev, onNext }: ScoreStepsBarProps) {
  return (
    <nav
      aria-label="점수 입력 단계"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const active = step.key === current
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => onStep(step.key)}
                disabled={step.key === 'upload'}
                aria-current={active ? 'step' : undefined}
                className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-background hover:bg-muted disabled:hover:bg-background'
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    step.done
                      ? 'bg-emerald-600 text-white'
                      : active
                        ? 'bg-background text-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.done ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="font-medium">{step.label}</span>
                <span className={`text-xs ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                  {step.detail}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="grow" />
      <Button type="button" size="sm" variant="outline" onClick={onPrev} title="Ctrl+↑">
        ◀ 이전 <span className="text-xs text-muted-foreground">Ctrl+↑</span>
      </Button>
      <Button type="button" size="sm" onClick={onNext} title="Ctrl+↓">
        {nextLabel} ▶ <span className="text-xs opacity-70">Ctrl+↓</span>
      </Button>
    </nav>
  )
}
