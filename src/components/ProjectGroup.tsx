import { useState } from 'react'
import { ProjectGroup as ProjectGroupType, Framework } from '../types'
import { useStore } from '../store'
import { ProjectCard } from './ProjectCard'
import { TechIcon, TechIconStack, FRAMEWORK_COLOR, FRAMEWORK_LABEL } from './TechIcon'

interface Props {
  group: ProjectGroupType
  onRemove: () => void
}

export function ProjectGroup({ group, onRemove }: Props) {
  const { statuses } = useStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const runningCount = group.projects.reduce((acc, p) =>
    acc + Object.keys(p.scripts).filter(s => statuses[`${p.id}:${s}`] === 'running').length, 0
  )
  const isRunning = runningCount > 0

  // Primary framework for the group — first found across all projects
  const primaryFw: Framework | undefined = group.projects
    .flatMap(p => p.frameworks ?? [])
    .find(Boolean)

  // All unique frameworks across the group
  const allFws: Framework[] = [...new Set(group.projects.flatMap(p => p.frameworks ?? []))]

  // Card accent color from primary framework
  const accentColor = primaryFw ? FRAMEWORK_COLOR[primaryFw] : '#7c5cfc'

  const subtitle = group.projects.length > 1
    ? `${group.projects.length} SERVICES`
    : (primaryFw ? FRAMEWORK_LABEL[primaryFw].toUpperCase() : group.projects[0]?.projectType?.toUpperCase() ?? '')

  return (
    <div className="group-card" style={{ borderTop: `2px solid ${accentColor}22` }}>
      {/* Card header */}
      <div className="group-card-header">

        {/* Group icon — primary framework */}
        <div className="group-icon" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}>
          {primaryFw
            ? <TechIcon framework={primaryFw} size={22} />
            : <span style={{ fontSize: 18 }}>⚡</span>
          }
        </div>

        <div className="group-meta">
          <div className="group-name">{group.name}</div>
          <div className="group-subtitle" style={{ color: accentColor, opacity: 0.8 }}>{subtitle}</div>
        </div>

        {/* Framework stack badges */}
        {allFws.length > 0 && (
          <TechIconStack frameworks={allFws} size={18} />
        )}

        <div className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
          <span className="status-dot" />
          {isRunning ? 'RUNNING' : 'STOPPED'}
        </div>

        <button
          onClick={onRemove}
          title="Remove"
          style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 18, padding: '2px 6px', borderRadius: 6, marginLeft: 4, lineHeight: 1 }}
        >×</button>
      </div>

      {/* Sub-projects — collapsible, start collapsed */}
      {group.projects.map((project) => {
        const isOpen        = expanded[project.id] ?? false
        const projectRunning = Object.keys(project.scripts).some(s => statuses[`${project.id}:${s}`] === 'running')
        const projFw        = project.frameworks?.[0]
        const projColor     = projFw ? FRAMEWORK_COLOR[projFw] : '#475569'

        return (
          <div key={project.id} className="sub-project-section">
            <div
              className="sub-project-header"
              onClick={() => toggle(project.id)}
              style={{ cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Chevron */}
                <span style={{
                  display: 'inline-block', fontSize: 9,
                  color: projColor,
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}>▶</span>

                {/* Service tech icon */}
                {projFw && <TechIcon framework={projFw} size={16} />}

                <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: 11 }}>
                  {project.name}
                </span>

                {/* Framework pills */}
                {(project.frameworks ?? []).map(fw => (
                  <span key={fw} style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.6px',
                    textTransform: 'uppercase', color: FRAMEWORK_COLOR[fw],
                    background: `${FRAMEWORK_COLOR[fw]}18`,
                    border: `1px solid ${FRAMEWORK_COLOR[fw]}33`,
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    {FRAMEWORK_LABEL[fw]}
                  </span>
                ))}

                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  ({Object.keys(project.scripts).length} scripts)
                </span>
              </div>

              {projectRunning && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--green)', display: 'inline-block',
                  marginRight: 4, animation: 'pulse-green 1.8s ease-in-out infinite',
                }} />
              )}
            </div>

            {isOpen && <ProjectCard project={project} />}
          </div>
        )
      })}
    </div>
  )
}
