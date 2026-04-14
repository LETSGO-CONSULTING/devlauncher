import { useState, useMemo } from 'react'
import { useStore } from '../store'

interface Props {
  onSearch?: (query: string) => void
}

export function TopBar({ onSearch }: Props) {
  const [query, setQuery] = useState('')
  const { groups } = useStore()

  // Build searchable items from all projects + scripts
  const allItems = useMemo(() => {
    const items: Array<{ label: string; sub: string; action: string }> = []
    for (const g of groups) {
      for (const p of g.projects) {
        items.push({ label: p.name, sub: g.name, action: 'project' })
        for (const s of Object.keys(p.scripts)) {
          items.push({ label: `${p.name} › ${s}`, sub: g.name, action: 'script' })
        }
      }
    }
    return items
  }, [groups])

  const results = query.trim().length > 1
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    onSearch?.(e.target.value)
  }

  const clear = () => setQuery('')

  return (
    <div className="topbar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>

      {/* Workspace label */}
      <div className="topbar-workspace">
        <span className="topbar-workspace-label">Dev&nbsp;Space</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--card-border)' }} />

      {/* Single tab — Cluster */}
      <div className="topbar-tabs" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="topbar-tab active">Cluster</button>
      </div>

      {/* Search — right side */}
      <div className="topbar-right" style={{ WebkitAppRegion: 'no-drag', position: 'relative' } as React.CSSProperties}>
        <div className="topbar-search" style={{ position: 'relative' }}>
          <span style={{ opacity: 0.45, fontSize: 13 }}>🔍</span>
          <input
            value={query}
            onChange={handleChange}
            onBlur={() => setTimeout(clear, 150)}
            placeholder="Search projects & scripts…"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
              width: 190,
              caretColor: 'var(--accent)',
            }}
          />
          {query && (
            <button
              onClick={clear}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', right: 0,
            width: 280, marginTop: 6, zIndex: 999,
            background: 'var(--surface)',
            border: '1px solid var(--card-border)',
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {results.slice(0, 8).map((item, i) => (
              <div
                key={i}
                onMouseDown={() => setQuery(item.label)}
                style={{
                  padding: '8px 14px', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 10, color: '#475569' }}>{item.sub}</span>
              </div>
            ))}
            {results.length > 8 && (
              <div style={{ padding: '6px 14px', fontSize: 11, color: '#334155' }}>
                +{results.length - 8} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
