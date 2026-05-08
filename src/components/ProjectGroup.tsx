import { useState, useRef, useEffect } from 'react'
import { ProjectGroup as ProjectGroupType, Framework } from '../types'
import { useStore } from '../store'
import { ProjectCard } from './ProjectCard'
import { TechIcon, TechIconStack, FRAMEWORK_COLOR, FRAMEWORK_LABEL } from './TechIcon'
import { RuntimeSelector } from './RuntimeSelector'

interface Props {
  group: ProjectGroupType
  onRemove: () => void
  selected?: boolean
}

export function ProjectGroup({ group, onRemove, selected }: Props) {
  const { statuses, runtimeVersions, setRuntimeVersion } = useStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])
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
    <div ref={cardRef} className={`group-card${selected ? ' selected' : ''}`} style={{ borderTop: selected ? `2px solid ${accentColor}` : `2px solid ${accentColor}22` }}>
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
          <div className="group-subtitle">{subtitle}</div>
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
        const projFw = project.frameworks?.[0]

        return (
          <div key={project.id} className="sub-project-section">
            <div
              className="sub-project-header"
              onClick={() => toggle(project.id)}
              style={{ cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-block', fontSize: 9,
                  color: 'var(--text-muted)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}>▶</span>

                {projFw && <TechIcon framework={projFw} size={15} />}

                <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: 11 }}>
                  {project.name}
                </span>

                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  · {Object.keys(project.scripts).length} scripts
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

            {isOpen && (
              <div style={{ padding: '8px 20px 4px', borderTop: '1px solid rgba(30,45,61,0.4)' }}>
                <RuntimeSelector
                  projectType={project.projectType}
                  selectedNode={runtimeVersions[project.id]?.node}
                  selectedJava={runtimeVersions[project.id]?.java}
                  onChange={(node, java) => setRuntimeVersion(project.id, node, java)}
                />
              </div>
            )}
            {isOpen && <ProjectCard project={project} />}
          </div>
        )
      })}
    </div>
  )
}
