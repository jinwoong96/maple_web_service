export interface LiberationInfo {
  label: string
  gradientClassName: string
}

/** `character_basic.liberation_quest_clear` -> display info. Colors are an
 * original design loosely inspired by each weapon's general color mood
 * (Genesis: dark/gold, Destiny: blue-cyan/gold) — not a reproduction of the
 * in-game artwork itself. */
const LIBERATION_BY_VALUE: Record<string, LiberationInfo> = {
  '1': {
    label: '제네시스 해방',
    gradientClassName: 'bg-gradient-to-br from-neutral-900 via-amber-700 to-amber-400',
  },
  '2': {
    label: '데스티니 1차 해방',
    gradientClassName: 'bg-gradient-to-br from-sky-700 via-cyan-400 to-amber-300',
  },
  '3': {
    label: '데스티니 2차 해방',
    gradientClassName: 'bg-gradient-to-br from-blue-800 via-cyan-300 to-yellow-200',
  },
}

export function getLiberationInfo(value: string | null | undefined): LiberationInfo | undefined {
  if (!value) return undefined
  return LIBERATION_BY_VALUE[value]
}
