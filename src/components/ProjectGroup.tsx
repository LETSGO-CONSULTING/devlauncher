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

        {/* Name + Open btn inline */}
        <div className="group-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="group-name">{group.name}</div>
            {/* Open folder — next to name */}
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button
                className="open-with-btn"
                title="Open folder in editor"
                onClick={() => setOpenWithTarget(openWithTarget === 'group' ? null : 'group')}
              >⎋ Open</button>
              {openWithTarget === 'group' && (
                <div className="open-with-menu">
                  <div className="open-with-label">Open folder in…</div>
                  <button className="open-with-item open-with-finder"
                    onClick={() => { window.electronAPI.openInFinder(group.path); setOpenWithTarget(null) }}
                  >🗂 Finder</button>
                  {editors.map(ed => (
                    <button
                      key={ed.id}
                      className="open-with-item"
                      onClick={() => { window.electronAPI.openInEditor(group.path, ed.bin); setOpenWithTarget(null) }}
                    >{ed.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="group-subtitle">{subtitle}</div>
        </div>

        {/* Right-side actions */}
        <div className="group-header-actions">
          <span
            className={`group-status-dot${isRunning ? ' running' : ''}`}
            title={isRunning ? `${runningCount} running` : 'Stopped'}
          />
          <button className="group-action-btn" title="Expand all" onClick={expandAll}>↓↓</button>
          <button className="group-action-btn" title="Collapse all" onClick={collapseAll}>↑↑</button>
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
              className={`sub-project-header${isOpen ? ' open' : ''}`}
              onClick={() => toggle(project.id)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              {/* Left: chevron + icon + name + Open btn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  fontSize: 9, color: 'var(--text-muted)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                  flexShrink: 0,
                }}>▶</span>

                {projFw && <TechIcon framework={projFw} size={14} />}

                <span style={{ fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {project.name}
                </span>

                {/* Open-with — right next to name */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button
                    className="open-with-btn"
                    title="Open in editor"
                    onClick={() => setOpenWithTarget(openWithTarget === project.id ? null : project.id)}
                  >⎋ Open</button>
                  {openWithTarget === project.id && (
                    <div className="open-with-menu">
                      <div className="open-with-label">Open in…</div>
                      <button className="open-with-item open-with-finder"
                        onClick={() => { window.electronAPI.openInFinder(project.path); setOpenWithTarget(null) }}
                      >🗂 Finder</button>
                      {editors.map(ed => (
                        <button
                          key={ed.id}
                          className="open-with-item"
                          onClick={() => { window.electronAPI.openInEditor(project.path, ed.bin); setOpenWithTarget(null) }}
                        >{ed.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: script count + running dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {Object.keys(project.scripts).length} scripts
                </span>
                {projectRunning && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--green)', flexShrink: 0,
                    animation: 'pulse-green 1.8s ease-in-out infinite',
                  }} />
                )}
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
