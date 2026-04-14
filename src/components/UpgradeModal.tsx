import { FREE_TIER_GROUP_LIMIT } from '../lib/license'

interface Props {
  onClose: () => void
}

export function UpgradeModal({ onClose }: Props) {
  const handleUpgrade = () => {
    window.electronAPI.openExternal('https://devlauncher.letsgo.dev')
    onClose()
  }

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-modal-icon">🚀</div>
        <div className="upgrade-modal-title">Free tier limit reached</div>
        <div className="upgrade-modal-body">
          The Free tier supports up to <strong>{FREE_TIER_GROUP_LIMIT} project groups</strong>.
          Upgrade to <strong>Pro</strong> for unlimited projects, commercial use, and
          one year of updates.
        </div>

        <div className="upgrade-modal-plans">
          <div className="upgrade-plan">
            <div className="upgrade-plan-name">Free</div>
            <div className="upgrade-plan-price">$0</div>
            <ul className="upgrade-plan-features">
              <li>Up to {FREE_TIER_GROUP_LIMIT} project groups</li>
              <li>All core features</li>
              <li>Personal use only</li>
            </ul>
          </div>
          <div className="upgrade-plan upgrade-plan--pro">
            <div className="upgrade-plan-badge">RECOMMENDED</div>
            <div className="upgrade-plan-name">Pro</div>
            <div className="upgrade-plan-price">$35 <span>one-time</span></div>
            <ul className="upgrade-plan-features">
              <li>Unlimited project groups</li>
              <li>Commercial use</li>
              <li>1 year of updates</li>
              <li>2 machines</li>
            </ul>
          </div>
          <div className="upgrade-plan">
            <div className="upgrade-plan-name">Teams</div>
            <div className="upgrade-plan-price">$15 <span>/ seat / mo</span></div>
            <ul className="upgrade-plan-features">
              <li>Everything in Pro</li>
              <li>Shared workspaces</li>
              <li>Team management</li>
            </ul>
          </div>
        </div>

        <div className="upgrade-modal-actions">
          <button className="upgrade-btn-primary" onClick={handleUpgrade}>
            Upgrade to Pro
          </button>
          <button className="upgrade-btn-secondary" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
