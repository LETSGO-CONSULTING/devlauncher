import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '../store'

// ─── Types ─────────────────────────────────────────────────────────────────

type NodeRole = 'frontend' | 'backend' | 'fullstack' | 'database' | 'cache' | 'unknown'

interface GraphNode {
  id: string; label: string; role: NodeRole; path: string
  port?: number; tech: string[]; envVars: Record<string, string>
  groupId?: string; groupName?: string
}
interface GraphEdge { source: string; target: string; label: string }

// ─── Role colors (matching arch.html exactly) ──────────────────────────────

const ROLE: Record<NodeRole, { border: string; glow: string; inner: string; text: string; label: string }> = {
  database:  { border:'#8b5cf6', glow:'rgba(139,92,246,.12)', inner:'rgba(139,92,246,.03)', text:'#c4b5fd', label:'Database'  },
  cache:     { border:'#f59e0b', glow:'rgba(245,158,11,.12)',  inner:'rgba(245,158,11,.03)', text:'#fcd34d', label:'Cache'     },
  backend:   { border:'#10b981', glow:'rgba(16,185,129,.13)',  inner:'rgba(16,185,129,.03)', text:'#6ee7b7', label:'Backend'   },
  fullstack: { border:'#f59e0b', glow:'rgba(245,158,11,.12)',  inner:'rgba(245,158,11,.03)', text:'#fcd34d', label:'Fullstack' },
  frontend:  { border:'#3b82f6', glow:'rgba(59,130,246,.12)',  inner:'rgba(59,130,246,.03)', text:'#93c5fd', label:'Frontend'  },
  unknown:   { border:'#475569', glow:'rgba(71,85,105,.08)',   inner:'rgba(71,85,105,.02)',  text:'#94a3b8', label:'Service'   },
}

// ─── Tech pill styles ──────────────────────────────────────────────────────

