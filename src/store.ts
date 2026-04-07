import { create } from 'zustand'
import { Project, ProcessStatus, LogEntry } from './types'

interface AppState {
  projects: Project[]
  statuses: Record<string, ProcessStatus>   // key: `${projectId}:${script}`
  logs: Record<string, LogEntry[]>          // key: `${projectId}:${script}`
  selectedLog: string | null

  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  setStatus: (key: string, status: ProcessStatus) => void
  appendLog: (key: string, entry: LogEntry) => void
  clearLog: (key: string) => void
  setSelectedLog: (key: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  projects: [],
  statuses: {},
  logs: {},
  selectedLog: null,

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((s) => ({ projects: [...s.projects, project] })),

  removeProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  setStatus: (key, status) =>
    set((s) => ({ statuses: { ...s.statuses, [key]: status } })),

  appendLog: (key, entry) =>
    set((s) => {
      const prev = s.logs[key] ?? []
      // keep last 2000 lines
      const next = prev.length >= 2000 ? [...prev.slice(-1999), entry] : [...prev, entry]
      return { logs: { ...s.logs, [key]: next } }
    }),

  clearLog: (key) =>
    set((s) => ({ logs: { ...s.logs, [key]: [] } })),

  setSelectedLog: (key) => set({ selectedLog: key }),
}))
