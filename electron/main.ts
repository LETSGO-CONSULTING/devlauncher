import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Config persistence ────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.devlauncher')
const CONFIG_FILE = path.join(CONFIG_DIR, 'groups.json')

interface StoredProject {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
}

interface StoredGroup {
  id: string
  name: string
  path: string
  projects: StoredProject[]
}

function loadGroups(): StoredGroup[] {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    if (!fs.existsSync(CONFIG_FILE)) return []
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveGroups(groups: StoredGroup[]) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(groups, null, 2))
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function readPkg(folderPath: string): { name: string; scripts: Record<string, string> } | null {
  const pkgPath = path.join(folderPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return {
      name: pkg.name || path.basename(folderPath),
      scripts: pkg.scripts || {},
    }
  } catch {
    return null
  }
}

function scanFolder(folderPath: string): StoredProject[] {
  const results: StoredProject[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const subPath = path.join(folderPath, entry.name)
    const pkg = readPkg(subPath)
    if (pkg) {
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: pkg.name,
        path: subPath,
        scripts: pkg.scripts,
      })
    }
  }

  return results
}

// ─── Process registry ──────────────────────────────────────────────────────
const runningProcesses = new Map<string, ChildProcess>() // key: `${projectId}:${script}`

// ─── Window ────────────────────────────────────────────────────────────────
let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
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

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// Open folder picker — auto-detect single project vs group
ipcMain.handle('pick-project-folder', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Select project folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const folderName = path.basename(folderPath)

  // Case 1: folder itself has package.json → single project group
  const ownPkg = readPkg(folderPath)
  if (ownPkg) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: ownPkg.name,
      path: folderPath,
      projects: [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: ownPkg.name,
        path: folderPath,
        scripts: ownPkg.scripts,
      }],
    } as StoredGroup
  }

  // Case 2: scan subdirectories for package.json files
  const projects = scanFolder(folderPath)
  if (projects.length === 0) {
    return { error: 'No package.json found in this folder or its subdirectories' }
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: folderName,
    path: folderPath,
    projects,
  } as StoredGroup
})

ipcMain.handle('get-groups', () => loadGroups())
ipcMain.handle('save-groups', (_e, groups: StoredGroup[]) => { saveGroups(groups); return true })

// Start a script
ipcMain.handle('start-process', (_e, projectId: string, projectPath: string, script: string) => {
  const key = `${projectId}:${script}`
  if (runningProcesses.has(key)) return { error: 'Already running' }

  const child = spawn('npm', ['run', script], {
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

  return { success: true }
})

// Stop a script
ipcMain.handle('stop-process', (_e, projectId: string, script: string) => {
  const key = `${projectId}:${script}`
  const child = runningProcesses.get(key)
  if (!child) return { error: 'Not running' }
  child.kill('SIGTERM')
  runningProcesses.delete(key)
  return { success: true }
})

// Restart a script
ipcMain.handle('restart-process', async (_e, projectId: string, projectPath: string, script: string) => {
  const key = `${projectId}:${script}`
  const child = runningProcesses.get(key)
  if (child) {
    child.kill('SIGTERM')
    runningProcesses.delete(key)
    await new Promise(r => setTimeout(r, 500))
  }

  const newChild = spawn('npm', ['run', script], {
    cwd: projectPath,
    shell: true,
    env: { ...process.env },
  })

  runningProcesses.set(key, newChild)

  newChild.stdout?.on('data', (data: Buffer) => {
    win?.webContents.send('process-log', { key, data: data.toString(), type: 'stdout' })
  })
  newChild.stderr?.on('data', (data: Buffer) => {
    win?.webContents.send('process-log', { key, data: data.toString(), type: 'stderr' })
  })
  newChild.on('exit', (code) => {
    runningProcesses.delete(key)
    win?.webContents.send('process-exit', { key, code })
  })

  return { success: true }
})

ipcMain.handle('get-running', () => Array.from(runningProcesses.keys()))
