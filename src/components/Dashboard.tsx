import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { ProjectGroup } from '../types'

interface Props {
  groups: ProjectGroup[]
  onAddProject: () => void
  onViewProjects: () => void
}

// ─── Clock ────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ─── Seeded mini chart values (consistent per project) ────────────────────
function seededValues(seed: string, count = 7): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  const vals: number[] = []
  for (let i = 0; i < count; i++) {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5
    vals.push(((h >>> 0) / 0xffffffff) * 8 + 2)
  }
  return vals
}

// ─── SVG mini bar chart ───────────────────────────────────────────────────
function MiniChart({ seed, color }: { seed: string; color: string }) {
  const vals = seededValues(seed)
  const max  = Math.max(...vals)
  return (
    <svg width="44" height="26" viewBox="0 0 44 26">
      {vals.map((v, i) => {
        const h = (v / max) * 22
        return (
          <rect key={i} x={i * 7} y={26 - h} width="5" height={h} rx="1.5"
            fill={color} opacity={0.45 + (i / vals.length) * 0.55} />
        )
      })}
    </svg>
  )
}

// ─── SVG donut chart ──────────────────────────────────────────────────────
function DonutChart({ pct }: { pct: number }) {
  const r    = 62
  const cx   = 85
  const cy   = 85
  const circ = 2 * Math.PI * r
  const dash = circ * (Math.min(pct, 100) / 100)

  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      <defs>
        <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22d3ee" />
          <stop offset="50%"  stopColor="#4ade80" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="13" />
      {/* Arc */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="url(#dg)" strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Center */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0"
        fontSize="24" fontWeight="800" fontFamily="Inter,system-ui,sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#475569"
        fontSize="9" fontWeight="700" letterSpacing="2"
        fontFamily="Inter,system-ui,sans-serif">
        OPTIMIZED
      </text>
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  icon: string
  value: string
  sub: string
  valueColor: string
  barPct?: number
  barColor?: string
  segments?: number
  segmentColor?: string
  variant?: 'bar' | 'segments' | 'minichart'
  chartSeed?: string
}

function StatCard({ label, icon, value, sub, valueColor, barPct, barColor, segments, segmentColor, variant = 'bar', chartSeed }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div>
        <span className="stat-value" style={{ color: valueColor }}>{value}</span>
        <span className="stat-sub">{sub}</span>
      </div>
      {variant === 'bar' && barPct !== undefined && (
        <div className="stat-bar-wrap">
          <div className="stat-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
        </div>
      )}
      {variant === 'segments' && segments !== undefined && (
        <div className="stat-segments">
          {Array.from({ length: segments }).map((_, i) => (
            <div key={i} className="stat-segment"
              style={{ background: i < Math.ceil(segments * (barPct ?? 100) / 100) ? segmentColor : '#1e293b' }} />
          ))}
        </div>
      )}
      {variant === 'minichart' && chartSeed && (
        <div style={{ marginTop: 4 }}>
          <MiniChart seed={chartSeed} color={barColor ?? '#a855f7'} />
        </div>
      )}
    </div>
  )
}

// ─── Group icon helpers (same as ProjectGroup) ────────────────────────────
const ICON_MAP: Record<string, string> = {
  api: '🗄️', backend: '🗄️', server: '🗄️',
  app: '📱', frontend: '🖥️', web: '🌐', site: '🌐',
  mobile: '📱', manager: '⚙️', admin: '⚙️', dashboard: '📊',
  docs: '📚', doc: '📚',
}
function getIcon(name: string) {
  const l = name.toLowerCase()
  for (const [k, v] of Object.entries(ICON_MAP)) if (l.includes(k)) return v
  return '⚡'
}

