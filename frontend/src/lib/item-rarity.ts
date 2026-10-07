/** Maps a Nexon `potential_option_grade` string to the rarity color
 * convention from docs/frontend-design.md (레전드리=green, 유니크=yellow/
 * gold, 에픽=purple, 레어=blue). Unrecognized or missing grades (most
 * accessories, cosmetics, titles/medals) fall back to a neutral color
 * rather than guessing. */
interface RarityColors {
  border: string
  text: string
}

const RARITY_COLORS: Record<string, RarityColors> = {
  레전드리: { border: 'border-emerald-500', text: 'text-emerald-600' },
  유니크: { border: 'border-amber-500', text: 'text-amber-600' },
  에픽: { border: 'border-purple-500', text: 'text-purple-600' },
  레어: { border: 'border-blue-500', text: 'text-blue-600' },
}

const NEUTRAL_COLORS: RarityColors = {
  border: 'border-border',
  text: 'text-foreground',
}

export function getItemRarityColors(grade: string | null | undefined): RarityColors {
  if (!grade) return NEUTRAL_COLORS
  return RARITY_COLORS[grade] ?? NEUTRAL_COLORS
}
