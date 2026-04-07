import { ProjectGroup } from '../types'
import { useStore } from '../store'

interface Props {
  groups: ProjectGroup[]
  onAddProject: () => void
  onRemove: (id: string) => void
}

export function Sidebar({ groups, onAddProject }: Props) {
  const { expanded, toggleExpanded } = useStore()

  return (
    <aside style={{
      width: '220px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      WebkitAppRegion: 'drag' as never,
    }}>
      {/* Title bar */}
      <div style={{ height: '52px', display: 'flex', alignItems: 'center', paddingLeft: '80px', paddingRight: '16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>DevLauncher</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 8px 8px' }}>
          Projects ({groups.length})
        </p>
        {groups.map((g) => (
          <div key={g.id} style={{ marginBottom: '2px' }}>
            {/* Group row */}
            <div
              onClick={() => toggleExpanded(g.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '6px', fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', transform: expanded[g.id] ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={g.path}>{g.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{g.projects.length}</span>
            </div>

            {/* Sub-projects */}
            {expanded[g.id] && g.projects.map((p) => (
              <div key={p.id} style={{ padding: '5px 10px 5px 28px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.path}>
                {p.name}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', WebkitAppRegion: 'no-drag' as never }}>
        <button
          onClick={onAddProject}
          style={{ width: '100%', padding: '9px', background: 'var(--accent)', color: '#fff', borderRadius: '7px', fontWeight: 600, fontSize: '13px' }}
        >
          + Add Project
        </button>
      </div>
    </aside>
  )
}
