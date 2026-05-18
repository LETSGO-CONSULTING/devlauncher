import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { createHmac, randomBytes } from 'crypto'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Types ─────────────────────────────────────────────────────────────────
type ProjectType = 'npm' | 'maven' | 'gradle' | 'docker' | 'composer' | 'python' | 'ruby' | 'go' | 'rust'
type Framework =
  | 'react' | 'nextjs' | 'angular' | 'vue' | 'nuxt'
  | 'svelte' | 'astro' | 'nestjs' | 'express' | 'fastify'
  | 'vite' | 'electron' | 'spring' | 'node'
  | 'typescript' | 'javascript'
  | 'docker'
  | 'laravel' | 'symfony' | 'php'
  | 'django' | 'flask' | 'fastapi' | 'python'
  | 'rails' | 'ruby'
  | 'go'
  | 'rust'

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
const CONFIG_DIR    = path.join(os.homedir(), '.devlauncher')
const CONFIG_FILE   = path.join(CONFIG_DIR, 'groups.json')
const LICENSE_FILE  = path.join(CONFIG_DIR, 'license.json')

// ─── License system ────────────────────────────────────────────────────────
//
// Key format:  DLPRO-YYYYMMDD-NNNNN-HHHHHHHHHHHH
//              DLTEA-YYYYMMDD-NNNNN-HHHHHHHHHHHH
//
//   DLPRO / DLTEA  = tier prefix (5 chars)
//   YYYYMMDD       = expiry date (8 chars)
//   NNNNN          = 5-char random nonce (A-Z)
//   HHHHHHHHHHHH   = 12-char HMAC-SHA256 (48-bit, uppercase hex)
//
// ⚠️  Replace LICENSE_HMAC_SECRET with a strong random value before
//     shipping. Inject it at build time via an env variable so it never
//     appears in the public repo:
//       DEVLAUNCHER_LICENSE_SECRET=<secret> npm run build
//
const LICENSE_HMAC_SECRET =
  process.env.DEVLAUNCHER_LICENSE_SECRET ?? 'DL-DEV-PLACEHOLDER-REPLACE-BEFORE-SHIPPING'

type LicenseTier = 'free' | 'pro' | 'teams'

interface StoredLicense {
  key:         string
  tier:        LicenseTier
  expiresAt:   string   // ISO date string
  activatedAt: string
}

