import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  NodeResizer,
  Handle,
  Position,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeMouseHandler,
  type NodeProps,
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

const ROLE_COLOR: Record<NodeRole, { bg: string; border: string; text: string; glow: string; label: string }> = {
  database:  { bg: '#1a0a12', border: '#ec4899', text: '#f9a8d4', glow: '#ec489940', label: 'Database' },
  cache:     { bg: '#12081a', border: '#a855f7', text: '#d8b4fe', glow: '#a855f740', label: 'Cache'    },
  backend:   { bg: '#081a0e', border: '#22c55e', text: '#86efac', glow: '#22c55e40', label: 'Backend'  },
  fullstack: { bg: '#1a120a', border: '#f59e0b', text: '#fcd34d', glow: '#f59e0b40', label: 'Fullstack'},
  frontend:  { bg: '#080f1a', border: '#3b82f6', text: '#93c5fd', glow: '#3b82f640', label: 'Frontend' },
  unknown:   { bg: '#0f0f18', border: '#475569', text: '#94a3b8', glow: '#47556940', label: 'Unknown'  },
}

// Layout: DB(0) → Backend(1) → Fullstack(2) → Frontend(3)
const ROLE_COL: Record<NodeRole, number> = {
  database:  0,
  cache:     0,
  backend:   1,
  unknown:   1,
  fullstack: 2,
  frontend:  3,
}

// ─── Custom resizable node ─────────────────────────────────────────────────

const HANDLE_STYLE: React.CSSProperties = {
  width: 8, height: 8,
  background: '#1e2d45',
  border: '1.5px solid #334155',
  borderRadius: '50%',
}

function ServiceNode({ data, selected }: NodeProps) {
  const d       = data as { graphNode: GraphNode; onSelect: (n: GraphNode) => void; isRunning: boolean }
  const n       = d.graphNode
  const col     = ROLE_COLOR[n.role]
  const running = d.isRunning

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120} minHeight={60}
        handleStyle={{ width: 7, height: 7, background: col.border, border: 'none', borderRadius: 2 }}
        lineStyle={{ borderColor: col.border, borderWidth: 1 }}
      />

      {/* Handles — all 4 sides, source+target so edges can reconnect from any side */}
      {(['Top','Right','Bottom','Left'] as const).map(pos => (
        <span key={pos}>
          <Handle type="source" position={Position[pos]} id={`s-${pos}`}
            style={{ ...HANDLE_STYLE, ...(pos==='Top'?{top:-4}:pos==='Right'?{right:-4}:pos==='Bottom'?{bottom:-4}:{left:-4}) }} />
          <Handle type="target" position={Position[pos]} id={`t-${pos}`}
            style={{ ...HANDLE_STYLE, ...(pos==='Top'?{top:-4}:pos==='Right'?{right:-4}:pos==='Bottom'?{bottom:-4}:{left:-4}) }} />
        </span>
      ))}

      <div
        onClick={() => d.onSelect(n)}
        style={{ width: '100%', height: '100%', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
      >
        {/* Name + running indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {running && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 5px #22c55e' }} />}
          <span style={{ fontWeight: 700, fontSize: 11, color: col.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {n.label}
          </span>
        </div>

        {/* Port + tech */}
        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {n.port && (
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              background: `${col.border}25`,
              border: `1px solid ${col.border}50`,
              color: col.text,
            }}>:{n.port}</span>
          )}
          {n.tech.slice(0, 2).map(t => (
            <span key={t} style={{
              fontSize: 9, padding: '0 4px',
              background: `${col.border}10`,
              border: `1px solid ${col.border}20`,
              borderRadius: 3, color: `${col.text}99`,
            }}>{t}</span>
          ))}
        </div>
      </div>
    </>
  )
}

const nodeTypes = { service: ServiceNode }

// ─── Layout constants ──────────────────────────────────────────────────────

const NODE_W     = 150
const NODE_H     = 70
const NODE_GAP_Y = 16
const COL_GAP_X  = 120
const GRP_PAD    = 32

// ─── Layout builder ────────────────────────────────────────────────────────

