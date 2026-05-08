import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { LogViewer } from './components/LogViewer'
import { ProjectGroup } from './components/ProjectGroup'
import { Dashboard } from './components/Dashboard'
import { SDKManager } from './components/SDKManager'
import { InfraManager } from './components/InfraManager'
import { UpgradeModal } from './components/UpgradeModal'
import { ProjectGroup as ProjectGroupType } from './types'
import { canAddGroup } from './lib/license'

declare global {
  interface Window {
    electronAPI: {
      pickProjectFolder: () => Promise<ProjectGroupType | { error: string } | null>
      getGroups: () => Promise<ProjectGroupType[]>
      saveGroups: (groups: ProjectGroupType[]) => Promise<boolean>
      startProcess: (projectId: string, projectPath: string, scriptKey: string, command: string, nodeVersion?: string, javaVersion?: string) => Promise<{ success?: boolean; error?: string }>
      stopProcess: (projectId: string, scriptKey: string) => Promise<{ success?: boolean; error?: string }>
      restartProcess: (projectId: string, projectPath: string, scriptKey: string, command: string, nodeVersion?: string, javaVersion?: string) => Promise<{ success?: boolean; error?: string }>
      getRunning: () => Promise<string[]>
      nodeListVersions:    () => Promise<{ versions: string[]; current: string; nvmFound: boolean; error?: string }>
      nodeInstallVersion:  (version: string) => Promise<{ key?: string; error?: string }>
      nodeUninstallVersion:(version: string) => Promise<{ key?: string; error?: string }>
      nodeSetDefault:      (version: string) => Promise<{ success?: boolean; error?: string }>
      javaListVersions:    () => Promise<{ versions: Array<{ version: string; vendor: string; home: string }>; current: string; error?: string }>
      javaInstallVersion:  (cask: string)    => Promise<{ key?: string; error?: string }>
      checkTools: () => Promise<{ brewFound: boolean; nvmFound: boolean; pyenvFound: boolean; pythonVersions: string[] }>
      // Docker
      dockerInfo: () => Promise<{ version?: string; containers?: number; running?: number; paused?: number; stopped?: number; images?: number; os?: string; error?: string }>
      dockerContainers: () => Promise<{ containers?: Array<{ id: string; name: string; image: string; status: string; ports: string; state: string }>; error?: string }>
      dockerImages: () => Promise<{ images?: Array<{ repo: string; tag: string; id: string; size: string; created: string }>; error?: string }>
      dockerAction: (action: string, containerId: string) => Promise<{ success?: boolean; error?: string }>
      dockerImageAction: (action: string, imageId: string) => Promise<{ success?: boolean; error?: string }>
      dockerContainerLogs: (containerId: string) => Promise<{ key?: string; error?: string }>
      // Kubernetes
      kubectlCheck: () => Promise<{ found: boolean; version?: string }>
      kubectlContexts: () => Promise<{ contexts?: string[]; current?: string; error?: string }>
      kubectlUseContext: (ctx: string) => Promise<{ success?: boolean; error?: string }>
      kubectlGet: (resource: string, namespace?: string) => Promise<{ items?: unknown[]; error?: string }>
      kubectlNamespaces: () => Promise<{ namespaces?: string[]; error?: string }>
      kubectlPodAction: (action: string, pod: string, ns: string) => Promise<{ success?: boolean; error?: string }>
      kubectlPodLogs: (pod: string, ns: string) => Promise<{ key?: string; error?: string }>
      kubectlScale: (deployment: string, ns: string, replicas: number) => Promise<{ success?: boolean; error?: string }>
      openExternal: (url: string) => Promise<void>
      killPort: (port: number) => Promise<{ success: boolean; error?: string }>
      getProcessPids: () => Promise<Record<string, number>>
      sendInput: (projectId: string, scriptKey: string, text: string) => Promise<{ success?: boolean; error?: string }>
      licenseGet: () => Promise<{ tier: string; expiresAt?: string | null; expired?: boolean }>
      licenseActivate: (key: string) => Promise<{ success?: boolean; tier?: string; expiresAt?: string; error?: string }>
      licenseDeactivate: () => Promise<{ success?: boolean; error?: string }>
      onProcessLog: (cb: (p: { key: string; data: string; type: 'stdout' | 'stderr' }) => void) => () => void
      onProcessExit: (cb: (p: { key: string; code: number | null }) => void) => () => void
      onProcessStarted: (cb: (p: { key: string; pid: number | null }) => void) => () => void
      onNodeVersionsChanged: (cb: () => void) => () => void
      onJavaVersionsChanged: (cb: () => void) => () => void
    }
  }
}

