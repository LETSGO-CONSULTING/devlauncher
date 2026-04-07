import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { LogViewer } from './components/LogViewer'
import { ProjectGroup } from './components/ProjectGroup'
import { ProjectGroup as ProjectGroupType } from './types'

declare global {
  interface Window {
    electronAPI: {
      pickProjectFolder: () => Promise<ProjectGroupType | { error: string } | null>
      getGroups: () => Promise<ProjectGroupType[]>
      saveGroups: (groups: ProjectGroupType[]) => Promise<boolean>
      startProcess: (projectId: string, projectPath: string, scriptKey: string, command: string) => Promise<{ success?: boolean; error?: string }>
      stopProcess: (projectId: string, scriptKey: string) => Promise<{ success?: boolean; error?: string }>
      restartProcess: (projectId: string, projectPath: string, scriptKey: string, command: string) => Promise<{ success?: boolean; error?: string }>
      getRunning: () => Promise<string[]>
      onProcessLog: (cb: (p: { key: string; data: string; type: 'stdout' | 'stderr' }) => void) => () => void
      onProcessExit: (cb: (p: { key: string; code: number | null }) => void) => () => void
    }
  }
}

export default function App() {
  const { groups, setGroups, addGroup, removeGroup, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()
  const [sidebarTab, setSidebarTab] = useState('dashboard')
  const [topbarTab, setTopbarTab]   = useState('Cluster')
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    window.electronAPI.getGroups().then(setGroups)
    window.electronAPI.getRunning().then((keys) => keys.forEach((k) => setStatus(k, 'running')))

    const unsubLog = window.electronAPI.onProcessLog(({ key, data, type }) => {
      appendLog(key, { type, data, timestamp: Date.now() })
    })
    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      setStatus(key, code === 0 ? 'stopped' : 'error')
      appendLog(key, { type: 'system', data: `Process exited with code ${code}`, timestamp: Date.now() })
    })
    return () => { unsubLog(); unsubExit() }
  }, [])

  useEffect(() => {
    if (groups.length > 0) window.electronAPI.saveGroups(groups)
  }, [groups])

  const handleAdd = async () => {
    const result = await window.electronAPI.pickProjectFolder()
    if (!result) return
    if ('error' in result) { alert(result.error); return }
    addGroup(result)
    await window.electronAPI.saveGroups([...groups, result])
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
        onTabChange={setSidebarTab}
      />

      <div className="main-area">
        <TopBar activeTab={topbarTab} onTabChange={setTopbarTab} />

        <div className="workspace">
          {/* Workspace header */}
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

          {/* Cards */}
          {groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🚀</div>
              <div className="empty-state-title">No projects yet</div>
              <div className="empty-state-desc">
                Add a project folder or a workspace folder containing multiple projects
              </div>
              <button className="empty-state-btn" onClick={handleAdd}>
                + New Project
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'cards-grid' : ''} style={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', gap: 12 } : {}}>
              {groups.map((g) => (
                <ProjectGroup key={g.id} group={g} onRemove={() => handleRemove(g.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Debug console */}
        {selectedLog && (
          <LogViewer processKey={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </div>
    </div>
  )
}
