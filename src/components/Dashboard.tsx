import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { ProjectGroup, Framework } from '../types'
import { TechIcon, TechIconStack, FRAMEWORK_COLOR } from './TechIcon'

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

// ─── Activity sampler — snapshots log-line counts every 3s ───────────────
// Returns per-key rolling arrays of deltas (last 7 buckets)
const SAMPLE_INTERVAL = 3000
const SAMPLE_BUCKETS  = 7

function useSampler(): Record<string, number[]> {
  const [samples, setSamples] = useState<Record<string, number[]>>({})
  const prevRef    = useRef<Record<string, number>>({})
  const countsRef  = useRef<Record<string, number>>({})
  const logCounts  = useStore(s => s.logCounts)
  countsRef.current = logCounts

  useEffect(() => {
    const tick = () => {
      const counts = countsRef.current
      const prev   = prevRef.current
      setSamples(old => {
        const next = { ...old }
        for (const [key, count] of Object.entries(counts)) {
          const delta = Math.max(0, count - (prev[key] ?? count))
          const arr   = old[key] ?? []
          next[key]   = [...arr, delta].slice(-SAMPLE_BUCKETS)
        }
        return next
      })
      prevRef.current = { ...counts }
    }
    const id = setInterval(tick, SAMPLE_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return samples
}

// ─── Get chart values for a group (sum of deltas across all its keys) ─────
function groupChartValues(
  projects: ProjectGroup['projects'],
  samples: Record<string, number[]>,
): number[] {
  const result = new Array(SAMPLE_BUCKETS).fill(0)
  for (const project of projects) {
    for (const scriptKey of Object.keys(project.scripts)) {
      const key = `${project.id}:${scriptKey}`
      const s   = samples[key] ?? []
      // right-align: put latest sample in last bucket
      const offset = SAMPLE_BUCKETS - s.length
      s.forEach((v, i) => { result[offset + i] += v })
    }
  }
  return result
}

// ─── SVG mini bar chart ───────────────────────────────────────────────────
function MiniChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)   // avoid div/0
  return (
    <svg width="44" height="26" viewBox="0 0 44 26">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * 22)
        return (
          <rect key={i} x={i * 7} y={26 - h} width="5" height={h} rx="1.5"
            fill={color} opacity={0.45 + (i / values.length) * 0.55} />
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="13" />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="url(#dg)" strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0"
        fontSize="24" fontWeight="800" fontFamily="Inter,system-ui,sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#475569"
        fontSize="9" fontWeight="700" letterSpacing="2"
        fontFamily="Inter,system-ui,sans-serif">
        ACTIVE
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
  chartValues?: number[]
}

function StatCard({ label, icon, value, sub, valueColor, barPct, barColor, segments, segmentColor, variant = 'bar', chartValues }: StatCardProps) {
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
      {variant === 'minichart' && chartValues && (
        <div style={{ marginTop: 4 }}>
          <MiniChart values={chartValues} color={barColor ?? '#a855f7'} />
        </div>
      )}
    </div>
  )
}

// ─── Group icon helpers ───────────────────────────────────────────────────
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
  const statuses    = useStore(s => s.statuses)
  const logs        = useStore(s => s.logs)
  const logCounts   = useStore(s => s.logCounts)
  const processPids = useStore(s => s.processPids)
  const [activityFilter, setActivityFilter] = useState<'all'|'start'|'stop'|'error'>('all')
  const now     = useClock()
  const samples = useSampler()

  // ── Derived stats ──────────────────────────────────────────────────────
  const totalProjects = groups.reduce((a, g) => a + g.projects.length, 0)
  const totalScripts  = groups.reduce((a, g) =>
    a + g.projects.reduce((b, p) => b + Object.keys(p.scripts).length, 0), 0)

  const runningScripts = Object.values(statuses).filter(s => s === 'running').length
  const runningGroups  = groups.filter(g =>
    g.projects.some(p => Object.keys(p.scripts).some(s => statuses[`${p.id}:${s}`] === 'running'))
  ).length

  // Real health % = running scripts / total scripts
  const healthPct = totalScripts > 0
    ? Math.round((runningScripts / totalScripts) * 100)
    : 0

  // Real throughput = total log lines received across all running processes
  const totalLogLines = useMemo(() =>
    Object.entries(logCounts)
      .reduce((acc, [, count]) => acc + count, 0),
    [logCounts]
  )

  // Throughput mini chart = sum of all key deltas per bucket
  const throughputChart = useMemo(() => {
    const result = new Array(SAMPLE_BUCKETS).fill(0)
    for (const s of Object.values(samples)) {
      const offset = SAMPLE_BUCKETS - s.length
      s.forEach((v, i) => { result[offset + i] += v })
    }
    return result
  }, [samples])

  // ── Recent activity from system logs ──────────────────────────────────
  const recentActivity = useMemo(() => {
    const events: { key: string; msg: string; ts: number; projectName: string; type: string }[] = []
    for (const [key, entries] of Object.entries(logs)) {
      const [projectId] = key.split(':')
      const group   = groups.find(g => g.projects.some(p => p.id === projectId))
      const project = group?.projects.find(p => p.id === projectId)
      const name    = project?.name ?? projectId
      entries
        .filter(e => e.type === 'system')
        .forEach(e => {
          const type = e.data.includes('stop') || e.data.includes('exit') || e.data.includes('■')
            ? 'stop'
            : e.data.includes('Error') || e.data.includes('✗')
            ? 'error'
            : 'start'
          events.push({ key, msg: e.data, ts: e.timestamp, projectName: name, type })
        })
    }
    return events.sort((a, b) => b.ts - a.ts).slice(0, 8)
  }, [logs, groups])

  const filteredActivity = useMemo(() =>
    activityFilter === 'all'
      ? recentActivity
      : recentActivity.filter(e => e.type === activityFilter),
    [recentActivity, activityFilter]
  )

  const exportActivity = () => {
    const lines = recentActivity.map(e =>
      `[${new Date(e.ts).toISOString()}] [${e.type.toUpperCase()}] ${e.projectName} — ${e.msg}`
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `devlauncher-activity-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Formatters ────────────────────────────────────────────────────────
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()
  const timeStr = now.toTimeString().slice(0, 8)

  function formatRelative(ts: number) {
    const diff = Date.now() - ts
    if (diff < 60_000)   return 'JUST NOW'
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
            {timeStr} <span className="db-header-tz">LOCAL</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="db-stats">
        <StatCard
          label="Active Projects"
          icon="✓"
          value={`${runningGroups}/${groups.length}`}
          sub="Groups online"
          valueColor="#4ade80"
          variant="bar"
          barPct={groups.length > 0 ? (runningGroups / groups.length) * 100 : 0}
          barColor="linear-gradient(90deg, #22c55e, #4ade80)"
        />
        <StatCard
          label="Running Scripts"
          icon="❊"
          value={`${runningScripts}/${totalScripts}`}
          sub="Active processes"
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
          label="Log Throughput"
          icon="≋"
          value={totalLogLines >= 1000 ? `${(totalLogLines / 1000).toFixed(1)}k` : `${totalLogLines}`}
          sub="Lines received"
          valueColor="#c084fc"
          variant="minichart"
          chartValues={throughputChart}
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
              const primaryFw: Framework | undefined = group.projects.flatMap(p => p.frameworks ?? []).find(Boolean)
              const allFws: Framework[]              = [...new Set(group.projects.flatMap(p => p.frameworks ?? []))]
              const accentColor = primaryFw ? FRAMEWORK_COLOR[primaryFw] : groupColor(group.id)
              const running = group.projects.some(p =>
                Object.keys(p.scripts).some(s => statuses[`${p.id}:${s}`] === 'running')
              )
              const scriptCount = group.projects.reduce((a, p) => a + Object.keys(p.scripts).length, 0)
              const runCount    = group.projects.reduce((a, p) =>
                a + Object.keys(p.scripts).filter(s => statuses[`${p.id}:${s}`] === 'running').length, 0)

              const chartVals = groupChartValues(group.projects, samples)

              return (
                <div key={group.id} className="pinned-project-row" onClick={onViewProjects}>
                  <div className="pp-icon" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}>
                    {primaryFw
                      ? <TechIcon framework={primaryFw} size={22} />
                      : <span style={{ fontSize: 18 }}>{getIcon(group.name)}</span>
                    }
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
                    {allFws.length > 0 && <TechIconStack frameworks={allFws} size={16} />}
                    <MiniChart values={chartVals} color={running ? accentColor : '#334155'} />
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
                {
                  label: 'Running Scripts',
                  color: '#22d3ee',
                  pct: totalScripts > 0 ? Math.round((runningScripts / totalScripts) * 100) : 0,
                },
                {
                  label: 'Active Groups',
                  color: '#4ade80',
                  pct: groups.length > 0 ? Math.round((runningGroups / groups.length) * 100) : 0,
                },
                {
                  label: 'Services Registered',
                  color: '#a855f7',
                  pct: totalProjects > 0 ? 100 : 0,
                  raw: `${totalProjects}`,
                },
              ].map((item) => (
                <div key={item.label} className="health-legend-row">
                  <span className="health-legend-dot" style={{ background: item.color }} />
                  <span className="health-legend-label">{item.label}</span>
                  <span className="health-legend-pct">{'raw' in item ? item.raw : `${item.pct}%`}</span>
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
            {(['all','start','stop','error'] as const).map(f => (
              <button
                key={f}
                className={`activity-btn${activityFilter === f ? ' active' : ''}`}
                onClick={() => setActivityFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button className="activity-btn" onClick={exportActivity} title="Download activity log">Export</button>
          </div>
        </div>

        {filteredActivity.length === 0 ? (
          <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
            {recentActivity.length === 0
              ? 'No activity yet. Start a script to see events here.'
              : `No ${activityFilter} events yet.`}
          </div>
        ) : (
          filteredActivity.map((ev, i) => {
            const { bg, icon } = activityIconStyle(ev.type)
            const color = activityIconColor(ev.type)
            const realPid = processPids[ev.key]
            return (
              <div key={i} className="activity-row">
                <div className="activity-icon" style={{ background: bg, color }}>
                  {icon}
                </div>
                <div className="activity-info">
                  <div className="activity-msg">
                    {ev.msg.replace(/^[▸■↺✗]\s*/, '')} — <strong>{ev.projectName}</strong>
                  </div>
                  <div className="activity-time">
                    {formatRelative(ev.ts)} &bull; {ev.key.split(':')[1]?.toUpperCase()}
                  </div>
                </div>
                <div className="activity-hash">
                  {realPid ? `PID: ${realPid}` : '—'}
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
