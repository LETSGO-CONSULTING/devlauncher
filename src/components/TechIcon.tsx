import { Icon } from '@iconify/react'
import { Framework } from '../types'

// ─── Iconify icon IDs (logos set = colored, devicon = colored variants) ───
const FRAMEWORK_ICON: Record<Framework, string> = {
  react:      'logos:react',
  nextjs:     'logos:nextjs-icon',
  angular:    'logos:angular-icon',
  vue:        'logos:vue',
  nuxt:       'logos:nuxt-icon',
  svelte:     'logos:svelte-icon',
  astro:      'logos:astro-icon',
  nestjs:     'logos:nestjs',
  express:    'logos:nodejs-icon',
  fastify:    'devicon:fastify',
  vite:       'logos:vitejs',
  electron:   'logos:electron',
  spring:     'logos:spring-icon',
  node:       'logos:nodejs-icon',
  typescript: 'logos:typescript-icon',
  javascript: 'logos:javascript',
}

// ─── Native brand colors (for text/accents when needed) ───────────────────
export const FRAMEWORK_COLOR: Record<Framework, string> = {
  react:      '#61DAFB',
  nextjs:     '#ffffff',
  angular:    '#DD0031',
  vue:        '#4FC08D',
  nuxt:       '#00DC82',
  svelte:     '#FF3E00',
  astro:      '#FF5D01',
  nestjs:     '#E0234E',
  express:    '#339933',
  fastify:    '#ffffff',
  vite:       '#646CFF',
  electron:   '#47848F',
  spring:     '#6DB33F',
  node:       '#339933',
  typescript: '#3178C6',
  javascript: '#F7DF1E',
}

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  react:      'React',
  nextjs:     'Next.js',
  angular:    'Angular',
  vue:        'Vue',
  nuxt:       'Nuxt',
  svelte:     'Svelte',
  astro:      'Astro',
  nestjs:     'NestJS',
  express:    'Express',
  fastify:    'Fastify',
  vite:       'Vite',
  electron:   'Electron',
  spring:     'Spring Boot',
  node:       'Node.js',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
}

// ─── Single icon ──────────────────────────────────────────────────────────
interface Props {
  framework?: Framework
  size?: number
  style?: React.CSSProperties
}

export function TechIcon({ framework, size = 24, style }: Props) {
  if (!framework) return null
  const icon = FRAMEWORK_ICON[framework]
  if (!icon) return null

  return (
    <span
      title={FRAMEWORK_LABEL[framework]}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}
    >
      <Icon icon={icon} width={size} height={size} />
    </span>
  )
}

// ─── Stack — show up to N icons side by side ──────────────────────────────
interface StackProps {
  frameworks: Framework[]
  size?: number
  max?: number
}

export function TechIconStack({ frameworks, size = 18, max = 3 }: StackProps) {
  const visible = [...new Set(frameworks)].slice(0, max)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {visible.map((fw) => (
        <TechIcon key={fw} framework={fw} size={size} />
      ))}
    </div>
  )
}
