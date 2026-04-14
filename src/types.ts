export type ProjectType = 'npm' | 'maven' | 'gradle' | 'docker'

export type Framework =
  | 'react'   | 'nextjs'   | 'angular'  | 'vue'      | 'nuxt'
  | 'svelte'  | 'astro'    | 'nestjs'   | 'express'  | 'fastify'
  | 'vite'    | 'electron' | 'spring'   | 'node'
  | 'typescript' | 'javascript'
  | 'docker'

export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
  projectType: ProjectType
  frameworks: Framework[]
  nodeVersion?: string   // e.g. "18.20.0" — selected by user, empty = system default
  javaVersion?: string   // e.g. "17.0.13" — selected by user, empty = system default
}

export interface ProjectGroup {
  id: string
  name: string
  path: string
  projects: Project[]
}

export type ProcessStatus = 'stopped' | 'running' | 'error'

export interface LogEntry {
  type: 'stdout' | 'stderr' | 'system' | 'stdin'
  data: string
  timestamp: number
}
