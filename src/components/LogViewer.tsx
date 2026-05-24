import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'

interface Props {
  processKey: string
  label?: string
  fullHeight?: boolean
  onClose: () => void
}

// ─── ANSI stripper ────────────────────────────────────────────────────────
function stripAnsi(str: string): string {
  return str.replace(
    /[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g,
    ''
  )
}

// ─── IntelliJ-accurate colors ─────────────────────────────────────────────
// Match exactly how IntelliJ IDEA renders log levels
const LEVEL_STYLES: Record<string, { color: string; bg?: string; bold?: boolean }> = {
  ERROR:     { color: '#FF6B68', bg: 'rgba(255,107,104,0.08)', bold: true },
  FATAL:     { color: '#FF6B68', bg: 'rgba(255,107,104,0.08)', bold: true },
  EXCEPTION: { color: '#FF6B68', bold: true },
  SEVERE:    { color: '#FF6B68', bold: true },
  WARN:      { color: '#BBB529', bold: true },
  WARNING:   { color: '#BBB529', bold: true },
  INFO:      { color: '#6A9153', bold: false },
  DEBUG:     { color: '#6897BB', bold: false },
  TRACE:     { color: '#6B6B6B', bold: false },
  VERBOSE:   { color: '#6B6B6B', bold: false },
}

// IntelliJ dark theme palette
const C = {
  timestamp:    '#6B7280',   // muted gray — same as IntelliJ datetime
  pid:          '#808080',   // process ID
  separator:    '#4B5563',   // --- dashes
  bracket:      '#6B7280',   // [thread] [context]
  bracketInner: '#9E9E9E',   // text inside brackets
  logger:       '#6897BB',   // abbreviated class name (o.s.b.w...)
  loggerFull:   '#6897BB',   // full class name
  message:      '#BBBBBB',   // default message text — IntelliJ light gray
  string:       '#6A8759',   // "quoted strings"
  number:       '#6897BB',   // numbers
  port:         '#6897BB',   // port numbers
  url:          '#287BDE',   // http://...
  httpMethod:   '#CC7832',   // GET POST PUT
  status2xx:    '#6A9153',   // 200 OK
  status3xx:    '#6897BB',   // 301
  status4xx:    '#BBB529',   // 404
  status5xx:    '#FF6B68',   // 500
  duration:     '#6A9153',   // 123ms 4.5s
  stackAt:      '#9E9E9E',   // at com.foo.Bar(...)
  stackFile:    '#6897BB',   // Foo.java:42
  keyword:      '#CC7832',   // true false null
  highlight:    '#FFFFFF',   // important values (port number, app name on start)
}

// ─── Segment ──────────────────────────────────────────────────────────────
interface Seg {
  text: string
  color: string
  bg?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  dim?: boolean
}

function seg(text: string, color: string, opts?: Partial<Omit<Seg, 'text' | 'color'>>): Seg {
  return { text, color, ...opts }
}

// ─── Spring Boot / NestJS structured log parser ───────────────────────────
//
// Spring Boot format:
//   2026-04-07T11:28:22.496-05:00  INFO 68860 --- [app] [main] c.e.MyClass : message
//
// NestJS format:
//   [Nest] 12345  - 04/07/2026, 11:28:22 AM     LOG [NestApplication] message
//
const SPRING_RE =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)(\s+)(ERROR|FATAL|WARN|INFO|DEBUG|TRACE)(\s+)(\d+)(\s+)(---|\.\.\.)(\s+)(\[[^\]]*\])(\s+)(\[[^\]]*\])?(\s*)([\w.$][\w.$/:]*)?(\s*:\s*)(.*)/

const NEST_RE =
  /^(\[Nest\]|\[NestApplication\]|\[NestFactory\]|\[RoutesResolver\]|\[RouterExplorer\]|\[InstanceLoader\])(\s+)(\d+)(\s+-\s+)(.+?)(LOG|ERROR|WARN|DEBUG|VERBOSE)(\s+)(\[[^\]]+\])(\s*)(.*)/

