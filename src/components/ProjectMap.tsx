import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store'

// ─── Types ─────────────────────────────────────────────────────────────────

type NodeRole = 'frontend' | 'backend' | 'fullstack' | 'database' | 'cache' | 'unknown'

interface GraphNode {
  id:         string
  label:      string
  role:       NodeRole
  path:       string
  port?:      number
  tech:       string[]
  envVars:    Record<string, string>
  groupId?:   string
  groupName?: string
}

interface GraphEdge {
  source: string
  target: string
  label:  string
}

// ─── Colors ────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<NodeRole, { bg: string; border: string; text: string; glow: string }> = {
  frontend:  { bg: '#0d2a4a', border: '#3b82f6', text: '#93c5fd', glow: '#3b82f680' },
  backend:   { bg: '#0a2e1a', border: '#22c55e', text: '#86efac', glow: '#22c55e80' },
  fullstack: { bg: '#2a1a0a', border: '#f59e0b', text: '#fcd34d', glow: '#f59e0b80' },
  database:  { bg: '#2a0a1a', border: '#ec4899', text: '#f9a8d4', glow: '#ec489980' },
  cache:     { bg: '#1a0a2a', border: '#a855f7', text: '#d8b4fe', glow: '#a855f780' },
  unknown:   { bg: '#1a1a2a', border: '#6b7280', text: '#9ca3af', glow: '#6b728080' },
}

const ROLE_ICON: Record<NodeRole, string> = {
  frontend:  '🖥',
  backend:   '⚙️',
  fullstack: '⚡',
  database:  '🗄',
  cache:     '⚡',
  unknown:   '📦',
}

function edgeColor(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('mongo') || l.includes('redis'))                           return '#a855f7'
  if (l.includes('database') || l.includes('postgres') || l.includes('mysql')) return '#ec4899'
  if (l.includes('supabase') || l.includes('firebase'))                    return '#f59e0b'
  return '#3b82f6'
}

// ─── Layout constants ──────────────────────────────────────────────────────

const NODE_W      = 150
const NODE_H      = 140
const NODE_GAP_Y  = 24
const GRP_PAD     = 40
const GRP_GAP_X   = 60
const DB_COL_X    = 9999 // resolved at runtime

// ─── Build flow nodes+edges from graph data ────────────────────────────────

function makeNodeEl(n: GraphNode): Node {
  const col = ROLE_COLOR[n.role]
  return {
    id:   n.id,
    type: 'default',
    position: { x: 0, y: 0 }, // overridden below
    data: {
      role: n.role,
      graphNode: n,
      label: (
        <div style={{ textAlign: 'center', padding: '6px 8px' }}>
          <div style={{ fontSize: 20, marginBottom: 2 }}>{ROLE_ICON[n.role]}</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: col.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
            {n.role}{n.port ? ` · :${n.port}` : ''}
          </div>
          <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            {n.tech.slice(0, 3).map(t => (
              <span key={t} style={{
                fontSize: 9, padding: '1px 4px',
                background: `${col.border}22`, border: `1px solid ${col.border}44`,
                borderRadius: 4, color: col.text,
              }}>{t}</span>
            ))}
          </div>
        </div>
      ),
    },
    style: {
      width: NODE_W,
      background: col.bg, border: `1.5px solid ${col.border}`,
      borderRadius: 12, color: col.text,
      boxShadow: `0 0 14px ${col.glow}, 0 0 4px ${col.border}60`,
      animation: 'nodePulse 3s ease-in-out infinite',
    },
  }
}

// Role → column index (left to right: frontend → fullstack → backend → db/cache at bottom)
const ROLE_COL: Record<NodeRole, number> = {
  frontend:  0,
  fullstack: 1,
  backend:   2,
  unknown:   1,
  database:  99, // bottom row
  cache:     99,
}

