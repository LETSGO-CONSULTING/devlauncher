import { Fragment, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'

// ─── Types ─────────────────────────────────────────────────────────────────

interface DockerInfo {
  version?: string; containers?: number; running?: number
  paused?: number; stopped?: number; images?: number; os?: string
}
interface Container { id: string; name: string; image: string; status: string; ports: string; state: string; composeProject: string }
interface DockerImage { repo: string; tag: string; id: string; size: string; created: string }

interface K8sPod        { metadata: { name: string; namespace: string }; status: { phase: string; podIP?: string }; spec: { nodeName?: string } }
interface K8sService    { metadata: { name: string; namespace: string }; spec: { type: string; clusterIP: string; ports?: Array<{ port: number; targetPort: unknown }> } }
interface K8sDeployment { metadata: { name: string; namespace: string }; spec: { replicas: number }; status: { readyReplicas?: number; availableReplicas?: number } }
interface K8sNode       { metadata: { name: string }; status: { conditions?: Array<{ type: string; status: string }> } }

type DockerTab = 'containers' | 'images'
type K8sTab    = 'pods' | 'services' | 'deployments' | 'nodes'
type Panel     = 'docker' | 'kubernetes'

// ─── Helpers ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="infra-stat-card">
      <div className="infra-stat-value" style={{ color }}>{value}</div>
      <div className="infra-stat-label">{label}</div>
    </div>
  )
}

function StatusBadge({ state }: { state: string }) {
  const s = state.toLowerCase()
  const color =
    s === 'running'   ? '#22c55e' :
    s === 'exited'    ? '#94a3b8' :
    s === 'created'   ? '#f59e0b' :
    s === 'paused'    ? '#f59e0b' :
    s === 'dead'      ? '#ef4444' : '#94a3b8'
  return <span className="infra-badge" style={{ color, borderColor: color + '44', background: color + '12' }}>{state}</span>
}

function K8sPhaseBadge({ phase }: { phase: string }) {
  const p = phase.toLowerCase()
  const color = p === 'running' ? '#22c55e' : p === 'pending' ? '#f59e0b' : p === 'failed' ? '#ef4444' : '#94a3b8'
  return <span className="infra-badge" style={{ color, borderColor: color + '44', background: color + '12' }}>{phase}</span>
}

// ─── Containers table (grouped by compose project) ────────────────────────

function ContainerRow({ c, onAction, onLogs }: {
  c: Container
  onAction: (action: string, id: string) => void
  onLogs: (c: Container) => void
}) {
  return (
    <tr key={c.id}>
      <td className="infra-mono">{c.name}</td>
      <td className="infra-muted" style={{ fontSize: 11 }}>{c.image}</td>
      <td><StatusBadge state={c.state} /></td>
      <td className="infra-mono infra-muted" style={{ fontSize: 11 }}>{c.ports || '—'}</td>
      <td>
        <div className="infra-actions">
          <button className="infra-act-btn" onClick={() => onLogs(c)}>📋 Logs</button>
          {c.state === 'running'
            ? <>
                <button className="infra-act-btn" onClick={() => onAction('stop', c.id)}>■ Stop</button>
                <button className="infra-act-btn" onClick={() => onAction('restart', c.id)}>↺</button>
              </>
            : <button className="infra-act-btn infra-act-green" onClick={() => onAction('start', c.id)}>▶ Start</button>
          }
          <button className="infra-act-btn infra-act-red" onClick={() => onAction('rm', c.id)}>✕</button>
        </div>
      </td>
    </tr>
  )
}

