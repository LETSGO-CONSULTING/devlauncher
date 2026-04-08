import { Framework, ProjectType } from '../types'

interface Props {
  framework?: Framework
  projectType?: ProjectType
  size?: number
  style?: React.CSSProperties
}

// ─── Native brand colors ───────────────────────────────────────────────────
export const FRAMEWORK_COLOR: Record<Framework, string> = {
  react:      '#61DAFB',
  nextjs:     '#FFFFFF',
  angular:    '#DD0031',
  vue:        '#4FC08D',
  nuxt:       '#00DC82',
  svelte:     '#FF3E00',
  astro:      '#FF5D01',
  nestjs:     '#E0234E',
  express:    '#FFFFFF',
  fastify:    '#FFFFFF',
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

// ─── SVG paths — official brand icons ─────────────────────────────────────
function IconSVG({ fw, size }: { fw: Framework; size: number }) {
  const s = size

  switch (fw) {

    case 'react':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <g fill="none" stroke="#61DAFB" strokeWidth="4">
            <ellipse cx="50" cy="50" rx="46" ry="18" />
            <ellipse cx="50" cy="50" rx="46" ry="18" transform="rotate(60 50 50)" />
            <ellipse cx="50" cy="50" rx="46" ry="18" transform="rotate(120 50 50)" />
          </g>
          <circle cx="50" cy="50" r="7" fill="#61DAFB" />
        </svg>
      )

    case 'nextjs':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="#000" />
          <path d="M29 72V28l42 52h-8L29 44v28z" fill="#fff" />
          <path d="M65 28v27" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
        </svg>
      )

    case 'angular':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon points="50,5 93,20 86,80 50,95 14,80 7,20" fill="#DD0031" />
          <polygon points="50,5 50,95 14,80 7,20" fill="#C3002F" />
          <polygon points="50,20 70,65 30,65" fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
        </svg>
      )

    case 'vue':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <polygon points="50,8 92,8 50,75 8,8 26,8 50,51 74,8" fill="#4FC08D" />
          <polygon points="50,8 74,8 50,51 26,8" fill="#35495E" />
        </svg>
      )

    case 'nuxt':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path d="M55 20L90 80H45L55 60H72L55 32z" fill="#00DC82" />
          <path d="M38 80H10L38 32l10 18-12 20H38z" fill="#00DC82" opacity="0.7" />
        </svg>
      )

    case 'svelte':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path
            d="M85 22c-8-14-26-19-40-10L20 30C10 36 6 48 11 59c-4 6-5 14-2 21 8 14 26 19 40 10l25-18c10-6 14-18 9-29 4-6 5-14 2-21z"
            fill="#FF3E00"
          />
          <path
            d="M44 85c-8 5-18 3-24-4-4-5-5-12-2-18l1-2 8 5-1 2c-2 3-1 7 2 9 4 3 9 2 12 0l25-18c6-4 8-11 5-17-3-5-9-8-15-6l-1 1-8-5 1-2c8-5 18-3 24 4 7 9 5 22-4 29L44 85z"
            fill="#fff"
          />
          <path
            d="M56 15c8-5 18-3 24 4 4 5 5 12 2 18l-1 2-8-5 1-2c2-3 1-7-2-9-4-3-9-2-12 0L35 41c-6 4-8 11-5 17 3 5 9 8 15 6l1-1 8 5-1 2c-8 5-18 3-24-4-7-9-5-22 4-29L56 15z"
            fill="#fff"
          />
        </svg>
      )

    case 'astro':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path d="M38 72c-4-2-7-6-7-11 0-3 1-6 3-8l22-38 22 38c2 2 3 5 3 8 0 5-3 9-7 11-5 2-10 1-14-2l-4-3-4 3c-4 3-9 4-14 2z" fill="#FF5D01" />
          <path d="M50 23l13 36H37L50 23z" fill="#fff" opacity="0.8" />
        </svg>
      )

    case 'nestjs':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path
            d="M62 8C54 4 44 5 38 10 28 17 25 30 28 42c-8 3-15 10-17 18-4 16 6 32 22 36 5 2 11 2 16 0 4 6 11 10 19 10 16 0 28-14 26-30-1-7-5-13-11-17 5-12 3-26-5-34-4-4-10-7-16-7z"
            fill="#E0234E"
          />
          <path
            d="M50 30c10 0 18 8 18 18S60 66 50 66 32 58 32 48s8-18 18-18z"
            fill="#fff"
            opacity="0.15"
          />
          <text x="50" y="55" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="bold" fontFamily="sans-serif">N</text>
        </svg>
      )

    case 'express':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <rect width="100" height="100" rx="12" fill="#1a1a1a" />
          <text x="50" y="56" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="sans-serif">express</text>
        </svg>
      )

    case 'fastify':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <rect width="100" height="100" rx="12" fill="#1a1a1a" />
          <path d="M20 35h60M20 50h40M20 65h50" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <circle cx="72" cy="50" r="8" fill="#fff" />
        </svg>
      )

    case 'vite':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path d="M94 12L52 90 45 52 10 44z" fill="#646CFF" />
          <path d="M52 90L10 44l35-8z" fill="#BD34FE" />
          <path d="M94 12L52 52 45 52 52 90z" fill="#41D1FF" opacity="0.8" />
        </svg>
      )

    case 'electron':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <g fill="none" stroke="#47848F" strokeWidth="3.5">
            <ellipse cx="50" cy="50" rx="44" ry="16" />
            <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)" />
            <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)" />
          </g>
          <circle cx="50" cy="50" r="8" fill="#47848F" />
          <circle cx="94" cy="50" r="5" fill="#9FEAF9" />
        </svg>
      )

    case 'spring':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="#6DB33F" />
          <path
            d="M68 18c4 12 1 26-8 35-10 10-24 13-37 10 6 4 13 6 21 6 22 0 40-18 40-40 0-5-1-9-3-13l-3 2z"
            fill="#fff"
          />
          <path
            d="M30 76c-2-1-4-4-3-6 1-3 4-4 7-3 2 1 4 4 3 6-1 3-4 4-7 3z"
            fill="#fff"
          />
        </svg>
      )

    case 'node':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <path
            d="M50 8L88 28v40L50 92 12 68V28z"
            fill="none" stroke="#339933" strokeWidth="5"
          />
          <path
            d="M50 20v60M50 20l28 16M50 20l-28 16M50 80l28-16M50 80l-28-16M22 36l28 16 28-16"
            stroke="#339933" strokeWidth="4" strokeLinecap="round"
          />
        </svg>
      )

    case 'typescript':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <rect width="100" height="100" rx="8" fill="#3178C6" />
          <path d="M20 52h18v8H30v28h-10V60H10v-8z" fill="#fff" />
          <path d="M55 52h30v8H76v28H66V60H55v-8z" fill="#fff" />
          <path d="M55 68h21v8H55z" fill="#fff" />
        </svg>
      )

    case 'javascript':
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <rect width="100" height="100" rx="8" fill="#F7DF1E" />
          <path d="M20 80l9-5c2 3 3 5 7 5 3 0 5-2 5-6V42h11v33c0 11-6 16-16 16-8 0-13-4-16-11z" fill="#323330" />
          <path d="M60 79l9-5c2 4 5 7 10 7 4 0 7-2 7-5 0-3-3-4-8-6l-3-1c-7-3-12-7-12-15 0-8 6-13 15-13 7 0 11 2 15 9l-8 5c-2-3-4-5-7-5-3 0-5 2-5 5 0 3 2 4 7 6l3 1c8 3 13 7 13 16 0 10-8 15-18 15-10 0-16-5-18-13z" fill="#323330" />
        </svg>
      )

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#334155" />
          <text x="50" y="57" textAnchor="middle" fill="#94a3b8" fontSize="28" fontFamily="sans-serif">?</text>
        </svg>
      )
  }
}

// ─── Public component ──────────────────────────────────────────────────────
export function TechIcon({ framework, projectType, size = 24, style }: Props) {
  // Resolve framework from projectType fallback
  const fw: Framework = framework
    ?? (projectType === 'maven' || projectType === 'gradle' ? 'spring' : 'node')

  return (
    <span
      title={FRAMEWORK_LABEL[fw]}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}
    >
      <IconSVG fw={fw} size={size} />
    </span>
  )
}

// ─── Icon stack — show up to 3 icons for a project ────────────────────────
interface StackProps {
  frameworks: Framework[]
  size?: number
}

export function TechIconStack({ frameworks, size = 20 }: StackProps) {
  const visible = frameworks.slice(0, 3)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {visible.map((fw) => (
        <TechIcon key={fw} framework={fw} size={size} />
      ))}
    </div>
  )
}