function buildLayout(rawNodes: GraphNode[], rawEdges: GraphEdge[]): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  const projectNodes = rawNodes.filter(n => !n.id.startsWith('db-'))
  const dbNodes      = rawNodes.filter(n => n.id.startsWith('db-'))

  // Bucket project nodes by column
  const cols = new Map<number, GraphNode[]>()
  for (const n of projectNodes) {
    const col = ROLE_COL[n.role]
    if (!cols.has(col)) cols.set(col, [])
    cols.get(col)!.push(n)
  }

  // Assign positions — each column stacks vertically
  const COL_W    = NODE_W + GRP_GAP_X
  const sortedCols = [...cols.keys()].sort((a, b) => a - b)

  // Remap sparse col indices to dense 0,1,2…
  const colIndex = new Map(sortedCols.map((c, i) => [c, i]))
  const totalCols = sortedCols.length

  for (const [colKey, nodes] of cols) {
    const ci = colIndex.get(colKey)!
    // Center the column horizontally within its slot
    const cx = ci * COL_W

    // Column label node
    if (nodes.length > 0) {
      const roleLabel = nodes[0].role.toUpperCase()
      const col = ROLE_COLOR[nodes[0].role]
      flowNodes.push({
        id: `col-label-${colKey}`,
        type: 'default',
        position: { x: cx + (NODE_W - 100) / 2, y: -38 },
        selectable: false, draggable: false,
        data: {
          label: (
            <span style={{ fontSize: 10, fontWeight: 700, color: col.border, letterSpacing: '0.07em' }}>
              {roleLabel}
            </span>
          ),
        },
        style: {
          background: `${col.border}12`,
          border: `1px solid ${col.border}30`,
          borderRadius: 6, padding: '2px 10px',
          boxShadow: 'none', width: 100,
          pointerEvents: 'none',
        },
      })
    }

    nodes.forEach((n, ni) => {
      const node = makeNodeEl(n)
      node.position = { x: cx, y: ni * (NODE_H + NODE_GAP_Y) }
      flowNodes.push(node)
    })
  }

  // DB/cache row — centered below all project columns
  const projectRowW = Math.max(totalCols - 1, 0) * COL_W + NODE_W
  const dbRowW      = Math.max(dbNodes.length - 1, 0) * (NODE_W + GRP_GAP_X)
  const dbStartX    = (projectRowW - dbRowW) / 2
  const maxColH     = Math.max(...[...cols.values()].map(ns => ns.length), 1)
  const dbY         = maxColH * (NODE_H + NODE_GAP_Y) + 80

  dbNodes.forEach((n, i) => {
    const node = makeNodeEl(n)
    node.position = { x: dbStartX + i * (NODE_W + GRP_GAP_X), y: dbY }
    flowNodes.push(node)
  })

  rawEdges.forEach((e, i) => {
    flowEdges.push({
      id: `e-${i}`, source: e.source, target: e.target,
      type: 'energy', data: { label: e.label },
    })
  })

  return { nodes: flowNodes, edges: flowEdges }
}

// ─── Animated Energy Edge ──────────────────────────────────────────────────

const PARTICLES = [0, 0.33, 0.66]

function EnergyEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const label = (data as { label?: string })?.label ?? ''
  const color = edgeColor(label)
  const dur   = 1.8

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: `${color}30`, strokeWidth: 1.5 }} />
      <path d={edgePath} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.6}
        strokeDasharray="6 10" style={{ animation: `dashFlow ${dur}s linear infinite` }} />
      <g>
        {PARTICLES.map((offset, i) => (
          <circle key={i} r={4} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
            <animateMotion dur={`${dur}s`} begin={`${-offset * dur}s`} repeatCount="indefinite" path={edgePath} />
            <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${-offset * dur}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute',
          transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
          fontSize: 10, color,
          background: '#0b1120cc', padding: '1px 5px', borderRadius: 4,
          border: `1px solid ${color}40`, pointerEvents: 'none', whiteSpace: 'nowrap',
        }} className="nodrag nopan">
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { energy: EnergyEdge }

// ─── Detail Panel ──────────────────────────────────────────────────────────

const SECRET_KEYS = /secret|password|token|key|pwd|pass|auth|private|credential/i

function DetailPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const col       = ROLE_COLOR[node.role]
  const statuses  = useStore(s => s.statuses)
  const groups    = useStore(s => s.groups)
  const appendLog = useStore(s => s.appendLog)
  const setStatus = useStore(s => s.setStatus)
  const openLog   = useStore(s => s.openLog)

  const [showSecrets, setShowSecrets] = useState(false)
  const [launching, setLaunching]     = useState<string | null>(null)

  const project    = groups.flatMap(g => g.projects).find(p => p.id === node.id)
  const envEntries = Object.entries(node.envVars)
  const scriptKeys = project ? Object.keys(project.scripts) : []
  const isRunning  = scriptKeys.some(s => statuses[`${node.id}:${s}`] === 'running')

  const handleStart = async (scriptKey: string) => {
    if (!project) return
    setLaunching(scriptKey)
    const key = `${project.id}:${scriptKey}`
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▶ Starting ${scriptKey}…`, timestamp: Date.now() })
    openLog(key)
    await window.electronAPI.startProcess(project.id, project.path, scriptKey, project.scripts[scriptKey], project.nodeVersion, project.javaVersion)
    setLaunching(null)
  }

  const handleStop = async (scriptKey: string) => {
    if (!project) return
    const key = `${project.id}:${scriptKey}`
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Stopped', timestamp: Date.now() })
    await window.electronAPI.stopProcess(project.id, scriptKey)
  }

  const maskSecret = (v: string) => showSecrets ? v : v.slice(0, 4) + '••••••' + v.slice(-2)

  return (
    <div style={{
      width: 300, flexShrink: 0,
      background: '#0c1829', borderLeft: `1px solid ${col.border}40`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'slideIn 0.18s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${col.border}30`,
        background: `${col.bg}cc`, display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ fontSize: 26 }}>{ROLE_ICON[node.role]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: col.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge color={col.border} text={col.text}>{node.role}</Badge>
            {node.port && <Badge color="#ffffff18" text="#9ca3af">:{node.port}</Badge>}
            {node.groupName && <Badge color="#1e2d45" text="#64748b">{node.groupName}</Badge>}
            {isRunning && (
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#22c55e22', border: '1px solid #22c55e66', color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'nodePulse 1s ease-in-out infinite', display: 'inline-block' }} />
                running
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>
        {node.path && (
          <Section title="Path" color={col.border}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }} title={node.path}>{node.path}</span>
              <button onClick={() => window.electronAPI.openInFinder(node.path)} style={btnStyle('#1e2d45', '#9ca3af')}>Finder</button>
            </div>
          </Section>
        )}

        {node.tech.length > 0 && (
          <Section title="Tech Stack" color={col.border}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {node.tech.map(t => (
                <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${col.border}18`, border: `1px solid ${col.border}44`, color: col.text }}>{t}</span>
              ))}
            </div>
          </Section>
        )}

        {scriptKeys.length > 0 && (
          <Section title="Scripts" color={col.border}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {scriptKeys.map(sk => {
                const key     = `${node.id}:${sk}`
                const running = statuses[key] === 'running'
                return (
                  <div key={sk} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                    background: running ? '#22c55e10' : '#ffffff06',
                    border: `1px solid ${running ? '#22c55e30' : '#ffffff10'}`,
                  }}>
                    {running && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'nodePulse 1s ease-in-out infinite', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{sk}</div>
                      <div style={{ fontSize: 9, color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project?.scripts[sk]}</div>
                    </div>
                    {running
                      ? <button onClick={() => handleStop(sk)} style={btnStyle('#3f0a0a', '#ef4444')}>■ Stop</button>
                      : <button onClick={() => handleStart(sk)} disabled={launching === sk} style={btnStyle('#0a2e1a', '#22c55e')}>{launching === sk ? '…' : '▶ Run'}</button>
                    }
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {envEntries.length > 0 && (
          <Section title="Environment" color={col.border} action={
            <button onClick={() => setShowSecrets(v => !v)} style={{ fontSize: 10, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}>
              {showSecrets ? '🙈 hide' : '👁 reveal'}
            </button>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {envEntries.map(([k, v]) => {
                const isSecret = SECRET_KEYS.test(k)
                return (
                  <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 5px', borderRadius: 4, background: '#ffffff05', fontSize: 10, fontFamily: 'monospace' }}>
                    <span style={{ color: col.text, flexShrink: 0, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
                    <span style={{ color: '#374151' }}>=</span>
                    <span style={{ color: isSecret && !showSecrets ? '#ef444488' : '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isSecret ? maskSecret(v) : v}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {!project && node.role !== 'unknown' && (
          <Section title="Info" color={col.border}>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              External {node.role} detected via env vars in connected projects.
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── Micro components ──────────────────────────────────────────────────────

function Badge({ color, text, children }: { color: string; text: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${color}22`, border: `1px solid ${color}66`, color: text }}>
      {children}
    </span>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return { fontSize: 10, padding: '2px 7px', borderRadius: 5, background: bg, border: `1px solid ${color}44`, color, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }
}

function Section({ title, color, action, children }: { title: string; color: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2d4540' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{title}</span>
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── CSS ───────────────────────────────────────────────────────────────────

const CSS = `
@keyframes dashFlow  { to { stroke-dashoffset: -32; } }
@keyframes nodePulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.18)} }
@keyframes slideIn   { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
`

// ─── Main component ────────────────────────────────────────────────────────

// ─── Per-group canvas ──────────────────────────────────────────────────────

function GroupCanvas({
  groupId, allNodes, allEdges,
}: { groupId: string; allNodes: GraphNode[]; allEdges: GraphEdge[] }) {
  const groupNodes = allNodes.filter(n => n.groupId === groupId)
  const groupEdgeTargets = new Set(groupNodes.map(n => n.id))
  const groupEdges = allEdges.filter(e => groupEdgeTargets.has(e.source) && groupEdgeTargets.has(e.target))

  const { nodes: fn, edges: fe } = buildLayout(groupNodes, groupEdges)

  const [nodes, setNodes, onNodesChange] = useNodesState(fn)
  const [edges, setEdges, onEdgesChange] = useEdgesState(fe)
  const [selected, setSelected]          = useState<GraphNode | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'energy', data: { label: 'custom' } }, eds)),
    [setEdges],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const raw = groupNodes.find(n => n.id === node.id)
    if (raw) setSelected(raw)
  }, [groupNodes])

  const projectCount    = groupNodes.filter(n => n.groupId && !n.id.startsWith('db-')).length
  const connectionCount = groupEdges.length

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Stats bar */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          display: 'flex', gap: 8, alignItems: 'center',
          background: '#0b112099', backdropFilter: 'blur(8px)',
          border: '1px solid #1e2d45', borderRadius: 8, padding: '5px 10px',
        }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{projectCount} services</span>
          <span style={{ fontSize: 11, color: '#374151' }}>·</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{connectionCount} connections</span>
        </div>

        <ReactFlow
          nodes={nodes} edges={edges}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          fitView fitViewOptions={{ padding: 0.2 }}
          colorMode="dark"
          defaultEdgeOptions={{ type: 'energy' }}
        >
          <Background color="#1e2d4530" gap={28} size={1} />
          <Controls style={{ background: '#0f1e35cc', border: '1px solid #1e2d45', borderRadius: 8 }} />
          <MiniMap
            style={{ background: '#0b1120', border: '1px solid #1e2d45', borderRadius: 8 }}
            nodeColor={(n) => ROLE_COLOR[(n.data as { role?: NodeRole }).role ?? 'unknown'].border}
            maskColor="#0b112088"
          />
        </ReactFlow>
      </div>
      {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ProjectMap() {
  const [allNodes, setAllNodes] = useState<GraphNode[]>([])
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const graph = await window.electronAPI.getProjectGraph() as { nodes: GraphNode[]; edges: GraphEdge[] }
        setAllNodes(graph.nodes)
        setAllEdges(graph.edges)
        // default to first group
        const firstGroup = graph.nodes.find(n => n.groupId)?.groupId ?? null
        setActiveTab(firstGroup)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 13 }}>
      Building graph…
    </div>
  )
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontSize: 13 }}>
      {error}
    </div>
  )

  // Unique groups in order
  const groups: { id: string; name: string }[] = []
  const seen = new Set<string>()
  for (const n of allNodes) {
    if (n.groupId && !seen.has(n.groupId)) {
      seen.add(n.groupId)
      groups.push({ id: n.groupId, name: n.groupName ?? n.groupId })
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b1120', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e2d45', flexShrink: 0 }}>
        {/* Title + legend */}
        <div style={{ padding: '8px 20px 0', display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Project Map</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(Object.entries(ROLE_COLOR) as [NodeRole, typeof ROLE_COLOR[NodeRole]][]).map(([role, c]) => (
              <span key={role} style={{ fontSize: 10, color: c.text, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.border, boxShadow: `0 0 5px ${c.border}`, display: 'inline-block' }} />
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Group tabs */}
        <div style={{ display: 'flex', gap: 0, paddingLeft: 12, paddingTop: 6, overflowX: 'auto' }}>
          {groups.map(g => {
            const active = activeTab === g.id
            const nodeCount = allNodes.filter(n => n.groupId === g.id && !n.id.startsWith('db-')).length
            return (
              <button
                key={g.id}
                onClick={() => setActiveTab(g.id)}
                style={{
                  padding: '6px 16px',
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? '#e2e8f0' : '#64748b',
                  background: active ? '#0f1e35' : 'transparent',
                  border: 'none',
                  borderTop: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
                  borderRight: '1px solid #1e2d4540',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {g.name}
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 8,
                  background: active ? '#3b82f622' : '#ffffff0a',
                  color: active ? '#93c5fd' : '#475569',
                  border: `1px solid ${active ? '#3b82f640' : '#ffffff10'}`,
                }}>{nodeCount}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Canvas for active group */}
      {activeTab && (
        <GroupCanvas
          key={activeTab}
          groupId={activeTab}
          allNodes={allNodes}
          allEdges={allEdges}
        />
      )}

      {groups.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 13 }}>
          No projects detected. Add a project first.
        </div>
      )}
    </div>
  )
}