function buildLayout(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
  onSelect: (n: GraphNode) => void,
): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  // Bucket by column
  const cols = new Map<number, GraphNode[]>()
  for (const n of rawNodes) {
    const c = ROLE_COL[n.role]
    if (!cols.has(c)) cols.set(c, [])
    cols.get(c)!.push(n)
  }

  const sortedColKeys = [...cols.keys()].sort((a, b) => a - b)
  const colIndexMap   = new Map(sortedColKeys.map((k, i) => [k, i]))
  const COL_W         = NODE_W + COL_GAP_X

  // Max height for centering shorter columns
  const maxRows = Math.max(...[...cols.values()].map(ns => ns.length), 1)
  const totalH  = maxRows * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y

  for (const [colKey, nodes] of cols) {
    const ci  = colIndexMap.get(colKey)!
    const cx  = GRP_PAD + ci * COL_W
    const colH = nodes.length * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y
    const startY = (totalH - colH) / 2  // vertically center shorter columns

    nodes.forEach((n, ni) => {
      flowNodes.push({
        id:   n.id,
        type: 'service',
        position: { x: cx, y: GRP_PAD + startY + ni * (NODE_H + NODE_GAP_Y) },
        data: { graphNode: n, onSelect },
        style: {
          width:  NODE_W,
          height: NODE_H,
          background: ROLE_COLOR[n.role].bg,
          border: `1px solid ${ROLE_COLOR[n.role].border}`,
          borderRadius: 8,
          boxShadow: `0 0 10px ${ROLE_COLOR[n.role].glow}`,
        },
      })
    })
  }

  rawEdges.forEach((e, i) => {
    flowEdges.push({
      id: `e-${i}`, source: e.source, target: e.target,
      type: 'energy', data: { label: e.label },
    })
  })

  return { nodes: flowNodes, edges: flowEdges }
}

// ─── Edge color ────────────────────────────────────────────────────────────

function edgeColor(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('mongo') || l.includes('redis'))                                return '#a855f7'
  if (l.includes('database') || l.includes('postgres') || l.includes('mysql'))  return '#ec4899'
  if (l.includes('supabase') || l.includes('firebase'))                         return '#f59e0b'
  return '#3b82f6'
}

// ─── Animated energy edge ──────────────────────────────────────────────────

const PARTICLES = [0, 0.4, 0.7]

function isProjectRunning(nodeId: string, statuses: Record<string, string>): boolean {
  return Object.entries(statuses).some(([k, v]) => k.startsWith(nodeId + ':') && v === 'running')
}

function EnergyEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const d        = data as { label?: string }
  const label    = d.label ?? ''
  const statuses = useStore(s => s.statuses)
  const live     = isProjectRunning(source, statuses) && isProjectRunning(target, statuses)
  const color    = edgeColor(label)
  const dur      = 2

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return (
    <>
      {/* Base dim path — always visible */}
      <BaseEdge id={id} path={edgePath} style={{ stroke: live ? `${color}30` : '#1e2d4560', strokeWidth: 1 }} />

      {/* Animated dash — only when live */}
      {live && (
        <path d={edgePath} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5}
          strokeDasharray="5 8" style={{ animation: `dashFlow ${dur}s linear infinite` }} />
      )}

      {/* Particles — only when live */}
      {live && (
        <g>
          {PARTICLES.map((offset, i) => (
            <circle key={i} r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
              <animateMotion dur={`${dur}s`} begin={`${-offset * dur}s`} repeatCount="indefinite" path={edgePath} />
              <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${-offset * dur}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      )}

      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute',
          transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
          fontSize: 9, color: live ? color : '#334155',
          background: '#090e1a', padding: '1px 5px', borderRadius: 3,
          border: `1px solid ${live ? color + '30' : '#1e2d45'}`,
          pointerEvents: 'none', whiteSpace: 'nowrap',
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

  const maskSecret = (v: string) => showSecrets ? v : '••••••••'

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: '#090e1a', borderLeft: `1px solid ${col.border}30`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'slideIn 0.15s ease-out',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${col.border}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${col.border}18`, border: `1px solid ${col.border}40`, color: col.text, fontWeight: 700 }}>
          {col.label}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
        {isRunning && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px #22c55e' }} />}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {node.path && (
          <Sec title="Path" color={col.border}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{node.path}</span>
              <Btn bg="#1e2d45" color="#64748b" onClick={() => window.electronAPI.openInFinder(node.path)}>Finder</Btn>
            </div>
          </Sec>
        )}

        {node.port && (
          <Sec title="Port" color={col.border}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: col.text }}>:{node.port}</span>
          </Sec>
        )}

        {node.tech.length > 0 && (
          <Sec title="Stack" color={col.border}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {node.tech.map(t => (
                <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${col.border}14`, border: `1px solid ${col.border}30`, color: col.text }}>{t}</span>
              ))}
            </div>
          </Sec>
        )}

        {scriptKeys.length > 0 && (
          <Sec title="Scripts" color={col.border}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {scriptKeys.map(sk => {
                const key     = `${node.id}:${sk}`
                const running = statuses[key] === 'running'
                return (
                  <div key={sk} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px', borderRadius: 6,
                    background: running ? '#22c55e0a' : '#ffffff05',
                    border: `1px solid ${running ? '#22c55e20' : '#ffffff08'}`,
                  }}>
                    {running && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1' }}>{sk}</div>
                      <div style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project?.scripts[sk]}</div>
                    </div>
                    {running
                      ? <Btn bg="#1a0505" color="#ef4444" onClick={() => handleStop(sk)}>■</Btn>
                      : <Btn bg="#051a0a" color="#22c55e" onClick={() => handleStart(sk)} disabled={launching === sk}>{launching === sk ? '…' : '▶'}</Btn>
                    }
                  </div>
                )
              })}
            </div>
          </Sec>
        )}

        {envEntries.length > 0 && (
          <Sec title="Env" color={col.border} action={
            <button onClick={() => setShowSecrets(v => !v)} style={{ fontSize: 9, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0 }}>
              {showSecrets ? 'hide' : 'reveal'}
            </button>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {envEntries.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 5, fontSize: 9, fontFamily: 'monospace', padding: '2px 0' }}>
                  <span style={{ color: col.text, flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
                  <span style={{ color: '#1e2d45' }}>=</span>
                  <span style={{ color: SECRET_KEYS.test(k) && !showSecrets ? '#1e2d45' : '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {SECRET_KEYS.test(k) ? maskSecret(v) : v}
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

// ─── Micro components ──────────────────────────────────────────────────────

function Sec({ title, color, action, children }: { title: string; color: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #0f1a2a' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{title}</span>
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      {children}
    </div>
  )
}

function Btn({ bg, color, onClick, disabled, children }: { bg: string; color: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 4,
      background: bg, border: `1px solid ${color}30`,
      color, cursor: 'pointer', flexShrink: 0,
    }}>{children}</button>
  )
}

// ─── CSS ───────────────────────────────────────────────────────────────────

const CSS = `
@keyframes dashFlow  { to { stroke-dashoffset: -26; } }
@keyframes slideIn   { from { transform: translateX(16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
.react-flow__node-service { overflow: visible !important; }
.react-flow__handle { opacity: 0; transition: opacity 0.15s; }
.react-flow__node:hover .react-flow__handle { opacity: 1; }
.react-flow__node.selected .react-flow__handle { opacity: 1; }
`

// ─── Per-group canvas ──────────────────────────────────────────────────────

function GroupCanvas({ groupId, allNodes, allEdges }: { groupId: string; allNodes: GraphNode[]; allEdges: GraphEdge[] }) {
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const statuses = useStore(s => s.statuses)

  const groupNodes = allNodes.filter(n => n.groupId === groupId)
  const groupIds   = new Set(groupNodes.map(n => n.id))
  const groupEdges = allEdges.filter(e => groupIds.has(e.source) && groupIds.has(e.target))

  const onSelect = useCallback((n: GraphNode) => setSelected(n), [])

  // Determine running status per node (any script running = node is live)
  const isNodeRunning = useCallback((nodeId: string) =>
    Object.entries(statuses).some(([k, v]) => k.startsWith(nodeId + ':') && v === 'running'),
  [statuses])

  const { nodes: fn, edges: fe } = buildLayout(groupNodes, groupEdges, onSelect)

  // Inject isRunning into node data for ServiceNode dot/glow
  const fnWithStatus = fn.map(n => {
    const running = isNodeRunning(n.id)
    const role    = (n.data as { graphNode?: GraphNode }).graphNode?.role ?? 'unknown'
    return {
      ...n,
      data: { ...n.data, isRunning: running },
      style: {
        ...n.style,
        boxShadow: running
          ? `0 0 14px ${ROLE_COLOR[role].glow}, 0 0 4px ${ROLE_COLOR[role].border}60`
          : '0 0 4px #00000040',
      },
    }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(fnWithStatus)
  const [edges, setEdges, onEdgesChange] = useEdgesState(fe)

  // Sync node running status (glow + dot) when statuses change
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const running = isNodeRunning(n.id)
      const role    = (n.data as { graphNode?: GraphNode }).graphNode?.role ?? 'unknown'
      return {
        ...n,
        data: { ...n.data, isRunning: running },
        style: {
          ...n.style,
          boxShadow: running
            ? `0 0 14px ${ROLE_COLOR[role].glow}, 0 0 4px ${ROLE_COLOR[role].border}60`
            : '0 0 4px #00000040',
        },
      }
    }))
  }, [statuses, isNodeRunning, setNodes])

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    const raw = groupNodes.find(n => n.id === node.id)
    if (raw) setSelected(raw)
  }, [groupNodes])

  // Allow reconnecting existing edges to different handles, but no new connections
  const onReconnect = useCallback(
    (oldEdge: Edge, newConn: Connection) =>
      setEdges(eds => eds.map(e => e.id === oldEdge.id ? { ...e, source: newConn.source ?? e.source, target: newConn.target ?? e.target, sourceHandle: newConn.sourceHandle, targetHandle: newConn.targetHandle } : e)),
    [setEdges],
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          nodesConnectable={false}
          fitView fitViewOptions={{ padding: 0.25 }}
          colorMode="dark"
          defaultEdgeOptions={{ type: 'energy' }}
        >
          <Background color="#0f1a2a" gap={32} size={1} />
          <Controls style={{ background: '#090e1acc', border: '1px solid #1e2d45', borderRadius: 6 }} />
          <MiniMap
            style={{ background: '#090e1a', border: '1px solid #1e2d45', borderRadius: 6 }}
            nodeColor={(n) => ROLE_COLOR[(n.data as { graphNode?: GraphNode }).graphNode?.role ?? 'unknown'].border}
            maskColor="#090e1a88"
          />
        </ReactFlow>
      </div>
      {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ProjectMap({ focusGroupId }: { focusGroupId?: string | null }) {
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
        // If launched from a project button, jump straight to that group
        const defaultTab = focusGroupId ?? graph.nodes.find(n => n.groupId)?.groupId ?? null
        setActiveTab(defaultTab)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // When parent changes focusGroupId (e.g. user clicks map button on another project)
  useEffect(() => {
    if (focusGroupId) setActiveTab(focusGroupId)
  }, [focusGroupId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: 12 }}>
      Building graph…
    </div>
  )
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontSize: 12 }}>
      {error}
    </div>
  )

  // When focusGroupId set → show only that group's tab; otherwise show all
  const allGroups: { id: string; name: string }[] = []
  const seen = new Set<string>()
  for (const n of allNodes) {
    if (n.groupId && !seen.has(n.groupId)) {
      seen.add(n.groupId)
      allGroups.push({ id: n.groupId, name: n.groupName ?? n.groupId })
    }
  }
  const groups = focusGroupId
    ? allGroups.filter(g => g.id === focusGroupId)
    : allGroups

  return (
    <div style={{ height: '100%', width: '100%', background: '#090e1a', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e2d45', flexShrink: 0, background: '#090e1a' }}>
        {/* Legend + title */}
        <div style={{ padding: '8px 16px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#475569', letterSpacing: '0.05em' }}>MAP</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {(Object.entries(ROLE_COLOR) as [NodeRole, typeof ROLE_COLOR[NodeRole]][]).map(([role, c]) => (
              <span key={role} style={{ fontSize: 10, color: c.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.border, display: 'inline-block' }} />
                {c.label}
              </span>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#1e2d45', fontFamily: 'monospace' }}>
            DB → backend → frontend
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', paddingLeft: 8, paddingTop: 4, overflowX: 'auto' }}>
          {groups.map(g => {
            const active = activeTab === g.id
            const count  = allNodes.filter(n => n.groupId === g.id && !n.id.startsWith('db-')).length
            return (
              <button key={g.id} onClick={() => setActiveTab(g.id)} style={{
                padding: '5px 14px', fontSize: 11,
                fontWeight: active ? 600 : 400,
                color: active ? '#cbd5e1' : '#475569',
                background: active ? '#0f1a2acc' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
                cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.12s',
              }}>
                {g.name}
                <span style={{
                  fontSize: 9, padding: '0 4px', borderRadius: 6,
                  background: active ? '#3b82f618' : '#ffffff08',
                  color: active ? '#64748b' : '#334155',
                }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {activeTab
        ? <GroupCanvas key={activeTab} groupId={activeTab} allNodes={allNodes} allEdges={allEdges} />
        : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e2d45', fontSize: 12 }}>No projects</div>
      }
    </div>
  )
}
