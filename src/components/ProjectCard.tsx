import { Project, ProcessStatus, ProjectType } from '../types'
import { useStore } from '../store'

interface Props {
  project: Project
}

const PRIORITY_SCRIPTS: Record<ProjectType, string[]> = {
  npm:    ['dev', 'start', 'serve', 'preview', 'build', 'test', 'lint'],
  maven:  ['spring-boot:run', 'clean install', 'test', 'package', 'clean'],
  gradle: ['bootRun', 'build', 'test', 'clean', 'jar'],
}

const TYPE_META: Record<ProjectType, { prefix: string; prefixColor: string; icon: string; label: string }> = {
  npm:    { prefix: 'npm',       prefixColor: 'var(--accent)',  icon: '📦', label: 'Node.js'     },
  maven:  { prefix: 'mvn',      prefixColor: '#f97316',        icon: '☕', label: 'Spring Boot'  },
  gradle: { prefix: './gradlew', prefixColor: '#22d3ee',        icon: '🐘', label: 'Gradle'      },
}

function sortScripts(scripts: Record<string, string>, type: ProjectType): string[] {
  const priority = PRIORITY_SCRIPTS[type] ?? []
  const keys = Object.keys(scripts)
  const sorted = keys.filter((k) => priority.includes(k))
  const rest   = keys.filter((k) => !priority.includes(k))
  return [...sorted, ...rest]
}

function parseDisplay(scriptKey: string, command: string, type: ProjectType) {
  const meta = TYPE_META[type]

  if (type === 'npm') {
    // "npm run dev" → prefix="npm run", cmd="dev"
    return { prefix: 'npm run', cmd: scriptKey }
  }

  if (type === 'maven') {
    // command: "mvn spring-boot:run" or "./mvnw spring-boot:run"
    const parts = command.split(' ')
    const runner = parts[0]
    const rest   = parts.slice(1).join(' ')
    const prefix = runner.includes('mvnw') ? './mvnw' : 'mvn'
    return { prefix, cmd: rest }
  }

  if (type === 'gradle') {
    const parts = command.split(' ')
    const runner = parts[0]
    const rest   = parts.slice(1).join(' ')
    return { prefix: runner, cmd: rest }
  }

  return { prefix: meta.prefix, cmd: scriptKey }
}

export function ProjectCard({ project }: Props) {
  const { statuses, setStatus, appendLog, setSelectedLog, selectedLog } = useStore()
  const type    = project.projectType ?? 'npm'
  const meta    = TYPE_META[type]
  const scripts = sortScripts(project.scripts, type)

  const getKey    = (s: string) => `${project.id}:${s}`
  const getStatus = (s: string): ProcessStatus => statuses[getKey(s)] ?? 'stopped'

  const start = async (scriptKey: string) => {
    const key     = getKey(scriptKey)
    const command = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▸ ${command}`, timestamp: Date.now() })
    const res = await window.electronAPI.startProcess(project.id, project.path, scriptKey, command)
    if (res.error) {
      setStatus(key, 'error')
      appendLog(key, { type: 'system', data: `✗ ${res.error}`, timestamp: Date.now() })
    }
    setSelectedLog(key)
  }

  const stop = async (scriptKey: string) => {
    const key = getKey(scriptKey)
    await window.electronAPI.stopProcess(project.id, scriptKey)
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Process stopped', timestamp: Date.now() })
  }

  const restart = async (scriptKey: string) => {
    const key     = getKey(scriptKey)
    const command = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
    appendLog(key, { type: 'system', data: '↺ Restarting...', timestamp: Date.now() })
    setStatus(key, 'running')
    await window.electronAPI.restartProcess(project.id, project.path, scriptKey, command)
    setSelectedLog(key)
  }

  if (scripts.length === 0) {
    return (
      <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
        No scripts found
      </div>
    )
  }

  return (
    <>
      {/* Project type badge inside card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px 4px', opacity: 0.6 }}>
        <span style={{ fontSize: 12 }}>{meta.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: meta.prefixColor }}>
          {meta.label}
        </span>
      </div>

      {scripts.map((scriptKey) => {
        const status    = getStatus(scriptKey)
        const key       = getKey(scriptKey)
        const isRunning = status === 'running'
        const isError   = status === 'error'
        const isSelected = selectedLog === key
        const pillClass  = isRunning ? 'active' : isError ? 'error' : 'idle'
        const command    = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
        const { prefix, cmd } = parseDisplay(scriptKey, command, type)

        return (
          <div key={scriptKey} className={`script-row ${isSelected ? 'selected' : ''}`}>
            <span className="script-name">
              <span className="script-npm" style={{ color: meta.prefixColor }}>{prefix}</span>
              <span className="script-cmd"> {cmd}</span>
            </span>

            <span className={`script-pill ${pillClass}`}>
              {isRunning ? 'active' : isError ? 'error' : 'idle'}
            </span>

            <button
              className={`btn-logs ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedLog(isSelected ? null : key)}
            >
              LOGS
            </button>

            {isRunning ? (
              <>
                <button className="btn-restart" onClick={() => restart(scriptKey)}>↺ RESTART</button>
                <button className="btn-stop"    onClick={() => stop(scriptKey)}>STOP</button>
              </>
            ) : (
              <button className="btn-run" onClick={() => start(scriptKey)}>RUN</button>
            )}
          </div>
        )
      })}
    </>
  )
}
