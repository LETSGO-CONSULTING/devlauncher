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

  return (
    <div style={{ height: '280px', borderTop: '1px solid var(--border)', background: '#0a0f1e', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--accent)', flex: 1 }}>
          {processKey}
        </span>
        <button onClick={() => clearLog(processKey)}
          style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', padding: '3px 8px' }}>
          Clear
        </button>
        <button onClick={onClose}
          style={{ fontSize: '16px', color: 'var(--text-muted)', background: 'transparent', padding: '3px 8px' }}>
          ×
        </button>
      </div>

      {/* Log output */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: '12px', lineHeight: '1.6' }}>
        {entries.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>No output yet...</span>
        ) : (
          entries.map((entry, i) => (
            <div key={i} style={{ color: entry.type === 'stderr' ? 'var(--red)' : entry.type === 'system' ? 'var(--yellow)' : 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {entry.data}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
