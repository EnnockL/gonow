'use client'

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
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 32px 72px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>Aktiva resor just nu</span>
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
              color: '#86efac', background: 'rgba(34,197,94,0.12)',
              padding: '2px 8px', borderRadius: 100, border: '1px solid rgba(34,197,94,0.22)',
            }}>
              LIVE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Trip list */}
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {trips.map((trip, i) => (
            <div
              key={trip.id}
              style={{
                padding: '18px 20px',
                borderBottom: i < trips.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                display: 'flex', alignItems: 'center', gap: 14,
              }}
            >
              {/* Route indicator */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: trip.isReal ? '#92ff63' : 'rgba(146,255,99,0.5)', display: 'block' }} />
                <span style={{ width: 1, height: 20, background: 'linear-gradient(to bottom, #92ff63, #22c55e)', display: 'block' }} />
                <MapPin size={9} style={{ color: '#86efac' }} />
              </div>

              {/* From / to */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.from}</span>
                  {trip.isReal && (
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(146,255,99,0.2)', color: '#92ff63', border: '1px solid rgba(146,255,99,0.3)', flexShrink: 0 }}>DIN</span>
                  )}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>→ {trip.to}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{trip.carrier}</span>
                  {trip.rating !== null ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                      <Star size={9} style={{ color: '#fbbf24', fill: '#fbbf24' }} />{trip.rating}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'rgba(146,255,99,0.75)' }}>Ny bärare</span>
                  )}
                </div>
              </div>

              {/* Price + cta */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{trip.price} kr</p>
                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.48)', marginTop: 2 }}>om {trip.eta}</p>
                </div>
                <button
                  onClick={() => { onBook({ id: trip.id, from: trip.from, to: trip.to, carrier: trip.carrier, price: trip.price }); onClose() }}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: '#92ff63', color: '#0a0a0a',
                    fontSize: '0.75rem', fontWeight: 700,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'opacity 0.15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                >
                  Boka →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
