import { Project, ProcessStatus } from '../types'
import { useStore } from '../store'

interface Props {
  project: Project
}

const PRIORITY_SCRIPTS = ['dev', 'start', 'serve', 'preview', 'build', 'test', 'lint']

function sortScripts(scripts: Record<string, string>): string[] {
  const keys = Object.keys(scripts)
  const priority = keys.filter((k) => PRIORITY_SCRIPTS.includes(k))
  const rest = keys.filter((k) => !PRIORITY_SCRIPTS.includes(k))
  return [...priority, ...rest]
}

export function ProjectCard({ project }: Props) {
  const { statuses, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()
  const scripts = sortScripts(project.scripts)

  const getKey  = (s: string) => `${project.id}:${s}`
  const getStatus = (s: string): ProcessStatus => statuses[getKey(s)] ?? 'stopped'

  const start = async (script: string) => {
    const key = getKey(script)
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▸ Starting: npm run ${script}`, timestamp: Date.now() })
    const res = await window.electronAPI.startProcess(project.id, project.path, script)
    if (res.error) {
      setStatus(key, 'error')
      appendLog(key, { type: 'system', data: `✗ Error: ${res.error}`, timestamp: Date.now() })
    }
    setSelectedLog(key)
  }

  const stop = async (script: string) => {
    const key = getKey(script)
    await window.electronAPI.stopProcess(project.id, script)
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: `■ Process stopped`, timestamp: Date.now() })
  }

  const restart = async (script: string) => {
    const key = getKey(script)
    appendLog(key, { type: 'system', data: `↺ Restarting...`, timestamp: Date.now() })
    setStatus(key, 'running')
    await window.electronAPI.restartProcess(project.id, project.path, script)
    setSelectedLog(key)
  }

  if (scripts.length === 0) {
    return (
      <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
        No scripts found in package.json
      </div>
    )
  }

  return (
    <>
      {scripts.map((script) => {
        const status   = getStatus(script)
        const key      = getKey(script)
        const isRunning = status === 'running'
        const isError   = status === 'error'
        const isSelected = selectedLog === key

        const pillClass = isRunning ? 'active' : isError ? 'error' : 'idle'

        return (
          <div
            key={script}
            className={`script-row ${isSelected ? 'selected' : ''}`}
          >
            {/* Script name */}
            <span className="script-name">
              <span className="script-npm">npm</span>
              <span className="script-cmd"> run {script}</span>
            </span>

            {/* Status pill */}
            <span className={`script-pill ${pillClass}`}>
              {isRunning ? 'active' : isError ? 'error' : 'idle'}
            </span>

            {/* Logs */}
            <button
              className={`btn-logs ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedLog(isSelected ? null : key)}
            >
              LOGS
            </button>

            {/* Action buttons */}
            {isRunning ? (
              <>
                <button className="btn-restart" onClick={() => restart(script)}>↺ RESTART</button>
                <button className="btn-stop"    onClick={() => stop(script)}>STOP</button>
              </>
            ) : (
              <button className="btn-run" onClick={() => start(script)}>RUN</button>
            )}
          </div>
        )
      })}
    </>
  )
}
