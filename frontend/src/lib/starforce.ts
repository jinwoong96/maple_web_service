/** Max starforce for an equipment level, per general-item tiering (namuwiki,
 * confirmed 2026-09-20: https://namu.wiki/w/메이플스토리/스타포스%20강화 —
 * the 138+ cap was raised 25→30 in the 2025-03-20 patch). Nexon's API
 * doesn't return this directly — derived from
 * `item_base_option.base_equipment_level`. Doesn't account for 슈페리얼
 * items (lower caps: 3/5/8/10/12/15) or named exceptions (아케인셰이드
 * 블레이드=26, 데스티니 2차 무기=25) — no field in the API response
 * distinguishes these from a regular item, so they're not handled; see
 * REVIEW_NOTES.md. */
export function getMaxStarforce(baseEquipmentLevel: number | null | undefined): number {
  if (baseEquipmentLevel == null) return 30
  if (baseEquipmentLevel < 95) return 5
  if (baseEquipmentLevel < 108) return 8
  if (baseEquipmentLevel < 118) return 10
  if (baseEquipmentLevel < 128) return 15
  if (baseEquipmentLevel < 138) return 20
  return 30
}
