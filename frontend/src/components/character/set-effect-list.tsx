import type { components } from '@/lib/api-types'

type SetEffect = components['schemas']['SetEffect']

interface SetEffectListProps {
  sets: SetEffect[]
}

/** Only sets with an actually active bonus (`set_effect_info` non-empty) —
 * `set_effect[]` also includes sets the character merely owns some pieces
 * of without enough to trigger any tier. `set_option_full` (every future
 * tier) is fetched but not shown — see docs/planning/features/
 * character.md's "Not in scope for this pass". */
export function SetEffectList({ sets }: SetEffectListProps) {
  const activeSets = sets.filter((set) => (set.set_effect_info?.length ?? 0) > 0)
  if (activeSets.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {activeSets.map((set) => {
        const activeTiers = set.set_effect_info ?? []
        const equippedCount = activeTiers[activeTiers.length - 1]?.set_count ?? 0

        return (
          <div key={set.set_name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{set.set_name}</span>
              <span className="text-xs text-muted-foreground">
                {equippedCount}/{set.total_set_count}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {activeTiers.map((tier) => (
                <p key={tier.set_count} className="text-xs text-muted-foreground">
                  {tier.set_option}
                </p>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
