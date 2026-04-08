import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Types ─────────────────────────────────────────────────────────────────
type ProjectType = 'npm' | 'maven' | 'gradle'
type Framework =
  | 'react' | 'nextjs' | 'angular' | 'vue' | 'nuxt'
  | 'svelte' | 'astro' | 'nestjs' | 'express' | 'fastify'
  | 'vite' | 'electron' | 'spring' | 'node'
  | 'typescript' | 'javascript'

interface ScannedProject {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
  projectType: ProjectType
  frameworks: Framework[]
}

// ─── Framework detector (npm) ──────────────────────────────────────────────
// Order matters — more specific frameworks first
const FRAMEWORK_DEPS: Array<{ key: string; dep: string | string[]; fw: Framework }> = [
  { key: 'nextjs',    dep: 'next',                        fw: 'nextjs'    },
  { key: 'nuxt',      dep: ['nuxt', 'nuxt3'],             fw: 'nuxt'      },
  { key: 'nestjs',    dep: '@nestjs/core',                fw: 'nestjs'    },
  { key: 'angular',   dep: '@angular/core',               fw: 'angular'   },
  { key: 'react',     dep: 'react',                       fw: 'react'     },
  { key: 'vue',       dep: 'vue',                         fw: 'vue'       },
  { key: 'svelte',    dep: 'svelte',                      fw: 'svelte'    },
  { key: 'astro',     dep: 'astro',                       fw: 'astro'     },
  { key: 'electron',  dep: 'electron',                    fw: 'electron'  },
  { key: 'vite',      dep: 'vite',                        fw: 'vite'      },
  { key: 'fastify',   dep: 'fastify',                     fw: 'fastify'   },
  { key: 'express',   dep: 'express',                     fw: 'express'   },
]

function detectNpmFrameworks(pkg: Record<string, unknown>): Framework[] {
  const allDeps = {
    ...((pkg.dependencies    as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  }
  const found: Framework[] = []
  for (const { dep, fw } of FRAMEWORK_DEPS) {
    const deps = Array.isArray(dep) ? dep : [dep]
    if (deps.some(d => d in allDeps)) found.push(fw)
  }
  // Always add typescript/javascript based on tsconfig or scripts
  const hasTsConfig = false // checked separately
  if ('typescript' in allDeps) found.push('typescript')
  if (found.length === 0) found.push('node')
  return found
}

interface StoredGroup {
  id: string
  name: string
  path: string
  projects: ScannedProject[]
}

// ─── Config persistence ────────────────────────────────────────────────────
const CONFIG_DIR  = path.join(os.homedir(), '.devlauncher')
const CONFIG_FILE = path.join(CONFIG_DIR, 'groups.json')

// Re-detect frameworks for a project that is missing the field
function migrateProject(p: ScannedProject): ScannedProject {
  if (p.frameworks && p.frameworks.length > 0) return p   // already detected

  if (p.projectType === 'maven' || p.projectType === 'gradle') {
    return { ...p, frameworks: ['spring'] }
  }

  // npm — read package.json again
  const pkgPath = path.join(p.path, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return { ...p, frameworks: detectNpmFrameworks(pkg) }
    } catch { /* ignore */ }
  }
  return { ...p, frameworks: ['node'] }
}

function loadGroups(): StoredGroup[] {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    if (!fs.existsSync(CONFIG_FILE)) return []
    const groups: StoredGroup[] = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))

    // Migration: fill in missing frameworks and save back
    let dirty = false
    const migrated = groups.map(g => ({
      ...g,
      projects: g.projects.map(p => {
        if (!p.frameworks || p.frameworks.length === 0) {
          dirty = true
          return migrateProject(p)
        }
        return p
      }),
    }))

    if (dirty) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(migrated, null, 2))
    }

    return migrated
  } catch { return [] }
}

function saveGroups(groups: StoredGroup[]) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(groups, null, 2))
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ─── Project detectors ─────────────────────────────────────────────────────

function readNpm(folderPath: string): ScannedProject | null {
  const pkgPath = path.join(folderPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const rawScripts: Record<string, string> = pkg.scripts || {}
    const scripts: Record<string, string> = {}
    for (const key of Object.keys(rawScripts)) {
      scripts[key] = `npm run ${key}`
    }
    return {
      id: uid(),
      name: pkg.name || path.basename(folderPath),
      path: folderPath,
      scripts,
      projectType: 'npm',
      frameworks: detectNpmFrameworks(pkg),
    }
  } catch { return null }
}

function readMaven(folderPath: string): ScannedProject | null {
  const pomPath = path.join(folderPath, 'pom.xml')
  if (!fs.existsSync(pomPath)) return null
  try {
    const content = fs.readFileSync(pomPath, 'utf-8')
    // Extract artifactId (first occurrence = project itself, not parent)
    const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/)
    const name = artifactMatch ? artifactMatch[1].trim() : path.basename(folderPath)

    const mvn = process.platform === 'win32' ? 'mvn.cmd' : 'mvn'

    // Check for Maven wrapper
    const mvnw = path.join(folderPath, process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw')
    const runner = fs.existsSync(mvnw) ? (process.platform === 'win32' ? 'mvnw.cmd' : './mvnw') : mvn

    const scripts: Record<string, string> = {
      'spring-boot:run': `${runner} spring-boot:run`,
      'clean install':   `${runner} clean install`,
      'test':            `${runner} test`,
      'package':         `${runner} package -DskipTests`,
      'clean':           `${runner} clean`,
    }

    return { id: uid(), name, path: folderPath, scripts, projectType: 'maven', frameworks: ['spring'] }
  } catch { return null }
}

