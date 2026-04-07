import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pickProjectFolder: () => ipcRenderer.invoke('pick-project-folder'),
  getGroups:   () => ipcRenderer.invoke('get-groups'),
  saveGroups:  (groups: unknown) => ipcRenderer.invoke('save-groups', groups),

  // command = full shell command to execute (e.g. "mvn spring-boot:run", "npm run dev", "./gradlew bootRun")
  startProcess:   (projectId: string, projectPath: string, scriptKey: string, command: string) =>
    ipcRenderer.invoke('start-process', projectId, projectPath, scriptKey, command),
  stopProcess:    (projectId: string, scriptKey: string) =>
    ipcRenderer.invoke('stop-process', projectId, scriptKey),
  restartProcess: (projectId: string, projectPath: string, scriptKey: string, command: string) =>
    ipcRenderer.invoke('restart-process', projectId, projectPath, scriptKey, command),

  getRunning: () => ipcRenderer.invoke('get-running'),

  onProcessLog: (cb: (payload: { key: string; data: string; type: 'stdout' | 'stderr' }) => void) => {
    ipcRenderer.on('process-log', (_e, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners('process-log')
  },
  onProcessExit: (cb: (payload: { key: string; code: number | null }) => void) => {
    ipcRenderer.on('process-exit', (_e, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners('process-exit')
  },
})