function licenseHmac(tier: string, expires: string, nonce: string): string {
  return createHmac('sha256', LICENSE_HMAC_SECRET)
    .update(`${tier}:${expires}:${nonce}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

function validateKey(key: string): { ok: true; tier: LicenseTier; expiresAt: Date } | { ok: false; error: string } {
  const clean = key.trim().toUpperCase().replace(/[\s]/g, '')
  const parts = clean.split('-')

  // Expected 4 parts: prefix, expires, nonce, hmac
  if (parts.length !== 4) return { ok: false, error: 'Invalid key format. Expected DLPRO-YYYYMMDD-NNNNN-HHHHHHHHHHHH' }

  const [prefix, expires, nonce, hmac] = parts

  const tier: LicenseTier | null =
    prefix === 'DLPRO' ? 'pro' :
    prefix === 'DLTEA' ? 'teams' : null

  if (!tier)                           return { ok: false, error: 'Unknown license tier prefix' }
  if (!/^\d{8}$/.test(expires))        return { ok: false, error: 'Invalid expiry date in key' }
  if (!/^[A-Z]{5}$/.test(nonce))       return { ok: false, error: 'Invalid nonce in key' }
  if (hmac.length !== 12)              return { ok: false, error: 'Invalid signature length' }

  const expected = licenseHmac(tier, expires, nonce)
  if (hmac !== expected)               return { ok: false, error: 'License key is invalid or has been tampered with' }

  const yr = parseInt(expires.slice(0, 4))
  const mo = parseInt(expires.slice(4, 6)) - 1
  const dy = parseInt(expires.slice(6, 8))
  const expiresAt = new Date(yr, mo, dy, 23, 59, 59)
  if (expiresAt < new Date())          return { ok: false, error: `License expired on ${expiresAt.toLocaleDateString()}` }

  return { ok: true, tier, expiresAt }
}

function loadStoredLicense(): StoredLicense | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null
    return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) as StoredLicense
  } catch { return null }
}

// ─── License IPC ───────────────────────────────────────────────────────────

ipcMain.handle('license-get', () => {
  const stored = loadStoredLicense()
  if (!stored) return { tier: 'free' }

  const result = validateKey(stored.key)
  if (!result.ok) {
    // Key is invalid or expired — wipe it so user sees free tier
    try { fs.unlinkSync(LICENSE_FILE) } catch { /* ignore */ }
    return { tier: 'free', expired: true }
  }
  return {
    tier:        result.tier,
    expiresAt:   result.expiresAt.toISOString(),
    activatedAt: stored.activatedAt,
    key:         stored.key,
  }
})

ipcMain.handle('license-activate', (_e, key: string) => {
  const result = validateKey(key)
  if (!result.ok) return { success: false, error: result.error }

  const stored: StoredLicense = {
    key:         key.trim().toUpperCase(),
    tier:        result.tier,
    expiresAt:   result.expiresAt.toISOString(),
    activatedAt: new Date().toISOString(),
  }
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(stored, null, 2))
    return { success: true, tier: result.tier, expiresAt: result.expiresAt.toISOString() }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
})

ipcMain.handle('license-deactivate', () => {
  try {
    if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
})

// Re-detect frameworks for a project that is missing the field
function migrateProject(p: ScannedProject): ScannedProject {
  if (p.frameworks && p.frameworks.length > 0) return p   // already detected

  if (p.projectType === 'maven' || p.projectType === 'gradle') {
    return { ...p, frameworks: ['spring'] }
  }
  if (p.projectType === 'docker')    return { ...p, frameworks: ['docker'] }
  if (p.projectType === 'composer')  return { ...p, frameworks: ['php'] }
  if (p.projectType === 'python')    return { ...p, frameworks: ['python'] }
  if (p.projectType === 'ruby')      return { ...p, frameworks: ['ruby'] }
  if (p.projectType === 'go')        return { ...p, frameworks: ['go'] }
  if (p.projectType === 'rust')      return { ...p, frameworks: ['rust'] }

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

    // Migration: fill in missing frameworks + fix Maven project names from pom.xml
    let dirty = false
    const migrated = groups.map(g => ({
      ...g,
      projects: g.projects.map(p => {
        let next = p

        // Fix missing frameworks
        if (!p.frameworks || p.frameworks.length === 0) {
          dirty = true
          next = migrateProject(next)
        }

        // Fix Maven name: always re-read from pom.xml so <name> takes precedence
        if (p.projectType === 'maven') {
          const pomPath = path.join(p.path, 'pom.xml')
          if (fs.existsSync(pomPath)) {
            try {
              const content = fs.readFileSync(pomPath, 'utf-8')
              const correctName = pomProjectName(content, p.path)
              if (correctName !== p.name) {
                dirty = true
                next = { ...next, name: correctName }
              }
            } catch { /* ignore */ }
          }
        }

        return next
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

function pomProjectName(content: string, folderPath: string): string {
  // 1. Prefer <name> — human-readable project name
  const nameMatch = content.match(/<name>([^<]+)<\/name>/)
  if (nameMatch) return nameMatch[1].trim()
  // 2. Strip <parent>…</parent> so we don't pick up spring-boot-starter-parent
  const withoutParent = content.replace(/<parent>[\s\S]*?<\/parent>/m, '')
  const artifactMatch = withoutParent.match(/<artifactId>([^<]+)<\/artifactId>/)
  return artifactMatch ? artifactMatch[1].trim() : path.basename(folderPath)
}

function readMaven(folderPath: string): ScannedProject | null {
  const pomPath = path.join(folderPath, 'pom.xml')
  if (!fs.existsSync(pomPath)) return null
  try {
    const content = fs.readFileSync(pomPath, 'utf-8')
    const name = pomProjectName(content, folderPath)

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

// ─── Docker / Docker Compose detector ─────────────────────────────────────

function readDocker(folderPath: string): ScannedProject | null {
  const composeFiles = [
    'docker-compose.yml', 'docker-compose.yaml',
    'compose.yml',        'compose.yaml',
  ]
  const composePath   = composeFiles.map(f => path.join(folderPath, f)).find(f => fs.existsSync(f))
  const dockerfilePath = path.join(folderPath, 'Dockerfile')
  const hasDockerfile  = fs.existsSync(dockerfilePath)

  if (!composePath && !hasDockerfile) return null

  // Try to extract project name from compose file's `name:` field
  let name = path.basename(folderPath)
  if (composePath) {
    try {
      const content   = fs.readFileSync(composePath, 'utf-8')
      const nameMatch = content.match(/^name\s*:\s*['"]?([^'"\s\n]+)['"]?/m)
      if (nameMatch) name = nameMatch[1]
    } catch { /* ignore */ }
  }

  const slug = path.basename(folderPath).toLowerCase().replace(/[^a-z0-9-]/g, '-')

  const scripts: Record<string, string> = composePath
    ? {
        'up':    'docker compose up',
        'up -d': 'docker compose up -d',
        'down':  'docker compose down',
        'build': 'docker compose build',
        'logs':  'docker compose logs -f',
        'ps':    'docker compose ps',
      }
    : {
        'build': `docker build -t ${slug} .`,
        'run':   `docker run --rm ${slug}`,
      }

  return {
    id: uid(),
    name,
    path: folderPath,
    scripts,
    projectType: 'docker',
    frameworks: ['docker'],
  }
}

// ─── PHP / Composer detector ───────────────────────────────────────────────
function readComposer(folderPath: string): ScannedProject | null {
  const composerPath = path.join(folderPath, 'composer.json')
  if (!fs.existsSync(composerPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(composerPath, 'utf-8'))
    const require: Record<string, string> = pkg.require ?? {}
    const name = pkg.name ? path.basename(pkg.name) : path.basename(folderPath)

    const frameworks: Framework[] = []
    if ('laravel/framework' in require)      frameworks.push('laravel')
    else if ('symfony/symfony' in require || 'symfony/framework-bundle' in require) frameworks.push('symfony')
    else frameworks.push('php')

    const isLaravel  = frameworks.includes('laravel')
    const isSymfony  = frameworks.includes('symfony')
    const scripts: Record<string, string> = isLaravel
      ? {
          'serve':   'php artisan serve',
          'install': 'composer install',
          'migrate': 'php artisan migrate',
          'test':    'php artisan test',
          'queue':   'php artisan queue:work',
        }
      : isSymfony
      ? {
          'serve':   'symfony serve',
          'install': 'composer install',
          'console': 'php bin/console',
          'test':    'php bin/phpunit',
        }
      : {
          'install': 'composer install',
          'serve':   'php -S localhost:8000',
          'test':    'composer test',
          'dump':    'composer dump-autoload',
        }

    return { id: uid(), name, path: folderPath, scripts, projectType: 'composer', frameworks }
  } catch { return null }
}

// ─── Python detector ────────────────────────────────────────────────────────
function readPython(folderPath: string): ScannedProject | null {
  const hasReqs    = fs.existsSync(path.join(folderPath, 'requirements.txt'))
  const hasPyproj  = fs.existsSync(path.join(folderPath, 'pyproject.toml'))
  const hasManage  = fs.existsSync(path.join(folderPath, 'manage.py'))
  const hasSetup   = fs.existsSync(path.join(folderPath, 'setup.py'))
  if (!hasReqs && !hasPyproj && !hasManage && !hasSetup) return null

  const name = path.basename(folderPath)
  const frameworks: Framework[] = []

  // Read requirements for framework detection
  let reqs = ''
  if (hasReqs) {
    try { reqs = fs.readFileSync(path.join(folderPath, 'requirements.txt'), 'utf-8').toLowerCase() } catch { /* */ }
  }
  if (hasManage || reqs.includes('django'))          frameworks.push('django')
  else if (reqs.includes('fastapi'))                 frameworks.push('fastapi')
  else if (reqs.includes('flask'))                   frameworks.push('flask')
  else                                               frameworks.push('python')

  const isDjango  = frameworks.includes('django')
  const isFastAPI = frameworks.includes('fastapi')
  const scripts: Record<string, string> = isDjango
    ? {
        'runserver': 'python manage.py runserver',
        'migrate':   'python manage.py migrate',
        'test':      'python manage.py test',
        'shell':     'python manage.py shell',
        'install':   'pip install -r requirements.txt',
      }
    : isFastAPI
    ? {
        'dev':     'uvicorn main:app --reload',
        'start':   'uvicorn main:app',
        'install': 'pip install -r requirements.txt',
      }
    : {
        'start':   'python app.py',
        'dev':     'flask run --debug',
        'install': 'pip install -r requirements.txt',
        'test':    'pytest',
      }

  return { id: uid(), name, path: folderPath, scripts, projectType: 'python', frameworks }
}

// ─── Ruby / Rails detector ──────────────────────────────────────────────────
function readRuby(folderPath: string): ScannedProject | null {
  const gemfilePath = path.join(folderPath, 'Gemfile')
  if (!fs.existsSync(gemfilePath)) return null
  try {
    const content = fs.readFileSync(gemfilePath, 'utf-8')
    const name = path.basename(folderPath)
    const isRails = /gem ['"]rails['"]/.test(content)
    const frameworks: Framework[] = [isRails ? 'rails' : 'ruby']
    const scripts: Record<string, string> = isRails
      ? {
          'server':  'rails server',
          'install': 'bundle install',
          'migrate': 'rails db:migrate',
          'test':    'rails test',
          'console': 'rails console',
        }
      : {
          'install': 'bundle install',
          'test':    'bundle exec rspec',
          'exec':    'bundle exec ruby',
        }
    return { id: uid(), name, path: folderPath, scripts, projectType: 'ruby', frameworks }
  } catch { return null }
}

// ─── Go detector ────────────────────────────────────────────────────────────
function readGo(folderPath: string): ScannedProject | null {
  const gomodPath = path.join(folderPath, 'go.mod')
  if (!fs.existsSync(gomodPath)) return null
  try {
    const content = fs.readFileSync(gomodPath, 'utf-8')
    const moduleMatch = content.match(/^module\s+(.+)/m)
    const name = moduleMatch ? path.basename(moduleMatch[1].trim()) : path.basename(folderPath)
    const scripts: Record<string, string> = {
      'run':   'go run .',
      'build': 'go build -o bin/app .',
      'test':  'go test ./...',
      'tidy':  'go mod tidy',
      'vet':   'go vet ./...',
    }
    return { id: uid(), name, path: folderPath, scripts, projectType: 'go', frameworks: ['go'] }
  } catch { return null }
}

// ─── Rust detector ──────────────────────────────────────────────────────────
function readRust(folderPath: string): ScannedProject | null {
  const cargoPath = path.join(folderPath, 'Cargo.toml')
  if (!fs.existsSync(cargoPath)) return null
  try {
    const content = fs.readFileSync(cargoPath, 'utf-8')
    const nameMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
    const name = nameMatch ? nameMatch[1] : path.basename(folderPath)
    const scripts: Record<string, string> = {
      'run':     'cargo run',
      'build':   'cargo build',
      'release': 'cargo build --release',
      'test':    'cargo test',
      'check':   'cargo check',
      'clippy':  'cargo clippy',
    }
    return { id: uid(), name, path: folderPath, scripts, projectType: 'rust', frameworks: ['rust'] }
  } catch { return null }
}

function detectProject(folderPath: string): ScannedProject | null {
  return readNpm(folderPath)
    || readMaven(folderPath)
    || readGradle(folderPath)
    || readDocker(folderPath)
    || readComposer(folderPath)
    || readPython(folderPath)
    || readRuby(folderPath)
    || readGo(folderPath)
    || readRust(folderPath)
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
    width: 1760,
    height: 1200,
    minWidth: 1100,
    minHeight: 750,
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

// Kill all managed processes before the app exits so ports are freed
app.on('before-quit', () => {
  for (const [, child] of runningProcesses) {
    try { killProcess(child) } catch { /* ignore */ }
  }
  runningProcesses.clear()
})

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

// ─── Runtime version helpers ───────────────────────────────────────────────

const NVM_SCRIPT = path.join(os.homedir(), '.nvm', 'nvm.sh')

// List Node versions installed via nvm
ipcMain.handle('node-list-versions', async () => {
  if (!fs.existsSync(NVM_SCRIPT)) return { error: 'nvm not found', versions: [] }
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', `source "${NVM_SCRIPT}" && nvm ls --no-colors`], { shell: false })
    let out = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { out += d.toString() })
    child.on('exit', () => {
      // Parse lines like "->  v18.20.0" or "    v20.11.0"
      const versions: string[] = []
      let current = ''
      for (const line of out.split('\n')) {
        const m = line.match(/v(\d+\.\d+\.\d+)/)
        if (m) {
          versions.push(m[1])
          if (line.includes('->')) current = m[1]
        }
      }
      resolve({ versions, current, nvmFound: true })
    })
  })
})

// Install a Node version via nvm (streams logs back)
ipcMain.handle('node-install-version', (_e, version: string) => {
  if (!fs.existsSync(NVM_SCRIPT)) return { error: 'nvm not found' }
  const key = `__install__:node-${version}`
  if (runningProcesses.has(key)) return { error: 'Already installing' }

  const child = spawn('bash', ['-c', `source "${NVM_SCRIPT}" && nvm install ${version}`], { shell: false })
  runningProcesses.set(key, child)

  child.stdout?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
    win?.webContents.send('node-versions-changed')
  })

  return { success: true, key }
})

// List Java versions installed (macOS /usr/libexec/java_home -V)
ipcMain.handle('java-list-versions', async () => {
  return new Promise((resolve) => {
    // -V writes to stderr on macOS
    const child = spawn('/usr/libexec/java_home', ['-V'], { shell: false })
    let out = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { out += d.toString() })
    child.on('exit', (code) => {
      if (code !== 0 && !out) return resolve({ versions: [], error: 'java_home not found' })

      // Parse lines like: "21.0.5 (arm64) "Amazon.com Inc." - "Amazon Corretto 21" /path"
      const versions: Array<{ version: string; vendor: string; home: string }> = []
      for (const line of out.split('\n')) {
        const m = line.match(/^\s+(\d+\.\d+(?:\.\d+)?)\s+\(.*?\)\s+"([^"]+)"\s+-\s+"([^"]+)"\s+(.+)$/)
        if (m) {
          versions.push({ version: m[1], vendor: m[3], home: m[4].trim() })
        }
      }

      // Current JAVA_HOME
      const currentHome = process.env.JAVA_HOME ?? ''
      const current = versions.find(v => v.home === currentHome)?.version ?? (versions[0]?.version ?? '')

      resolve({ versions, current })
    })
  })
})

// Get JAVA_HOME path for a specific version (or the default if no version given)
function getJavaHome(version?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const args = version ? ['-v', version] : []
    const child = spawn('/usr/libexec/java_home', args, { shell: false })
    let out = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.on('exit', (code) => resolve(code === 0 ? out.trim() : null))
  })
}

// ─── IPC: process control ──────────────────────────────────────────────────

async function buildEnv(nodeVersion?: string, javaVersion?: string): Promise<Record<string, string>> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>

  if (nodeVersion && fs.existsSync(NVM_SCRIPT)) {
    // nvm sets PATH — we resolve the exact bin path
    const nvmDir = path.join(os.homedir(), '.nvm', 'versions', 'node', `v${nodeVersion}`, 'bin')
    if (fs.existsSync(nvmDir)) {
      env.PATH = `${nvmDir}:${env.PATH ?? ''}`
    }
  }

  // Always resolve a Java home — Electron apps launched from Dock/Finder don't
  // inherit the shell's JAVA_HOME, so we must set it explicitly every time.
  const javaHome = await getJavaHome(javaVersion)
  if (javaHome) {
    env.JAVA_HOME = javaHome
    env.PATH = `${javaHome}/bin:${env.PATH ?? ''}`
  }

  return env
}

// Kill a child process and its entire process group (so JVM children also die)
function killProcess(child: ChildProcess) {
  if (!child.pid) { child.kill('SIGTERM'); return }
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {
    child.kill('SIGTERM')
  }
}

function spawnProcess(projectPath: string, command: string, key: string, env: Record<string, string>) {
  const child = spawn(command, {
    cwd: projectPath,
    shell: true,
    env,
    // detached: true lets us kill the whole process group on Unix
    detached: process.platform !== 'win32',
  })

  runningProcesses.set(key, child)

  // Notify renderer immediately with the real PID
  win?.webContents.send('process-started', { key, pid: child.pid ?? null })

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

// start-process: (projectId, projectPath, scriptKey, command, nodeVersion?, javaVersion?)
ipcMain.handle('start-process', async (_e, projectId: string, projectPath: string, scriptKey: string, command: string, nodeVersion?: string, javaVersion?: string) => {
  const key = `${projectId}:${scriptKey}`
  if (runningProcesses.has(key)) {
    // Race condition guard: the exit event may not have fired yet.
    // Use kill(pid, 0) to check if the process is actually alive.
    const child = runningProcesses.get(key)!
    const alive = child.pid != null && (() => {
      try { process.kill(child.pid!, 0); return true } catch { return false }
    })()
    if (alive) return { error: 'Already running' }
    // Stale entry — process died but exit event hasn't fired yet; clean up now
    runningProcesses.delete(key)
  }
  const env = await buildEnv(nodeVersion, javaVersion)
  spawnProcess(projectPath, command, key, env)
  return { success: true }
})

// stop-process
ipcMain.handle('stop-process', (_e, projectId: string, scriptKey: string) => {
  const key = `${projectId}:${scriptKey}`
  const child = runningProcesses.get(key)
  if (!child) return { error: 'Not running' }
  killProcess(child)
  runningProcesses.delete(key)
  return { success: true }
})

// restart-process
ipcMain.handle('restart-process', async (_e, projectId: string, projectPath: string, scriptKey: string, command: string, nodeVersion?: string, javaVersion?: string) => {
  const key = `${projectId}:${scriptKey}`
  const existing = runningProcesses.get(key)
  if (existing) {
    killProcess(existing)
    runningProcesses.delete(key)
    await new Promise(r => setTimeout(r, 500))
  }
  const env = await buildEnv(nodeVersion, javaVersion)
  spawnProcess(projectPath, command, key, env)
  return { success: true }
})

ipcMain.handle('get-running', () => Array.from(runningProcesses.keys()))

// Send text to a running process stdin (for interactive prompts like Y/n)
ipcMain.handle('send-input', (_e, projectId: string, scriptKey: string, text: string) => {
  const key = `${projectId}:${scriptKey}`
  const child = runningProcesses.get(key)
  if (!child) return { error: 'Not running' }
  if (!child.stdin || child.stdin.destroyed) return { error: 'stdin not available' }
  try {
    child.stdin.write(text)
    return { success: true }
  } catch (err) {
    return { error: String(err) }
  }
})

// Returns a map of processKey → real OS pid for all currently running processes
ipcMain.handle('get-process-pids', () => {
  const pids: Record<string, number> = {}
  for (const [key, child] of runningProcesses) {
    if (child.pid != null) pids[key] = child.pid
  }
  return pids
})

/// ─── Kill any process occupying a port ────────────────────────────────────
ipcMain.handle('kill-port', (_e, port: number): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`
      : `lsof -ti tcp:${port} | xargs kill -9`
    const child = spawn(process.platform === 'win32' ? 'cmd' : 'bash',
      process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd],
      { shell: false })
    child.on('exit', (code) => {
      if (code === 0) resolve({ success: true })
      else resolve({ success: false, error: `No process found on port ${port}` })
    })
  })
})