function readGradle(folderPath: string): ScannedProject | null {
  const gradlePath    = path.join(folderPath, 'build.gradle')
  const gradleKtsPath = path.join(folderPath, 'build.gradle.kts')
  if (!fs.existsSync(gradlePath) && !fs.existsSync(gradleKtsPath)) return null

  try {
    // Prefer Gradle wrapper
    const gradlew = path.join(folderPath, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
    const runner = fs.existsSync(gradlew)
      ? (process.platform === 'win32' ? 'gradlew.bat' : './gradlew')
      : (process.platform === 'win32' ? 'gradle.bat' : 'gradle')

    // Try to get project name from settings.gradle
    let name = path.basename(folderPath)
    const settingsPath = path.join(folderPath, 'settings.gradle')
    const settingsKtsPath = path.join(folderPath, 'settings.gradle.kts')
    const settingsFile = fs.existsSync(settingsPath) ? settingsPath : fs.existsSync(settingsKtsPath) ? settingsKtsPath : null
    if (settingsFile) {
      const settings = fs.readFileSync(settingsFile, 'utf-8')
      const nameMatch = settings.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/)
      if (nameMatch) name = nameMatch[1]
    }

    const scripts: Record<string, string> = {
      'bootRun':   `${runner} bootRun`,
      'build':     `${runner} build`,
      'test':      `${runner} test`,
      'clean':     `${runner} clean`,
      'jar':       `${runner} jar`,
    }

    return { id: uid(), name, path: folderPath, scripts, projectType: 'gradle', frameworks: ['spring'] }
  } catch { return null }
}

function detectProject(folderPath: string): ScannedProject | null {
  return readNpm(folderPath) || readMaven(folderPath) || readGradle(folderPath)
}

function scanFolder(folderPath: string): ScannedProject[] {
  const results: ScannedProject[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(folderPath, { withFileTypes: true }) }
  catch { return results }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'build') continue
    const subPath = path.join(folderPath, entry.name)
    const project = detectProject(subPath)
    if (project) results.push(project)
  }
  return results
}

// ─── Process registry ──────────────────────────────────────────────────────
const runningProcesses = new Map<string, ChildProcess>()

// ─── Window ────────────────────────────────────────────────────────────────
let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b1120',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ─── IPC: pick folder ──────────────────────────────────────────────────────
ipcMain.handle('pick-project-folder', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Select project folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const folderName = path.basename(folderPath)

  // Case 1: folder itself is a project
  const own = detectProject(folderPath)
  if (own) {
    return {
      id: uid(),
      name: own.name,
      path: folderPath,
      projects: [own],
    } as StoredGroup
  }

  // Case 2: scan sub-directories
  const projects = scanFolder(folderPath)
  if (projects.length === 0) {
    return { error: 'No supported project found (package.json / pom.xml / build.gradle)' }
  }

  return {
    id: uid(),
    name: folderName,
    path: folderPath,
    projects,
  } as StoredGroup
})

ipcMain.handle('get-groups',   () => loadGroups())
ipcMain.handle('save-groups',  (_e, groups: StoredGroup[]) => { saveGroups(groups); return true })

// ─── IPC: process control ──────────────────────────────────────────────────

function spawnProcess(projectPath: string, command: string, key: string) {
  const child = spawn(command, {
    cwd: projectPath,
    shell: true,
    env: { ...process.env },
  })

  runningProcesses.set(key, child)

  child.stdout?.on('data', (data: Buffer) => {
    win?.webContents.send('process-log', { key, data: data.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (data: Buffer) => {
    win?.webContents.send('process-log', { key, data: data.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
  })

  return child
}

// start-process: (projectId, projectPath, scriptKey, command)
ipcMain.handle('start-process', (_e, projectId: string, projectPath: string, scriptKey: string, command: string) => {
  const key = `${projectId}:${scriptKey}`
  if (runningProcesses.has(key)) return { error: 'Already running' }
  spawnProcess(projectPath, command, key)
  return { success: true }
})

// stop-process: (projectId, scriptKey)
ipcMain.handle('stop-process', (_e, projectId: string, scriptKey: string) => {
  const key = `${projectId}:${scriptKey}`
  const child = runningProcesses.get(key)
  if (!child) return { error: 'Not running' }
  child.kill('SIGTERM')
  runningProcesses.delete(key)
  return { success: true }
})

// restart-process: (projectId, projectPath, scriptKey, command)
ipcMain.handle('restart-process', async (_e, projectId: string, projectPath: string, scriptKey: string, command: string) => {
  const key = `${projectId}:${scriptKey}`
  const existing = runningProcesses.get(key)
  if (existing) {
    existing.kill('SIGTERM')
    runningProcesses.delete(key)
    await new Promise(r => setTimeout(r, 500))
  }
  spawnProcess(projectPath, command, key)
  return { success: true }
})

ipcMain.handle('get-running', () => Array.from(runningProcesses.keys()))
