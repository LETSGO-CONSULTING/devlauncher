import { useState } from 'react'
import { ProjectGroup, Framework } from '../types'
import { useStore } from '../store'
import { TechIcon, FRAMEWORK_COLOR } from './TechIcon'

interface Props {
  groups: ProjectGroup[]
  onAddProject: () => void
  onRemove: (id: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Sidebar({ groups, onAddProject, activeTab, onTabChange }: Props) {
  const expanded       = useStore((s) => s.expanded)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const statuses       = useStore((s) => s.statuses)
  const setStatus      = useStore((s) => s.setStatus)
  const appendLog      = useStore((s) => s.appendLog)
  const openLog        = useStore((s) => s.openLog)

  const [killPortInput, setKillPortInput] = useState('')
  const [killPortMsg,   setKillPortMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  const handleKillPort = async () => {
    const port = parseInt(killPortInput.trim())
    if (!port || port < 1 || port > 65535) return
    const res = await window.electronAPI.killPort(port)
    setKillPortMsg({ ok: res.success, text: res.success ? `Port ${port} freed` : (res.error ?? 'Failed') })
    if (res.success) setKillPortInput('')
    setTimeout(() => setKillPortMsg(null), 3000)
  }

  const isRunning = (group: ProjectGroup) =>
    group.projects.some((p) =>
      Object.keys(p.scripts).some((s) => statuses[`${p.id}:${s}`] === 'running')
    )

  // All currently running process keys
  const runningKeys = Object.entries(statuses)
    .filter(([, s]) => s === 'running')
    .map(([key]) => key)

  const resolveKey = (key: string): { name: string; script: string } => {
    const [projectId, ...rest] = key.split(':')
    const script = rest.join(':')
    for (const g of groups) {
      const p = g.projects.find((p) => p.id === projectId)
      if (p) return { name: p.name, script }
    }
    return { name: projectId, script }
  }

  const handleStop = (key: string) => {
    const [projectId, scriptKey] = key.split(':')
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Process stopped', timestamp: Date.now() })
    window.electronAPI.stopProcess(projectId, scriptKey)
  }

  const handleLogs = (key: string) => {
    openLog(key)
    onTabChange('console')
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',   icon: '⊞' },
    { id: 'projects',  label: 'Projects',    icon: '▣' },
    { id: 'sdks',      label: 'SDK Manager', icon: '📦' },
    { id: 'infra',     label: 'Infra',       icon: '🐳' },
    { id: 'console',   label: 'Console',     icon: '⬛' },
  ]

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">⚡</div>
        <div className="logo-text">
          <div className="logo-name">DevLauncher</div>
          <div className="logo-version">V 1.0.0-BETA</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Running processes */}
      <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Running
        {runningKeys.length > 0 && <span className="running-badge">{runningKeys.length}</span>}
      </div>

      {runningKeys.length > 0 && (
        <div className="running-list">
          {runningKeys.map((key) => {
            const { name, script } = resolveKey(key)
            return (
              <div key={key} className="running-item">
                <span className="running-pulse" />
                <div className="running-info">
                  <span className="running-name">{name}</span>
                  <span className="running-script">{script.toUpperCase()}</span>
                </div>
                <button className="running-btn" data-tooltip="Open console" onClick={() => handleLogs(key)}>⬛</button>
                <button className="running-btn running-btn-stop" data-tooltip="Stop process" onClick={() => handleStop(key)}>■</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Kill port — always visible, useful for orphaned processes */}
      <div className="kill-port-row">
        <input
          className="kill-port-input"
          type="number"
          placeholder="Port…"
          value={killPortInput}
          onChange={(e) => setKillPortInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleKillPort()}
          min={1} max={65535}
        />
        <button className="kill-port-btn" onClick={handleKillPort} title="Kill process on port">
          Kill port
        </button>
      </div>
      {killPortMsg && (
        <div className="kill-port-msg" style={{ color: killPortMsg.ok ? '#22c55e' : '#FF6B68' }}>
          {killPortMsg.text}
        </div>
      )}

      {/* Recent projects */}
      <div className="sidebar-section-label">Recent Projects</div>
      <div className="sidebar-projects">
        {groups.map((g) => {
          const primaryFw: Framework | undefined = g.projects.flatMap(p => p.frameworks ?? []).find(Boolean)
          const accentColor = primaryFw ? FRAMEWORK_COLOR[primaryFw] : '#7c5cfc'
          const running = isRunning(g)

          return (
            <div key={g.id} className="sidebar-group">
              <div className="sidebar-group-row" onClick={() => toggleExpanded(g.id)}>
                <span
                  className="sidebar-group-dot"
                  style={{ background: running ? '#22c55e' : '#334155' }}
                />
                {primaryFw
                  ? <TechIcon framework={primaryFw} size={14} />
                  : <span style={{ width: 14, height: 14, display: 'inline-block' }} />
                }
                <span className="sidebar-group-name" style={{ color: accentColor }} title={g.path}>
                  {g.name.toUpperCase()}
                </span>
              </div>

              {expanded[g.id] && g.projects.map((p) => {
                const pFw = p.frameworks?.[0]
                const pColor = pFw ? FRAMEWORK_COLOR[pFw] : '#475569'
                return (
                  <div key={p.id} className="sidebar-project-item" title={p.path}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {pFw && <TechIcon framework={pFw} size={11} />}
                    <span style={{ color: pColor, opacity: 0.8 }}>{p.name}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <button className="btn-new-project" onClick={onAddProject}>
          + New Project
        </button>
        <div className="sidebar-user">
          <div className="user-avatar">D</div>
          <div className="user-info">
            <div className="user-name">Developer</div>
            <div className="user-role">Core Contributor</div>
          </div>
          <button className="user-settings" title="Settings">⚙</button>
        </div>
      </div>
    </aside>
  )
}