// ─── Shell: open URL in default browser ───────────────────────────────────
ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url))
ipcMain.handle('open-in-finder', (_e, folderPath: string) => shell.openPath(folderPath))

// ─── Node: uninstall version ───────────────────────────────────────────────
ipcMain.handle('node-uninstall-version', (_e, version: string) => {
  if (!fs.existsSync(NVM_SCRIPT)) return { error: 'nvm not found' }
  const key = `__uninstall__:node-${version}`
  if (runningProcesses.has(key)) return { error: 'Already running' }

  const child = spawn('bash', ['-c', `source "${NVM_SCRIPT}" && nvm uninstall ${version}`], { shell: false })
  runningProcesses.set(key, child)

  child.stdout?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
    win?.webContents.send('node-versions-changed')
  })
  return { success: true, key }
})

// ─── Node: set default version ─────────────────────────────────────────────
ipcMain.handle('node-set-default', (_e, version: string) => {
  if (!fs.existsSync(NVM_SCRIPT)) return { error: 'nvm not found' }
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', `source "${NVM_SCRIPT}" && nvm alias default ${version}`], { shell: false })
    child.on('exit', (code) => {
      if (code === 0) {
        win?.webContents.send('node-versions-changed')
        resolve({ success: true })
      } else {
        resolve({ error: `Exit code ${code}` })
      }
    })
  })
})

