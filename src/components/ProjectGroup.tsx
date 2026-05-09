import { useState, useRef, useEffect } from 'react'
import { ProjectGroup as ProjectGroupType, Framework } from '../types'
import { useStore } from '../store'
import { ProjectCard } from './ProjectCard'
import { TechIcon, TechIconStack, FRAMEWORK_COLOR, FRAMEWORK_LABEL } from './TechIcon'
import { RuntimeSelector } from './RuntimeSelector'

interface Editor { id: string; label: string; bin: string }

interface Props {
  group: ProjectGroupType
  onRemove: () => void
  selected?: boolean
}

export function ProjectGroup({ group, onRemove, selected }: Props) {
  const { statuses, runtimeVersions, setRuntimeVersion } = useStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editors, setEditors] = useState<Editor[]>([])
  const [openWithTarget, setOpenWithTarget] = useState<string | null>(null) // 'group' | projectId
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])

  useEffect(() => {
    window.electronAPI.detectEditors().then(setEditors)
  }, [])

  // Close open-with menu on outside click
  useEffect(() => {
    if (!openWithTarget) return
    const handler = () => setOpenWithTarget(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [openWithTarget])

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const expandAll  = () => setExpanded(Object.fromEntries(group.projects.map(p => [p.id, true])))
  const collapseAll = () => setExpanded({})

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

        {/* Right-side actions — all in one flex cluster */}
        <div className="group-header-actions">
          {/* Running indicator */}
          <span
            className={`group-status-dot${isRunning ? ' running' : ''}`}
            title={isRunning ? `${runningCount} running` : 'Stopped'}
          />

          {/* Expand / collapse all */}
          <button className="group-action-btn" title="Expand all" onClick={expandAll}>↓↓</button>
          <button className="group-action-btn" title="Collapse all" onClick={collapseAll}>↑↑</button>

          {/* Open group folder with editor */}
          <div style={{ position: 'relative' }}>
            <button
              className="open-with-btn"
              title="Open folder in editor"
              onClick={(e) => { e.stopPropagation(); setOpenWithTarget(openWithTarget === 'group' ? null : 'group') }}
            >⎋ Open</button>
            {openWithTarget === 'group' && (
              <div className="open-with-menu" onClick={e => e.stopPropagation()}>
                <div className="open-with-label">Open folder in…</div>
                {editors.length > 0
                  ? editors.map(ed => (
                    <button
                      key={ed.id}
                      className="open-with-item"
                      onClick={() => { window.electronAPI.openInEditor(group.path, ed.bin); setOpenWithTarget(null) }}
                    >{ed.label}</button>
                  ))
                  : <div className="open-with-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No editors found</div>
                }
              </div>
            )}
          </div>

          <button
            onClick={onRemove}
            title="Remove"
            className="group-action-btn"
            style={{ color: '#ff6b6b' }}
          >×</button>
        </div>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {projectRunning && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--green)', display: 'inline-block',
                    animation: 'pulse-green 1.8s ease-in-out infinite',
                  }} />
                )}
                {/* Open this sub-project with editor */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="open-with-btn"
                    title="Open in editor"
                    onClick={(e) => { e.stopPropagation(); setOpenWithTarget(openWithTarget === project.id ? null : project.id) }}
                  >⎋ Open</button>
                  {openWithTarget === project.id && editors.length > 0 && (
                    <div className="open-with-menu" style={{ right: 0, left: 'auto' }} onClick={e => e.stopPropagation()}>
                      <div className="open-with-label">Open in…</div>
                      {editors.map(ed => (
                        <button
                          key={ed.id}
                          className="open-with-item"
                          onClick={() => { window.electronAPI.openInEditor(project.path, ed.bin); setOpenWithTarget(null) }}
                        >{ed.label}</button>
                      ))}
                    </div>
                  )}
                  {openWithTarget === project.id && editors.length === 0 && (
                    <div className="open-with-menu" style={{ right: 0, left: 'auto' }} onClick={e => e.stopPropagation()}>
                      <div className="open-with-label" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No editors found</div>
                    </div>
                  )}
                </div>
              </div>
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
