import { useEffect, useRef, useState } from 'react'
import { Project, ProcessStatus, ProjectType, Framework } from '../types'
import { useStore } from '../store'
import { TechIcon, FRAMEWORK_COLOR, FRAMEWORK_LABEL } from './TechIcon'

interface Props {
  project: Project
}

const PRIORITY_SCRIPTS: Record<ProjectType, string[]> = {
  npm:    ['dev', 'start', 'serve', 'preview', 'build', 'test', 'lint'],
  maven:  ['spring-boot:run', 'clean install', 'test', 'package', 'clean'],
  gradle: ['bootRun', 'build', 'test', 'clean', 'jar'],
  docker: ['up', 'up -d', 'down', 'build', 'logs', 'ps', 'run'],
}

const TYPE_META: Record<ProjectType, { prefix: string; prefixColor: string; icon: string; label: string }> = {
  npm:    { prefix: 'npm',            prefixColor: 'var(--accent)', icon: '📦', label: 'Node.js'     },
  maven:  { prefix: 'mvn',           prefixColor: '#f97316',       icon: '☕', label: 'Spring Boot'  },
  gradle: { prefix: './gradlew',      prefixColor: '#22d3ee',       icon: '🐘', label: 'Gradle'      },
  docker: { prefix: 'docker compose', prefixColor: '#2496ED',       icon: '🐳', label: 'Docker'      },
}

// Frontend frameworks that run a dev server with a URL
const FRONTEND_FRAMEWORKS: Framework[] = [
  'react', 'nextjs', 'vue', 'nuxt', 'angular', 'svelte', 'astro', 'vite',
]

// Scripts that launch a dev server (frontend)
const DEV_SERVER_SCRIPTS = ['dev', 'start', 'serve', 'preview']

// Default port per framework if we can't detect from logs
const DEFAULT_PORT: Partial<Record<Framework, number>> = {
  react:   3000,
  nextjs:  3000,
  vue:     8080,
  nuxt:    3000,
  angular: 4200,
  svelte:  5173,
  astro:   4321,
  vite:    5173,
}

function isFrontendProject(frameworks: Framework[]): boolean {
  return frameworks.some(fw => FRONTEND_FRAMEWORKS.includes(fw))
}

function isDevServerScript(scriptKey: string): boolean {
  return DEV_SERVER_SCRIPTS.includes(scriptKey.toLowerCase())
}

function getDefaultPort(frameworks: Framework[]): number {
  for (const fw of frameworks) {
    if (DEFAULT_PORT[fw]) return DEFAULT_PORT[fw]!
  }
  return 3000
}

// Try to extract a localhost URL from a log line
function extractUrl(text: string): string | null {
  // Match patterns like: http://localhost:5173, http://127.0.0.1:3000
  const m = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)(?:\/[^\s]*)?/)
  if (m) return m[0]
  // Angular sometimes logs: "on port 4200"
  const p = text.match(/\bon\s+port\s+(\d+)/i)
  if (p) return `http://localhost:${p[1]}`
  return null
}

function sortScripts(scripts: Record<string, string>, type: ProjectType): string[] {
  const priority = PRIORITY_SCRIPTS[type] ?? []
  const keys = Object.keys(scripts)
  return [...keys.filter(k => priority.includes(k)), ...keys.filter(k => !priority.includes(k))]
}

function parseDisplay(scriptKey: string, command: string, type: ProjectType) {
  const meta = TYPE_META[type]
  if (type === 'npm') return { prefix: 'npm run', cmd: scriptKey }
  if (type === 'maven') {
    const parts = command.split(' ')
    return { prefix: parts[0].includes('mvnw') ? './mvnw' : 'mvn', cmd: parts.slice(1).join(' ') }
  }
  if (type === 'gradle') {
    const parts = command.split(' ')
    return { prefix: parts[0], cmd: parts.slice(1).join(' ') }
  }
  if (type === 'docker') {
    const parts = command.split(' ')
    // "docker compose up -d" → prefix: "docker compose", cmd: "up -d"
    // "docker build -t name ." → prefix: "docker", cmd: "build -t name ."
    if (parts[1] === 'compose') return { prefix: 'docker compose', cmd: parts.slice(2).join(' ') }
    return { prefix: 'docker', cmd: parts.slice(1).join(' ') }
  }
  return { prefix: meta.prefix, cmd: scriptKey }
}

// ─── Hook: detect localhost URL from process logs ──────────────────────────

function useDetectedUrl(processKey: string, isRunning: boolean, fallbackUrl: string) {
  const [url, setUrl] = useState<string | null>(null)
  const logs = useStore(s => s.logs[processKey] ?? [])

  useEffect(() => {
    if (!isRunning) { setUrl(null); return }
    // Scan all existing logs
    for (const entry of logs) {
      const found = extractUrl(entry.data)
      if (found) { setUrl(found); return }
    }
  }, [isRunning, logs.length])

  return url ?? (isRunning ? fallbackUrl : null)
}

// ─── Open-in-browser button ─────────────────────────────────────────────────

