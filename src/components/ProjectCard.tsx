import { Project, ProcessStatus } from '../types'
import { useStore } from '../store'

interface Props {
  project: Project
  onRemove: () => void
}

const PRIORITY_SCRIPTS = ['dev', 'start', 'serve', 'preview', 'build', 'test']

function sortScripts(scripts: Record<string, string>): string[] {
  const keys = Object.keys(scripts)
  const priority = keys.filter((k) => PRIORITY_SCRIPTS.includes(k))
  const rest = keys.filter((k) => !PRIORITY_SCRIPTS.includes(k))
  return [...priority, ...rest]
}

export function ProjectCard({ project, onRemove }: Props) {
  const { statuses, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()
  const scripts = sortScripts(project.scripts)

  const getKey = (script: string) => `${project.id}:${script}`
  const getStatus = (script: string): ProcessStatus => statuses[getKey(script)] ?? 'stopped'

  const start = async (script: string) => {
    const key = getKey(script)
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `Starting: npm run ${script}`, timestamp: Date.now() })
    const res = await window.electronAPI.startProcess(project.id, project.path, script)
    if (res.error) {
      setStatus(key, 'error')
      appendLog(key, { type: 'system', data: `Error: ${res.error}`, timestamp: Date.now() })
    }
    setSelectedLog(key)
  }

  const stop = async (script: string) => {
    const key = getKey(script)
    await window.electronAPI.stopProcess(project.id, script)
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: 'Process stopped.', timestamp: Date.now() })
  }

  const restart = async (script: string) => {
    const key = getKey(script)
    appendLog(key, { type: 'system', data: 'Restarting...', timestamp: Date.now() })
    setStatus(key, 'running')
    await window.electronAPI.restartProcess(project.id, project.path, script)
    setSelectedLog(key)
  }

  const statusDot = (status: ProcessStatus) => {
    const color = status === 'running' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--border)'
    return (
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6, flexShrink: 0 }} />
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{project.name}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{project.path}</p>
        </div>
        <button onClick={onRemove} title="Remove project" style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '18px', padding: '4px 8px', borderRadius: '6px' }}>
          ×
        </button>
      </div>

      {/* Scripts */}
      {scripts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No scripts found in package.json</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scripts.map((script) => {
            const status = getStatus(script)
            const key = getKey(script)
            const isRunning = status === 'running'
            const isSelected = selectedLog === key

            return (
              <div key={script} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', border: isSelected ? '1px solid var(--accent)' : '1px solid transparent' }}>
                {statusDot(status)}
                <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500 }}>
                  {script}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                  {status}
                </span>

                {/* Logs button */}
                <button onClick={() => setSelectedLog(isSelected ? null : key)}
                  style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', background: isSelected ? 'var(--accent)' : 'var(--border)', color: '#fff', fontWeight: 500 }}>
                  logs
                </button>

                {/* Action buttons */}
                {!isRunning ? (
                  <button onClick={() => start(script)}
                    style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', background: 'var(--green)', color: '#fff', fontWeight: 600 }}>
                    ▶ Run
                  </button>
                ) : (
                  <>
                    <button onClick={() => restart(script)}
                      style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', background: 'var(--yellow)', color: '#000', fontWeight: 600 }}>
                      ↺ Restart
                    </button>
                    <button onClick={() => stop(script)}
                      style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', background: 'var(--red)', color: '#fff', fontWeight: 600 }}>
                      ■ Stop
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
