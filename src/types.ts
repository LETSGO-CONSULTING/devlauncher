export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
}

export type ProcessStatus = 'stopped' | 'running' | 'error'

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'system'
  data: string
  timestamp: number
}
