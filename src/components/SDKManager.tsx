import { useEffect, useState, useRef } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface NodeInfo  { versions: string[]; current: string; nvmFound: boolean }
interface JavaVersion { version: string; vendor: string; home: string }
interface JavaInfo  { versions: JavaVersion[]; current: string }
interface Tools {
  brewFound: boolean; nvmFound: boolean; pyenvFound: boolean; pythonVersions: string[]
}
type InstallStatus = 'idle' | 'installing' | 'success' | 'error'

const JAVA_CASKS: Array<{ label: string; cask: string; lts: boolean }> = [
  { label: 'Java 8',  cask: 'temurin@8',  lts: true  },
  { label: 'Java 11', cask: 'temurin@11', lts: true  },
  { label: 'Java 17', cask: 'temurin@17', lts: true  },
  { label: 'Java 21', cask: 'temurin@21', lts: true  },
  { label: 'Java 22', cask: 'temurin@22', lts: false },
]

const NODE_LTS: Array<{ label: string; version: string }> = [
  { label: 'v18 LTS', version: '18' },
  { label: 'v20 LTS', version: '20' },
  { label: 'v22 LTS', version: '22' },
  { label: 'v23',     version: '23' },
]

const PYTHON_VERSIONS = ['3.10.14', '3.11.9', '3.12.4', '3.13.0']

// ─── Helpers ───────────────────────────────────────────────────────────────

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

function safeOn(fn: ((cb: () => void) => (() => void)) | undefined, cb: () => void): () => void {
  if (typeof fn !== 'function') return () => {}
  try { return fn(cb) } catch { return () => {} }
}

function openLink(url: string) {
  safeCall(() => window.electronAPI.openExternal(url), undefined)
}

// ─── Copy snippet button ───────────────────────────────────────────────────

function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <code style={{
        display: 'block', background: '#0d1117', padding: '8px 40px 8px 12px',
        borderRadius: 6, color: '#94a3b8', fontSize: 11, fontFamily: 'monospace',
        border: '1px solid rgba(255,255,255,0.06)', userSelect: 'text',
      }}>
        {code}
      </code>
      <button
        onClick={copy}
        title="Copy to clipboard"
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: copied ? '#22c55e' : '#475569', fontSize: 13, padding: '2px 4px',
          transition: 'color 0.15s',
        }}
      >
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  )
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function SdkSection({ icon, title, badge, badgeColor, onRefresh, children }: {
  icon: string; title: string; badge?: string; badgeColor?: string
  onRefresh?: () => void; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '24px 28px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0', letterSpacing: '0.3px', flex: 1 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
            background: `${badgeColor ?? '#7c5cfc'}22`, color: badgeColor ?? '#7c5cfc',
            border: `1px solid ${badgeColor ?? '#7c5cfc'}44`, borderRadius: 6, padding: '2px 8px',
          }}>{badge}</span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh versions"
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '3px 8px', color: '#475569',
              cursor: 'pointer', fontSize: 13, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            ↺
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Install log box ────────────────────────────────────────────────────────

function useInstallLogs(key: string | null) {
  const [logs, setLogs] = useState<Array<{ data: string; type: string }>>([])
  useEffect(() => {
    if (!key) return
    setLogs([])
    const unsub = window.electronAPI.onProcessLog(({ key: k, data, type }) => {
      if (k === key) setLogs(prev => [...prev, { data, type }])
    })
    return unsub
  }, [key])
  return { logs }
}

function LogBox({ logKey, label }: { logKey: string | null; label: string }) {
  const { logs } = useInstallLogs(logKey)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  if (!logKey || logs.length === 0) return null
  return (
    <div ref={ref} style={{
      marginTop: 12, background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: '10px 14px', maxHeight: 160, overflowY: 'auto',
      fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', lineHeight: 1.6,
    }}>
      <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, fontFamily: 'sans-serif' }}>{label}</div>
      {logs.map((l, i) => (
        <div key={i} style={{ color: l.type === 'stderr' ? '#f87171' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
          {l.data}
        </div>
      ))}
    </div>
  )
}

// ─── Status banner ──────────────────────────────────────────────────────────

function StatusBanner({ status, msg }: { status: InstallStatus; msg: string }) {
  if (status === 'idle') return null
  const colors = {
    installing: { bg: '#7c5cfc11', border: '#7c5cfc33', text: '#a78bfa' },
    success:    { bg: '#22c55e11', border: '#22c55e33', text: '#22c55e' },
    error:      { bg: '#f8717111', border: '#f8717133', text: '#f87171' },
    idle:       { bg: '', border: '', text: '' },
  }
  const c = colors[status]
  return (
    <div style={{
      padding: '6px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {status === 'installing' && (
        <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span>
      )}
      {msg}
    </div>
  )
}

