export type ProjectType = 'npm' | 'maven' | 'gradle'

export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>  // key = display name, value = full shell command
  projectType: ProjectType
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
