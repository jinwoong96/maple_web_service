/** Max growth level per symbol group, confirmed by the user: 아케인심볼 caps
 * at 20, 어센틱심볼/그랜드 어센틱심볼 cap at 11. Not a response field — a
 * fixed constant per group, keyed off the same name-prefix split used to
 * group `symbol[]` into sections. */
export function getSymbolLevelCap(symbolName: string): number {
  return symbolName.startsWith('아케인심볼') ? 20 : 11
}