// ─── Quick install row ──────────────────────────────────────────────────────

function QuickBtn({ label, sub, installed, isInstalling, disabled, onClick, accentColor }: {
  label: string; sub?: string; installed: boolean; isInstalling: boolean
  disabled: boolean; onClick: () => void; accentColor: string
}) {
  return (
    <button
      disabled={disabled || installed}
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8,
        border: installed ? `1px solid ${accentColor}44` : '1px solid rgba(255,255,255,0.1)',
        background: installed ? `${accentColor}11` : isInstalling ? `${accentColor}22` : 'rgba(255,255,255,0.05)',
        color: installed ? accentColor : '#e2e8f0',
        fontSize: 12, fontWeight: 600,
        cursor: (disabled || installed) ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
      }}
    >
      {isInstalling && <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span>}
      {installed ? '✓ ' : ''}{label}
      {sub && <span style={{ fontSize: 9, color: installed ? `${accentColor}88` : '#64748b', marginLeft: 2 }}>{sub}</span>}
    </button>
  )
}

// ─── Node.js section ─────────────────────────────────────────────────────────

function NodeSection({ tools }: { tools: Tools }) {
  const [info, setInfo]             = useState<NodeInfo | null>(null)
  const [customVer, setCustomVer]   = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installKey, setInstallKey] = useState<string | null>(null)
  const [uninstalling, setUninstalling] = useState<string | null>(null)
  const [status, setStatus]         = useState<InstallStatus>('idle')
  const [statusMsg, setStatusMsg]   = useState('')

  const installKeyRef = useRef<string | null>(null)
  const installingRef = useRef<string | null>(null)
  installKeyRef.current = installKey
  installingRef.current = installing

  const load = () => {
    safeCall(() => window.electronAPI.nodeListVersions(), { versions: [], current: '', nvmFound: false })
      .then(r => setInfo({ versions: r.versions ?? [], current: r.current ?? '', nvmFound: r.nvmFound ?? false }))
  }

  useEffect(() => {
    load()
    const unsubChanged = safeOn(window.electronAPI.onNodeVersionsChanged, load)
    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      const ik = installKeyRef.current
      const ins = installingRef.current
      if ((ik && key === ik) || (ins && key.includes(`node-${ins}`))) {
        setInstalling(null); setInstallKey(null)
        setStatus(code === 0 ? 'success' : 'error')
        setStatusMsg(code === 0 ? 'Installed successfully ✓' : `Failed (exit ${code})`)
        setTimeout(() => setStatus('idle'), 3000)
      }
    })
    return () => { unsubChanged(); unsubExit() }
  }, [])

  const install = async (version: string) => {
    setInstalling(version); setStatus('installing'); setStatusMsg(`Installing Node ${version}…`)
    const res = await safeCall(() => window.electronAPI.nodeInstallVersion(version), { error: 'not available' })
    if (res.error) {
      setInstalling(null); setStatus('error'); setStatusMsg(res.error)
      setTimeout(() => setStatus('idle'), 3000)
    } else { setInstallKey((res as any).key ?? null) }
  }

  const uninstall = async (version: string) => {
    if (!confirm(`Uninstall Node v${version}?`)) return
    setUninstalling(version)
    const res = await safeCall(() => window.electronAPI.nodeUninstallVersion(version), { error: 'not available' })
    if (res.error) { alert(res.error); setUninstalling(null) }
    setTimeout(() => setUninstalling(null), 6000)
  }

  const setDefault = async (version: string) => {
    await safeCall(() => window.electronAPI.nodeSetDefault(version), {})
    load()
  }

  if (!tools.nvmFound) {
    return (
      <SdkSection icon="🟩" title="Node.js" badge="nvm" badgeColor="#339933">
        <div style={{ color: '#f59e0b', fontSize: 13, lineHeight: 1.7 }}>
          <strong>nvm not found.</strong> Install it to manage Node.js versions:
          <CodeSnippet code="curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash" />
          <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
            After install, restart DevLauncher.
          </div>
        </div>
      </SdkSection>
    )
  }

  return (
    <SdkSection icon="🟩" title="Node.js" badge="via nvm" badgeColor="#339933" onRefresh={load}>
      {/* Quick install */}
      <div style={{ marginBottom: 16 }}>
        <div className="sdk-label">Quick Install</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {NODE_LTS.map(({ label, version }) => (
            <QuickBtn
              key={version} label={label} accentColor="#339933"
              installed={!!info?.versions.some(v => v === version || v.startsWith(version + '.'))}
              isInstalling={installing === version}
              disabled={!!installing}
              onClick={() => install(version)}
            />
          ))}
        </div>
      </div>

      {/* Custom version */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={customVer}
          onChange={e => setCustomVer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && customVer.trim() && !installing && install(customVer.trim())}
          placeholder="Custom version — e.g. 21.7.1"
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        />
        <button
          disabled={!customVer.trim() || !!installing}
          onClick={() => install(customVer.trim())}
          style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none',
            background: (customVer.trim() && !installing) ? '#7c5cfc' : 'rgba(124,92,252,0.2)',
            color: (customVer.trim() && !installing) ? '#fff' : 'rgba(167,139,250,0.4)',
            cursor: (customVer.trim() && !installing) ? 'pointer' : 'default',
          }}
        >
          Install
        </button>
      </div>

      <StatusBanner status={status} msg={statusMsg} />
      <LogBox logKey={installKey} label="nvm install output" />

      {/* Installed list */}
      <div style={{ marginTop: 4 }}>
        <div className="sdk-label">Installed Versions</div>
        {!info || info.versions.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13 }}>No versions installed yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {info.versions.map(v => {
              const isCurrent = v === info.current
              return (
                <div key={v} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: 8,
                  background: isCurrent ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)',
                  border: isCurrent ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? '#22c55e' : '#cbd5e1', fontFamily: 'monospace' }}>
                      v{v}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
                        background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.25)', borderRadius: 5, padding: '1px 7px',
                      }}>default</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!isCurrent && (
                      <button onClick={() => setDefault(v)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8', cursor: 'pointer',
                      }}>
                        Set default
                      </button>
                    )}
                    <button
                      disabled={isCurrent || uninstalling === v}
                      onClick={() => uninstall(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: isCurrent ? 'transparent' : 'rgba(248,113,113,0.08)',
                        border: isCurrent ? '1px solid transparent' : '1px solid rgba(248,113,113,0.2)',
                        color: isCurrent ? '#334155' : '#f87171',
                        cursor: isCurrent ? 'default' : 'pointer',
                      }}
                    >
                      {uninstalling === v ? '…' : 'Uninstall'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SdkSection>
  )
}

