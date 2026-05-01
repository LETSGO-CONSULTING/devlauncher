import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Projects ──────────────────────────────────────────────
  pickProjectFolder: () => ipcRenderer.invoke('pick-project-folder'),
  getGroups:   () => ipcRenderer.invoke('get-groups'),
  saveGroups:  (groups: unknown) => ipcRenderer.invoke('save-groups', groups),

  // ── Process control ───────────────────────────────────────
  startProcess: (
    projectId: string, projectPath: string, scriptKey: string, command: string,
    nodeVersion?: string, javaVersion?: string, projectName?: string, preHook?: string,
  ) => ipcRenderer.invoke('start-process', projectId, projectPath, scriptKey, command, nodeVersion, javaVersion, projectName, preHook),
  stopProcess: (projectId: string, scriptKey: string) =>
    ipcRenderer.invoke('stop-process', projectId, scriptKey),
  restartProcess: (
    projectId: string, projectPath: string, scriptKey: string, command: string,
    nodeVersion?: string, javaVersion?: string, projectName?: string,
  ) => ipcRenderer.invoke('restart-process', projectId, projectPath, scriptKey, command, nodeVersion, javaVersion, projectName),
  getRunning: () => ipcRenderer.invoke('get-running'),
  setAutoRestart: (projectId: string, scriptKey: string, enabled: boolean) =>
    ipcRenderer.invoke('set-auto-restart', projectId, scriptKey, enabled),

  // ── Node.js versions (nvm) ────────────────────────────────
  nodeListVersions:    () => ipcRenderer.invoke('node-list-versions'),
  nodeInstallVersion:  (version: string) => ipcRenderer.invoke('node-install-version', version),
  nodeUninstallVersion:(version: string) => ipcRenderer.invoke('node-uninstall-version', version),
  nodeSetDefault:      (version: string) => ipcRenderer.invoke('node-set-default', version),

  // ── Java versions (/usr/libexec/java_home + homebrew) ─────
  javaListVersions:   () => ipcRenderer.invoke('java-list-versions'),
  javaInstallVersion: (cask: string) => ipcRenderer.invoke('java-install-version', cask),

  // ── Tool availability ─────────────────────────────────────
  checkTools: () => ipcRenderer.invoke('check-tools'),

  // ── Docker ────────────────────────────────────────────────
  dockerInfo:          ()                                                => ipcRenderer.invoke('docker-info'),
  dockerContainers:    ()                                                => ipcRenderer.invoke('docker-containers'),
  dockerImages:        ()                                                => ipcRenderer.invoke('docker-images'),
  dockerAction:        (action: string, containerId: string)             => ipcRenderer.invoke('docker-action', action, containerId),
  dockerImageAction:   (action: string, imageId: string)                 => ipcRenderer.invoke('docker-image-action', action, imageId),
  dockerContainerLogs: (containerId: string)                             => ipcRenderer.invoke('docker-container-logs', containerId),

  // ── Kubernetes / kubectl ──────────────────────────────────
  kubectlCheck:      ()                                                  => ipcRenderer.invoke('kubectl-check'),
  kubectlContexts:   ()                                                  => ipcRenderer.invoke('kubectl-contexts'),
  kubectlUseContext: (ctx: string)                                       => ipcRenderer.invoke('kubectl-use-context', ctx),
  kubectlGet:        (resource: string, namespace?: string)              => ipcRenderer.invoke('kubectl-get', resource, namespace),
  kubectlNamespaces: ()                                                  => ipcRenderer.invoke('kubectl-namespaces'),
  kubectlPodAction:  (action: string, pod: string, ns: string)           => ipcRenderer.invoke('kubectl-pod-action', action, pod, ns),
  kubectlPodLogs:    (pod: string, ns: string)                           => ipcRenderer.invoke('kubectl-pod-logs', pod, ns),
  kubectlScale:      (deployment: string, ns: string, replicas: number)  => ipcRenderer.invoke('kubectl-scale', deployment, ns, replicas),

  // ── Shell / system ────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  killPort:     (port: number) => ipcRenderer.invoke('kill-port', port),
  checkPort:    (port: number) => ipcRenderer.invoke('check-port', port),
  getProcessPids: () => ipcRenderer.invoke('get-process-pids'),
  sendInput: (projectId: string, scriptKey: string, text: string) =>
    ipcRenderer.invoke('send-input', projectId, scriptKey, text),

  // ── Git ───────────────────────────────────────────────────
  gitInfo: (projectPath: string) => ipcRenderer.invoke('git-info', projectPath),

  // ── .env files ────────────────────────────────────────────
  envList:  (projectPath: string)                              => ipcRenderer.invoke('env-list', projectPath),
  envRead:  (projectPath: string, filename: string)            => ipcRenderer.invoke('env-read', projectPath, filename),
  envWrite: (projectPath: string, filename: string, content: string) => ipcRenderer.invoke('env-write', projectPath, filename, content),

  // ── License ───────────────────────────────────────────────
  licenseGet:        () => ipcRenderer.invoke('license-get'),
  licenseActivate:   (key: string) => ipcRenderer.invoke('license-activate', key),
  licenseDeactivate: () => ipcRenderer.invoke('license-deactivate'),

  // ── Events ────────────────────────────────────────────────
  onProcessLog: (cb: (p: { key: string; data: string; type: 'stdout' | 'stderr' }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, p: { key: string; data: string; type: 'stdout' | 'stderr' }) => cb(p)
    ipcRenderer.on('process-log', handler)
    return () => ipcRenderer.removeListener('process-log', handler)
  },
  onProcessExit: (cb: (p: { key: string; code: number | null }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, p: { key: string; code: number | null }) => cb(p)
    ipcRenderer.on('process-exit', handler)
    return () => ipcRenderer.removeListener('process-exit', handler)
  },
  onProcessStarted: (cb: (p: { key: string; pid: number | null; startedAt: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, p: { key: string; pid: number | null; startedAt: number }) => cb(p)
    ipcRenderer.on('process-started', handler)
    return () => ipcRenderer.removeListener('process-started', handler)
  },
  onProcessPortConflict: (cb: (p: { key: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, p: { key: string }) => cb(p)
    ipcRenderer.on('process-port-conflict', handler)
    return () => ipcRenderer.removeListener('process-port-conflict', handler)
  },
  onNodeVersionsChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('node-versions-changed', handler)
    return () => ipcRenderer.removeListener('node-versions-changed', handler)
  },
  onJavaVersionsChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('java-versions-changed', handler)
    return () => ipcRenderer.removeListener('java-versions-changed', handler)
  },
})