function parseSpringBoot(line: string): Seg[] | null {
  const m = SPRING_RE.exec(line)
  if (!m) return null

  const [, ts, sp1, level, sp2, pid, sp3, sep, sp4, ctx1, sp5, ctx2, sp6, logger, colon, message] = m
  const ls = LEVEL_STYLES[level] ?? { color: C.message }

  const segs: Seg[] = []

  // Timestamp
  segs.push(seg(ts, C.timestamp))
  segs.push(seg(sp1, C.separator))

  // Level — padded, with optional bg highlight on ERROR/WARN
  segs.push(seg(level.padEnd(5), ls.color, { bold: ls.bold, bg: ls.bg }))
  segs.push(seg(sp2, C.separator))

  // PID
  segs.push(seg(pid, C.pid))
  segs.push(seg(sp3, C.separator))

  // --- separator
  segs.push(seg(sep, C.separator))
  segs.push(seg(sp4, C.separator))

  // [thread/app context]
  if (ctx1) segs.push(seg(ctx1, C.bracketInner))
  if (sp5)  segs.push(seg(sp5, C.separator))
  if (ctx2) segs.push(seg(ctx2, C.bracketInner))
  if (sp6)  segs.push(seg(sp6, C.separator))

  // Logger class — abbreviated like o.s.b.w.EmbeddedWebServer
  if (logger) segs.push(seg(logger, C.logger))

  // Colon separator
  if (colon) segs.push(seg(colon, C.separator))

  // Message — colorize inline
  if (message) segs.push(...colorizeMessage(message, level))

  return segs
}

function parseNest(line: string): Seg[] | null {
  const m = NEST_RE.exec(line)
  if (!m) return null
  const [, ctx, sp1, pid, dash, rest, level, sp2, module, sp3, message] = m
  const ls = LEVEL_STYLES[level] ?? { color: C.message }
  return [
    seg(ctx, '#A9B7C6'),
    seg(sp1 + pid, C.pid),
    seg(dash + rest, C.timestamp),
    seg(level, ls.color, { bold: ls.bold }),
    seg(sp2, C.separator),
    seg(module, C.bracketInner),
    seg(sp3, C.separator),
    ...colorizeMessage(message, level),
  ]
}

// ─── Message-level tokenizer ──────────────────────────────────────────────
// Applied to the message part after the logger colon, or full line if no structured format
const MSG_RE = new RegExp([
  // Stack trace line
  /^(\s*at\s+[\w$.<>[\]]+\([\w$.:/\\-]+(?::\d+)?\))/.source,
  // "Caused by:"
  /(Caused by:[^\n]*)/.source,
  // HTTP methods
  /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/.source,
  // HTTP status codes
  /\b(2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/.source,
  // URLs
  /(https?:\/\/[^\s,)]+)/.source,
  // Quoted strings
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.source,
  // Duration / size
  /\b(\d+(?:\.\d+)?(?:ms|s|ns|MB|KB|GB))\b/.source,
  // Port  "on port 8080"
  /\bon\s+port\s+(\d+)/.source,
  // Boolean / null keywords
  /\b(true|false|null|undefined|NaN|Infinity)\b/.source,
  // Numbers (standalone, not part of words)
  /(?<!\w)(\d+(?:\.\d+)?)(?!\w)/.source,
].join('|'), 'gim')

function colorizeMessage(msg: string, level: string): Seg[] {
  const baseColor = LEVEL_STYLES[level]?.color ?? C.message

  // For ERROR/FATAL lines, the whole message gets a tint
  const defaultColor = (level === 'ERROR' || level === 'FATAL')
    ? '#E06C6C'
    : level === 'WARN'
    ? '#C4A84F'
    : C.message

  const segs: Seg[] = []
  let last = 0
  MSG_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = MSG_RE.exec(msg)) !== null) {
    if (m.index > last) segs.push(seg(msg.slice(last, m.index), defaultColor))

    const [full, stack, causedBy, http, status, url, quoted, duration, port, keyword, num] = m

    if      (stack)    segs.push(seg(full, C.stackAt, { dim: true }))
    else if (causedBy) segs.push(seg(full, '#FF6B68', { bold: true }))
    else if (http)     segs.push(seg(full, C.httpMethod, { bold: true }))
    else if (status) {
      const s = parseInt(status)
      const c = s < 300 ? C.status2xx : s < 400 ? C.status3xx : s < 500 ? C.status4xx : C.status5xx
      segs.push(seg(full, c, { bold: true }))
    }
    else if (url)      segs.push(seg(full, C.url, { italic: true }))
    else if (quoted)   segs.push(seg(full, C.string))
    else if (duration) segs.push(seg(full, C.duration))
    else if (port)     segs.push(seg('on port ', defaultColor), seg(port, C.highlight, { bold: true }))
    else if (keyword)  segs.push(seg(full, C.keyword))
    else if (num)      segs.push(seg(full, C.number))
    else               segs.push(seg(full, defaultColor))

    last = m.index + full.length
  }

  if (last < msg.length) segs.push(seg(msg.slice(last), defaultColor))
  return segs
}

// ─── Generic fallback — line-level detection ──────────────────────────────
function colorizeFallback(line: string): Seg[] {
  // Try to detect level anywhere in the line
  let detectedLevel = ''
  for (const lvl of ['ERROR', 'FATAL', 'WARN', 'INFO', 'DEBUG', 'TRACE']) {
    if (new RegExp(`\\b${lvl}\\b`, 'i').test(line)) { detectedLevel = lvl; break }
  }
  return colorizeMessage(line, detectedLevel)
}

