'use client'

import { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export default function OpenTripsButton({ children, style, className }: Props) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))}
      style={{ fontFamily: 'inherit', border: 'none', cursor: 'pointer', ...style }}
      className={className}
    >
      {children}
    </button>
  )
}
