import { useState } from 'react'
import { ProjectGroup as ProjectGroupType } from '../types'
import { useStore } from '../store'
import { ProjectCard } from './ProjectCard'

interface Props {
  group: ProjectGroupType
  onRemove: () => void
}

const ICON_MAP: Record<string, string> = {
  api: '🗄️', backend: '🗄️', server: '🗄️',
  app: '📱', frontend: '🖥️', web: '🌐', site: '🌐',
  mobile: '📱', manager: '⚙️', admin: '⚙️', dashboard: '📊',
  docs: '📚', doc: '📚',
}

function getIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon
  }
  return '⚡'
}

const GROUP_BG_COLORS = [
  'linear-gradient(135deg,#7c5cfc,#5b3fd8)',
  'linear-gradient(135deg,#22d3ee,#0891b2)',
  'linear-gradient(135deg,#22c55e,#15803d)',
  'linear-gradient(135deg,#f59e0b,#b45309)',
  'linear-gradient(135deg,#ef4444,#b91c1c)',
  'linear-gradient(135deg,#ec4899,#9d174d)',
]

let colorIndex = 0
const groupColorCache = new Map<string, string>()

function getGroupColor(id: string) {
  if (!groupColorCache.has(id)) {
    groupColorCache.set(id, GROUP_BG_COLORS[colorIndex % GROUP_BG_COLORS.length])
    colorIndex++
  }
  return groupColorCache.get(id)!
}

export function ProjectGroup({ group, onRemove }: Props) {
  const { statuses } = useStore()

  // All services start collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const runningCount = group.projects.reduce((acc, p) =>
    acc + Object.keys(p.scripts).filter(
      (s) => statuses[`${p.id}:${s}`] === 'running'
    ).length, 0
  )

  const isRunning = runningCount > 0
  const iconBg    = getGroupColor(group.id)

  const subtitle = group.projects.length > 1
    ? `${group.projects.length} SERVICES`
    : group.projects[0]?.path.split('/').slice(-2).join(' / ').toUpperCase()

  return (
    <div className="group-card">
      {/* Card header */}
      <div className="group-card-header">
        <div className="group-icon" style={{ background: iconBg }}>
          {getIcon(group.name)}
        </div>
        <div className="group-meta">
          <div className="group-name">{group.name}</div>
          <div className="group-subtitle">{subtitle}</div>
        </div>
        <div className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
          <span className="status-dot" />
          {isRunning ? 'RUNNING' : 'STOPPED'}
        </div>
        <button
          onClick={onRemove}
          title="Remove"
          style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 18, padding: '2px 6px', borderRadius: 6, marginLeft: 4, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Sub-projects — each collapsible, starts collapsed */}
      {group.projects.map((project) => {
        const isOpen        = expanded[project.id] ?? false
        const projectRunning = Object.keys(project.scripts).some(
          (s) => statuses[`${project.id}:${s}`] === 'running'
        )

        return (
          <div key={project.id} className="sub-project-section">
            {/* Collapsible header — always shown */}
            <div
              className="sub-project-header"
              onClick={() => toggle(project.id)}
              style={{ cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Chevron */}
                <span style={{
                  display: 'inline-block',
                  fontSize: 10,
                  color: 'var(--accent)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}>
                  ▶
                </span>
                <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: 11 }}>
                  {project.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  ({Object.keys(project.scripts).length} scripts)
                </span>
              </div>

              {/* Running indicator */}
              {projectRunning && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--green)', display: 'inline-block',
                  marginRight: 4,
                  animation: 'pulse-green 1.8s ease-in-out infinite',
                }} />
              )}
            </div>

            {/* Scripts — only when expanded */}
            {isOpen && <ProjectCard project={project} />}
          </div>
        )
      })}
    </div>
  )
}