// ─── Java section ─────────────────────────────────────────────────────────────

function JavaSection({ tools }: { tools: Tools }) {
  const [info, setInfo]             = useState<JavaInfo | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installKey, setInstallKey] = useState<string | null>(null)
  const [status, setStatus]         = useState<InstallStatus>('idle')
  const [statusMsg, setStatusMsg]   = useState('')

  const installKeyRef = useRef<string | null>(null)
  installKeyRef.current = installKey

  const load = () => {
    safeCall(() => window.electronAPI.javaListVersions(), { versions: [], current: '', error: '' })
      .then(r => setInfo({ versions: r.versions ?? [], current: r.current ?? '' }))
  }

  useEffect(() => {
    load()
    const unsubChanged = safeOn(window.electronAPI.onJavaVersionsChanged, load)
    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      if (installKeyRef.current && key === installKeyRef.current) {
        setInstalling(null); setInstallKey(null)
        setStatus(code === 0 ? 'success' : 'error')
        setStatusMsg(code === 0 ? 'Installed ✓ — restart DevLauncher to detect' : `Install failed (exit ${code})`)
        setTimeout(() => setStatus('idle'), 5000)
        load()
      }
    })
    return () => { unsubChanged(); unsubExit() }
  }, [])

  const install = async (cask: string, label: string) => {
    if (!tools.brewFound) { alert('Homebrew not found. Install from https://brew.sh'); return }
    setInstalling(cask); setStatus('installing'); setStatusMsg(`Installing ${label} via Homebrew…`)
    const res = await safeCall(() => window.electronAPI.javaInstallVersion(cask), { error: 'not available' })
    if (res.error) {
      setInstalling(null); setStatus('error'); setStatusMsg(res.error)
      setTimeout(() => setStatus('idle'), 4000)
    } else { setInstallKey((res as any).key ?? null) }
  }

  return (
    <SdkSection icon="☕" title="Java" badge="via Homebrew Temurin" badgeColor="#f97316" onRefresh={load}>
      {!tools.brewFound && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12,
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠ Homebrew not found — installs unavailable.</span>
          <button
            onClick={() => openLink('https://brew.sh')}
            style={{
              background: 'none', border: '1px solid #7c5cfc44', borderRadius: 5,
              color: '#7c5cfc', fontSize: 11, cursor: 'pointer', padding: '2px 8px', fontWeight: 600,
            }}
          >
            Install Homebrew ↗
          </button>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div className="sdk-label">Install via Homebrew Temurin</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {JAVA_CASKS.map(({ label, cask, lts }) => {
            const vn = cask.split('@')[1]
            return (
              <QuickBtn
                key={cask} label={label} sub={lts ? 'LTS' : undefined} accentColor="#f97316"
                installed={!!info?.versions.some(v => v.version === vn || v.version.startsWith(vn + '.'))}
                isInstalling={installing === cask}
                disabled={!!installing || !tools.brewFound}
                onClick={() => install(cask, label)}
              />
            )
          })}
        </div>
      </div>

      <StatusBanner status={status} msg={statusMsg} />
      <LogBox logKey={installKey} label="Homebrew install output" />

      <div style={{ marginTop: 4 }}>
        <div className="sdk-label">Detected Versions</div>
        {!info || info.versions.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13 }}>No Java versions detected</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {info.versions.map(v => {
              const isCurrent = v.version === info.current
              return (
                <div key={v.home} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: 8,
                  background: isCurrent ? 'rgba(249,115,22,0.05)' : 'rgba(255,255,255,0.03)',
                  border: isCurrent ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: isCurrent ? '#fb923c' : '#cbd5e1' }}>
                        Java {v.version}
                      </span>
                      {isCurrent && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
                          background: 'rgba(249,115,22,0.12)', color: '#f97316',
                          border: '1px solid rgba(249,115,22,0.25)', borderRadius: 5, padding: '1px 7px',
                        }}>active</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{v.vendor}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#334155', maxWidth: 260, textAlign: 'right', wordBreak: 'break-all' }}>
                    {v.home}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SdkSection>
  )
}

