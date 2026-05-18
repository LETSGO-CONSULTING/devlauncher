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
  id:      string
  label:   string
  role:    NodeRole
  path:    string
  port?:   number
  tech:    string[]
  envVars: Record<string, string>
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
  if (l.includes('mongo') || l.includes('redis'))             return '#a855f7'
  if (l.includes('database') || l.includes('postgres') || l.includes('mysql')) return '#ec4899'
  if (l.includes('supabase') || l.includes('firebase'))       return '#f59e0b'
  return '#3b82f6'
}

// ─── Animated Energy Edge ──────────────────────────────────────────────────

const PARTICLES = [0, 0.33, 0.66]

function EnergyEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps) {
  const label = (data as { label?: string })?.label ?? ''
  const color = edgeColor(label)
  const dur   = 1.8

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: `${color}30`, strokeWidth: 1.5 }} />
      <path
        d={edgePath} fill="none"
        stroke={color} strokeWidth={2} strokeOpacity={0.6}
        strokeDasharray="6 10"
        style={{ animation: `dashFlow ${dur}s linear infinite` }}
      />
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
          background: '#0b1120cc',
          padding: '1px 5px', borderRadius: 4,
          border: `1px solid ${color}40`,
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }} className="nodrag nopan">
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { energy: EnergyEdge }

// ─── Node builder ──────────────────────────────────────────────────────────

function makeFlowNode(g: GraphNode, index: number, total: number): Node {
  const col    = ROLE_COLOR[g.role]
  const angle  = (index / Math.max(total, 1)) * Math.PI * 2
  const radius = total <= 3 ? 180 : Math.min(total * 55, 320)
  const cx     = Math.cos(angle) * radius + 420
  const cy     = Math.sin(angle) * radius + 280

  return {
    id: g.id, type: 'default',
    position: { x: cx, y: cy },
    data: {
      role: g.role,
      graphNode: g,
      label: (
        <div style={{ textAlign: 'center', padding: '6px 10px' }}>
          <div style={{ fontSize: 22, marginBottom: 3 }}>{ROLE_ICON[g.role]}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: col.text }}>{g.label}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
            {g.role}{g.port ? ` · :${g.port}` : ''}
          </div>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            {g.tech.slice(0, 3).map(t => (
              <span key={t} style={{
                fontSize: 9, padding: '1px 5px',
                background: `${col.border}22`,
                border: `1px solid ${col.border}44`,
                borderRadius: 4, color: col.text,
              }}>{t}</span>
            ))}
          </div>
        </div>
      ),
    },
    style: {
      background: col.bg, border: `1.5px solid ${col.border}`,
      borderRadius: 14, color: col.text, minWidth: 130,
      boxShadow: `0 0 16px ${col.glow}, 0 0 4px ${col.border}60`,
      animation: 'nodePulse 3s ease-in-out infinite',
    },
  }
}

function makeFlowEdge(g: GraphEdge, index: number): Edge {
  return {
    id: `e-${index}`, source: g.source, target: g.target,
    type: 'energy', data: { label: g.label },
  }
}

// ─── Detail Panel ──────────────────────────────────────────────────────────

const SECRET_KEYS = /secret|password|token|key|pwd|pass|auth|private|credential/i

interface DetailPanelProps {
  node: GraphNode
  onClose: () => void
}