function processLabel(
  key: string,
  groups: ProjectGroupType[],
  logLabels: Record<string, { name: string; script: string }>,
): { name: string; script: string } {
  if (logLabels[key]) return logLabels[key]
  const [projectId, ...rest] = key.split(':')
  const scriptKey = rest.join(':')
  for (const group of groups) {
    const project = group.projects.find((p) => p.id === projectId)
    if (project) return { name: project.name, script: scriptKey }
  }
  return { name: projectId, script: scriptKey }
}

export default function App() {
  const { groups, setGroups, addGroup, removeGroup, setStatus, appendLog, openLog, closeLog, setActiveLog, openLogs, activeLog, setPid, logLabels, tier, setTier } = useStore()
  const [sidebarTab, setSidebarTab] = useState<'dashboard' | 'projects' | 'sdks' | 'infra' | 'console'>('dashboard')
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid')
  const [overlayHeight, setOverlayHeight] = useState(320)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Close a console tab AND stop its process
  const closeAndStop = (key: string) => {
    const [projectId, scriptKey] = key.split(':')
    closeLog(key)
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Console closed — process stopped', timestamp: Date.now() })
    window.electronAPI.stopProcess(projectId, scriptKey)
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = overlayHeight
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      setOverlayHeight(Math.max(120, Math.min(window.innerHeight * 0.85, startH + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    window.electronAPI.getGroups().then(setGroups)
    window.electronAPI.licenseGet().then((res) => {
      if (res.tier && res.tier !== 'free') setTier(res.tier as 'pro' | 'teams', res.expiresAt ?? null)
    })
    window.electronAPI.getRunning().then((keys) => keys.forEach((k) => setStatus(k, 'running')))
    // Hydrate PIDs for processes already running at startup (e.g. after hot-reload)
    window.electronAPI.getProcessPids().then((pids) => {
      for (const [key, pid] of Object.entries(pids)) setPid(key, pid)
    })

    const unsubLog = window.electronAPI.onProcessLog(({ key, data, type }) => {
      appendLog(key, { type, data, timestamp: Date.now() })
    })
    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      setStatus(key, code === 0 ? 'stopped' : 'error')
      appendLog(key, { type: 'system', data: `Process exited with code ${code}`, timestamp: Date.now() })
    })
    const unsubStarted = window.electronAPI.onProcessStarted(({ key, pid }) => {
      if (pid != null) setPid(key, pid)
    })
    return () => { unsubLog(); unsubExit(); unsubStarted() }
  }, [])

  useEffect(() => {
    if (groups.length > 0) window.electronAPI.saveGroups(groups)
  }, [groups])

  const handleAdd = async () => {
    if (!canAddGroup(groups.length, tier)) {
      setShowUpgradeModal(true)
      return
    }
    const result = await window.electronAPI.pickProjectFolder()
    if (!result) return
    if ('error' in result) { alert(result.error); return }
    addGroup(result)
    await window.electronAPI.saveGroups([...groups, result])
    setSelectedGroupId(result.id)
    setSidebarTab('projects')
  }

  const handleRemove = (id: string) => {
    removeGroup(id)
    window.electronAPI.saveGroups(groups.filter((g) => g.id !== id))
  }

  return (
    <div className="app-shell">
      <Sidebar
        groups={groups}
        onAddProject={handleAdd}
        onRemove={handleRemove}
        activeTab={sidebarTab}
        onTabChange={(tab) => setSidebarTab(tab as 'dashboard' | 'projects' | 'sdks' | 'infra' | 'console')}
        onSelectGroup={(id) => { setSelectedGroupId(id); setSidebarTab('projects') }}
        selectedGroupId={selectedGroupId}
      />

      <div className="main-area">

        {/* ── Dashboard tab ─────────────────────────────────────────── */}
        {sidebarTab === 'dashboard' && (
          <Dashboard
            groups={groups}
            onAddProject={handleAdd}
            onViewProjects={() => setSidebarTab('projects')}
          />
        )}

        {/* ── SDK Manager tab ───────────────────────────────────────── */}
        {sidebarTab === 'sdks' && <SDKManager />}

        {/* ── Infra tab ─────────────────────────────────────────────── */}
        {sidebarTab === 'infra' && <InfraManager />}

        {/* ── Projects tab ──────────────────────────────────────────── */}
        {sidebarTab === 'projects' && (
          <>
            <TopBar />
            <div className="workspace">
              <div className="workspace-header">
                <div>
                  <div className="workspace-title">Workspace</div>
                  <div className="workspace-subtitle">Active development environment cluster</div>
                </div>
                <div className="view-toggle">
                  <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
                  <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>≡</button>
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🚀</div>
                  <div className="empty-state-title">No projects yet</div>
                  <div className="empty-state-desc">
                    Add a project folder or a workspace folder containing multiple projects
                  </div>
                  <button className="empty-state-btn" onClick={handleAdd}>+ New Project</button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'cards-grid' : ''}
                  style={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', gap: 12 } : {}}>
                  {groups.map((g) => (
                    <ProjectGroup key={g.id} group={g} onRemove={() => handleRemove(g.id)} selected={selectedGroupId === g.id} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Console tab ───────────────────────────────────────────── */}
        {sidebarTab === 'console' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {openLogs.length > 0 ? (
              <>
                <div className="console-tabs-bar">
                  {openLogs.map((key) => {
                    const { name, script } = processLabel(key, groups, logLabels)
                    return (
                      <button
                        key={key}
                        className={`console-tab-btn${activeLog === key ? ' active' : ''}`}
                        onClick={() => setActiveLog(key)}
                      >
                        <span className="console-tab-name">{name}</span>
                        <span className="console-tab-script">{script.toUpperCase()}</span>
                        <span
                          className="console-tab-close"
                          onClick={(e) => { e.stopPropagation(); closeAndStop(key) }}
                        >×</span>
                      </button>
                    )
                  })}
                </div>
                {activeLog && (
                  <LogViewer
                    processKey={activeLog}
                    label={(() => { const { name, script } = processLabel(activeLog, groups, logLabels); return `${name} — ${script.toUpperCase()}` })()}
                    fullHeight
                    onClose={() => closeAndStop(activeLog)}
                  />
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="empty-state">
                  <div className="empty-state-icon">⬛</div>
                  <div className="empty-state-title">No active console</div>
                  <div className="empty-state-desc">Run a script and click LOGS to open the debug console here.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Log console overlay — resizable, tabbed, always available outside Console tab */}
        {sidebarTab !== 'console' && openLogs.length > 0 && activeLog && (
          <div className="console-overlay" style={{ height: overlayHeight }}>
            <div className="console-resize-handle" onMouseDown={startResize} />
            {openLogs.length > 1 && (
              <div className="console-tabs-bar">
                {openLogs.map((key) => {
                  const { name, script } = processLabel(key, groups, logLabels)
                  return (
                    <button
                      key={key}
                      className={`console-tab-btn${activeLog === key ? ' active' : ''}`}
                      onClick={() => setActiveLog(key)}
                    >
                      <span className="console-tab-name">{name}</span>
                      <span className="console-tab-script">{script.toUpperCase()}</span>
                      <span className="console-tab-close" onClick={(e) => { e.stopPropagation(); closeAndStop(key) }}>×</span>
                    </button>
                  )
                })}
              </div>
            )}
            <LogViewer
              processKey={activeLog}
              label={(() => { const { name, script } = processLabel(activeLog, groups, logLabels); return `${name} — ${script.toUpperCase()}` })()}
              fullHeight
              onClose={() => setActiveLog(null)}
            />
          </div>
        )}

      </div>

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
    </div>
  )
}
