import { create } from 'zustand'
import { ProjectGroup, ProcessStatus, LogEntry } from './types'

interface AppState {
  groups: ProjectGroup[]
  expanded: Record<string, boolean>          // groupId → open/closed
  statuses: Record<string, ProcessStatus>    // `${projectId}:${script}`
  logs: Record<string, LogEntry[]>           // `${projectId}:${script}`
  selectedLog: string | null

  setGroups: (groups: ProjectGroup[]) => void
  addGroup: (group: ProjectGroup) => void
  removeGroup: (id: string) => void
  toggleExpanded: (id: string) => void
  setStatus: (key: string, status: ProcessStatus) => void
  appendLog: (key: string, entry: LogEntry) => void
  clearLog: (key: string) => void
  setSelectedLog: (key: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  groups: [],
  expanded: {},
  statuses: {},
  logs: {},
  selectedLog: null,

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
      return { logs: { ...s.logs, [key]: next } }
    }),

  clearLog: (key) =>
    set((s) => ({ logs: { ...s.logs, [key]: [] } })),

  setSelectedLog: (key) => set({ selectedLog: key }),
}))
