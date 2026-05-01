export type ProjectType = 'npm' | 'maven' | 'gradle' | 'docker'

export type Framework =
  | 'react'   | 'nextjs'   | 'angular'  | 'vue'      | 'nuxt'
  | 'svelte'  | 'astro'    | 'nestjs'   | 'express'  | 'fastify'
  | 'vite'    | 'electron' | 'spring'   | 'node'
  | 'typescript' | 'javascript'
  | 'docker'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface Project {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
  projectType: ProjectType
  frameworks: Framework[]
  packageManager?: PackageManager
  nodeVersion?: string
  javaVersion?: string
  hooks?: Record<string, { pre?: string; post?: string }>
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