// ─── Main line renderer ───────────────────────────────────────────────────
function renderLine(raw: string): React.ReactNode {
  const line = stripAnsi(raw)
  if (!line.trim()) return <span>&nbsp;</span>

  const segs = parseSpringBoot(line) ?? parseNest(line) ?? colorizeFallback(line)

  return segs.map((s, i) => (
    <span key={i} style={{
      color:          s.color,
      background:     s.bg,
      fontWeight:     s.bold   ? '600'    : undefined,
      fontStyle:      s.italic ? 'italic' : undefined,
      textDecoration: s.underline ? 'underline' : undefined,
      opacity:        s.dim   ? 0.55     : undefined,
    }}>
      {s.text}
    </span>
  ))
}

// ─── Context menu ─────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number }

type LevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug'

function matchesLevel(line: string, filter: LevelFilter): boolean {
  if (filter === 'all') return true
  const u = line.toUpperCase()
  if (filter === 'error') return /\b(ERROR|FATAL|EXCEPTION)\b/.test(u)
  if (filter === 'warn')  return /\bWARN(ING)?\b/.test(u)
  if (filter === 'info')  return /\bINFO\b/.test(u)
  if (filter === 'debug') return /\b(DEBUG|TRACE|VERBOSE)\b/.test(u)
  return true
}

