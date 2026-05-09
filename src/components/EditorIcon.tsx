import { Icon } from '@iconify/react'

const EDITOR_ICON: Record<string, string> = {
  code:      'logos:visual-studio-code',
  webstorm:  'logos:webstorm',
  idea:      'logos:intellij-idea',
  'idea-ce': 'logos:intellij-idea',
  pycharm:   'logos:pycharm',
  xcode:     'logos:xcode',
  rubymine:  'logos:rubymine',
  goland:    'logos:goland',
  subl:      'logos:sublime-text',
}

interface Props {
  editorId: string
  label: string
  size?: number
}

export function EditorIcon({ editorId, label, size = 15 }: Props) {
  const icon = EDITOR_ICON[editorId]
  if (icon) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
        <Icon icon={icon} width={size} height={size} />
      </span>
    )
  }
  // Fallback: colored initial circle
  const initial = label.charAt(0).toUpperCase()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(124,92,252,0.3)', color: 'var(--accent)',
      fontSize: size * 0.6, fontWeight: 700, flexShrink: 0,
    }}>
      {initial}
    </span>
  )
}
