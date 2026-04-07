import { ProjectGroup } from '../types'
import { useStore } from '../store'

interface Props {
  groups: ProjectGroup[]
  onAddProject: () => void
  onRemove: (id: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
}

const GROUP_COLORS = [
  '#7c5cfc', '#22d3ee', '#22c55e', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
]

export function Sidebar({ groups, onAddProject, activeTab, onTabChange }: Props) {
  const { expanded, toggleExpanded, statuses } = useStore()

  const isRunning = (group: ProjectGroup) =>
    group.projects.some((p) =>
      Object.keys(p.scripts).some((s) => statuses[`${p.id}:${s}`] === 'running')
    )

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
    { id: 'projects',  label: 'Projects',  icon: '▣' },
    { id: 'console',   label: 'Console',   icon: '⬛' },
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

      {/* Recent projects */}
      <div className="sidebar-section-label">Recent Projects</div>
      <div className="sidebar-projects">
        {groups.map((g, i) => {
          const color = GROUP_COLORS[i % GROUP_COLORS.length]
          const running = isRunning(g)
          return (
            <div key={g.id} className="sidebar-group">
              <div
                className="sidebar-group-row"
                onClick={() => toggleExpanded(g.id)}
              >
                <span
                  className="sidebar-group-dot"
                  style={{ background: running ? '#22c55e' : '#334155' }}
                />
                <span className="sidebar-group-name" style={{ color }} title={g.path}>
                  {g.name.toUpperCase()}
                </span>
              </div>
              {expanded[g.id] && g.projects.map((p) => (
                <div key={p.id} className="sidebar-project-item" title={p.path}>
                  {p.name}
                </div>
              ))}
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
