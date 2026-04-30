import { useState } from 'react'
import { FREE_TIER_GROUP_LIMIT } from '../lib/license'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

export function UpgradeModal({ onClose }: Props) {
  const setTier = useStore((s) => s.setTier)
  const [view, setView] = useState<'plans' | 'activate'>('plans')
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleUpgrade = () => {
    window.electronAPI.openExternal('https://devlauncher.letsgo.dev')
    onClose()
  }

  const handleActivate = async () => {
    const key = licenseKey.trim().toUpperCase()
    if (!key) { setError('Enter a license key'); return }
    setActivating(true)
    setError(null)
    const res = await window.electronAPI.licenseActivate(key)
    setActivating(false)
    if (res.error || !res.success) {
      setError(res.error ?? 'Activation failed')
      return
    }
    setTier(res.tier as 'pro' | 'teams', res.expiresAt ?? null)
    setSuccess(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>

        {view === 'plans' && !success && (
          <>
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
              <button className="upgrade-btn-secondary" onClick={() => setView('activate')}>
                Activate license key
              </button>
              <button className="upgrade-btn-ghost" onClick={onClose}>
                Maybe later
              </button>
            </div>
          </>
        )}

        {view === 'activate' && !success && (
          <>
            <div className="upgrade-modal-icon">🔑</div>
            <div className="upgrade-modal-title">Activate your license</div>
            <div className="upgrade-modal-body">
              Enter the license key you received after purchase.
            </div>

            <div className="license-input-wrap">
              <input
                className="license-input"
                placeholder="DLPRO-YYYYMMDD-NNNNN-HHHHHHHHHHHH"
                value={licenseKey}
                onChange={(e) => { setLicenseKey(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                spellCheck={false}
                autoFocus
              />
              {error && <div className="license-error">{error}</div>}
            </div>

            <div className="upgrade-modal-actions">
              <button className="upgrade-btn-primary" onClick={handleActivate} disabled={activating}>
                {activating ? 'Activating…' : 'Activate'}
              </button>
              <button className="upgrade-btn-secondary" onClick={() => { setView('plans'); setError(null) }}>
                ← Back
              </button>
            </div>
          </>
        )}

        {success && (
          <>
            <div className="upgrade-modal-icon">✅</div>
            <div className="upgrade-modal-title">License activated!</div>
            <div className="upgrade-modal-body">Your Pro features are now unlocked.</div>
          </>
        )}

      </div>
    </div>
  )
}
