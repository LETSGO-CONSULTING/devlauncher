import { useEffect, useRef } from 'react'
import { useStore } from '../store'

interface Props {
  processKey: string
  onClose: () => void
}

export function LogViewer({ processKey, onClose }: Props) {
  const { logs, clearLog } = useStore()
  const entries = logs[processKey] ?? []
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  // Format: SCHOLARGATE/NPM RUN DEV
  const label = processKey
    .replace(':', '/')
    .replace('npm run ', 'npm run ')
    .toUpperCase()
    .split(':')[0]

  return (
    <div className="log-console">
      {/* Console bar */}
      <div className="log-console-bar">
        <div className="traffic-lights">
          <span className="tl tl-red" />
          <span className="tl tl-yellow" />
          <span className="tl tl-green" />
        </div>
        <span className="console-terminal-icon">⬛</span>
        <span className="console-label">
          Active Debug Console — {label}
        </span>
        <button className="btn-console-clear" onClick={() => clearLog(processKey)}>
          Clear
        </button>
        <button className="btn-console-close" onClick={onClose}>×</button>
      </div>

      {/* Log output */}
      <div className="log-output">
        {entries.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Waiting for output...</span>
        ) : (
          entries.map((entry, i) => {
            const ts = new Date(entry.timestamp)
            const time = `[${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}]`
            return (
              <div key={i} className={`log-entry ${entry.type}`}>
                {entry.type !== 'stderr'
                  ? <><span style={{ color: 'var(--text-muted)' }}>{time} </span>{entry.data}</>
                  : entry.data
                }
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
