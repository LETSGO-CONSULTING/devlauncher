import { ProjectGroup as ProjectGroupType } from '../types'
import { useStore } from '../store'
import { ProjectCard } from './ProjectCard'

interface Props {
  group: ProjectGroupType
  onRemove: () => void
}

export function ProjectGroup({ group, onRemove }: Props) {
  const { expanded, toggleExpanded, statuses } = useStore()
  const isOpen = expanded[group.id] ?? true

  // Count running processes inside this group
  const runningCount = group.projects.reduce((acc, p) => {
    return acc + Object.keys(p.scripts).filter(
      (s) => statuses[`${p.id}:${s}`] === 'running'
    ).length
  }, 0)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      {/* Group header */}
      <div
        onClick={() => toggleExpanded(group.id)}
        style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', userSelect: 'none', gap: '10px' }}
      >
        {/* Chevron */}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>

        {/* Folder icon */}
        <span style={{ fontSize: '18px' }}>{isOpen ? '📂' : '📁'}</span>

        {/* Name */}
        <span style={{ fontWeight: 700, fontSize: '15px', flex: 1 }}>{group.name}</span>

        {/* Sub-project count */}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '10px' }}>
          {group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'}
        </span>

        {/* Running badge */}
        {runningCount > 0 && (
          <span style={{ fontSize: '12px', color: '#fff', background: 'var(--green)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
            {runningCount} running
          </span>
        )}

        {/* Remove group */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          title="Remove group"
          style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '18px', padding: '2px 8px', borderRadius: '6px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Sub-projects */}
      {isOpen && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {group.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
