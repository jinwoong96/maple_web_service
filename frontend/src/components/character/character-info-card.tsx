import { ExpBar } from '@/components/character/exp-bar'
import { LiberationBadge } from '@/components/character/liberation-badge'
import { UnionChampionBadge } from '@/components/character/union-champion-badge'
import type { components } from '@/lib/api-types'

type CharacterBasic = components['schemas']['CharacterBasic']
type UnionChampion = components['schemas']['UnionChampion']

interface CharacterInfoCardProps {
  basic: CharacterBasic
  unionLevel?: number
  popularity?: number
  champions?: UnionChampion[]
}

export function CharacterInfoCard({
  basic,
  unionLevel,
  popularity,
  champions,
}: CharacterInfoCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <img
          src={basic.character_image}
          alt={basic.character_name}
          className="mx-auto shrink-0 sm:mx-0"
        />

        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-xl font-semibold">{basic.character_name}</h1>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Lv. {basic.character_level}
            </span>
            <LiberationBadge liberationQuestClear={basic.liberation_quest_clear} />
          </div>

          <ExpBar currentExp={basic.character_exp} expRate={basic.character_exp_rate} />

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <InfoItem label="월드" value={basic.world_name} />
            <InfoItem label="직업" value={basic.character_class} />
            <InfoItem label="길드" value={basic.character_guild_name ?? '-'} />
            <InfoItem
              label="유니온"
              value={unionLevel != null ? unionLevel.toLocaleString('ko-KR') : '-'}
            />
            <InfoItem
              label="인기도"
              value={popularity != null ? popularity.toLocaleString('ko-KR') : '-'}
            />
          </dl>
        </div>
      </div>

      {champions && champions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">챔피언</span>
          {champions.map((champion) => (
            <UnionChampionBadge
              key={champion.champion_slot ?? champion.champion_name}
              champion={champion}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
