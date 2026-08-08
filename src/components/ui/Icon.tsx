import type { CSSProperties } from 'preact'

interface IconProps {
  name: string
  brand?: boolean
  class?: string
  style?: CSSProperties
}

export function Icon({ name, brand, class: className, style }: IconProps) {
  return (
    <i
      class={`${brand ? 'fa-brands' : 'fa-solid'} fa-${name}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    />
  )
}
