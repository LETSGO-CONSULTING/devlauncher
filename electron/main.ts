import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Config persistence ────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.devlauncher')
const CONFIG_FILE = path.join(CONFIG_DIR, 'projects.json')

function loadProjects(): StoredProject[] {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    if (!fs.existsSync(CONFIG_FILE)) return []
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveProjects(projects: StoredProject[]) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(projects, null, 2))
}

interface StoredProject {
  id: string
  name: string
  path: string
  scripts: Record<string, string>
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// Open folder picker and read package.json
ipcMain.handle('pick-project-folder', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Select project folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]
  const pkgPath = path.join(folderPath, 'package.json')

  if (!fs.existsSync(pkgPath)) {
    return { error: 'No package.json found in this folder' }
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  return {
    name: pkg.name || path.basename(folderPath),
    path: folderPath,
    scripts: pkg.scripts || {},
  }
})

// Load persisted projects
ipcMain.handle('get-projects', () => loadProjects())

// Save projects list
ipcMain.handle('save-projects', (_e, projects: StoredProject[]) => {
  saveProjects(projects)
  return true
})

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

// Get running processes keys
ipcMain.handle('get-running', () => Array.from(runningProcesses.keys()))
