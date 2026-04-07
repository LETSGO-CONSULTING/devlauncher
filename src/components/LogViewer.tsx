import { useEffect, useRef } from 'react'
import { useStore } from '../store'

interface Props {
  processKey: string
  onClose: () => void
}

// ─── ANSI stripper ────────────────────────────────────────────────────────
function stripAnsi(str: string): string {
  return str.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g, '')
}

// ─── Token colors ─────────────────────────────────────────────────────────
interface Segment {
  text: string
  color: string
  bold?: boolean
  italic?: boolean
  dim?: boolean
}

/**
 * Single-pass regex tokenizer — processes each line left to right,
 * matching the first rule that applies at each position.
 *
 * Groups (in order):
 * 1  ERROR / FATAL / EXCEPTION / SEVERE
 * 2  WARN / WARNING
 * 3  INFO / INFORMATION / STARTED / STARTED
 * 4  DEBUG
 * 5  TRACE
 * 6  HTTP methods
 * 7  2xx status
 * 8  3xx status
 * 9  4xx status
 * 10 5xx status
 * 11 ISO / full datetime
 * 12 HH:MM:SS time only
 * 13 URLs
 * 14 Quoted strings "..."
 * 15 Stack-trace line  (at com.foo.Bar...)
 * 16 Brackets [NestJS / Spring context tags]
 * 17 Numeric durations  (e.g. 123ms, 4.5s)
 * 18 Port numbers / standalone numbers
 */
const TOKEN_REGEX =
  /(\b(?:ERROR|FATAL|EXCEPTION|SEVERE)\b)|(\b(?:WARN(?:ING)?)\b)|(\b(?:INFO(?:RMATION)?|STARTED|MAPPED)\b)|(\bDEBUG\b)|(\bTRACE\b)|\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b|\b(2\d{2})\b|\b(3\d{2})\b|\b(4\d{2})\b|\b(5\d{2})\b|(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)| (\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)|(https?:\/\/\S+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(^\s*at\s+[\w$./\-<>()[\]:, ]+)|\[([^\]]+)\]|(\d+(?:\.\d+)?(?:ms|s|MB|KB|GB)\b)|(\d+)/gim

function colorizeLine(raw: string): Segment[] {
  const line = stripAnsi(raw)
  const segments: Segment[] = []
  let lastIndex = 0

  TOKEN_REGEX.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    // Text before this match → default color
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), color: '#94a3b8' })
    }

    const full = match[0]
    const [
      , g1Error, g2Warn, g3Info, g4Debug, g5Trace,
      g6Http,
      g7s2xx, g8s3xx, g9s4xx, g10s5xx,
      g11DateTime, g12Time,
      g13Url,
      g14Quoted,
      g15Stack,
      g16Bracket,
      g17Duration,
      g18Number,
    ] = match

    if      (g1Error)    segments.push({ text: full, color: '#ff5f57', bold: true })
    else if (g2Warn)     segments.push({ text: full, color: '#fbbf24', bold: true })
    else if (g3Info)     segments.push({ text: full, color: '#4ade80', bold: true })
    else if (g4Debug)    segments.push({ text: full, color: '#60a5fa' })
    else if (g5Trace)    segments.push({ text: full, color: '#64748b', dim: true })
    else if (g6Http)     segments.push({ text: full, color: '#38bdf8', bold: true })
    else if (g7s2xx)     segments.push({ text: full, color: '#4ade80', bold: true })
    else if (g8s3xx)     segments.push({ text: full, color: '#38bdf8' })
    else if (g9s4xx)     segments.push({ text: full, color: '#fbbf24', bold: true })
    else if (g10s5xx)    segments.push({ text: full, color: '#ff5f57', bold: true })
    else if (g11DateTime)segments.push({ text: full, color: '#475569' })
    else if (g12Time)    segments.push({ text: full, color: '#475569' })
    else if (g13Url)     segments.push({ text: full, color: '#38bdf8', italic: true })
    else if (g14Quoted)  segments.push({ text: full, color: '#fde68a' })
    else if (g15Stack)   segments.push({ text: full, color: '#f97316', dim: true })
    else if (g16Bracket) segments.push({ text: `[${g16Bracket}]`, color: '#c084fc' })
    else if (g17Duration)segments.push({ text: full, color: '#34d399' })
    else if (g18Number)  segments.push({ text: full, color: '#c084fc' })
    else                 segments.push({ text: full, color: '#94a3b8' })

    lastIndex = match.index + full.length
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), color: '#94a3b8' })
  }

  return segments
}

function renderLine(raw: string): React.ReactNode {
  const segments = colorizeLine(raw)
  return segments.map((seg, i) => (
    <span
      key={i}
      style={{
        color: seg.color,
        fontWeight: seg.bold ? '700' : undefined,
        fontStyle: seg.italic ? 'italic' : undefined,
        opacity: seg.dim ? 0.6 : undefined,
      }}
    >
      {seg.text}
    </span>
  ))
}

// ─── Component ────────────────────────────────────────────────────────────
export function LogViewer({ processKey, onClose }: Props) {
  const { logs, clearLog } = useStore()
  const entries   = logs[processKey] ?? []
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  const label = processKey.toUpperCase().replace(':', ' / ')

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
        <span className="console-label">Active Debug Console — {label}</span>
        <button className="btn-console-clear" onClick={() => clearLog(processKey)}>Clear</button>
        <button className="btn-console-close" onClick={onClose}>×</button>
      </div>

      {/* Log output */}
      <div className="log-output">
        {entries.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Waiting for output...</span>
        ) : (
          entries.map((entry, i) => {
            if (entry.type === 'system') {
              return (
                <div key={i} className="log-entry" style={{ color: '#f59e0b', opacity: 0.8 }}>
                  {entry.data}
                </div>
              )
            }

            // Split multi-line chunks (stdout/stderr can batch multiple lines)
            const lines = entry.data.split('\n').filter((l) => l.length > 0)
            return lines.map((line, j) => (
              <div key={`${i}-${j}`} className="log-entry">
                {renderLine(line)}
              </div>
            ))
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