// ─── Component ────────────────────────────────────────────────────────────
export function LogViewer({ processKey, label, fullHeight, onClose }: Props) {
  const { logs, clearLog, statuses } = useStore()
  const allEntries = logs[processKey] ?? []
  const bottomRef  = useRef<HTMLDivElement>(null)
  const topRef     = useRef<HTMLDivElement>(null)
  const [ctx, setCtx]           = useState<CtxMenu | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [inputErr, setInputErr] = useState('')
  const [searchQuery, setSearchQuery]   = useState('')
  const [levelFilter, setLevelFilter]   = useState<LevelFilter>('all')
  const [cmdHistory, setCmdHistory]     = useState<string[]>([])
  const [historyIdx, setHistoryIdx]     = useState(-1)
  const inputRef  = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Apply search + level filter
  const entries = allEntries.filter(entry => {
    if (entry.type === 'system' || entry.type === 'stdin') return true
    const lines = entry.data
    if (searchQuery && !stripAnsi(lines).toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (levelFilter !== 'all' && !matchesLevel(stripAnsi(lines), levelFilter)) return false
    return true
  })

  const isFiltered = searchQuery !== '' || levelFilter !== 'all'

  // Derive projectId + scriptKey from processKey
  const colonIdx  = processKey.indexOf(':')
  const projectId = colonIdx > -1 ? processKey.slice(0, colonIdx) : processKey
  const scriptKey = colonIdx > -1 ? processKey.slice(colonIdx + 1) : ''
  const isRunning = statuses[processKey] === 'running'

  const sendStdin = async () => {
    const text = inputVal
    if (!text) return
    setInputVal('')
    setCmdHistory(h => [text, ...h.slice(0, 49)])
    setHistoryIdx(-1)
    const { appendLog } = useStore.getState()
    appendLog(processKey, { type: 'stdin', data: text, timestamp: Date.now() })
    const res = await window.electronAPI.sendInput(projectId, scriptKey, text + '\n')
    if (res?.error) {
      setInputErr(res.error)
      setTimeout(() => setInputErr(''), 3000)
    }
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { sendStdin(); return }
    if (e.key === 'Escape') { setInputVal(''); setHistoryIdx(-1); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIdx = Math.min(historyIdx + 1, cmdHistory.length - 1)
      setHistoryIdx(nextIdx)
      if (cmdHistory[nextIdx] !== undefined) setInputVal(cmdHistory[nextIdx])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = Math.max(historyIdx - 1, -1)
      setHistoryIdx(nextIdx)
      setInputVal(nextIdx === -1 ? '' : cmdHistory[nextIdx] ?? '')
      return
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  // close context menu on outside click or Escape
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onKey) }
  }, [ctx])

  // Cmd+F / Ctrl+F focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  label = label ?? processKey.toUpperCase().replace(':', ' / ')

  const plainText = () => entries.map((e) => e.data).join('\n')

  const copyLogs = () => {
    navigator.clipboard.writeText(plainText())
  }

  const copySelection = () => {
    const sel = window.getSelection()?.toString()
    if (sel) navigator.clipboard.writeText(sel)
  }

  const downloadLogs = () => {
    const blob = new Blob([plainText()], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${processKey.replace(':', '-')}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY })
  }, [])

  const ctxAction = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
    setCtx(null)
  }

  return (
    <div className={`log-console${fullHeight ? ' log-console--full' : ''}`}>
      <div className="log-console-bar">
        <div className="traffic-lights">
          <span className="tl tl-red" />
          <span className="tl tl-yellow" />
          <span className="tl tl-green" />
        </div>
        <span className="console-terminal-icon">⬛</span>
        <span className="console-label">Active Debug Console — {label}</span>
        <button className="btn-console-clear" onClick={copyLogs} title="Copy log to clipboard">Copy</button>
        <button className="btn-console-clear" onClick={downloadLogs} title="Download log as file">Download</button>
        <button className="btn-console-clear" onClick={() => clearLog(processKey)}>Clear</button>
        <button className="btn-console-close" onClick={onClose}>×</button>
      </div>

      {/* ── Search + level filter bar ───────────────────────── */}
      <div className="log-filter-bar">
        <div className="log-search-wrap">
          <span className="log-search-icon">⌕</span>
          <input
            ref={searchRef}
            className="log-search-input"
            type="text"
            placeholder="Search logs… (⌘F)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button className="log-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="log-level-btns">
          {(['all', 'error', 'warn', 'info', 'debug'] as LevelFilter[]).map(lvl => (
            <button
              key={lvl}
              className={`log-level-btn log-level-btn--${lvl}${levelFilter === lvl ? ' active' : ''}`}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl.toUpperCase()}
            </button>
          ))}
        </div>
        {isFiltered && (
          <span className="log-filter-count">
            {entries.filter(e => e.type !== 'system' && e.type !== 'stdin').length} / {allEntries.filter(e => e.type !== 'system' && e.type !== 'stdin').length}
          </span>
        )}
      </div>

      <div className="log-output" onContextMenu={handleContextMenu}>
        <div ref={topRef} />
        {entries.length === 0 ? (
          <span style={{ color: '#4B5563' }}>Waiting for output...</span>
        ) : (
          entries.map((entry, i) => {
            // System events (our own messages)
            if (entry.type === 'system') {
              return (
                <div key={i} className="log-entry" style={{ color: '#6B7280', fontStyle: 'italic' }}>
                  {entry.data}
                </div>
              )
            }

            // stdin echo
            if (entry.type === 'stdin') {
              return (
                <div key={i} className="log-entry log-entry--stdin">
                  <span style={{ color: '#6B7280' }}>{'> '}</span>
                  <span style={{ color: '#e2e8f0' }}>{entry.data}</span>
                </div>
              )
            }

            const lines = entry.data.split('\n').filter(l => l.length > 0)
            return lines.map((line, j) => {
              const isError = /\b(ERROR|FATAL)\b/.test(line)
              const isWarn  = !isError && /\bWARN(ING)?\b/.test(line)
              const cls     = `log-entry${isError ? ' is-error' : isWarn ? ' is-warn' : ''}`
              return (
                <div key={`${i}-${j}`} className={cls}>
                  {renderLine(line)}
                </div>
              )
            })
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── stdin input bar ─────────────────────────────────────── */}
      <div className="log-stdin-bar">
        <span className="log-stdin-prompt">{'>'}</span>
        <input
          ref={inputRef}
          className="log-stdin-input"
          type="text"
          placeholder={isRunning ? 'Send input to process… (Enter to send)' : 'Process not running'}
          disabled={!isRunning}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={onInputKey}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="log-stdin-send"
          onClick={sendStdin}
          disabled={!isRunning || !inputVal.trim()}
          title="Send (Enter)"
        >↵</button>
        {inputErr && <span className="log-stdin-err">{inputErr}</span>}
      </div>

      {ctx && (
        <div
          className="ctx-menu"
          style={{ top: ctx.y, left: ctx.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="ctx-item" onClick={ctxAction(copySelection)}>
            <span className="ctx-icon">⎘</span> Copy selection
          </button>
          <button className="ctx-item" onClick={ctxAction(copyLogs)}>
            <span className="ctx-icon">⎘</span> Copy all
          </button>
          <button className="ctx-item" onClick={ctxAction(downloadLogs)}>
            <span className="ctx-icon">↓</span> Download .log
          </button>
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={ctxAction(() => clearLog(processKey))}>
            <span className="ctx-icon">✕</span> Clear console
          </button>
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={ctxAction(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }))}>
            <span className="ctx-icon">↑</span> Scroll to top
          </button>
          <button className="ctx-item" onClick={ctxAction(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))}>
            <span className="ctx-icon">↓</span> Scroll to bottom
          </button>
        </div>
      )}
    </div>
  )
}
