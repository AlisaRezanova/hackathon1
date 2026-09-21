import type { SVGProps } from 'react'

type IconName = 'home' | 'conversation' | 'analytics' | 'history' | 'arrow' | 'spark'

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }

  if (name === 'home') {
    return <svg {...common}><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6" /></svg>
  }
  if (name === 'conversation') {
    return <svg {...common}><path d="M5 5.5h14v10H9l-4 3v-13Z" /><path d="M8.5 9h7M8.5 12h4" /></svg>
  }
  if (name === 'analytics') {
    return <svg {...common}><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19.5h18" /></svg>
  }
  if (name === 'history') {
    return <svg {...common}><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6M12 8v4l2.8 1.7" /></svg>
  }
  if (name === 'spark') {
    return <svg {...common}><path d="m12 3 1.2 4.3L17 9l-3.8 1.7L12 15l-1.2-4.3L7 9l3.8-1.7L12 3Z" /><path d="m18.5 15 .6 2.1 1.9.9-1.9.9-.6 2.1-.6-2.1L16 18l1.9-.9.6-2.1Z" /></svg>
  }
  return <svg {...common}><path d="M5 12h14M14 7l5 5-5 5" /></svg>
}
