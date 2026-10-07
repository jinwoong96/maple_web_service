/** Hand-written mirror of the backend's (unused) `schemas/probability.py`
 * Pydantic models — there's no OpenAPI schema for this domain since our
 * backend never serves it (the frontend calls Nexon directly). Keep these
 * in sync with that file by hand if Nexon's shape ever changes. */

export interface AccountOuid {
  ouid: string
}

export interface PotentialOptionEntry {
  value: string
  grade: string
}

export interface StarforceEvent {
  success_rate: string | null
  destroy_decrease_rate: string | null
  cost_discount_rate: string | null
  plus_value: string | null
  starforce_event_range: string | null
  recovery_cost_discount_rate: string | null
}

export interface StarforceHistoryEntry {
  id: string
  item_upgrade_result: string
  before_starforce_count: number | null
  after_starforce_count: number | null
  starcatch_result: string | null
  superior_item_flag: string | null
  destroy_defence: string | null
  chance_time: string | null
  event_field_flag: string | null
  upgrade_item: string | null
  protect_shield: string | null
  bonus_stat_upgrade: string | null
  character_name: string | null
  world_name: string | null
  target_item: string | null
  date_create: string | null
  starforce_event_list: StarforceEvent[]
}

export interface StarforceHistory {
  count: number
  next_cursor: string | null
  starforce_history: StarforceHistoryEntry[]
}

interface PotentialOrCubeHistoryEntry {
  id: string
  character_name: string | null
  date_create: string | null
  item_upgrade_result: string | null
  miracle_time_flag: string | null
  item_equipment_part: string | null
  item_level: number | null
  target_item: string | null
  potential_option_grade: string | null
  additional_potential_option_grade: string | null
  upgrade_guarantee: boolean | null
  upgrade_guarantee_count: number | null
  before_potential_option: PotentialOptionEntry[]
  before_additional_potential_option: PotentialOptionEntry[]
  after_potential_option: PotentialOptionEntry[]
  after_additional_potential_option: PotentialOptionEntry[]
}

export interface PotentialHistoryEntry extends PotentialOrCubeHistoryEntry {
  potential_type: string
}

export interface PotentialHistory {
  count: number
  next_cursor: string | null
  potential_history: PotentialHistoryEntry[]
}

export interface CubeHistoryEntry extends PotentialOrCubeHistoryEntry {
  cube_type: string
}

export interface CubeHistory {
  count: number
  next_cursor: string | null
  cube_history: CubeHistoryEntry[]
}
