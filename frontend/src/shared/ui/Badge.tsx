import type { ReactNode } from 'react'

type Tone = 'default' | 'amber' | 'danger' | 'neutral'

const toneClass: Record<Tone, string> = {
  default: 'ui-badge',
  amber: 'ui-badge ui-badge--amber',
  danger: 'ui-badge ui-badge--danger',
  neutral: 'ui-badge ui-badge--neutral',
}

export function Badge({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={toneClass[tone]}>{children}</span>
}
