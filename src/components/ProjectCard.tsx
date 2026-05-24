import { useEffect, useRef, useState, useCallback } from 'react'
import { Project, ProcessStatus, ProjectType, Framework } from '../types'
import { useStore } from '../store'

interface Props {
  project: Project
}

const PRIORITY_SCRIPTS: Record<ProjectType, string[]> = {
  npm:      ['dev', 'start', 'serve', 'preview', 'build', 'test', 'lint'],
  maven:    ['spring-boot:run', 'clean install', 'test', 'package', 'clean'],
  gradle:   ['bootRun', 'build', 'test', 'clean', 'jar'],
  docker:   ['up', 'up -d', 'down', 'build', 'logs', 'ps', 'run'],
  composer: ['serve', 'install', 'migrate', 'test', 'queue', 'console', 'dump'],
  python:   ['runserver', 'dev', 'start', 'migrate', 'test', 'shell', 'install'],
  ruby:     ['server', 'install', 'migrate', 'test', 'console', 'exec'],
  go:       ['run', 'build', 'test', 'tidy', 'vet'],
  rust:     ['run', 'build', 'release', 'test', 'check', 'clippy'],
}

const TYPE_META: Record<ProjectType, { prefix: string; prefixColor: string; icon: string; label: string }> = {
  npm:      { prefix: 'npm',            prefixColor: 'var(--accent)', icon: '📦', label: 'Node.js'      },
  maven:    { prefix: 'mvn',            prefixColor: '#f97316',       icon: '☕', label: 'Spring Boot'  },
  gradle:   { prefix: './gradlew',      prefixColor: '#22d3ee',       icon: '🐘', label: 'Gradle'       },
  docker:   { prefix: 'docker compose', prefixColor: '#2496ED',       icon: '🐳', label: 'Docker'       },
  composer: { prefix: 'composer',       prefixColor: '#885630',       icon: '🎼', label: 'PHP/Composer' },
  python:   { prefix: 'python',         prefixColor: '#3776AB',       icon: '🐍', label: 'Python'       },
  ruby:     { prefix: 'bundle',         prefixColor: '#CC342D',       icon: '💎', label: 'Ruby'         },
  go:       { prefix: 'go',             prefixColor: '#00ADD8',       icon: '🐹', label: 'Go'           },
  rust:     { prefix: 'cargo',          prefixColor: '#CE412B',       icon: '🦀', label: 'Rust'         },
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

// ─── Script grouping for monorepos ─────────────────────────────────────────

type ScriptGroup = 'database' | 'backend' | 'frontend' | 'worker' | 'general'

const GROUP_META: Record<ScriptGroup, { label: string; color: string; bg: string }> = {
  database: { label: 'DATABASE', color: '#ec4899', bg: '#ec489912' },
  backend:  { label: 'BACKEND',  color: '#22c55e', bg: '#22c55e12' },
  frontend: { label: 'FRONTEND', color: '#3b82f6', bg: '#3b82f612' },
  worker:   { label: 'WORKER',   color: '#f59e0b', bg: '#f59e0b12' },
  general:  { label: '',         color: '',         bg: ''          },
}

function classifyScript(key: string): ScriptGroup {
  const k = key.toLowerCase()

  // Database
  if (/^(db|prisma|migrate|seed|schema|knex|typeorm|sequelize)(:|$)/.test(k)) return 'database'
  if (/(:|^)(migrate|seed|migration|db)$/.test(k))                            return 'database'
  if (/^(db:up|db:down|db:reset|db:push|db:pull)$/.test(k))                  return 'database'

  // Backend
  if (/^(api|server|backend|srv)(:|$)/.test(k))                              return 'backend'
  if (/(:|^)(api|server|backend|srv)$/.test(k))                              return 'backend'

  // Frontend
  if (/^(web|client|app|front|ui|spa)(:|$)/.test(k))                        return 'frontend'
  if (/(:|^)(web|client|app|front|ui|spa)$/.test(k))                        return 'frontend'

  // Worker
  if (/^(worker|queue|job|consumer|producer|cron)(:|$)/.test(k))            return 'worker'
  if (/(:|^)(worker|queue|job|worker)$/.test(k))                            return 'worker'

  return 'general'
}

function groupScripts(keys: string[]): { group: ScriptGroup; scripts: string[] }[] {
  const buckets = new Map<ScriptGroup, string[]>()
  const ORDER: ScriptGroup[] = ['database', 'backend', 'frontend', 'worker', 'general']

  for (const k of keys) {
    const g = classifyScript(k)
    if (!buckets.has(g)) buckets.set(g, [])
    buckets.get(g)!.push(k)
  }

  // Only show groups that have scripts; keep order
  return ORDER.filter(g => buckets.has(g)).map(g => ({ group: g, scripts: buckets.get(g)! }))
}

// Returns true if ANY script key has a non-general group → it's a monorepo-like project
function isMonorepoLike(keys: string[]): boolean {
  return keys.some(k => classifyScript(k) !== 'general')
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
    for (const entry of logs) {
      const found = extractUrl(entry.data)
      if (found) { setUrl(found); return }
    }
  }, [isRunning, logs.length])

  return url ?? (isRunning ? fallbackUrl : null)
}

