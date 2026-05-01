import type { Tier } from '../store'

export type { Tier }

export const FREE_TIER_GROUP_LIMIT = 3

export function canAddGroup(currentGroupCount: number, tier: Tier = 'free'): boolean {
  if (tier !== 'free') return true
  return currentGroupCount < FREE_TIER_GROUP_LIMIT
}