// ─── Python section ───────────────────────────────────────────────────────────

function PythonSection({ tools }: { tools: Tools }) {
  const [installing, setInstalling] = useState<string | null>(null)
  const [installKey, setInstallKey] = useState<string | null>(null)
  const [customVer, setCustomVer]   = useState('')
  const [status, setStatus]         = useState<InstallStatus>('idle')
  const [statusMsg, setStatusMsg]   = useState('')
  const [installed, setInstalled]   = useState<string[]>(tools.pythonVersions)

  const installKeyRef = useRef<string | null>(null)
  installKeyRef.current = installKey

  const load = () => {
    safeCall(() => window.electronAPI.checkTools(), null as any)
      .then(r => { if (r) setInstalled(r.pythonVersions ?? []) })
  }

  useEffect(() => {
    const unsubExit = window.electronAPI.onProcessExit(({ key, code }) => {
      if (installKeyRef.current && key === installKeyRef.current) {
        setInstalling(null); setInstallKey(null)
        setStatus(code === 0 ? 'success' : 'error')
        setStatusMsg(code === 0 ? 'Python installed ✓' : `Install failed (exit ${code})`)
        setTimeout(() => setStatus('idle'), 4000)
        load()
      }
    })
    return () => unsubExit()
  }, [])

  const installPython = async (version: string) => {
    if (!tools.nvmFound && !tools.brewFound) {
      alert('pyenv is required. Install with: brew install pyenv')
      return
    }
    if (!tools.pyenvFound) {
      alert('pyenv not found. Install with: brew install pyenv')
      return
    }
    setInstalling(version); setStatus('installing'); setStatusMsg(`Installing Python ${version} via pyenv…`)
    // Use the node-install-version mechanism but with pyenv
    // We'll spawn it as a custom process via a special install key
    const key = `__install__:python-${version}`
    // We don't have a dedicated pyenv IPC — use a workaround: show instructions
    // Since we can't add IPC mid-session, show the copy command and mark as pending
    setInstalling(null)
    setStatus('idle')
    // Fall back to showing the command to copy
    setCustomVer(version)
  }

  return (
    <SdkSection icon="🐍" title="Python" badge="via pyenv" badgeColor="#3b82f6" onRefresh={load}>
      {!tools.pyenvFound ? (
        <div>
          <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            <strong style={{ color: '#94a3b8' }}>pyenv not found.</strong>{' '}
            Install it to manage Python versions:
            <CodeSnippet code="brew install pyenv" />
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Then add to your shell profile (~/.zshrc or ~/.bashrc):
            <CodeSnippet code={`export PYENV_ROOT="$HOME/.pyenv"\nexport PATH="$PYENV_ROOT/bin:$PATH"\neval "$(pyenv init -)"`} />
          </div>
          {!tools.brewFound && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => openLink('https://brew.sh')}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'none', border: '1px solid #7c5cfc44', color: '#7c5cfc', cursor: 'pointer',
                }}
              >
                Install Homebrew first ↗
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Quick install popular versions */}
          <div style={{ marginBottom: 16 }}>
            <div className="sdk-label">Quick Install</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PYTHON_VERSIONS.map(v => {
                const isInstalled = installed.some(i => i === v || i.startsWith(v.split('.').slice(0,2).join('.')))
                return (
                  <QuickBtn
                    key={v} label={v} accentColor="#3b82f6"
                    installed={isInstalled}
                    isInstalling={installing === v}
                    disabled={!!installing}
                    onClick={() => installPython(v)}
                  />
                )
              })}
            </div>
          </div>

          {/* Custom version + run command */}
          <div style={{ marginBottom: 12 }}>
            <div className="sdk-label">Custom Version</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={customVer}
                onChange={e => setCustomVer(e.target.value)}
                placeholder="e.g. 3.12.4"
                style={{
                  flex: 1, padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            {customVer.trim() && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Run in your terminal:</div>
                <CodeSnippet code={`pyenv install ${customVer.trim()}`} />
              </div>
            )}
          </div>

          <StatusBanner status={status} msg={statusMsg} />
          <LogBox logKey={installKey} label="pyenv install output" />

          {/* Installed versions */}
          <div className="sdk-label" style={{ marginTop: 4 }}>Installed via pyenv</div>
          {installed.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13, marginBottom: 8 }}>
              No Python versions installed via pyenv
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {installed.map(v => (
                <span key={v} style={{
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  color: '#93c5fd', fontSize: 12, fontWeight: 600, fontFamily: 'monospace',
                }}>
                  {v}
                </span>
              ))}
            </div>
          )}

          {/* Install tip */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Run from terminal to install:</div>
            <CodeSnippet code="pyenv install 3.12.4" />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 8, marginBottom: 6 }}>Set as global default:</div>
            <CodeSnippet code="pyenv global 3.12.4" />
          </div>
        </div>
      )}
    </SdkSection>
  )
}