function ContainersView({ containers, onAction, onLogs }: {
  containers: Container[]
  onAction: (action: string, id: string) => void
  onLogs: (c: Container) => void
}) {
  // Group by compose project; standalone = ''
  const { groups, standalone } = useMemo(() => {
    const map: Record<string, Container[]> = {}
    const solo: Container[] = []
    for (const c of containers) {
      if (c.composeProject) {
        if (!map[c.composeProject]) map[c.composeProject] = []
        map[c.composeProject].push(c)
      } else {
        solo.push(c)
      }
    }
    return { groups: map, standalone: solo }
  }, [containers])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (name: string) => setCollapsed(s => ({ ...s, [name]: !s[name] }))

  if (containers.length === 0) return <div className="infra-empty">No containers found</div>

  const thead = (
    <thead><tr>
      <th>Name</th><th>Image</th><th>Status</th><th>Ports</th><th style={{ textAlign: 'right' }}>Actions</th>
    </tr></thead>
  )

  return (
    <div className="infra-table-wrap">
      <table className="infra-table">
        {thead}
        <tbody>
          {/* Compose groups */}
          {Object.entries(groups).map(([project, list]) => {
            const runningCount = list.filter(c => c.state === 'running').length
            const isCollapsed  = collapsed[project]
            return (
              <Fragment key={project}>
                <tr className="infra-group-row" onClick={() => toggle(project)}>
                  <td colSpan={5}>
                    <div className="infra-group-header">
                      <span className="infra-group-chevron">{isCollapsed ? '▶' : '▼'}</span>
                      <span className="infra-group-icon">🐙</span>
                      <span className="infra-group-name">{project}</span>
                      <span className="infra-group-badge">{runningCount}/{list.length} running</span>
                    </div>
                  </td>
                </tr>
                {!isCollapsed && list.map(c => <ContainerRow key={c.id} c={c} onAction={onAction} onLogs={onLogs} />)}
              </Fragment>
            )
          })}

          {/* Standalone containers */}
          {standalone.length > 0 && Object.keys(groups).length > 0 && (
            <tr className="infra-group-row">
              <td colSpan={5}>
                <div className="infra-group-header">
                  <span className="infra-group-icon">📦</span>
                  <span className="infra-group-name">Standalone</span>
                  <span className="infra-group-badge">{standalone.length}</span>
                </div>
              </td>
            </tr>
          )}
          {standalone.map(c => <ContainerRow key={c.id} c={c} onAction={onAction} onLogs={onLogs} />)}
        </tbody>
      </table>
    </div>
  )
}

// ─── Docker Panel ──────────────────────────────────────────────────────────

