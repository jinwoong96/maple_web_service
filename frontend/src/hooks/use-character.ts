import { useQueries, useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import type { components } from '@/lib/api-types'

type SkillInfo = components['schemas']['SkillInfo']

// Every valid character_skill_grade value, in the order MapleStory's own
// skill window shows them. Confirmed live (다섯별/메카닉, 2026-09-20): all 11
// return 200; a grade this character has no skills in comes back with
// character_skill_grade: null and an empty character_skill[].
const SKILL_GRADES = [
  { id: '0', label: '0차' },
  { id: '1', label: '1차' },
  { id: '1.5', label: '1.5차' },
  { id: '2', label: '2차' },
  { id: '2.5', label: '2.5차' },
  { id: '3', label: '3차' },
  { id: '4', label: '4차' },
  { id: 'hyperpassive', label: '하이퍼패시브' },
  { id: 'hyperactive', label: '하이퍼액티브' },
  { id: '5', label: '5차' },
  { id: '6', label: '6차' },
] as const

export function useCharacterOcid(characterName: string) {
  return useQuery({
    queryKey: ['character', 'ocid', characterName],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/ocid', {
        params: { query: { character_name: characterName } },
      })
      if (error) throw error
      return data.ocid
    },
    enabled: characterName.length > 0,
    retry: false,
  })
}

export function useCharacterBasic(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'basic', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/basic', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterStat(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'stat', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/stat', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterPopularity(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'popularity', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/popularity', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterItemEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'item-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/item-equipment', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterRingSkillEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'ring-skill-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/characters/{ocid}/ring-skill-equipment',
        { params: { path: { ocid: ocid! } } },
      )
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterAndroidEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'android-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/android-equipment', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterSymbolEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'symbol-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/symbol-equipment', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterSetEffect(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'set-effect', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/set-effect', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterBeautyEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'beauty-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/beauty-equipment', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterCashitemEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'cashitem-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/characters/{ocid}/cashitem-equipment',
        { params: { path: { ocid: ocid! } } },
      )
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterPetEquipment(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'pet-equipment', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/pet-equipment', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterHyperStat(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'hyper-stat', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/hyper-stat', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterPropensity(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'propensity', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/propensity', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterAbility(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'ability', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/ability', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterDojang(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'dojang', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/dojang', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterOtherStat(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'other-stat', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/other-stat', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterVmatrix(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'vmatrix', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/vmatrix', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterHexamatrix(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'hexamatrix', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/hexamatrix', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useCharacterHexamatrixStat(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'hexamatrix-stat', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/hexamatrix-stat', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

function characterSkillQueryOptions(ocid: string | undefined, grade: string) {
  return {
    queryKey: ['character', 'skill', ocid, grade] as const,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/skill', {
        params: { path: { ocid: ocid! }, query: { character_skill_grade: grade } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  }
}

export function useCharacterSkill(ocid: string | undefined, grade: string) {
  return useQuery(characterSkillQueryOptions(ocid, grade))
}

export interface SkillGradeGroup {
  grade: string
  label: string
  skills: SkillInfo[]
}

/** Sweeps all 11 `character_skill_grade` values in parallel (TanStack
 * Query's `useQueries` — no other hook in this file needs a dynamic,
 * fixed-size batch of parallel queries) and drops grades with no skills,
 * since Nexon returns an empty `character_skill[]` for those rather than
 * omitting the grade. */
export function useCharacterSkillsByGrade(ocid: string | undefined): {
  isLoading: boolean
  groups: SkillGradeGroup[]
} {
  const results = useQueries({
    queries: SKILL_GRADES.map(({ id }) => characterSkillQueryOptions(ocid, id)),
  })

  const isLoading = results.some((result) => result.isLoading)
  const groups: SkillGradeGroup[] = []
  SKILL_GRADES.forEach(({ id, label }, index) => {
    const skills = results[index]?.data?.character_skill ?? []
    if (skills.length > 0) groups.push({ grade: id, label, skills })
  })

  return { isLoading, groups }
}

export function useCharacterLinkSkill(ocid: string | undefined) {
  return useQuery({
    queryKey: ['character', 'link-skill', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/characters/{ocid}/link-skill', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}
