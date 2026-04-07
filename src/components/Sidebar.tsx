import { Project } from '../types'

interface Props {
  projects: Project[]
  onAddProject: () => void
  onRemove: (id: string) => void
}

export function Sidebar({ projects, onAddProject }: Props) {
  return (
    <aside style={{
      width: '220px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      WebkitAppRegion: 'drag' as never,
    }}>
      {/* Title bar area */}
      <div style={{ height: '52px', display: 'flex', alignItems: 'center', paddingLeft: '80px', paddingRight: '16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>DevLauncher</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 8px 8px' }}>
          Projects ({projects.length})
        </p>
        {projects.map((p) => (
          <div key={p.id} style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '2px', fontSize: '13px', color: 'var(--text)', cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={p.path}>
            {p.name}
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
