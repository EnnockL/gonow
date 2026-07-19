'use client'

import { useEffect, useState } from 'react'
import { Star, MapPin, X } from 'lucide-react'
import type { TripInfo } from './TripBookingModal'

interface DisplayTrip {
  id: string
  from: string
  to: string
  carrier: string
  rating: number | null
  price: number
  eta: string
  isReal: boolean
}

interface Props {
  trips: DisplayTrip[]
  onBook: (trip: TripInfo) => void
  onClose: () => void
}

export default function AllTripsModal({ trips, onBook, onClose }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 12 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: isMobile ? 18 : 24,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 32px 72px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: isMobile ? '16px 14px' : '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gn)', display: 'inline-block', boxShadow: '0 0 8px var(--gn)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>Aktiva resor just nu</span>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--gn-lt)',
                background: 'var(--gn-012)',
                padding: '2px 8px',
                borderRadius: 100,
                border: '1px solid var(--gn-022)',
              }}
            >
              LIVE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {trips.map((trip, i) => (
            <div
              key={trip.id}
              style={{
                padding: isMobile ? '14px 14px' : '18px 20px',
                borderBottom: i < trips.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: 14,
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: trip.isReal ? 'var(--gn)' : 'var(--gn-050)', display: 'block' }} />
                  <span style={{ width: 1, height: 20, background: 'linear-gradient(to bottom, var(--gn), var(--gn))', display: 'block' }} />
                  <MapPin size={9} style={{ color: 'var(--gn-lt)' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{trip.from}</span>
                    {trip.isReal && (
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'var(--gn-020)', color: 'var(--gn)', border: '1px solid var(--gn-030)', flexShrink: 0 }}>DIN</span>
                    )}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{'\u2192'} {trip.to}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{trip.carrier}</span>
                    {trip.rating !== null ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                        <Star size={9} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                        {trip.rating}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', color: 'var(--gn-075)' }}>Ny bärare</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems: isMobile ? 'center' : 'flex-end',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{trip.price} kr</p>
                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.48)', marginTop: 2 }}>om {trip.eta}</p>
                </div>
                <button
                  onClick={() => {
                    onBook({ id: trip.id, from: trip.from, to: trip.to, carrier: trip.carrier, price: trip.price })
                    onClose()
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'var(--gn)',
                    color: '#0a0a0a',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    minHeight: 38,
                  }}
                >
                  Boka {'\u2192'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