// ─── Hook: git branch info ──────────────────────────────────────────────────

function useGitInfo(projectPath: string) {
  const [branch, setBranch]   = useState<string | null>(null)
  const [dirty, setDirty]     = useState(false)

  useEffect(() => {
    window.electronAPI.gitInfo(projectPath).then(res => {
      setBranch(res.branch)
      setDirty(res.dirty)
    })
  }, [projectPath])

  return { branch, dirty }
}

// ─── Hook: uptime display ──────────────────────────────────────────────────

function useUptime(processKey: string, isRunning: boolean) {
  const startedAt = useStore(s => s.processStartedAt[processKey])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isRunning || !startedAt) { setElapsed(0); return }
    setElapsed(Date.now() - startedAt)
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 5000)
    return () => clearInterval(id)
  }, [isRunning, startedAt])

  if (!isRunning || elapsed === 0) return null
  const s = Math.floor(elapsed / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0)  return `${h}h ${m % 60}m`
  if (m > 0)  return `${m}m`
  return `${s}s`
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

const PM_LABELS: Record<string, string> = { pnpm: 'pnpm', yarn: 'yarn', bun: 'bun', npm: 'npm' }
const PM_COLORS: Record<string, string> = { pnpm: '#f69220', yarn: '#2c8ebb', bun: '#fbf0df', npm: '#cc3534' }

// ─── Main component ─────────────────────────────────────────────────────────