// ─── Java: install via Homebrew (Temurin) ──────────────────────────────────
ipcMain.handle('java-install-version', (_e, cask: string) => {
  // cask e.g. "temurin@21", "temurin@17"
  const key = `__install__:java-${cask}`
  if (runningProcesses.has(key)) return { error: 'Already installing' }

  // Find brew binary
  const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
  const brewBin = brewPaths.find(p => fs.existsSync(p))
  if (!brewBin) return { error: 'Homebrew not found. Install from https://brew.sh' }

  const child = spawn(brewBin, ['install', '--cask', cask], { shell: false })
  runningProcesses.set(key, child)

  child.stdout?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
    win?.webContents.send('java-versions-changed')
  })
  return { success: true, key }
})

// ─── Check tool availability ───────────────────────────────────────────────
ipcMain.handle('check-tools', () => {
  const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
  const brewFound = brewPaths.some(p => fs.existsSync(p))
  const nvmFound  = fs.existsSync(NVM_SCRIPT)
  const pyenvDir  = path.join(os.homedir(), '.pyenv', 'versions')
  const pyenvFound = fs.existsSync(pyenvDir)

  // List pyenv Python versions
  let pythonVersions: string[] = []
  if (pyenvFound) {
    try { pythonVersions = fs.readdirSync(pyenvDir).filter(d => /^\d/.test(d)) } catch { /* */ }
  }

  return { brewFound, nvmFound, pyenvFound, pythonVersions }
})