type TechStyle = { bg: string; border: string; text: string; icon: string; label: string }
const TECH: Record<string, TechStyle> = {
  react:      { bg:'rgba(97,218,251,.08)',   border:'rgba(97,218,251,.28)',   text:'#67e8f9', icon:'⚛',  label:'React'       },
  nextjs:     { bg:'rgba(255,255,255,.05)',  border:'rgba(255,255,255,.13)',  text:'#cbd5e1', icon:'▲',  label:'Next.js'     },
  vue:        { bg:'rgba(66,184,131,.08)',   border:'rgba(66,184,131,.28)',   text:'#4ade80', icon:'◈',  label:'Vue'         },
  nuxt:       { bg:'rgba(0,220,130,.08)',    border:'rgba(0,220,130,.28)',    text:'#34d399', icon:'◈',  label:'Nuxt'        },
  angular:    { bg:'rgba(221,0,49,.10)',     border:'rgba(221,0,49,.28)',     text:'#f87171', icon:'◉',  label:'Angular'     },
  svelte:     { bg:'rgba(255,62,0,.08)',     border:'rgba(255,62,0,.25)',     text:'#fb923c', icon:'◈',  label:'Svelte'      },
  vite:       { bg:'rgba(189,52,254,.08)',   border:'rgba(189,52,254,.25)',   text:'#c084fc', icon:'⚡', label:'Vite'        },
  astro:      { bg:'rgba(255,93,1,.08)',     border:'rgba(255,93,1,.25)',     text:'#fb923c', icon:'🚀', label:'Astro'       },
  nestjs:     { bg:'rgba(231,0,43,.10)',     border:'rgba(231,0,43,.28)',     text:'#f87171', icon:'◉',  label:'NestJS'      },
  express:    { bg:'rgba(255,255,255,.05)',  border:'rgba(255,255,255,.10)',  text:'#94a3b8', icon:'◈',  label:'Express'     },
  fastify:    { bg:'rgba(255,255,255,.05)',  border:'rgba(255,255,255,.10)',  text:'#94a3b8', icon:'⚡', label:'Fastify'     },
  django:     { bg:'rgba(9,53,32,.18)',      border:'rgba(68,183,139,.28)',   text:'#6ee7b7', icon:'◈',  label:'Django'      },
  flask:      { bg:'rgba(255,255,255,.05)',  border:'rgba(255,255,255,.10)',  text:'#94a3b8', icon:'◈',  label:'Flask'       },
  fastapi:    { bg:'rgba(0,150,136,.09)',    border:'rgba(0,184,169,.28)',    text:'#2dd4bf', icon:'⚡', label:'FastAPI'     },
  rails:      { bg:'rgba(204,0,0,.09)',      border:'rgba(204,0,0,.28)',      text:'#fca5a5', icon:'◈',  label:'Rails'       },
  spring:     { bg:'rgba(109,179,63,.09)',   border:'rgba(109,179,63,.28)',   text:'#86efac', icon:'◉',  label:'Spring'      },
  laravel:    { bg:'rgba(255,45,32,.09)',    border:'rgba(255,45,32,.28)',    text:'#fca5a5', icon:'◉',  label:'Laravel'     },
  typescript: { bg:'rgba(49,120,198,.13)',   border:'rgba(49,120,198,.35)',   text:'#60a5fa', icon:'TS', label:'TypeScript'  },
  javascript: { bg:'rgba(247,223,30,.09)',   border:'rgba(247,223,30,.25)',   text:'#fde047', icon:'JS', label:'JavaScript'  },
  node:       { bg:'rgba(51,153,51,.09)',    border:'rgba(51,153,51,.28)',    text:'#86efac', icon:'◈',  label:'Node'        },
  docker:     { bg:'rgba(29,99,237,.09)',    border:'rgba(29,99,237,.25)',    text:'#93c5fd', icon:'🐳', label:'Docker'      },
  go:         { bg:'rgba(0,173,216,.09)',    border:'rgba(0,173,216,.28)',    text:'#67e8f9', icon:'◈',  label:'Go'          },
  rust:       { bg:'rgba(206,65,43,.09)',    border:'rgba(206,65,43,.28)',    text:'#fca5a5', icon:'◈',  label:'Rust'        },
  python:     { bg:'rgba(55,118,171,.13)',   border:'rgba(55,118,171,.35)',   text:'#7dd3fc', icon:'🐍', label:'Python'      },
  ruby:       { bg:'rgba(204,52,45,.09)',    border:'rgba(204,52,45,.28)',    text:'#fca5a5', icon:'💎', label:'Ruby'        },
  electron:   { bg:'rgba(71,132,143,.09)',   border:'rgba(71,132,143,.28)',   text:'#67e8f9', icon:'⚡', label:'Electron'    },
  php:        { bg:'rgba(119,123,180,.09)',  border:'rgba(136,146,191,.28)',  text:'#a5b4fc', icon:'◈',  label:'PHP'         },
  postgres:   { bg:'rgba(51,103,145,.13)',   border:'rgba(51,103,145,.35)',   text:'#7dd3fc', icon:'🐘', label:'PostgreSQL'  },
  postgresql: { bg:'rgba(51,103,145,.13)',   border:'rgba(51,103,145,.35)',   text:'#7dd3fc', icon:'🐘', label:'PostgreSQL'  },
  mysql:      { bg:'rgba(0,117,143,.09)',    border:'rgba(0,117,143,.28)',    text:'#67e8f9', icon:'🐬', label:'MySQL'       },
  redis:      { bg:'rgba(220,50,50,.09)',    border:'rgba(220,50,50,.28)',    text:'#fca5a5', icon:'◈',  label:'Redis'       },
  mongo:      { bg:'rgba(0,237,100,.07)',    border:'rgba(0,237,100,.25)',    text:'#6ee7b7', icon:'◈',  label:'MongoDB'     },
  mongodb:    { bg:'rgba(0,237,100,.07)',    border:'rgba(0,237,100,.25)',    text:'#6ee7b7', icon:'◈',  label:'MongoDB'     },
  minio:      { bg:'rgba(220,50,50,.09)',    border:'rgba(220,50,50,.28)',    text:'#fca5a5', icon:'◈',  label:'MinIO'       },
  jwt:        { bg:'rgba(234,179,8,.09)',    border:'rgba(234,179,8,.25)',    text:'#fde047', icon:'🔑', label:'JWT'         },
  graphql:    { bg:'rgba(225,0,152,.09)',    border:'rgba(225,0,152,.28)',    text:'#f472b6', icon:'◉',  label:'GraphQL'     },
}

function getTech(t: string): TechStyle {
  return TECH[t.toLowerCase()] ?? { bg:'rgba(255,255,255,.04)', border:'rgba(255,255,255,.09)', text:'#64748b', icon:'◈', label: t }
}

function edgeColor(label: string): string {
  if (/minio|s3|storage/i.test(label))           return '#f59e0b'
  if (/postgres|mysql|typeorm|database|mongo/i.test(label)) return '#8b5cf6'
  if (/redis/i.test(label))                      return '#a855f7'
  return '#3b82f6'
}

// ─── Layout ────────────────────────────────────────────────────────────────