function BrowserBtn({ url }: { url: string }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      title={`Open ${url}`}
      onClick={() => window.electronAPI.openExternal(url)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: hover ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.3)',
        color: '#22c55e', cursor: 'pointer', transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      🌐 Open
    </button>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ProjectCard({ project }: Props) {
  const { statuses, setStatus, appendLog, openLog, setActiveLog, openLogs, activeLog, runtimeVersions } = useStore()
  const type      = project.projectType ?? 'npm'
  const meta      = TYPE_META[type]
  const scripts   = sortScripts(project.scripts, type)
  const frameworks = project.frameworks ?? []
  const isFrontend = type === 'npm' && isFrontendProject(frameworks)

  const getKey    = (s: string) => `${project.id}:${s}`
  const getStatus = (s: string): ProcessStatus => statuses[getKey(s)] ?? 'stopped'
  const rv        = runtimeVersions[project.id]

  const start = async (scriptKey: string) => {
    const key     = getKey(scriptKey)
    const command = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▸ ${command}`, timestamp: Date.now() })
    const res = await window.electronAPI.startProcess(project.id, project.path, scriptKey, command, rv?.node, rv?.java)
    if (res.error) {
      if (res.error === 'Already running') {
        // Process is still alive — keep status as running, just open the console
        setStatus(key, 'running')
      } else {
        setStatus(key, 'error')
        appendLog(key, { type: 'system', data: `✗ ${res.error}`, timestamp: Date.now() })
      }
    }
    openLog(key)
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
    await window.electronAPI.restartProcess(project.id, project.path, scriptKey, command, rv?.node, rv?.java)
    openLog(key)
  }

  if (scripts.length === 0) {
    return <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: 12 }}>No scripts found</div>
  }

  const primaryFw    = frameworks[0]
  const prefixColor  = primaryFw ? FRAMEWORK_COLOR[primaryFw] : meta.prefixColor
  const defaultPort  = getDefaultPort(frameworks)

  return (
    <>
      {/* Tech badges row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px 4px' }}>
        {frameworks.length > 0
          ? frameworks.map(fw => (
              <span key={fw} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TechIcon framework={fw} size={14} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: FRAMEWORK_COLOR[fw], opacity: 0.85 }}>
                  {FRAMEWORK_LABEL[fw]}
                </span>
              </span>
            ))
          : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.6 }}>
              <span style={{ fontSize: 12 }}>{meta.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: meta.prefixColor }}>
                {meta.label}
              </span>
            </span>
          )
        }
      </div>

      {scripts.map((scriptKey) => {
        const status     = getStatus(scriptKey)
        const key        = getKey(scriptKey)
        const isRunning  = status === 'running'
        const isError    = status === 'error'
        const isSelected = openLogs.includes(key)
        const pillClass  = isRunning ? 'active' : isError ? 'error' : 'idle'
        const command    = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
        const { prefix, cmd } = parseDisplay(scriptKey, command, type)
        const showBrowser = isFrontend && isDevServerScript(scriptKey) && isRunning

        // Java projects: RUN always restarts if already running
        const isJava = type === 'maven' || type === 'gradle'

        return (
          <ScriptRow
            key={scriptKey}
            scriptKey={scriptKey}
            processKey={key}
            prefix={prefix}
            cmd={cmd}
            prefixColor={prefixColor}
            status={pillClass}
            isRunning={isRunning}
            isSelected={isSelected}
            showBrowser={showBrowser}
            defaultPort={defaultPort}
            restartOnRun={isJava}
            onLogs={() => activeLog === key ? setActiveLog(null) : openLog(key)}
            onStart={() => isJava && isRunning ? restart(scriptKey) : start(scriptKey)}
            onStop={() => stop(scriptKey)}
            onRestart={() => restart(scriptKey)}
          />
        )
      })}
    </>
  )
}

// ─── Script row with browser detection ─────────────────────────────────────

function ScriptRow({ scriptKey, processKey, prefix, cmd, prefixColor, status, isRunning, isSelected,
  showBrowser, defaultPort, restartOnRun, onLogs, onStart, onStop, onRestart }: {
  scriptKey: string; processKey: string; prefix: string; cmd: string; prefixColor: string
  status: string; isRunning: boolean; isSelected: boolean
  showBrowser: boolean; defaultPort: number; restartOnRun?: boolean
  onLogs: () => void; onStart: () => void; onStop: () => void; onRestart: () => void
}) {
  const fallbackUrl  = `http://localhost:${defaultPort}`
  const detectedUrl  = useDetectedUrl(processKey, isRunning, fallbackUrl)

  return (
    <div className={`script-row ${isSelected ? 'selected' : ''}`}>
      <span className="script-name">
        <span className="script-npm" style={{ color: prefixColor }}>{prefix}</span>
        <span className="script-cmd"> {cmd}</span>
      </span>

      <span className={`script-pill ${status}`}>
        {isRunning ? 'active' : status === 'error' ? 'error' : 'idle'}
      </span>

      <button
        className={`btn-logs ${isSelected ? 'active' : ''}`}
        onClick={onLogs}
      >
        LOGS
      </button>

      {/* Browser open button — only for running frontend dev-server scripts */}
      {showBrowser && detectedUrl && (
        <BrowserBtn url={detectedUrl} />
      )}

      {isRunning ? (
        <>
          {!restartOnRun && <button className="btn-restart" onClick={onRestart}>↺ RESTART</button>}
          <button className="btn-run" onClick={onStart}>{restartOnRun ? '↺ RUN' : 'RUN'}</button>
          <button className="btn-stop" onClick={onStop}>STOP</button>
        </>
      ) : (
        <button className="btn-run" onClick={onStart}>RUN</button>
      )}
    </div>
  )
}
