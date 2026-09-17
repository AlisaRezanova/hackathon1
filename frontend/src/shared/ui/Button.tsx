import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const classes = ['ui-btn', `ui-btn--${variant}`, className].filter(Boolean).join(' ')
  return <button className={classes} {...rest} />
}
