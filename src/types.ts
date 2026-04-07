export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
}

export interface ProjectGroup {
  id: string
  name: string       // parent folder name
  path: string       // parent folder path
  projects: Project[]
}

export type ProcessStatus = 'stopped' | 'running' | 'error'

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'system'
  data: string
  timestamp: number
}
