'use client'

import { Navigation } from 'lucide-react'

interface Props {
  address: string
  label?: string
  color?: string
}

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iP(hone|ad|od)/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export function buildNavUrl(address: string): string {
  const encoded = encodeURIComponent(address)
  const platform = detectPlatform()
  if (platform === 'ios') return `maps://maps.apple.com/?daddr=${encoded}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

export default function NavigateButton({ address, label = 'Navigera', color = '#60a5fa' }: Props) {
  function open() {
    window.open(buildNavUrl(address), '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={open}
      style={{
        flex: 1, padding: '11px 12px', borderRadius: 11,
        border: `1.5px solid ${color}44`,
        background: `${color}10`,
        color, fontWeight: 700, fontSize: '0.82rem',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 0.15s',
      }}
    >
      <Navigation size={14} />
      {label}
    </button>
  )
}