export function ProjectCard({ project }: Props) {
  const { statuses, setStatus, appendLog, openLog, setActiveLog, openLogs, activeLog, runtimeVersions, autoRestart, setAutoRestart } = useStore()
  const type       = project.projectType ?? 'npm'
  const meta       = TYPE_META[type]
  const scripts    = sortScripts(project.scripts, type)
  const frameworks = project.frameworks ?? []
  const isFrontend = type === 'npm' && isFrontendProject(frameworks)
  const pm         = project.packageManager ?? 'npm'

  const [showEnv, setShowEnv]     = useState(false)
  const [showHooks, setShowHooks] = useState(false)
  const [portWarn, setPortWarn]   = useState<string | null>(null)
  const { branch, dirty } = useGitInfo(project.path)

  const getKey    = (s: string) => `${project.id}:${s}`
  const getStatus = (s: string): ProcessStatus => statuses[getKey(s)] ?? 'stopped'
  const rv        = runtimeVersions[project.id]

  const start = useCallback(async (scriptKey: string) => {
    const key     = getKey(scriptKey)
    const command = project.scripts[scriptKey] ?? `npm run ${scriptKey}`

    // Pre-check port for dev server scripts
    if (isFrontend && isDevServerScript(scriptKey)) {
      const port = getDefaultPort(frameworks)
      const { inUse } = await window.electronAPI.checkPort(port)
      if (inUse) {
        setPortWarn(`Port ${port} is already in use`)
        setTimeout(() => setPortWarn(null), 5000)
      }
    }

    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▸ ${command}`, timestamp: Date.now() })
    const preHook = project.hooks?.[scriptKey]?.pre
    const res = await window.electronAPI.startProcess(project.id, project.path, scriptKey, command, rv?.node, rv?.java, project.name, preHook)
    if (res.error) {
      if (res.error === 'Already running') {
        setStatus(key, 'running')
      } else {
        setStatus(key, 'error')
        appendLog(key, { type: 'system', data: `✗ ${res.error}`, timestamp: Date.now() })
      }
    }
    openLog(key)
  }, [project, rv, frameworks, isFrontend])

  const stop = useCallback(async (scriptKey: string) => {
    const key = getKey(scriptKey)
    await window.electronAPI.stopProcess(project.id, scriptKey)
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Process stopped', timestamp: Date.now() })
  }, [project.id])

  const restart = useCallback(async (scriptKey: string) => {
    const key     = getKey(scriptKey)
    const command = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
    appendLog(key, { type: 'system', data: '↺ Restarting...', timestamp: Date.now() })
    setStatus(key, 'running')
    await window.electronAPI.restartProcess(project.id, project.path, scriptKey, command, rv?.node, rv?.java, project.name)
    openLog(key)
  }, [project, rv])

  const toggleAutoRestart = async (scriptKey: string) => {
    const key = getKey(scriptKey)
    const enabled = !autoRestart[key]
    setAutoRestart(key, enabled)
    await window.electronAPI.setAutoRestart(project.id, scriptKey, enabled)
  }

  if (scripts.length === 0) {
    return <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: 12 }}>No scripts found</div>
  }

  const primaryFw   = frameworks[0]
  const prefixColor = primaryFw ? FRAMEWORK_COLOR[primaryFw] : meta.prefixColor
  const defaultPort = getDefaultPort(frameworks)
  const isJava      = type === 'maven' || type === 'gradle'
  const monorepo    = isMonorepoLike(scripts)
  const grouped     = monorepo ? groupScripts(scripts) : [{ group: 'general' as ScriptGroup, scripts }]

  return (
    <>
      {/* Tech badges + git branch + PM row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px 4px', flexWrap: 'wrap' }}>
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

        {/* Package manager badge */}
        {type === 'npm' && pm !== 'npm' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: PM_COLORS[pm] ?? '#888', opacity: 0.8, marginLeft: 2 }}>
            {PM_LABELS[pm]}
          </span>
        )}

        {/* Git branch badge */}
        {branch && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: dirty ? '#f59e0b' : '#6b7280',
            marginLeft: 'auto',
          }}>
            <span style={{ fontSize: 11 }}>⎇</span>
            <span>{branch}</span>
            {dirty && <span title="Uncommitted changes">●</span>}
          </span>
        )}

        {/* ENV button */}
        <button
          onClick={() => setShowEnv(v => !v)}
          style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: showEnv ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8',
            cursor: 'pointer', letterSpacing: '0.5px',
          }}
          title="Edit .env files"
        >.ENV</button>

        {/* Hooks button */}
        <button
          onClick={() => setShowHooks(v => !v)}
          style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: showHooks ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80',
            cursor: 'pointer', letterSpacing: '0.5px',
          }}
          title="Configure pre/post hooks"
        >HOOKS</button>
      </div>

      {/* Port warning */}
      {portWarn && (
        <div style={{ margin: '0 20px 4px', padding: '4px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 11 }}>
          ⚠ {portWarn}
        </div>
      )}

      {/* ENV editor inline panel */}
      {showEnv && <EnvPanel projectPath={project.path} />}

      {/* Hooks editor inline panel */}
      {showHooks && <HooksPanel project={project} scripts={scripts} />}

      {/* Monorepo-grouped script rows */}
      {grouped.map(({ group, scripts: groupKeys }) => {
        const grpMeta = GROUP_META[group]
        return (
          <div key={group}>
            {monorepo && group !== 'general' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 20px 4px',
                marginTop: group === grouped[0].group ? 0 : 2,
                background: grpMeta.bg,
                borderTop: `1px solid ${grpMeta.color}22`,
                borderBottom: `1px solid ${grpMeta.color}22`,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: grpMeta.color }}>{grpMeta.label}</span>
                <span style={{ flex: 1, height: 1, background: `${grpMeta.color}20` }} />
                <span style={{ fontSize: 9, color: `${grpMeta.color}80` }}>{groupKeys.length} scripts</span>
              </div>
            )}
            {groupKeys.map((scriptKey) => {
              const status     = getStatus(scriptKey)
              const key        = getKey(scriptKey)
              const isRunning  = status === 'running'
              const isError    = status === 'error'
              const isSelected = openLogs.includes(key)
              const pillClass  = isRunning ? 'active' : isError ? 'error' : 'idle'
              const command    = project.scripts[scriptKey] ?? `npm run ${scriptKey}`
              const { prefix, cmd } = parseDisplay(scriptKey, command, type)
              const showBrowser = isFrontend && isDevServerScript(scriptKey) && isRunning
              const arEnabled   = autoRestart[key] ?? false

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
                  autoRestart={arEnabled}
                  onLogs={() => activeLog === key ? setActiveLog(null) : openLog(key)}
                  onStart={() => isJava && isRunning ? restart(scriptKey) : start(scriptKey)}
                  onStop={() => stop(scriptKey)}
                  onRestart={() => restart(scriptKey)}
                  onToggleAutoRestart={() => toggleAutoRestart(scriptKey)}
                />
              )
            })}
          </div>
        )
      })}
    </>
  )
}

// ─── Script row with browser detection, uptime, auto-restart ─────────────────

function ScriptRow({ scriptKey, processKey, prefix, cmd, prefixColor, status, isRunning, isSelected,
  showBrowser, defaultPort, restartOnRun, autoRestart, onLogs, onStart, onStop, onRestart, onToggleAutoRestart }: {
  scriptKey: string; processKey: string; prefix: string; cmd: string; prefixColor: string
  status: string; isRunning: boolean; isSelected: boolean
  showBrowser: boolean; defaultPort: number; restartOnRun?: boolean; autoRestart?: boolean
  onLogs: () => void; onStart: () => void; onStop: () => void; onRestart: () => void
  onToggleAutoRestart: () => void
}) {
  const fallbackUrl = `http://localhost:${defaultPort}`
  const detectedUrl = useDetectedUrl(processKey, isRunning, fallbackUrl)
  const uptime      = useUptime(processKey, isRunning)

  return (
    <div className={`script-row ${isSelected ? 'selected' : ''}`}>
      <span className="script-name">
        <span className="script-npm">{prefix}</span>
        <span className="script-cmd"> {cmd}</span>
      </span>

      <span className={`script-pill ${status}`}>
        {isRunning ? 'active' : status === 'error' ? 'error' : 'idle'}
      </span>

      {uptime && (
        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 2 }} title="Uptime">
          {uptime}
        </span>
      )}

      <button
        className={`btn-logs ${isSelected ? 'active' : ''}`}
        onClick={onLogs}
      >
        LOGS
      </button>

      {showBrowser && detectedUrl && <BrowserBtn url={detectedUrl} />}

      {/* Auto-restart toggle */}
      <button
        title={autoRestart ? 'Auto-restart on crash: ON' : 'Auto-restart on crash: OFF'}
        onClick={onToggleAutoRestart}
        style={{
          fontSize: 10, padding: '2px 5px', borderRadius: 4,
          background: autoRestart ? 'rgba(34,197,94,0.15)' : 'transparent',
          border: `1px solid ${autoRestart ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: autoRestart ? '#4ade80' : '#6b7280',
          cursor: 'pointer',
        }}
      >↺</button>

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

// ─── Inline .env panel ─────────────────────────────────────────────────────

function EnvPanel({ projectPath }: { projectPath: string }) {
  const [files, setFiles]       = useState<string[]>([])
  const [active, setActive]     = useState('.env')
  const [content, setContent]   = useState('')
  const [status, setStatus]     = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    window.electronAPI.envList(projectPath).then(r => {
      const list = r.files.length > 0 ? r.files : ['.env']
      setFiles(list)
      setActive(list[0])
    })
  }, [projectPath])

  useEffect(() => {
    if (!active) return
    window.electronAPI.envRead(projectPath, active).then(r => setContent(r.content ?? ''))
  }, [projectPath, active])

  const save = async () => {
    const res = await window.electronAPI.envWrite(projectPath, active, content)
    setStatus(res.success ? 'saved' : 'error')
    setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div style={{ margin: '0 20px 8px', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
        {files.map(f => (
          <button key={f} onClick={() => setActive(f)} style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
            background: active === f ? 'rgba(99,102,241,0.3)' : 'transparent',
            border: '1px solid ' + (active === f ? 'rgba(99,102,241,0.5)' : 'transparent'),
            color: active === f ? '#a5b4fc' : '#6b7280',
          }}>{f}</button>
        ))}
        {!files.includes('.env.local') && (
          <button onClick={() => { setFiles(f => [...f, '.env.local']); setActive('.env.local'); setContent('') }} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, cursor: 'pointer', background: 'transparent', border: '1px dashed rgba(99,102,241,0.3)', color: '#6b7280' }}>+ new</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: status === 'saved' ? '#4ade80' : status === 'error' ? '#f87171' : 'transparent' }}>
          {status === 'saved' ? '✓ saved' : status === 'error' ? '✗ error' : '·'}
        </span>
        <button onClick={save} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', cursor: 'pointer' }}>Save</button>
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 120, maxHeight: 280, padding: '8px 10px',
          background: '#0d1117', color: '#cdd9e5', fontSize: 11, fontFamily: 'monospace',
          border: 'none', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
        }}
        placeholder="KEY=value"
      />
    </div>
  )
}

// ─── Inline hooks panel ────────────────────────────────────────────────────

function HooksPanel({ project, scripts }: { project: Project; scripts: string[] }) {
  const [hooks, setHooks] = useState<Record<string, { pre?: string }>>(project.hooks ?? {})
  const [saved, setSaved] = useState(false)

  const save = () => {
    // Persist via save-groups — caller must handle; emit event
    const updated = { ...project, hooks }
    const event = new CustomEvent('project-hooks-updated', { detail: updated })
    window.dispatchEvent(event)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ margin: '0 20px 8px', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', letterSpacing: '0.5px' }}>PRE-HOOKS</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: saved ? '#4ade80' : 'transparent' }}>✓ saved</span>
        <button onClick={save} style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', cursor: 'pointer' }}>Save</button>
      </div>
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scripts.slice(0, 4).map(sk => (
          <div key={sk} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#6b7280', minWidth: 80 }}>{sk}</span>
            <input
              type="text"
              placeholder="command to run before…"
              value={hooks[sk]?.pre ?? ''}
              onChange={e => setHooks(h => ({ ...h, [sk]: { ...h[sk], pre: e.target.value } }))}
              style={{ flex: 1, fontSize: 10, padding: '3px 6px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#cdd9e5', outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
