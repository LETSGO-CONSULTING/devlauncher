import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

interface NodeVersionInfo {
  versions: string[]
  current: string
  nvmFound: boolean
  error?: string
}

interface JavaVersionInfo {
  versions: Array<{ version: string; vendor: string; home: string }>
  current: string
  error?: string
}

interface Props {
  projectType: 'npm' | 'maven' | 'gradle' | 'docker' | 'composer' | 'python' | 'ruby' | 'go' | 'rust'
  selectedNode?: string
  selectedJava?: string
  onChange: (nodeVersion?: string, javaVersion?: string) => void
}

const needsNode = (type: string) => type === 'npm'
const needsJava = (type: string) => type === 'maven' || type === 'gradle'

export function RuntimeSelector({ projectType, selectedNode, selectedJava, onChange }: Props) {
  const [nodeInfo, setNodeInfo] = useState<NodeVersionInfo | null>(null)
  const [javaInfo, setJavaInfo] = useState<JavaVersionInfo | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installInput, setInstallInput] = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const [installKey, setInstallKey] = useState('')

  useEffect(() => {
    if (needsNode(projectType)) {
      window.electronAPI.nodeListVersions().then(setNodeInfo)
    }
    if (needsJava(projectType)) {
      window.electronAPI.javaListVersions().then(setJavaInfo)
    }

    const unsub = window.electronAPI.onNodeVersionsChanged(() => {
      window.electronAPI.nodeListVersions().then(setNodeInfo)
    })
    return unsub
  }, [projectType])

  const handleInstallNode = async () => {
    if (!installInput.trim()) return
    setInstalling(true)
    const res = await window.electronAPI.nodeInstallVersion(installInput.trim())
    if (res.key) setInstallKey(res.key)
    setShowInstall(false)
    setInstallInput('')
    // installing will be set to false via onNodeVersionsChanged
    setTimeout(() => setInstalling(false), 30000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

      {/* ── Node.js version selector ── */}
      {needsNode(projectType) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon icon="logos:nodejs-icon" width={14} height={14} />
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>NODE</span>

          {nodeInfo?.error ? (
            <span style={{ fontSize: 10, color: '#f59e0b' }}>nvm not found</span>
          ) : (
            <select
              value={selectedNode ?? ''}
              onChange={e => onChange(e.target.value || undefined, selectedJava)}
              style={{
                background: '#1a2740', border: '1px solid #1e2d3d', borderRadius: 5,
                color: '#e2e8f0', fontSize: 11, padding: '2px 6px', cursor: 'pointer',
                outline: 'none', fontFamily: 'var(--mono)',
              }}
            >
              <option value="">system ({nodeInfo?.current ?? '...'})</option>
              {(nodeInfo?.versions ?? []).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          {/* Install button */}
          {nodeInfo?.nvmFound && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowInstall(!showInstall)}
                title="Install new Node version"
                style={{
                  background: installing ? '#1a2740' : '#162035',
                  border: '1px solid #1e2d3d', borderRadius: 5,
                  color: installing ? '#f59e0b' : '#64748b',
                  padding: '2px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {installing
                  ? <><Icon icon="svg-spinners:ring-resize" width={11} /> Installing...</>
                  : <><Icon icon="mdi:plus" width={12} /> Install</>
                }
              </button>

              {showInstall && (
                <div style={{
                  position: 'absolute', top: 26, left: 0, zIndex: 100,
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 8, padding: '10px 12px', display: 'flex',
                  flexDirection: 'column', gap: 8, minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    Install Node version via nvm
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={installInput}
                      onChange={e => setInstallInput(e.target.value)}
                      placeholder="e.g. 20 or 18.20.0"
                      onKeyDown={e => e.key === 'Enter' && handleInstallNode()}
                      style={{
                        flex: 1, background: '#0f172a', border: '1px solid #334155',
                        borderRadius: 5, color: '#e2e8f0', fontSize: 11,
                        padding: '4px 8px', outline: 'none', fontFamily: 'var(--mono)',
                      }}
                    />
                    <button
                      onClick={handleInstallNode}
                      style={{
                        background: '#7c5cfc', color: '#fff', borderRadius: 5,
                        padding: '4px 10px', fontSize: 11, fontWeight: 700,
                      }}
                    >Install</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {['18', '20', '22'].map(v => (
                      <button
                        key={v}
                        onClick={() => setInstallInput(v)}
                        style={{
                          background: installInput === v ? '#7c5cfc' : '#162035',
                          border: '1px solid #334155', borderRadius: 4,
                          color: '#94a3b8', fontSize: 10, padding: '2px 8px',
                        }}
                      >v{v} LTS</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Java version selector ── */}
      {needsJava(projectType) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon icon="logos:java" width={14} height={14} />
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>JAVA</span>

          {javaInfo?.error ? (
            <span style={{ fontSize: 10, color: '#f59e0b' }}>java_home not found</span>
          ) : (
            <select
              value={selectedJava ?? ''}
              onChange={e => onChange(selectedNode, e.target.value || undefined)}
              style={{
                background: '#1a2740', border: '1px solid #1e2d3d', borderRadius: 5,
                color: '#e2e8f0', fontSize: 11, padding: '2px 6px', cursor: 'pointer',
                outline: 'none', fontFamily: 'var(--mono)',
              }}
            >
              <option value="">system ({javaInfo?.current ?? '...'})</option>
              {(javaInfo?.versions ?? []).map(v => (
                <option key={v.version} value={v.version}>
                  {v.version} — {v.vendor}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Selected badge */}
      {(selectedNode || selectedJava) && (
        <div style={{ display: 'flex', gap: 4 }}>
          {selectedNode && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#339933',
              background: 'rgba(51,153,51,0.12)', border: '1px solid rgba(51,153,51,0.25)',
              padding: '1px 7px', borderRadius: 10, fontFamily: 'var(--mono)',
            }}>
              node v{selectedNode}
            </span>
          )}
          {selectedJava && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#f97316',
              background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
              padding: '1px 7px', borderRadius: 10, fontFamily: 'var(--mono)',
            }}>
              java {selectedJava}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