const ROLE_COL: Record<NodeRole, number> = { database:0, cache:0, backend:1, unknown:1, fullstack:2, frontend:3 }
const COL_X    = [60, 380, 700, 1020]
const ROW_Y    = 60
const ROW_GAP  = 290

function buildPositions(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const colRows = new Map<number, number>()
  const sorted = [...nodes].sort((a, b) => ROLE_COL[a.role] - ROLE_COL[b.role])
  for (const n of sorted) {
    const col = ROLE_COL[n.role]
    const row = colRows.get(col) ?? 0
    colRows.set(col, row + 1)
    positions[n.id] = { x: COL_X[col] ?? 60 + col * 320, y: ROW_Y + row * ROW_GAP }
  }
  return positions
}

// ─── CSS ───────────────────────────────────────────────────────────────────

const CSS = `
@keyframes dashFlow  { to { stroke-dashoffset: -22; } }
@keyframes cdotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes slideIn   { from { opacity:0; transform:translateX(14px) } to { opacity:1; transform:none } }
.pm-card { transition: box-shadow 0.18s ease; }
.pm-card:hover { filter: brightness(1.06); }
.pm-zoom-btn:hover { background: rgba(255,255,255,.06) !important; color: #94a3b8 !important; }
`

// ─── Service Card ──────────────────────────────────────────────────────────

interface CardProps {
  node: GraphNode
  pos: { x: number; y: number }
  isRunning: boolean
  selected: boolean
  onSelect: (n: GraphNode) => void
  onDragStart: (e: React.MouseEvent, id: string) => void
  cardRef: (el: HTMLDivElement | null) => void
}

