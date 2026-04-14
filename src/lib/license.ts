export type Tier = 'free' | 'pro' | 'teams'

export const FREE_TIER_GROUP_LIMIT = 3

// In a real implementation this would be validated against a license key server.
// For now the tier is stored in localStorage so it can be set during development/testing.
export function getTier(): Tier {
  const stored = localStorage.getItem('devlauncher_tier') as Tier | null
  if (stored === 'pro' || stored === 'teams') return stored
  return 'free'
}

export function isFreeTier(): boolean {
  return getTier() === 'free'
}

export function canAddGroup(currentGroupCount: number): boolean {
  if (!isFreeTier()) return true
  return currentGroupCount < FREE_TIER_GROUP_LIMIT
}
