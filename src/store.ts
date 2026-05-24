import { create } from 'zustand'
import { ProjectGroup, ProcessStatus, LogEntry } from './types'

export type Tier = 'free' | 'pro' | 'teams'

interface AppState {
  groups: ProjectGroup[]
  expanded: Record<string, boolean>
  statuses: Record<string, ProcessStatus>
  logs: Record<string, LogEntry[]>
  openLogs: string[]       // all open console tabs (ordered)
  activeLog: string | null // which tab is focused
  // runtime versions per project: projectId → { node, java }
  runtimeVersions: Record<string, { node?: string; java?: string }>
  // real OS PIDs — key → pid (retained even after process exits for history display)
  processPids: Record<string, number>
  // total log lines received per key (never resets, used for chart sampling)
  logCounts: Record<string, number>
  // human-readable labels for infra log keys (docker / k8s)
  logLabels: Record<string, { name: string; script: string }>
  // current license tier
  tier: Tier
  licenseExpiresAt: string | null  // ISO string or null
  // epoch ms when a process was last started
  processStartedAt: Record<string, number>
  // keys that should auto-restart on crash
  autoRestart: Record<string, boolean>

  setGroups: (groups: ProjectGroup[]) => void
  addGroup: (group: ProjectGroup) => void
  removeGroup: (id: string) => void
  toggleExpanded: (id: string) => void
  setStatus: (key: string, status: ProcessStatus) => void
  appendLog: (key: string, entry: LogEntry) => void
  clearLog: (key: string) => void
  setStartedAt: (key: string, ts: number) => void
  setAutoRestart: (key: string, enabled: boolean) => void
  openLog: (key: string) => void        // open or focus a console tab
  closeLog: (key: string) => void       // close a console tab
  setActiveLog: (key: string | null) => void  // switch active tab
  setRuntimeVersion: (projectId: string, node?: string, java?: string) => void
  setPid: (key: string, pid: number) => void
  setLogLabel: (key: string, label: { name: string; script: string }) => void
  setTier: (tier: Tier, expiresAt?: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  groups: [],
  expanded: {},
  statuses: {},
  logs: {},
  openLogs: [],
  activeLog: null,
  runtimeVersions: {},
  processPids: {},
  logCounts: {},
  logLabels: {},
  tier: 'free',
  licenseExpiresAt: null,
  processStartedAt: {},
  autoRestart: {},

  setGroups: (groups) => set({ groups }),

  addGroup: (group) =>
    set((s) => ({
      groups: [...s.groups, group],
      expanded: { ...s.expanded, [group.id]: true },
    })),

  removeGroup: (id) =>
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  toggleExpanded: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),

  setStatus: (key, status) =>
    set((s) => ({ statuses: { ...s.statuses, [key]: status } })),

  appendLog: (key, entry) =>
    set((s) => {
      const prev = s.logs[key] ?? []
      const next = prev.length >= 2000 ? [...prev.slice(-1999), entry] : [...prev, entry]
      return {
        logs: { ...s.logs, [key]: next },
        logCounts: { ...s.logCounts, [key]: (s.logCounts[key] ?? 0) + 1 },
      }
    }),

  clearLog: (key) =>
    set((s) => ({
      logs: { ...s.logs, [key]: [] },
      logCounts: { ...s.logCounts, [key]: 0 },
    })),

  setStartedAt: (key, ts) =>
    set((s) => ({ processStartedAt: { ...s.processStartedAt, [key]: ts } })),

  setAutoRestart: (key, enabled) =>
    set((s) => ({ autoRestart: { ...s.autoRestart, [key]: enabled } })),

  openLog: (key) =>
    set((s) => ({
      openLogs: s.openLogs.includes(key) ? s.openLogs : [...s.openLogs, key],
      activeLog: key,
    })),

  closeLog: (key) =>
    set((s) => {
      const next = s.openLogs.filter((k) => k !== key)
      let active = s.activeLog
      if (active === key) {
        const idx = s.openLogs.indexOf(key)
        active = next[idx] ?? next[idx - 1] ?? null
      }
      return { openLogs: next, activeLog: active }
    }),

  setActiveLog: (key) => set({ activeLog: key }),

  setRuntimeVersion: (projectId, node, java) =>
    set((s) => ({
      runtimeVersions: {
        ...s.runtimeVersions,
        [projectId]: { node, java },
      },
    })),

  setPid: (key, pid) =>
    set((s) => ({ processPids: { ...s.processPids, [key]: pid } })),

  setLogLabel: (key, label) =>
    set((s) => ({ logLabels: { ...s.logLabels, [key]: label } })),

  setTier: (tier, expiresAt = null) => set({ tier, licenseExpiresAt: expiresAt ?? null }),
}))
