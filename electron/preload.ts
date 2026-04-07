import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pickProjectFolder: () => ipcRenderer.invoke('pick-project-folder'),
  getGroups: () => ipcRenderer.invoke('get-groups'),
  saveGroups: (groups: unknown) => ipcRenderer.invoke('save-groups', groups),
  startProcess: (projectId: string, projectPath: string, script: string) =>
    ipcRenderer.invoke('start-process', projectId, projectPath, script),
  stopProcess: (projectId: string, script: string) =>
    ipcRenderer.invoke('stop-process', projectId, script),
  restartProcess: (projectId: string, projectPath: string, script: string) =>
    ipcRenderer.invoke('restart-process', projectId, projectPath, script),
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