function ServiceCard({ node, pos, isRunning, selected, onSelect, onDragStart, cardRef }: CardProps) {
  const col = ROLE[node.role]

  return (
    <div
      ref={cardRef}
      className="pm-card"
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, node.id) }}
      onClick={() => onSelect(node)}
      style={{
        position: 'absolute', left: pos.x, top: pos.y, width: 220,
        background: '#0c0c18',
        border: `1.5px solid ${selected ? col.border : col.border + 'cc'}`,
        borderRadius: 14, padding: '18px 20px 16px',
        boxShadow: selected
          ? `0 0 0 2px ${col.border}40, 0 0 32px ${col.glow}, inset 0 0 30px ${col.inner}`
          : `0 0 28px ${col.glow}, inset 0 0 30px ${col.inner}`,
        cursor: 'grab', userSelect: 'none', zIndex: selected ? 3 : 1,
      }}
    >
      {/* Head: dot + name */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{
          width:7, height:7, borderRadius:'50%', flexShrink:0,
          background: isRunning ? '#10b981' : col.border,
          boxShadow: isRunning ? '0 0 6px #10b981' : `0 0 5px ${col.border}`,
          animation: isRunning ? 'cdotPulse 2s ease-in-out infinite' : 'none',
          transition: 'background 0.4s, box-shadow 0.4s',
        }} />
        <span style={{ fontSize:13.5, fontWeight:600, letterSpacing:'-0.1px', color:'#e2e8f0' }}>
          {node.label}
        </span>
      </div>

      {/* Subtitle */}
      <div style={{ fontSize:10.5, color:'#334155', margin:'2px 0 11px 15px' }}>
        {col.label}{node.tech.includes('docker') ? ' · Docker' : ''}
      </div>

      {/* Port badge */}
      {node.port && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:11 }}>
          <span style={{
            fontFamily:"'SF Mono','Fira Code',monospace", fontSize:10.5, fontWeight:600,
            padding:'2px 7px', borderRadius:5,
            background: isRunning ? 'rgba(16,185,129,.07)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${isRunning ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.07)'}`,
            color: isRunning ? '#34d399' : '#64748b',
          }}>:{node.port}</span>
        </div>
      )}

      {/* Tech pills */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
        {node.tech.filter(t => t !== 'node').map(t => {
          const ts = getTech(t)
          const isCode = t === 'typescript' || t === 'javascript'
          return (
            <span key={t} style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 8px', borderRadius:5,
              fontSize:10.5, fontWeight:500, lineHeight:1,
              background:ts.bg, border:`1px solid ${ts.border}`, color:ts.text,
            }}>
              <span style={{ fontSize: isCode ? 8 : 11, fontWeight: isCode ? 800 : 400, fontFamily: isCode ? 'monospace' : 'inherit' }}>
                {ts.icon}
              </span>
              {ts.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── SVG connection overlay ────────────────────────────────────────────────

const PARTICLES = [0, 0.35, 0.7]
const DUR = 1.6

interface SvgPath {
  id: string; d: string; color: string
  label: string; lx: number; ly: number; live: boolean
}

function SvgOverlay({ paths, w, h }: { paths: SvgPath[]; w: number; h: number }) {
  const markers = [
    { id: 'arr-blue',   color: '#3b82f6' },
    { id: 'arr-purple', color: '#8b5cf6' },
    { id: 'arr-amber',  color: '#f59e0b' },
    { id: 'arr-blue-d', color: '#1e2f4a' },
    { id: 'arr-purple-d', color: '#3b2467' },
    { id: 'arr-amber-d',  color: '#4a3100' },
  ]

  function markerId(color: string, live: boolean): string {
    const base = color === '#8b5cf6' ? 'purple' : color === '#f59e0b' ? 'amber' : 'blue'
    return `arr-${base}${live ? '' : '-d'}`
  }

  return (
    <svg style={{ position:'absolute', left:0, top:0, width:w, height:h, pointerEvents:'none', overflow:'visible', zIndex:0 }}>
      <defs>
        {markers.map(m => (
          <marker key={m.id} id={m.id} markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L8,3.5 z" fill={m.color} />
          </marker>
        ))}
      </defs>

      {paths.map(p => {
        const mid = markerId(p.color, p.live)
        return (
          <g key={p.id}>
            {/* Base path */}
            <path d={p.d} fill="none"
              stroke={p.live ? `${p.color}38` : '#1e2d4545'}
              strokeWidth={1.5}
              markerEnd={`url(#${mid})`}
            />

            {/* Animated dashes when live */}
            {p.live && (
              <path d={p.d} fill="none"
                stroke={p.color} strokeWidth={1.5} strokeOpacity={0.55}
                strokeDasharray="6 5"
                style={{ animation:`dashFlow ${DUR}s linear infinite` }}
                markerEnd={`url(#${mid})`}
              />
            )}

            {/* Particles when live */}
            {p.live && PARTICLES.map((off, i) => (
              <circle key={i} r={2.5} fill={p.color} style={{ filter:`drop-shadow(0 0 4px ${p.color})` }}>
                <animateMotion dur={`${DUR}s`} begin={`${-off * DUR}s`} repeatCount="indefinite" path={p.d} />
                <animate attributeName="opacity" values="0;1;1;0" dur={`${DUR}s`} begin={`${-off * DUR}s`} repeatCount="indefinite" />
              </circle>
            ))}

            {/* Label */}
            {p.label && (() => {
              const bg = p.live ? p.color + '18' : 'transparent'
              return (
                <g transform={`translate(${p.lx},${p.ly})`}>
                  <rect x={-p.label.length * 3.2} y={-8} width={p.label.length * 6.4} height={14}
                    rx={3} fill="#07070f" stroke={p.live ? p.color + '30' : 'rgba(255,255,255,.05)'} strokeWidth={1} />
                  <text textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'SF Mono','Fira Code',monospace" fontSize={9.5}
                    fill={p.live ? p.color : '#334155'}>
                    {p.label}
                  </text>
                </g>
              )
            })()}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────────

const SECRET_PAT = /secret|password|token|key|pwd|pass|auth|private|credential/i

function DetailPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const col       = ROLE[node.role]
  const statuses  = useStore(s => s.statuses)
  const groups    = useStore(s => s.groups)
  const appendLog = useStore(s => s.appendLog)
  const setStatus = useStore(s => s.setStatus)
  const openLog   = useStore(s => s.openLog)
  const [showSecrets, setShowSecrets] = useState(false)
  const [launching, setLaunching]     = useState<string | null>(null)

  const project    = groups.flatMap(g => g.projects).find(p => p.id === node.id)
  const scriptKeys = project ? Object.keys(project.scripts) : []
  const envEntries = Object.entries(node.envVars)
  const isRunning  = scriptKeys.some(s => statuses[`${node.id}:${s}`] === 'running')

  const handleStart = async (sk: string) => {
    if (!project) return
    setLaunching(sk)
    const key = `${project.id}:${sk}`
    setStatus(key, 'running')
    appendLog(key, { type:'system', data:`▶ ${sk}…`, timestamp:Date.now() })
    openLog(key)
    await window.electronAPI.startProcess(project.id, project.path, sk, project.scripts[sk])
    setLaunching(null)
  }
  const handleStop = async (sk: string) => {
    if (!project) return
    const key = `${project.id}:${sk}`
    setStatus(key, 'stopped')
    appendLog(key, { type:'system', data:'■ Stopped', timestamp:Date.now() })
    await window.electronAPI.stopProcess(project.id, sk)
  }

  return (
    <div style={{ width:280, flexShrink:0, background:'#0c0c18', borderLeft:`1px solid ${col.border}30`, display:'flex', flexDirection:'column', overflow:'hidden', animation:'slideIn 0.15s ease-out' }}>
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${col.border}20`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:`${col.border}18`, border:`1px solid ${col.border}40`, color:col.text, fontWeight:700 }}>{col.label}</span>
        <span style={{ fontWeight:700, fontSize:13, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.label}</span>
        {isRunning && <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }} />}
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14, padding:0 }}>✕</button>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {node.path && (
          <Sec title="Path" color={col.border}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:10, color:'#475569', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>{node.path}</span>
              <Btn bg="#1e2d45" color="#64748b" onClick={() => window.electronAPI.openInFinder(node.path)}>Finder</Btn>
            </div>
          </Sec>
        )}
        {node.port && (
          <Sec title="Port" color={col.border}>
            <span style={{ fontSize:11, fontFamily:'monospace', color:col.text }}>:{node.port}</span>
          </Sec>
        )}
        {node.tech.length > 0 && (
          <Sec title="Stack" color={col.border}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {node.tech.map(t => {
                const ts = getTech(t)
                return <span key={t} style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:ts.bg, border:`1px solid ${ts.border}`, color:ts.text }}>{ts.label}</span>
              })}
            </div>
          </Sec>
        )}
        {scriptKeys.length > 0 && (
          <Sec title="Scripts" color={col.border}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {scriptKeys.map(sk => {
                const key     = `${node.id}:${sk}`
                const running = statuses[key] === 'running'
                return (
                  <div key={sk} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 7px', borderRadius:6, background:running?'#10b98110':'#ffffff05', border:`1px solid ${running?'#10b98130':'#ffffff08'}` }}>
                    {running && <span style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:'#cbd5e1' }}>{sk}</div>
                      <div style={{ fontSize:9, color:'#334155', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project?.scripts[sk]}</div>
                    </div>
                    {running
                      ? <Btn bg="#1a0505" color="#ef4444" onClick={() => handleStop(sk)}>■</Btn>
                      : <Btn bg="#051a0a" color="#10b981" onClick={() => handleStart(sk)} disabled={launching===sk}>{launching===sk?'…':'▶'}</Btn>
                    }
                  </div>
                )
              })}
            </div>
          </Sec>
        )}
        {envEntries.length > 0 && (
          <Sec title="Env" color={col.border} action={
            <button onClick={() => setShowSecrets(v=>!v)} style={{ fontSize:9, background:'none', border:'none', color:'#475569', cursor:'pointer', padding:0 }}>
              {showSecrets?'hide':'reveal'}
            </button>
          }>
            <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
              {envEntries.map(([k,v]) => (
                <div key={k} style={{ display:'flex', gap:5, fontSize:9, fontFamily:'monospace', padding:'2px 0' }}>
                  <span style={{ color:col.text, flexShrink:0, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k}</span>
                  <span style={{ color:'#1e2d45' }}>=</span>
                  <span style={{ color: SECRET_PAT.test(k) && !showSecrets ? '#1e2d45' : '#475569', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {SECRET_PAT.test(k) && !showSecrets ? '••••••••' : v}
                  </span>
                </div>
              ))}
            </div>
          </Sec>
        )}
      </div>
    </div>
  )
}

function Sec({ title, color, action, children }: { title:string; color:string; action?:React.ReactNode; children:React.ReactNode }) {
  return (
    <div style={{ padding:'8px 12px', borderBottom:'1px solid #0a0a14' }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color }}>{title}</span>
        {action && <span style={{ marginLeft:'auto' }}>{action}</span>}
      </div>
      {children}
    </div>
  )
}

function Btn({ bg, color, onClick, disabled, children }: { bg:string; color:string; onClick?:()=>void; disabled?:boolean; children:React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:bg, border:`1px solid ${color}30`, color, cursor:'pointer', flexShrink:0 }}>
      {children}
    </button>
  )
}

// ─── Minimap ───────────────────────────────────────────────────────────────

function Minimap({ nodes, positions, pan, zoom, viewW, viewH }: {
  nodes: GraphNode[]; positions: Record<string, { x:number; y:number }>
  pan:{ x:number; y:number }; zoom:number; viewW:number; viewH:number
}) {
  const W = 130, H = 80
  if (!nodes.length) return null

  const allX = nodes.map(n => positions[n.id]?.x ?? 0)
  const allY = nodes.map(n => positions[n.id]?.y ?? 0)
  const minX = Math.min(...allX) - 20
  const minY = Math.min(...allY) - 20
  const maxX = Math.max(...allX) + 240
  const maxY = Math.max(...allY) + 240
  const ww = maxX - minX || 1
  const hh = maxY - minY || 1
  const s  = Math.min(W / ww, H / hh)

  // Viewport rect in world space
  const vpX = -pan.x / zoom
  const vpY = -pan.y / zoom
  const vpW = viewW / zoom
  const vpH = viewH / zoom

  return (
    <div style={{ position:'absolute', bottom:64, left:16, background:'rgba(10,10,20,.9)', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'6px 8px', zIndex:20, pointerEvents:'none' }}>
      <div style={{ fontSize:8, color:'#334155', fontWeight:700, letterSpacing:'0.06em', marginBottom:4 }}>MINIMAP</div>
      <svg width={W} height={H}>
        {nodes.map(n => {
          const p = positions[n.id]; if (!p) return null
          const col = ROLE[n.role].border
          return (
            <rect key={n.id}
              x={(p.x - minX)*s} y={(p.y - minY)*s}
              width={Math.max(220*s, 4)} height={Math.max(8, 4)}
              rx={2} fill={`${col}25`} stroke={col} strokeWidth={0.5}
            />
          )
        })}
        {/* viewport indicator */}
        <rect
          x={(vpX - minX)*s} y={(vpY - minY)*s}
          width={vpW*s} height={vpH*s}
          rx={2} fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.2)" strokeWidth={0.75}
        />
      </svg>
    </div>
  )
}

// ─── Group Canvas ──────────────────────────────────────────────────────────

function GroupCanvas({ groupId, allNodes, allEdges }: { groupId:string; allNodes:GraphNode[]; allEdges:GraphEdge[] }) {
  const statuses = useStore(s => s.statuses)
  const [selected, setSelected] = useState<GraphNode | null>(null)

  const groupNodes = allNodes.filter(n => n.groupId === groupId)
  const groupIds   = new Set(groupNodes.map(n => n.id))
  const groupEdges = allEdges.filter(e => groupIds.has(e.source) && groupIds.has(e.target))

  // TCP port reachability for infra nodes (DB, cache, storage)
  const [portLive, setPortLive] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const infraNodes = groupNodes.filter(n => n.port && (n.id.startsWith('db-') || n.role === 'database' || n.role === 'cache'))
    if (!infraNodes.length) return
    const probe = async () => {
      const ports = infraNodes.map(n => n.port!)
      const result = await window.electronAPI.checkPorts(ports)
      const byId: Record<string, boolean> = {}
      for (const n of infraNodes) byId[n.id] = result[n.port!] ?? false
      setPortLive(byId)
    }
    probe()
    const interval = setInterval(probe, 5000)
    return () => clearInterval(interval)
  }, [groupId])

  const [pan,  setPan]  = useState({ x: 80, y: 60 })
  const [zoom, setZoom] = useState(1)
  const [positions, setPositions] = useState<Record<string, { x:number; y:number }>>(() => buildPositions(groupNodes))

  const cardEls   = useRef<Record<string, HTMLDivElement | null>>({})
  const cardSizes = useRef<Record<string, { w:number; h:number }>>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [viewSize, setViewSize] = useState({ w: 1200, h: 700 })

  // Drag refs (no state to avoid re-renders during drag)
  const panDrag  = useRef<{ sx:number; sy:number; px:number; py:number } | null>(null)
  const cardDrag = useRef<{ id:string; sx:number; sy:number; ox:number; oy:number; moved:boolean } | null>(null)

  // isRunning: DevLauncher process OR TCP port reachable (for infra nodes)
  const isRunning = useCallback((id: string) =>
    Object.entries(statuses).some(([k, v]) => k.startsWith(id + ':') && v === 'running') || portLive[id] === true,
  [statuses, portLive])

  // Measure view size
  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      setViewSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // Measure card sizes after render
  useLayoutEffect(() => {
    for (const [id, el] of Object.entries(cardEls.current)) {
      if (el) cardSizes.current[id] = { w: el.offsetWidth, h: el.offsetHeight }
    }
  })

  // Compute SVG paths
  const svgPaths: SvgPath[] = groupEdges.flatMap(edge => {
    const sp  = positions[edge.source]
    const tp  = positions[edge.target]
    const ss  = cardSizes.current[edge.source] ?? { w:220, h:180 }
    const ts  = cardSizes.current[edge.target] ?? { w:220, h:180 }
    if (!sp || !tp) return []

    const sx = sp.x + ss.w
    const sy = sp.y + ss.h / 2
    const tx = tp.x
    const ty = tp.y + ts.h / 2
    const dx = Math.abs(tx - sx) * 0.5

    const d    = `M${sx},${sy} C${sx+dx},${sy} ${tx-dx},${ty} ${tx-6},${ty}`
    const live = isRunning(edge.source) && isRunning(edge.target)
    const color = edgeColor(edge.label)

    return [{ id:`${edge.source}-${edge.target}`, d, color, label:edge.label, lx:(sx+tx)/2, ly:(sy+ty)/2 - 14, live }]
  })

  // Canvas size for SVG
  const canvasW = Math.max(...groupNodes.map(n => (positions[n.id]?.x ?? 0) + 260), 900)
  const canvasH = Math.max(...groupNodes.map(n => (positions[n.id]?.y ?? 0) + 260), 600)

  // Mouse handlers
  const onBgDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    panDrag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    setSelected(null)
  }

  const onCardDragStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const pos = positions[id] ?? { x:0, y:0 }
    cardDrag.current = { id, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (cardDrag.current) {
        const dx = (e.clientX - cardDrag.current.sx) / zoom
        const dy = (e.clientY - cardDrag.current.sy) / zoom
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) cardDrag.current.moved = true
        const { id, ox, oy } = cardDrag.current
        setPositions(p => ({ ...p, [id]: { x: ox + dx, y: oy + dy } }))
      } else if (panDrag.current) {
        const dx = e.clientX - panDrag.current.sx
        const dy = e.clientY - panDrag.current.sy
        setPan({ x: panDrag.current.px + dx, y: panDrag.current.py + dy })
      }
    }
    const onUp = () => { cardDrag.current = null; panDrag.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [zoom])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor  = e.deltaY < 0 ? 1.12 : 0.9
    const newZoom = Math.max(0.15, Math.min(3, zoom * factor))
    const rect    = wrapperRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setPan(p => ({ x: mx - (mx - p.x) * (newZoom / zoom), y: my - (my - p.y) * (newZoom / zoom) }))
    setZoom(newZoom)
  }

  const fitView = () => {
    const nodes = groupNodes
    if (!nodes.length) return
    const allX = nodes.map(n => positions[n.id]?.x ?? 0)
    const allY = nodes.map(n => positions[n.id]?.y ?? 0)
    const minX = Math.min(...allX), minY = Math.min(...allY)
    const maxX = Math.max(...allX) + 240, maxY = Math.max(...allY) + 220
    const fw = viewSize.w / (maxX - minX + 80)
    const fh = viewSize.h / (maxY - minY + 80)
    const fz = Math.min(fw, fh, 1.2)
    setZoom(fz)
    setPan({ x: (viewSize.w - (maxX - minX) * fz) / 2 - minX * fz, y: (viewSize.h - (maxY - minY) * fz) / 2 - minY * fz })
  }

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
      <div
        ref={wrapperRef}
        style={{ flex:1, position:'relative', overflow:'hidden', background:'#07070f', cursor: panDrag.current ? 'grabbing' : 'default' }}
        onMouseDown={onBgDown}
        onWheel={onWheel}
      >
        {/* Dot grid background */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:`radial-gradient(circle, rgba(30,45,61,0.6) 1px, transparent 1px)`,
          backgroundSize:`${32 * zoom}px ${32 * zoom}px`,
          backgroundPosition:`${pan.x % (32*zoom)}px ${pan.y % (32*zoom)}px`,
        }} />

        {/* Pan/zoom container */}
        <div style={{ position:'absolute', inset:0, transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'0 0' }}>
          <SvgOverlay paths={svgPaths} w={canvasW} h={canvasH} />
          {groupNodes.map(n => (
            <ServiceCard
              key={n.id}
              node={n}
              pos={positions[n.id] ?? { x:0, y:0 }}
              isRunning={isRunning(n.id)}
              selected={selected?.id === n.id}
              onSelect={node => {
                if (!cardDrag.current?.moved) setSelected(node)
              }}
              onDragStart={onCardDragStart}
              cardRef={el => { cardEls.current[n.id] = el }}
            />
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position:'absolute', bottom:16, right:16, display:'flex', flexDirection:'column', gap:4, zIndex:20 }}>
          {([['＋', () => setZoom(z => Math.min(3, z*1.2))], ['−', () => setZoom(z => Math.max(0.15, z*0.85))], ['⊙', fitView]] as [string, ()=>void][]).map(([lbl, fn]) => (
            <button key={lbl} className="pm-zoom-btn" onClick={fn} style={{
              width:32, height:32, borderRadius:6,
              border:'1px solid rgba(255,255,255,.07)',
              background:'rgba(12,12,24,.85)', color:'#475569',
              cursor:'pointer', fontSize: lbl==='⊙'?14:18, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Zoom level badge */}
        <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', fontSize:9, color:'#1e2d45', fontFamily:'monospace', zIndex:20, pointerEvents:'none' }}>
          {Math.round(zoom * 100)}%
        </div>

        <Minimap nodes={groupNodes} positions={positions} pan={pan} zoom={zoom} viewW={viewSize.w} viewH={viewSize.h} />
      </div>

      {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Root component ────────────────────────────────────────────────────────

export default function ProjectMap({ focusGroupId }: { focusGroupId?: string | null }) {
  const [allNodes, setAllNodes] = useState<GraphNode[]>([])
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const g = await window.electronAPI.getProjectGraph() as { nodes:GraphNode[]; edges:GraphEdge[] }
        setAllNodes(g.nodes); setAllEdges(g.edges)
        setActiveTab(focusGroupId ?? g.nodes.find(n => n.groupId)?.groupId ?? null)
      } catch (e) { setError(String(e)) }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => { if (focusGroupId) setActiveTab(focusGroupId) }, [focusGroupId])

  if (loading) return <Center c="#334155">Building graph…</Center>
  if (error)   return <Center c="#ef4444">{error}</Center>

  const allGroups: { id:string; name:string }[] = []
  const seen = new Set<string>()
  for (const n of allNodes) {
    if (n.groupId && !seen.has(n.groupId)) {
      seen.add(n.groupId)
      allGroups.push({ id:n.groupId, name:n.groupName ?? n.groupId })
    }
  }
  const groups = focusGroupId ? allGroups.filter(g => g.id === focusGroupId) : allGroups

  return (
    <div style={{ height:'100%', width:'100%', background:'#07070f', display:'flex', flexDirection:'column' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,.05)', flexShrink:0, background:'rgba(255,255,255,.01)' }}>
        <div style={{ padding:'8px 16px 0', display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981', animation:'cdotPulse 2s infinite' }} />
            <span style={{ fontWeight:800, fontSize:13, letterSpacing:'-0.3px', background:'linear-gradient(90deg,#fff 60%,#10b981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>MAP</span>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {(Object.entries(ROLE) as [NodeRole, typeof ROLE[NodeRole]][]).map(([role, c]) => (
              <span key={role} style={{ fontSize:10, color:c.text, display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:c.border, display:'inline-block' }} />
                {c.label}
              </span>
            ))}
          </div>
          <span style={{ marginLeft:'auto', fontSize:9.5, color:'#1e2d45', fontFamily:'monospace' }}>
            DB → backend → frontend · scroll to zoom · drag to pan
          </span>
        </div>

        <div style={{ display:'flex', paddingLeft:8, paddingTop:4, overflowX:'auto' }}>
          {groups.map(g => {
            const active = activeTab === g.id
            const count  = allNodes.filter(n => n.groupId === g.id && !n.id.startsWith('db-')).length
            return (
              <button key={g.id} onClick={() => setActiveTab(g.id)} style={{
                padding:'5px 14px', fontSize:11,
                fontWeight: active ? 600 : 400,
                color: active ? '#cbd5e1' : '#475569',
                background: active ? 'rgba(15,26,42,.8)' : 'transparent',
                border:'none', borderBottom:`2px solid ${active ? '#3b82f6' : 'transparent'}`,
                cursor:'pointer', whiteSpace:'nowrap',
                display:'flex', alignItems:'center', gap:5, transition:'all 0.12s',
              }}>
                {g.name}
                <span style={{ fontSize:9, padding:'0 4px', borderRadius:6, background:active?'#3b82f618':'#ffffff08', color:active?'#64748b':'#334155' }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {activeTab
        ? <GroupCanvas key={activeTab} groupId={activeTab} allNodes={allNodes} allEdges={allEdges} />
        : <Center c="#1e2d45">No projects</Center>
      }
    </div>
  )
}

function Center({ c, children }: { c:string; children:React.ReactNode }) {
  return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:c, fontSize:12 }}>{children}</div>
}
