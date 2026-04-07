interface Props {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = ['Cluster', 'Logs', 'Metrics']

export function TopBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="topbar">
      {/* Workspace label */}
      <div className="topbar-workspace">
        <span className="topbar-workspace-label">Dev&nbsp;Space</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--card-border)' }} />

      {/* Tabs */}
      <div className="topbar-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`topbar-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div className="topbar-right">
        <div className="topbar-search">
          <span style={{ opacity: 0.5 }}>🔍</span>
          <span>Search resources...</span>
        </div>
        <button style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 16, padding: '4px 6px', borderRadius: 6 }}>
          🔔
        </button>
        <button style={{ padding: '6px 16px', background: 'var(--green)', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.6px' }}>
          DEPLOY
        </button>
      </div>
    </div>
  )
}