function DockerPanel() {
  const { openLog, setLogLabel } = useStore()
  const [info,       setInfo]       = useState<DockerInfo | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [images,     setImages]     = useState<DockerImage[]>([])
  const [tab,        setTab]        = useState<DockerTab>('containers')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [actionMsg,  setActionMsg]  = useState<{ text: string; ok: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [infoRes, containersRes, imagesRes] = await Promise.all([
        window.electronAPI.dockerInfo(),
        window.electronAPI.dockerContainers(),
        window.electronAPI.dockerImages(),
      ])
      if (infoRes.error) { setError(infoRes.error); return }
      setInfo(infoRes as DockerInfo)
      setContainers(containersRes.containers ?? [])
      setImages(imagesRes.images ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok })
    setTimeout(() => setActionMsg(null), 2500)
  }

  const containerAction = async (action: string, id: string) => {
    const res = await window.electronAPI.dockerAction(action, id)
    if (res.error) flash(res.error, false)
    else { flash(`${action} → ok`, true); load() }
  }

  const imageAction = async (action: string, id: string) => {
    const res = await window.electronAPI.dockerImageAction(action, id)
    if (res.error) flash(res.error, false)
    else { flash('Image removed', true); load() }
  }

  const streamLogs = async (container: Container) => {
    const res = await window.electronAPI.dockerContainerLogs(container.id)
    if (res.key) {
      // image name without registry prefix, e.g. "postgres:16" → "postgres:16"
      const imageName = container.image.split('/').pop() ?? container.image
      setLogLabel(res.key, { name: container.name, script: imageName })
      openLog(res.key)
    } else {
      flash(res.error ?? 'Failed', false)
    }
  }

  if (error) return (
    <div className="infra-error">
      <div className="infra-error-icon">🐳</div>
      <div className="infra-error-title">Docker not available</div>
      <div className="infra-error-body">{error}</div>
      <button className="infra-retry-btn" onClick={load}>Retry</button>
    </div>
  )

  return (
    <div className="infra-panel">
      {/* Header */}
      <div className="infra-panel-header">
        <div className="infra-panel-title">
          <span style={{ fontSize: 20 }}>🐳</span>
          <span>Docker</span>
          {info && <span className="infra-version-badge">v{info.version}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {actionMsg && <span style={{ fontSize: 12, color: actionMsg.ok ? '#22c55e' : '#ef4444' }}>{actionMsg.text}</span>}
          <button className="infra-refresh-btn" onClick={load} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
        </div>
      </div>

      {/* Stats */}
      {info && (
        <div className="infra-stats-row">
          <StatCard label="Running"   value={info.running  ?? 0} color="#22c55e" />
          <StatCard label="Stopped"   value={info.stopped  ?? 0} color="#94a3b8" />
          <StatCard label="Paused"    value={info.paused   ?? 0} color="#f59e0b" />
          <StatCard label="Images"    value={info.images   ?? 0} color="#2496ED" />
        </div>
      )}

      {/* Tabs */}
      <div className="infra-tabs">
        {(['containers', 'images'] as DockerTab[]).map(t => (
          <button key={t} className={`infra-tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="infra-tab-count">{t === 'containers' ? containers.length : images.length}</span>
          </button>
        ))}
      </div>

      {/* Containers table — grouped by compose project */}
      {tab === 'containers' && <ContainersView containers={containers} onAction={containerAction} onLogs={streamLogs} />}

      {/* Images table */}
      {tab === 'images' && (
        <div className="infra-table-wrap">
          {images.length === 0
            ? <div className="infra-empty">No images found</div>
            : (
              <table className="infra-table">
                <thead><tr>
                  <th>Repository</th><th>Tag</th><th>ID</th><th>Size</th><th>Created</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {images.map(img => (
                    <tr key={img.id}>
                      <td className="infra-mono">{img.repo}</td>
                      <td><span className="infra-tag">{img.tag}</span></td>
                      <td className="infra-mono infra-muted" style={{ fontSize: 11 }}>{img.id.slice(0, 12)}</td>
                      <td className="infra-muted">{img.size}</td>
                      <td className="infra-muted">{img.created}</td>
                      <td>
                        <div className="infra-actions">
                          <button className="infra-act-btn infra-act-red" onClick={() => imageAction('rmi', img.id)}>✕ Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── Kubernetes Panel ──────────────────────────────────────────────────────

function KubernetesPanel() {
  const { openLog, setLogLabel } = useStore()
  const [found,       setFound]       = useState<boolean | null>(null)
  const [k8sVersion,  setK8sVersion]  = useState('')
  const [contexts,    setContexts]    = useState<string[]>([])
  const [currentCtx,  setCurrentCtx]  = useState('')
  const [namespaces,  setNamespaces]  = useState<string[]>([])
  const [namespace,   setNamespace]   = useState('default')
  const [tab,         setTab]         = useState<K8sTab>('pods')
  const [items,       setItems]       = useState<unknown[]>([])
  const [loading,     setLoading]     = useState(false)
  const [actionMsg,   setActionMsg]   = useState<{ text: string; ok: boolean } | null>(null)
  const [scaleTarget, setScaleTarget] = useState<{ name: string; ns: string; current: number } | null>(null)
  const [scaleVal,    setScaleVal]    = useState(1)

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok })
    setTimeout(() => setActionMsg(null), 2500)
  }

  useEffect(() => {
    window.electronAPI.kubectlCheck().then(r => {
      setFound(r.found)
      if (r.found) {
        setK8sVersion(r.version ?? '')
        loadContexts()
      }
    })
  }, [])

  const loadContexts = async () => {
    const r = await window.electronAPI.kubectlContexts()
    if (r.contexts) { setContexts(r.contexts); setCurrentCtx(r.current ?? '') }
    const nsRes = await window.electronAPI.kubectlNamespaces()
    if (nsRes.namespaces) setNamespaces(nsRes.namespaces)
  }

  const switchContext = async (ctx: string) => {
    const r = await window.electronAPI.kubectlUseContext(ctx)
    if (r.success) { setCurrentCtx(ctx); loadResources(tab, namespace) }
    else flash(r.error ?? 'Failed', false)
  }

  const loadResources = async (resource: K8sTab, ns: string) => {
    setLoading(true)
    const r = await window.electronAPI.kubectlGet(resource, ns === 'all' ? undefined : ns)
    setItems(r.items ?? [])
    if (r.error) flash(r.error, false)
    setLoading(false)
  }

  useEffect(() => {
    if (found) loadResources(tab, namespace)
  }, [tab, namespace, found])

  const streamPodLogs = async (pod: K8sPod) => {
    const r = await window.electronAPI.kubectlPodLogs(pod.metadata.name, pod.metadata.namespace)
    if (r.key) {
      setLogLabel(r.key, { name: pod.metadata.name, script: pod.metadata.namespace })
      openLog(r.key)
    } else {
      flash(r.error ?? 'Failed', false)
    }
  }

  const deletePod = async (pod: K8sPod) => {
    const r = await window.electronAPI.kubectlPodAction('delete', pod.metadata.name, pod.metadata.namespace)
    if (r.success) { flash('Pod deleted (will restart)', true); loadResources(tab, namespace) }
    else flash(r.error ?? 'Failed', false)
  }

  const doScale = async () => {
    if (!scaleTarget) return
    const r = await window.electronAPI.kubectlScale(scaleTarget.name, scaleTarget.ns, scaleVal)
    if (r.success) { flash(`Scaled to ${scaleVal}`, true); loadResources(tab, namespace) }
    else flash(r.error ?? 'Failed', false)
    setScaleTarget(null)
  }

  if (found === false) return (
    <div className="infra-error">
      <div className="infra-error-icon">☸</div>
      <div className="infra-error-title">kubectl not found</div>
      <div className="infra-error-body">Install kubectl and make sure it's in your PATH.</div>
      <button className="infra-retry-btn" onClick={() => window.electronAPI.openExternal('https://kubernetes.io/docs/tasks/tools/')}>
        Install kubectl
      </button>
    </div>
  )

  if (found === null) return <div className="infra-loading">Checking kubectl…</div>

  const pods        = items as K8sPod[]
  const services    = items as K8sService[]
  const deployments = items as K8sDeployment[]
  const nodes       = items as K8sNode[]

  return (
    <div className="infra-panel">
      {/* Scale modal */}
      {scaleTarget && (
        <div className="upgrade-overlay" onClick={() => setScaleTarget(null)}>
          <div className="infra-scale-modal" onClick={e => e.stopPropagation()}>
            <div className="infra-scale-title">Scale — {scaleTarget.name}</div>
            <div className="infra-scale-body">Current replicas: {scaleTarget.current}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
              <button className="infra-scale-stepper" onClick={() => setScaleVal(v => Math.max(0, v - 1))}>−</button>
              <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--cyan, #00d4ff)', minWidth: 30, textAlign: 'center' }}>{scaleVal}</span>
              <button className="infra-scale-stepper" onClick={() => setScaleVal(v => v + 1)}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="upgrade-btn-primary" style={{ flex: 1 }} onClick={doScale}>Apply</button>
              <button className="upgrade-btn-secondary" onClick={() => setScaleTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="infra-panel-header">
        <div className="infra-panel-title">
          <span style={{ fontSize: 20 }}>☸</span>
          <span>Kubernetes</span>
          {k8sVersion && <span className="infra-version-badge">{k8sVersion}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {actionMsg && <span style={{ fontSize: 12, color: actionMsg.ok ? '#22c55e' : '#ef4444' }}>{actionMsg.text}</span>}
          <button className="infra-refresh-btn" onClick={() => loadResources(tab, namespace)} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Context + Namespace selectors */}
      <div className="infra-selectors">
        <div className="infra-selector-group">
          <label className="infra-selector-label">Context</label>
          <select
            className="infra-select"
            value={currentCtx}
            onChange={e => switchContext(e.target.value)}
          >
            {contexts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="infra-selector-group">
          <label className="infra-selector-label">Namespace</label>
          <select
            className="infra-select"
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
          >
            <option value="all">All namespaces</option>
            {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
          </select>
        </div>
      </div>

      {/* Resource tabs */}
      <div className="infra-tabs">
        {(['pods', 'services', 'deployments', 'nodes'] as K8sTab[]).map(t => (
          <button key={t} className={`infra-tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="infra-tab-count">{items.length}</span>
          </button>
        ))}
      </div>

      {/* Pods */}
      {tab === 'pods' && (
        <div className="infra-table-wrap">
          {pods.length === 0
            ? <div className="infra-empty">No pods in namespace</div>
            : (
              <table className="infra-table">
                <thead><tr><th>Name</th><th>Namespace</th><th>Phase</th><th>IP</th><th>Node</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {pods.map(p => (
                    <tr key={p.metadata.name + p.metadata.namespace}>
                      <td className="infra-mono">{p.metadata.name}</td>
                      <td className="infra-muted">{p.metadata.namespace}</td>
                      <td><K8sPhaseBadge phase={p.status?.phase ?? 'Unknown'} /></td>
                      <td className="infra-mono infra-muted">{p.status?.podIP ?? '—'}</td>
                      <td className="infra-muted">{p.spec?.nodeName ?? '—'}</td>
                      <td>
                        <div className="infra-actions">
                          <button className="infra-act-btn" onClick={() => streamPodLogs(p)}>📋 Logs</button>
                          <button className="infra-act-btn infra-act-red" onClick={() => deletePod(p)}>✕ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Services */}
      {tab === 'services' && (
        <div className="infra-table-wrap">
          {services.length === 0
            ? <div className="infra-empty">No services found</div>
            : (
              <table className="infra-table">
                <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Cluster IP</th><th>Ports</th></tr></thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.metadata.name + s.metadata.namespace}>
                      <td className="infra-mono">{s.metadata.name}</td>
                      <td className="infra-muted">{s.metadata.namespace}</td>
                      <td><span className="infra-tag">{s.spec.type}</span></td>
                      <td className="infra-mono infra-muted">{s.spec.clusterIP}</td>
                      <td className="infra-mono infra-muted" style={{ fontSize: 11 }}>
                        {s.spec.ports?.map(p => `${p.port}`).join(', ') ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Deployments */}
      {tab === 'deployments' && (
        <div className="infra-table-wrap">
          {deployments.length === 0
            ? <div className="infra-empty">No deployments found</div>
            : (
              <table className="infra-table">
                <thead><tr><th>Name</th><th>Namespace</th><th>Desired</th><th>Ready</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {deployments.map(d => (
                    <tr key={d.metadata.name + d.metadata.namespace}>
                      <td className="infra-mono">{d.metadata.name}</td>
                      <td className="infra-muted">{d.metadata.namespace}</td>
                      <td>{d.spec.replicas}</td>
                      <td>
                        <span style={{ color: (d.status.readyReplicas ?? 0) === d.spec.replicas ? '#22c55e' : '#f59e0b' }}>
                          {d.status.readyReplicas ?? 0}/{d.spec.replicas}
                        </span>
                      </td>
                      <td>
                        <div className="infra-actions">
                          <button
                            className="infra-act-btn"
                            onClick={() => {
                              setScaleVal(d.spec.replicas)
                              setScaleTarget({ name: d.metadata.name, ns: d.metadata.namespace, current: d.spec.replicas })
                            }}
                          >
                            ⤢ Scale
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Nodes */}
      {tab === 'nodes' && (
        <div className="infra-table-wrap">
          {nodes.length === 0
            ? <div className="infra-empty">No nodes found</div>
            : (
              <table className="infra-table">
                <thead><tr><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  {nodes.map(n => {
                    const ready = n.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True'
                    return (
                      <tr key={n.metadata.name}>
                        <td className="infra-mono">{n.metadata.name}</td>
                        <td><K8sPhaseBadge phase={ready ? 'Ready' : 'NotReady'} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── Root component ────────────────────────────────────────────────────────

export function InfraManager() {
  const [panel, setPanel] = useState<Panel>('docker')

  return (
    <div className="infra-root">
      {/* Panel switcher */}
      <div className="infra-switcher">
        <button
          className={`infra-switch-btn ${panel === 'docker' ? 'active' : ''}`}
          onClick={() => setPanel('docker')}
        >
          🐳 Docker
        </button>
        <button
          className={`infra-switch-btn ${panel === 'kubernetes' ? 'active' : ''}`}
          onClick={() => setPanel('kubernetes')}
        >
          ☸ Kubernetes
        </button>
      </div>

      {panel === 'docker'     && <DockerPanel />}
      {panel === 'kubernetes' && <KubernetesPanel />}
    </div>
  )
}
