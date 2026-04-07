import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { LogViewer } from './components/LogViewer'
import { ProjectGroup } from './components/ProjectGroup'
import { ProjectGroup as ProjectGroupType } from './types'

declare global {
  interface Window {
    electronAPI: {
      pickProjectFolder: () => Promise<ProjectGroupType | { error: string } | null>
      getGroups: () => Promise<ProjectGroupType[]>
      saveGroups: (groups: ProjectGroupType[]) => Promise<boolean>
      startProcess: (projectId: string, projectPath: string, script: string) => Promise<{ success?: boolean; error?: string }>
      stopProcess: (projectId: string, script: string) => Promise<{ success?: boolean; error?: string }>
      restartProcess: (projectId: string, projectPath: string, script: string) => Promise<{ success?: boolean; error?: string }>
      getRunning: () => Promise<string[]>
      onProcessLog: (cb: (p: { key: string; data: string; type: 'stdout' | 'stderr' }) => void) => () => void
      onProcessExit: (cb: (p: { key: string; code: number | null }) => void) => () => void
    }
  }
}

export default function App() {
  const { groups, setGroups, addGroup, removeGroup, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar groups={groups} onAddProject={handleAdd} onRemove={handleRemove} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groups.length === 0 ? (
            <EmptyState onAdd={handleAdd} />
          ) : (
            groups.map((g) => (
              <ProjectGroup key={g.id} group={g} onRemove={() => handleRemove(g.id)} />
            ))
          )}
        </div>
        {selectedLog && (
          <LogViewer processKey={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </main>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-muted)', marginTop: '15vh' }}>
      <div style={{ fontSize: '48px' }}>🚀</div>
      <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>No projects yet</p>
      <p>Add a single project or a folder containing multiple projects</p>
      <button onClick={onAdd} style={{ marginTop: '8px', padding: '10px 24px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
        + Add Project
      </button>
    </div>
  )
}