// ─── Infra helpers ─────────────────────────────────────────────────────────

/** Run a command and return stdout as string, or throw on non-zero exit. */
function runCmd(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false })
    let out = ''
    let err = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { err += d.toString() })
    child.on('exit', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(err.trim() || `Exit code ${code}`))
    })
    child.on('error', reject)
  })
}

function findBin(names: string[]): string | null {
  const extraPaths = [
    '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin',
    path.join(os.homedir(), '.docker', 'bin'),
  ]
  for (const name of names) {
    for (const dir of extraPaths) {
      const full = path.join(dir, name)
      if (fs.existsSync(full)) return full
    }
  }
  return null
}

// ─── Docker IPC ────────────────────────────────────────────────────────────

ipcMain.handle('docker-info', async () => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  try {
    const raw = await runCmd(bin, ['info', '--format', '{{json .}}'])
    const info = JSON.parse(raw)
    return {
      version:    info.ServerVersion ?? '?',
      containers: info.Containers     ?? 0,
      running:    info.ContainersRunning ?? 0,
      paused:     info.ContainersPaused  ?? 0,
      stopped:    info.ContainersStopped ?? 0,
      images:     info.Images           ?? 0,
      os:         info.OperatingSystem  ?? '?',
    }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('docker-containers', async () => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  try {
    // Two-pass: first get base info, then inspect for compose label
    const raw = await runCmd(bin, [
      'ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}',
    ])
    if (!raw) return { containers: [] }
    const baseList = raw.split('\n').filter(Boolean).map(line => {
      const [id, name, image, status, ports, state] = line.split('|')
      return { id, name, image, status, ports, state, composeProject: '' }
    })

    // Batch-inspect all container IDs for labels (single call)
    const ids = baseList.map(c => c.id)
    let composeMap: Record<string, string> = {}
    if (ids.length > 0) {
      try {
        const inspectRaw = await runCmd(bin, [
          'inspect', '--format',
          '{{.Id}}|{{index .Config.Labels "com.docker.compose.project"}}',
          ...ids,
        ])
        inspectRaw.split('\n').filter(Boolean).forEach(line => {
          const sep = line.indexOf('|')
          const fullId = line.slice(0, sep)
          const proj   = line.slice(sep + 1).trim()
          // Match short ID (first 12 chars) to full ID
          const shortId = baseList.find(c => fullId.startsWith(c.id))?.id
          if (shortId && proj) composeMap[shortId] = proj
        })
      } catch { /* labels unavailable, show containers without grouping */ }
    }

    const containers = baseList.map(c => ({ ...c, composeProject: composeMap[c.id] ?? '' }))
    return { containers }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('docker-images', async () => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  try {
    const raw = await runCmd(bin, [
      'images', '--format', '{{.Repository}}|{{.Tag}}|{{.ID}}|{{.Size}}|{{.CreatedSince}}',
    ])
    if (!raw) return { images: [] }
    const images = raw.split('\n').filter(Boolean).map(line => {
      const [repo, tag, id, size, created] = line.split('|')
      return { repo, tag, id, size, created }
    })
    return { images }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('docker-action', async (_e, action: string, containerId: string) => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  const allowed = ['start', 'stop', 'restart', 'rm', 'kill']
  if (!allowed.includes(action)) return { error: 'Invalid action' }
  try {
    const args = action === 'rm' ? ['rm', '-f', containerId] : [action, containerId]
    await runCmd(bin, args)
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('docker-image-action', async (_e, action: string, imageId: string) => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  if (action !== 'rmi') return { error: 'Invalid action' }
  try {
    await runCmd(bin, ['rmi', '-f', imageId])
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('docker-container-logs', (_e, containerId: string) => {
  const bin = findBin(['docker'])
  if (!bin) return { error: 'Docker not found' }
  const key = `__docker_logs__:${containerId}`
  if (runningProcesses.has(key)) return { error: 'Already streaming' }
  const child = spawn(bin, ['logs', '-f', '--tail', '200', containerId], { shell: false })
  runningProcesses.set(key, child)
  child.stdout?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
  })
  return { key }
})

// ─── Kubernetes IPC ────────────────────────────────────────────────────────

ipcMain.handle('kubectl-check', async () => {
  const bin = findBin(['kubectl'])
  if (!bin) return { found: false }
  try {
    const version = await runCmd(bin, ['version', '--client', '--output=json'])
    const v = JSON.parse(version)
    return { found: true, version: v.clientVersion?.gitVersion ?? '?' }
  } catch {
    return { found: true, version: '?' }
  }
})

ipcMain.handle('kubectl-contexts', async () => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  try {
    const raw     = await runCmd(bin, ['config', 'get-contexts', '-o', 'name'])
    const current = await runCmd(bin, ['config', 'current-context']).catch(() => '')
    return { contexts: raw.split('\n').filter(Boolean), current }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('kubectl-use-context', async (_e, ctx: string) => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  try {
    await runCmd(bin, ['config', 'use-context', ctx])
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('kubectl-get', async (_e, resource: string, namespace?: string) => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  const allowed = ['pods', 'services', 'deployments', 'namespaces', 'nodes', 'configmaps', 'ingresses']
  if (!allowed.includes(resource)) return { error: 'Invalid resource' }
  try {
    const args = ['get', resource, '-o', 'json']
    if (namespace) args.push('-n', namespace)
    else args.push('--all-namespaces')
    const raw  = await runCmd(bin, args)
    const data = JSON.parse(raw)
    return { items: data.items ?? [] }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('kubectl-namespaces', async () => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  try {
    const raw  = await runCmd(bin, ['get', 'namespaces', '-o', 'json'])
    const data = JSON.parse(raw)
    return { namespaces: (data.items ?? []).map((i: { metadata: { name: string } }) => i.metadata.name) }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('kubectl-pod-action', async (_e, action: string, podName: string, namespace: string) => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  if (action !== 'delete') return { error: 'Invalid action' }
  try {
    await runCmd(bin, ['delete', 'pod', podName, '-n', namespace, '--grace-period=0'])
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('kubectl-pod-logs', (_e, podName: string, namespace: string) => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  const key = `__k8s_logs__:${namespace}:${podName}`
  if (runningProcesses.has(key)) return { error: 'Already streaming' }
  const child = spawn(bin, ['logs', '-f', '--tail=200', podName, '-n', namespace], { shell: false })
  runningProcesses.set(key, child)
  child.stdout?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stdout' })
  })
  child.stderr?.on('data', (d: Buffer) => {
    win?.webContents.send('process-log', { key, data: d.toString(), type: 'stderr' })
  })
  child.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
  })
  return { key }
})

ipcMain.handle('kubectl-scale', async (_e, deployment: string, namespace: string, replicas: number) => {
  const bin = findBin(['kubectl'])
  if (!bin) return { error: 'kubectl not found' }
  if (replicas < 0 || replicas > 50) return { error: 'Invalid replicas count' }
  try {
    await runCmd(bin, ['scale', 'deployment', deployment, `--replicas=${replicas}`, '-n', namespace])
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

// ─── Window controls ───────────────────────────────────────────────────────
ipcMain.handle('window-maximize', () => {
  if (!win) return
  if (process.platform === 'darwin') {
    win.isFullScreen() ? win.setFullScreen(false) : win.setFullScreen(true)
  } else {
    win.isMaximized() ? win.unmaximize() : win.maximize()
  }
})
ipcMain.handle('window-minimize', () => win?.minimize())
ipcMain.handle('window-close',    () => win?.close())

// ─── Editor detection & open ──────────────────────────────────────────────
const EDITORS = [
  { id: 'cursor',    label: 'Cursor',          app: 'Cursor' },
  { id: 'code',      label: 'VS Code',          app: 'Visual Studio Code' },
  { id: 'zed',       label: 'Zed',              app: 'Zed' },
  { id: 'webstorm',  label: 'WebStorm',         app: 'WebStorm' },
  { id: 'idea',      label: 'IntelliJ IDEA',    app: 'IntelliJ IDEA' },
  { id: 'idea-ce',   label: 'IDEA Community',   app: 'IntelliJ IDEA CE' },
  { id: 'subl',      label: 'Sublime Text',     app: 'Sublime Text' },
  { id: 'nova',      label: 'Nova',             app: 'Nova' },
  { id: 'xcode',     label: 'Xcode',            app: 'Xcode' },
  { id: 'rubymine',  label: 'RubyMine',         app: 'RubyMine' },
  { id: 'pycharm',   label: 'PyCharm',          app: 'PyCharm' },
  { id: 'goland',    label: 'GoLand',           app: 'GoLand' },
]

ipcMain.handle('detect-editors', () => {
  const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')]
  return EDITORS.filter(e =>
    appDirs.some(dir => fs.existsSync(path.join(dir, `${e.app}.app`)))
  ).map(({ id, label, app }) => ({ id, label, bin: app }))
})

ipcMain.handle('open-in-editor', (_e, projectPath: string, bin: string) => {
  try {
    spawn('open', ['-a', bin, projectPath], { detached: true, stdio: 'ignore' }).unref()
    return { success: true }
  } catch (e: unknown) {
    return { error: (e as Error).message }
  }
})

// ─── Project graph (mind map) ──────────────────────────────────────────────

type NodeRole = 'frontend' | 'backend' | 'fullstack' | 'database' | 'cache' | 'unknown'

interface GraphNode {
  id:        string
  label:     string
  role:      NodeRole
  path:      string
  port?:     number
  tech:      string[]
  envVars:   Record<string, string>
  groupId?:  string
  groupName?: string
}

interface GraphEdge {
  source: string
  target: string
  label:  string
}

interface ProjectGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const FRONTEND_FRAMEWORKS  = new Set(['react','vue','angular','svelte','astro','vite'])
const BACKEND_FRAMEWORKS   = new Set(['express','fastify','nestjs','django','flask','fastapi','rails','spring','laravel','symfony','go','rust'])
const FULLSTACK_FRAMEWORKS = new Set(['nextjs','nuxt','electron'])

const DB_ENV_PATTERNS = [
  { pattern: /DATABASE_URL|POSTGRES_URL|PG_URL/i,       label: 'PostgreSQL', role: 'database' as NodeRole },
  { pattern: /MONGO(DB)?_URI|MONGO_URL/i,               label: 'MongoDB',    role: 'database' as NodeRole },
  { pattern: /MYSQL_URL|DB_URL/i,                       label: 'MySQL',      role: 'database' as NodeRole },
  { pattern: /REDIS_URL|REDIS_URI/i,                    label: 'Redis',      role: 'cache'    as NodeRole },
  { pattern: /SUPABASE_URL/i,                           label: 'Supabase',   role: 'database' as NodeRole },
  { pattern: /FIREBASE_URL|FIREBASE_PROJECT/i,          label: 'Firebase',   role: 'database' as NodeRole },
]

const API_ENV_PATTERNS = [
  /REACT_APP_API_URL/i,
  /VITE_API_URL|VITE_APP_API/i,
  /NEXT_PUBLIC_API/i,
  /VUE_APP_API/i,
  /API_URL|API_BASE_URL|BACKEND_URL/i,
]

function parseEnvFile(projectPath: string): Record<string, string> {
  const envFiles = ['.env', '.env.local', '.env.development']
  const result: Record<string, string> = {}
  for (const f of envFiles) {
    const fp = path.join(projectPath, f)
    if (!fs.existsSync(fp)) continue
    try {
      const lines = fs.readFileSync(fp, 'utf-8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        result[key] = val
      }
    } catch { /* ignore unreadable */ }
  }
  return result
}

function classifyRole(frameworks: Framework[], envVars: Record<string, string>): NodeRole {
  const fws = new Set(frameworks)
  const isFront   = [...fws].some(f => FRONTEND_FRAMEWORKS.has(f))
  const isBack    = [...fws].some(f => BACKEND_FRAMEWORKS.has(f))
  const isFull    = [...fws].some(f => FULLSTACK_FRAMEWORKS.has(f))
  if (isFull) return 'fullstack'
  if (isFront && isBack) return 'fullstack'
  if (isFront) return 'frontend'
  if (isBack)  return 'backend'
  // Infer from env vars
  const keys = Object.keys(envVars).join('|')
  if (/EXPRESS|DJANGO|RAILS|SPRING|FLASK|FASTAPI/i.test(keys)) return 'backend'
  if (/REACT|VUE|ANGULAR|SVELTE/i.test(keys)) return 'frontend'
  return 'unknown'
}

function extractPort(envVars: Record<string, string>): number | undefined {
  const raw = envVars['PORT'] ?? envVars['SERVER_PORT'] ?? envVars['APP_PORT']
  if (raw) {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) return n
  }
}

function extractUrlPort(url: string): number | undefined {
  try {
    const u = new URL(url)
    const p = parseInt(u.port, 10)
    return isNaN(p) ? undefined : p
  } catch { return undefined }
}

ipcMain.handle('get-project-graph', (): ProjectGraph => {
  const groups = loadGroups()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[]  = []

  for (const group of groups) {
    // DB/cache nodes are scoped per group — each group owns its own services
    const groupDbNodes = new Map<string, string>() // label → node id
    const groupNodes: GraphNode[] = []

    for (const project of group.projects) {
      const envVars = parseEnvFile(project.path)
      const role    = classifyRole(project.frameworks ?? [], envVars)
      const port    = extractPort(envVars)

      groupNodes.push({
        id:        project.id,
        label:     project.name,
        role,
        path:      project.path,
        port,
        tech:      project.frameworks ?? [],
        envVars,
        groupId:   group.id,
        groupName: group.name,
      })
    }

    nodes.push(...groupNodes)

    // Infer edges within this group only
    for (const node of groupNodes) {
      const env = node.envVars

      // DB / cache edges — scoped to this group
      for (const { pattern, label, role } of DB_ENV_PATTERNS) {
        const match = Object.keys(env).find(k => pattern.test(k))
        if (!match) continue
        let dbId = groupDbNodes.get(label)
        if (!dbId) {
          dbId = `db-${group.id}-${label.toLowerCase()}`
          groupDbNodes.set(label, dbId)
          nodes.push({ id: dbId, label, role, path: '', tech: [label.toLowerCase()], envVars: {}, groupId: group.id, groupName: group.name })
        }
        edges.push({ source: node.id, target: dbId, label: match })
      }

      // API URL edges — only match within same group
      for (const pat of API_ENV_PATTERNS) {
        const key = Object.keys(env).find(k => pat.test(k))
        if (!key) continue
        const val  = env[key]
        const port = extractUrlPort(val)
        if (!port) continue
        const target = groupNodes.find(n => n.id !== node.id && n.port === port)
        if (target) {
          edges.push({ source: node.id, target: target.id, label: key })
        }
      }
    }
  }

  return { nodes, edges }
})
