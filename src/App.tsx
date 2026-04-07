import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { LogViewer } from './components/LogViewer'
import { ProjectCard } from './components/ProjectCard'
import { Project } from './types'

declare global {
  interface Window {
    electronAPI: {
      pickProjectFolder: () => Promise<{ name: string; path: string; scripts: Record<string, string> } | { error: string } | null>
      getProjects: () => Promise<Project[]>
      saveProjects: (projects: Project[]) => Promise<boolean>
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
  const { projects, setProjects, addProject, removeProject, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()

  // Load projects on mount
  useEffect(() => {
    window.electronAPI.getProjects().then((saved) => {
      setProjects(saved)
    })

    window.electronAPI.getRunning().then((keys) => {
      keys.forEach((key) => setStatus(key, 'running'))
    })

    const unsubLog = window.electronAPI.onProcessLog(({ key, data, type }) => {
      appendLog(key, { type, data, timestamp: Date.now() })
    })

    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      setStatus(key, code === 0 ? 'stopped' : 'error')
      appendLog(key, {
        type: 'system',
        data: `Process exited with code ${code}`,
        timestamp: Date.now(),
      })
    })

    return () => {
      unsubLog()
      unsubExit()
    }
  }, [])

  // Persist whenever projects change
  useEffect(() => {
    if (projects.length > 0) {
      window.electronAPI.saveProjects(projects)
    }
  }, [projects])

  const handleAddProject = async () => {
    const result = await window.electronAPI.pickProjectFolder()
    if (!result) return
    if ('error' in result) { alert(result.error); return }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: result.name,
      path: result.path,
      scripts: result.scripts,
    }
    addProject(newProject)
    await window.electronAPI.saveProjects([...projects, newProject])
  }

  const handleRemove = (id: string) => {
    removeProject(id)
    const updated = projects.filter((p) => p.id !== id)
    window.electronAPI.saveProjects(updated)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar projects={projects} onAddProject={handleAddProject} onRemove={handleRemove} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.length === 0 ? (
            <EmptyState onAdd={handleAddProject} />
          ) : (
            projects.map((p) => (
              <ProjectCard key={p.id} project={p} onRemove={() => handleRemove(p.id)} />
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '48px' }}>🚀</div>
      <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>No projects yet</p>
      <p>Add a project folder to get started</p>
      <button onClick={onAdd} style={{ marginTop: '8px', padding: '10px 24px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
        + Add Project
      </button>
    </div>
  )
}