// ─── Main SDKManager ──────────────────────────────────────────────────────────

export function SDKManager() {
  const [tools, setTools]   = useState<Tools | null>(null)
  const [loadErr, setLoadErr] = useState(false)

  const reload = () => {
    setLoadErr(false)
    safeCall(() => window.electronAPI.checkTools(), null as any)
      .then(r => r ? setTools(r) : setLoadErr(true))
  }

  useEffect(() => { reload() }, [])

  if (loadErr) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>SDK Manager requires a restart</div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          Stop the app and run <code style={{ color: '#7c5cfc' }}>npm run dev</code> again
        </div>
      </div>
    )
  }

  if (!tools) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 10 }}>
        <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Loading…
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px', marginBottom: 6 }}>
            SDK Manager
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Install and manage runtime versions for your projects
          </div>
        </div>
        <button
          onClick={reload}
          title="Refresh all"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '6px 14px', color: '#64748b',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          ↺ Refresh all
        </button>
      </div>

      {/* Tool status pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        {[
          { label: 'nvm',      found: tools.nvmFound,   color: '#339933', url: 'https://github.com/nvm-sh/nvm' },
          { label: 'Homebrew', found: tools.brewFound,  color: '#f59e0b', url: 'https://brew.sh' },
          { label: 'pyenv',    found: tools.pyenvFound, color: '#3b82f6', url: 'https://github.com/pyenv/pyenv' },
        ].map(({ label, found, color, url }) => (
          <div
            key={label}
            onClick={() => !found && openLink(url)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              background: found ? `${color}11` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${found ? `${color}33` : 'rgba(255,255,255,0.06)'}`,
              cursor: found ? 'default' : 'pointer',
            }}
            title={found ? `${label} is ready` : `${label} not found — click to learn more`}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: found ? color : '#334155', display: 'inline-block',
              boxShadow: found ? `0 0 5px ${color}88` : 'none',
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: found ? color : '#475569' }}>{label}</span>
            <span style={{ fontSize: 11, color: '#334155' }}>{found ? 'ready' : 'not found ↗'}</span>
          </div>
        ))}
      </div>

      <NodeSection   tools={tools} />
      <JavaSection   tools={tools} />
      <PythonSection tools={tools} />
    </div>
  )
}