const GROUP_COLORS = ['#7c5cfc','#22d3ee','#22c55e','#f59e0b','#ef4444','#ec4899']
const colorCache = new Map<string, string>()
let colorIdx = 0
function groupColor(id: string) {
  if (!colorCache.has(id)) { colorCache.set(id, GROUP_COLORS[colorIdx++ % GROUP_COLORS.length]) }
  return colorCache.get(id)!
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export function Dashboard({ groups, onAddProject, onViewProjects }: Props) {
  const { statuses, logs } = useStore()
  const now = useClock()

  // ── Derived stats ──────────────────────────────────────────────────────
  const totalProjects = groups.reduce((a, g) => a + g.projects.length, 0)
  const totalScripts  = groups.reduce((a, g) =>
    a + g.projects.reduce((b, p) => b + Object.keys(p.scripts).length, 0), 0)

  const runningScripts = Object.values(statuses).filter(s => s === 'running').length
  const runningGroups  = groups.filter(g =>
    g.projects.some(p => Object.keys(p.scripts).some(s => statuses[`${p.id}:${s}`] === 'running'))
  ).length

  const healthPct = totalScripts > 0
    ? Math.min(100, Math.round(84 + runningScripts * 2))   // decorative
    : 84

  // ── Recent activity from system logs ──────────────────────────────────
  const recentActivity = useMemo(() => {
    const events: { key: string; msg: string; ts: number; projectName: string; type: string }[] = []
    for (const [key, entries] of Object.entries(logs)) {
      const [projectId, script] = key.split(':')
      const group   = groups.find(g => g.projects.some(p => p.id === projectId))
      const project = group?.projects.find(p => p.id === projectId)
      const name    = project?.name ?? projectId
      entries
        .filter(e => e.type === 'system')
        .forEach(e => events.push({ key, msg: e.data, ts: e.timestamp, projectName: name, type: e.data.includes('stop') || e.data.includes('exit') ? 'stop' : e.data.includes('Error') ? 'error' : 'start' }))
    }
    return events.sort((a, b) => b.ts - a.ts).slice(0, 5)
  }, [logs, groups])

  // ── Formatters ────────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()
  const timeStr = now.toTimeString().slice(0, 8)

  function formatRelative(ts: number) {
    const diff = Date.now() - ts
    if (diff < 60_000)  return 'JUST NOW'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}M AGO`
    return `${Math.floor(diff / 3600_000)}H AGO`
  }

  const activityIconStyle = (type: string): { bg: string; icon: string } => {
    if (type === 'stop')  return { bg: 'rgba(148,163,184,0.1)', icon: '■' }
    if (type === 'error') return { bg: 'rgba(239,68,68,0.15)',  icon: '✕' }
    return { bg: 'rgba(34,197,94,0.12)', icon: '▶' }
  }

  const activityIconColor = (type: string) =>
    type === 'stop' ? '#64748b' : type === 'error' ? '#ef4444' : '#22c55e'

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="dashboard">

      {/* Header */}
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-header-label">System Controller</div>
          <div className="db-header-title">Dashboard Overview</div>
        </div>
        <div className="db-header-right">
          <div className="db-header-date">
            <span>📅</span> {dateStr}
          </div>
          <div className="db-header-time">
            {timeStr} <span className="db-header-tz">UTC</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="db-stats">
        <StatCard
          label="Active Projects"
          icon="✓"
          value={`${runningGroups}/${groups.length}`}
          sub="Online"
          valueColor="#4ade80"
          variant="bar"
          barPct={groups.length > 0 ? (runningGroups / groups.length) * 100 : 0}
          barColor="linear-gradient(90deg, #22c55e, #4ade80)"
        />
        <StatCard
          label="Running Scripts"
          icon="❊"
          value={`${runningScripts}/${totalScripts}`}
          sub="Active"
          valueColor="#22d3ee"
          variant="segments"
          segments={Math.min(totalScripts, 12)}
          barPct={totalScripts > 0 ? (runningScripts / totalScripts) * 100 : 0}
          segmentColor="#22d3ee"
        />
        <StatCard
          label="Total Services"
          icon="⬡"
          value={`${totalProjects}`}
          sub="Registered"
          valueColor="#a855f7"
          variant="bar"
          barPct={Math.min(100, totalProjects * 10)}
          barColor="linear-gradient(90deg, #7c5cfc, #a855f7)"
        />
        <StatCard
          label="Throughput"
          icon="✓"
          value={runningScripts > 0 ? `${runningScripts * 3}` : '0'}
          sub="Processes"
          valueColor="#c084fc"
          variant="minichart"
          chartSeed={groups[0]?.id ?? 'default'}
          barColor="#7c5cfc"
        />
      </div>

      {/* Middle: Pinned projects + System health */}
      <div className="db-middle">

        {/* Pinned projects */}
        <div>
          <div className="db-section-header">
            <div className="db-section-title">
              <span className="db-section-icon">📌</span>
              Pinned Projects
            </div>
            <button className="db-view-all" onClick={onViewProjects}>VIEW ALL</button>
          </div>

          {groups.length === 0 ? (
            <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No projects yet.{' '}
              <button onClick={onAddProject} style={{ color: 'var(--cyan)', background: 'transparent', fontWeight: 600 }}>
                Add one →
              </button>
            </div>
          ) : (
            groups.slice(0, 5).map((group) => {
              const color   = groupColor(group.id)
              const running = group.projects.some(p =>
                Object.keys(p.scripts).some(s => statuses[`${p.id}:${s}`] === 'running')
              )
              const scriptCount = group.projects.reduce((a, p) => a + Object.keys(p.scripts).length, 0)
              const runCount    = group.projects.reduce((a, p) =>
                a + Object.keys(p.scripts).filter(s => statuses[`${p.id}:${s}`] === 'running').length, 0)

              return (
                <div key={group.id} className="pinned-project-row" onClick={onViewProjects}>
                  <div className="pp-icon" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                    {getIcon(group.name)}
                  </div>
                  <div className="pp-info">
                    <div className="pp-name">{group.name}</div>
                    <div className="pp-meta">
                      <span className="pp-dot" style={{ background: running ? '#22c55e' : '#475569' }} />
                      <span className="pp-env">{running ? 'Running' : 'Stopped'}</span>
                      <span className="pp-tag">{runCount}/{scriptCount} scripts</span>
                      <span className="pp-tag">{group.projects.length} services</span>
                    </div>
                  </div>
                  <div className="pp-actions">
                    <MiniChart seed={group.id} color={running ? color : '#334155'} />
                    <button className="pp-menu-btn">⋮</button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* System Health */}
        <div>
          <div className="db-section-header">
            <div className="db-section-title">
              <span className="db-section-icon">📊</span>
              System Health
            </div>
          </div>
          <div className="health-card">
            <DonutChart pct={healthPct} />
            <div className="health-legend">
              {[
                { label: 'Running Scripts',  color: '#22d3ee', pct: totalScripts > 0 ? Math.round((runningScripts / totalScripts) * 100) : 0 },
                { label: 'Active Projects',  color: '#4ade80', pct: groups.length   > 0 ? Math.round((runningGroups / groups.length) * 100)  : 0 },
                { label: 'Total Services',   color: '#a855f7', pct: Math.min(100, totalProjects * 8) },
              ].map((item) => (
                <div key={item.label} className="health-legend-row">
                  <span className="health-legend-dot" style={{ background: item.color }} />
                  <span className="health-legend-label">{item.label}</span>
                  <span className="health-legend-pct">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="db-activity">
        <div className="db-section-header">
          <div className="db-section-title">
            <span className="db-section-icon">🕐</span>
            Recent Activity
          </div>
          <div className="activity-controls">
            <button className="activity-btn">Filter</button>
            <button className="activity-btn">Export</button>
          </div>
        </div>

        {recentActivity.length === 0 ? (
          <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
            No activity yet. Start a script to see events here.
          </div>
        ) : (
          recentActivity.map((ev, i) => {
            const { bg, icon } = activityIconStyle(ev.type)
            const color = activityIconColor(ev.type)
            return (
              <div key={i} className="activity-row">
                <div className="activity-icon" style={{ background: bg, color }}>
                  {icon}
                </div>
                <div className="activity-info">
                  <div className="activity-msg">
                    {ev.msg.replace('▸ ', '').replace('■ ', '').replace('↺ ', '').replace('✗ ', '')} — <strong>{ev.projectName}</strong>
                  </div>
                  <div className="activity-time">
                    {formatRelative(ev.ts)} &bull; {ev.key.split(':')[1]?.toUpperCase()}
                  </div>
                </div>
                <div className="activity-hash">
                  PID: {(ev.ts % 99999).toString(16).toUpperCase()}
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