function DetailPanel({ node, onClose }: DetailPanelProps) {
  const col      = ROLE_COLOR[node.role]
  const statuses = useStore(s => s.statuses)
  const groups   = useStore(s => s.groups)
  const appendLog = useStore(s => s.appendLog)
  const setStatus = useStore(s => s.setStatus)
  const openLog   = useStore(s => s.openLog)

  const [showSecrets, setShowSecrets] = useState(false)
  const [launching, setLaunching]     = useState<string | null>(null)

  // Find matching project in store (DB/cache nodes have no store entry)
  const project = groups.flatMap(g => g.projects).find(p => p.id === node.id)

  const envEntries = Object.entries(node.envVars)
  const hasEnv     = envEntries.length > 0

  const scriptKeys  = project ? Object.keys(project.scripts) : []
  const runningKeys = scriptKeys.filter(s => statuses[`${node.id}:${s}`] === 'running')
  const isRunning   = runningKeys.length > 0

  const handleStart = async (scriptKey: string) => {
    if (!project) return
    const cmd = project.scripts[scriptKey]
    setLaunching(scriptKey)
    const key = `${project.id}:${scriptKey}`
    setStatus(key, 'running')
    appendLog(key, { type: 'system', data: `▶ Starting ${scriptKey}…`, timestamp: Date.now() })
    openLog(key)
    await window.electronAPI.startProcess(project.id, project.path, scriptKey, cmd, project.nodeVersion, project.javaVersion)
    setLaunching(null)
  }

  const handleStop = async (scriptKey: string) => {
    if (!project) return
    const key = `${project.id}:${scriptKey}`
    setStatus(key, 'stopped')
    appendLog(key, { type: 'system', data: '■ Stopped', timestamp: Date.now() })
    await window.electronAPI.stopProcess(project.id, scriptKey)
  }

  const handleOpenFinder = () => {
    if (node.path) window.electronAPI.openInFinder(node.path)
  }

  const maskSecret = (val: string) =>
    showSecrets ? val : val.slice(0, 4) + '••••••••' + val.slice(-2)

  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: '#0c1829',
      borderLeft: `1px solid ${col.border}40`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideIn 0.18s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${col.border}30`,
        background: `${col.bg}cc`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ fontSize: 28 }}>{ROLE_ICON[node.role]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: col.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 10,
              background: `${col.border}22`, border: `1px solid ${col.border}66`,
              color: col.text, fontWeight: 600,
            }}>{node.role}</span>
            {node.port && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10,
                background: '#ffffff0a', border: '1px solid #ffffff18',
                color: '#9ca3af',
              }}>:{node.port}</span>
            )}
            {isRunning && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10,
                background: '#22c55e22', border: '1px solid #22c55e66',
                color: '#86efac', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'nodePulse 1s ease-in-out infinite', display: 'inline-block' }} />
                running
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 16, padding: '0 2px',
          lineHeight: 1, flexShrink: 0,
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>

        {/* Path */}
        {node.path && (
          <Section title="Path" color={col.border}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, color: '#6b7280', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }} title={node.path}>{node.path}</span>
              <button onClick={handleOpenFinder} style={smallBtnStyle('#1e2d45', '#9ca3af')}>
                Finder
              </button>
            </div>
          </Section>
        )}

        {/* Tech stack */}
        {node.tech.length > 0 && (
          <Section title="Tech Stack" color={col.border}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {node.tech.map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: `${col.border}18`,
                  border: `1px solid ${col.border}44`,
                  color: col.text,
                }}>{t}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Scripts */}
        {scriptKeys.length > 0 && (
          <Section title="Scripts" color={col.border}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scriptKeys.map(sk => {
                const key     = `${node.id}:${sk}`
                const running = statuses[key] === 'running'
                return (
                  <div key={sk} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 8,
                    background: running ? '#22c55e10' : '#ffffff06',
                    border: `1px solid ${running ? '#22c55e30' : '#ffffff10'}`,
                  }}>
                    {running && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'nodePulse 1s ease-in-out infinite', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{sk}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project?.scripts[sk]}
                      </div>
                    </div>
                    {running
                      ? <button onClick={() => handleStop(sk)} style={smallBtnStyle('#3f0a0a', '#ef4444')}>■ Stop</button>
                      : <button
                          onClick={() => handleStart(sk)}
                          disabled={launching === sk}
                          style={smallBtnStyle('#0a2e1a', '#22c55e')}
                        >
                          {launching === sk ? '…' : '▶ Run'}
                        </button>
                    }
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Env vars */}
        {hasEnv && (
          <Section
            title="Environment"
            color={col.border}
            action={
              <button onClick={() => setShowSecrets(v => !v)} style={{
                fontSize: 10, background: 'none', border: 'none',
                color: '#6b7280', cursor: 'pointer', padding: 0,
              }}>
                {showSecrets ? '🙈 hide' : '👁 reveal'}
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {envEntries.map(([k, v]) => {
                const isSecret = SECRET_KEYS.test(k)
                return (
                  <div key={k} style={{
                    display: 'flex', gap: 6, alignItems: 'center',
                    padding: '4px 6px', borderRadius: 5,
                    background: '#ffffff05',
                    fontSize: 10, fontFamily: 'monospace',
                  }}>
                    <span style={{ color: col.text, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
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

        {/* Connections info — shown for DB/cache nodes */}
        {!project && node.role !== 'unknown' && (
          <Section title="Info" color={col.border}>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              External {node.role} service detected via environment variables in connected projects.
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function smallBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 10, padding: '2px 8px', borderRadius: 5,
    background: bg, border: `1px solid ${color}44`,
    color, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  }
}

interface SectionProps {
  title: string
  color: string
  action?: React.ReactNode
  children: React.ReactNode
}

function Section({ title, color, action, children }: SectionProps) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d4540' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color,
        }}>{title}</span>
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

export default function ProjectMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading]            = useState(true)
  const [error, setError]                = useState<string | null>(null)
  const [selected, setSelected]          = useState<GraphNode | null>(null)
  const [rawNodes, setRawNodes]          = useState<GraphNode[]>([])

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'energy', data: { label: 'custom' } }, eds)),
    [setEdges],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const graph = await window.electronAPI.getProjectGraph() as { nodes: GraphNode[]; edges: GraphEdge[] }
        setRawNodes(graph.nodes)
        setNodes(graph.nodes.map((n, i) => makeFlowNode(n, i, graph.nodes.length)))
        setEdges(graph.edges.map((e, i) => makeFlowEdge(e, i)))
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [setNodes, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const raw = rawNodes.find(n => n.id === node.id)
    setSelected(raw ?? null)
  }, [rawNodes])

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

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b1120', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid #1e2d45',
        display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Project Map</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(Object.entries(ROLE_COLOR) as [NodeRole, typeof ROLE_COLOR[NodeRole]][]).map(([role, c]) => (
            <span key={role} style={{ fontSize: 11, color: c.text, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.border, boxShadow: `0 0 6px ${c.border}`, display: 'inline-block' }} />
              {role}
            </span>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#374151' }}>
          {nodes.length} nodes · {edges.length} connections
        </span>
      </div>

      {/* Canvas + panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
            fitView
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
    </div>
  )
}
