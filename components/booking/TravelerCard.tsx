'use client'

import { Trip } from '@/lib/types'
import { Star, Shield, Car, Package, Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { calculateGonowScore } from '@/lib/gonow-score'
import { GonowScoreBadgeCompact } from '@/components/GonowScoreBadge'

interface TravelerCardProps {
  trip: Trip & { users?: { name: string; rating_avg: number; rating_count: number; avatar_url?: string } }
  price: number
  onSelect: () => void
  selected?: boolean
  bookingMeta?: {
    acceptedPassengers: number
    acceptedPackages: number
    seatsLeft: number | null
    weightLeftKg: number | null
    myBookingStatus?: string | null
  }
}

export default function TravelerCard({ trip, price, onSelect, selected, bookingMeta }: TravelerCardProps) {
  const carrier = trip.users
  const initials = carrier?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'GN'
  const rating = carrier?.rating_avg?.toFixed(1) || '5.0'
  const ratingCount = carrier?.rating_count || 0
  const gonowScore = calculateGonowScore({
    rating_avg:      carrier?.rating_avg      ?? 0,
    rating_count:    carrier?.rating_count    ?? 0,
    bankid_verified: true,
  })

  const myStatusLabel = bookingMeta?.myBookingStatus === 'accepted'
    ? 'Din förfrågan är accepterad'
    : bookingMeta?.myBookingStatus === 'pending'
      ? 'Du väntar på svar'
      : bookingMeta?.myBookingStatus === 'declined'
        ? 'Din senaste förfrågan avböjdes'
        : null

  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected
          ? 'linear-gradient(135deg, rgba(146,255,99,0.08) 0%, rgba(146,255,99,0.04) 100%)'
          : 'var(--surface)',
        border: `1.5px solid ${selected ? '#92ff63' : 'var(--border)'}`,
        borderRadius: 18,
        padding: '18px 20px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.18s ease',
        boxShadow: selected
          ? '0 0 0 3px rgba(146,255,99,0.12), 0 8px 32px rgba(146,255,99,0.08)'
          : '0 2px 12px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      onMouseEnter={e => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(146,255,99,0.45)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: selected
            ? 'linear-gradient(135deg, rgba(146,255,99,0.3), rgba(146,255,99,0.15))'
            : 'linear-gradient(135deg, rgba(146,255,99,0.18), rgba(146,255,99,0.08))',
          border: `1.5px solid ${selected ? 'rgba(146,255,99,0.5)' : 'rgba(146,255,99,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', fontWeight: 800, color: '#92ff63',
          letterSpacing: '-0.02em',
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              {carrier?.name || 'Anonym bärare'}
            </p>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '1.35rem', fontWeight: 900, color: '#92ff63', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {price} kr
              </p>
              <p style={{ fontSize: '0.62rem', color: 'var(--muted)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                uppskattat
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--muted)' }}>
              <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
              <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{rating}</strong>
              <span style={{ color: 'var(--muted)' }}>({ratingCount})</span>
            </span>
            {trip.departure_at && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--muted)' }}>
                <Clock size={11} style={{ flexShrink: 0 }} />
                {format(new Date(trip.departure_at), 'EEE d MMM, HH:mm', { locale: sv })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#16a34a', fontSize: '0.7rem', fontWeight: 600,
          }}>
            <Shield size={10} /> BankID
          </span>
          <GonowScoreBadgeCompact result={gonowScore} />
          {trip.vehicle_type && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--muted)', fontSize: '0.7rem', fontWeight: 500,
            }}>
              <Car size={10} /> {trip.vehicle_type}
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: '0.7rem', fontWeight: 500,
          }}>
            <Package size={10} /> Max {trip.weight_capacity_kg} kg
          </span>
        </div>

        {selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#92ff63', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
            <CheckCircle2 size={16} style={{ fill: 'rgba(146,255,99,0.15)' }} /> Vald
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
            transition: 'all 0.15s',
          }}>
            Välj <ArrowRight size={12} />
          </div>
        )}
      </div>

      {(bookingMeta || myStatusLabel) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {bookingMeta?.acceptedPassengers ? (
            <span style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid rgba(146,255,99,0.22)', color: 'var(--text)', fontSize: '0.7rem', fontWeight: 600 }}>
              {bookingMeta.acceptedPassengers} bekräftade passagerare
            </span>
          ) : null}
          {bookingMeta?.acceptedPackages ? (
            <span style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.7rem', fontWeight: 600 }}>
              {bookingMeta.acceptedPackages} accepterade paket
            </span>
          ) : null}
          {bookingMeta?.seatsLeft !== null && typeof bookingMeta?.seatsLeft === 'number' ? (
            <span style={{ padding: '5px 10px', borderRadius: 999, background: bookingMeta.seatsLeft > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${bookingMeta.seatsLeft > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.18)'}`, color: bookingMeta.seatsLeft > 0 ? '#15803d' : '#dc2626', fontSize: '0.7rem', fontWeight: 700 }}>
              {bookingMeta.seatsLeft} säten kvar
            </span>
          ) : null}
          {myStatusLabel ? (
            <span style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.16)', color: '#2563eb', fontSize: '0.7rem', fontWeight: 700 }}>
              {myStatusLabel}
            </span>
          ) : null}
        </div>
      )}
    </button>
  )
}
