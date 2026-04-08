export type ProjectType = 'npm' | 'maven' | 'gradle'

export type Framework =
  | 'react'   | 'nextjs'   | 'angular'  | 'vue'      | 'nuxt'
  | 'svelte'  | 'astro'    | 'nestjs'   | 'express'  | 'fastify'
  | 'vite'    | 'electron' | 'spring'   | 'node'
  | 'typescript' | 'javascript'

export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
  projectType: ProjectType
  frameworks: Framework[]   // detected from dependencies, ordered by relevance
}

export interface ProjectGroup {
  id: string
  name: string
  path: string
  projects: Project[]
}

export type ProcessStatus = 'stopped' | 'running' | 'error'

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'system'
  data: string
  timestamp: number
}
