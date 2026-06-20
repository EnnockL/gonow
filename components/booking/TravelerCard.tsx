'use client'

import { Trip } from '@/lib/types'
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Shield,
  Star,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { calculateGonowScore } from '@/lib/gonow-score'
import { GonowScoreBadgeCompact } from '@/components/GonowScoreBadge'

interface TravelerCardProps {
  trip: Trip & { users?: { name: string; rating_avg: number; rating_count: number; avatar_url?: string } }
  price: number
  onSelect: () => void
  onViewProfile?: () => void
  selected?: boolean
  bookingMeta?: {
    acceptedPassengers: number
    acceptedPackages: number
    seatsLeft: number | null
    weightLeftKg: number | null
    myBookingStatus?: string | null
  }
}

export default function TravelerCard({
  trip,
  price,
  onSelect,
  onViewProfile,
  selected,
  bookingMeta,
}: TravelerCardProps) {
  const carrier = trip.users
  const initials = carrier?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'GN'
  const rating = carrier?.rating_avg?.toFixed(1) || '5.0'
  const ratingCount = carrier?.rating_count || 0
  const gonowScore = calculateGonowScore({
    rating_avg: carrier?.rating_avg ?? 0,
    rating_count: carrier?.rating_count ?? 0,
    bankid_verified: true,
  })

  const myStatusLabel =
    bookingMeta?.myBookingStatus === 'accepted'
      ? 'Din förfrågan är accepterad'
      : bookingMeta?.myBookingStatus === 'pending'
        ? 'Du väntar på svar'
        : bookingMeta?.myBookingStatus === 'declined'
          ? 'Din senaste förfrågan avböjdes'
          : null

  const routeLabel = `${trip.from_city} → ${trip.to_city}`
  const seatsLeftLabel = typeof bookingMeta?.seatsLeft === 'number' ? `${bookingMeta.seatsLeft} kvar` : 'Ej satt'
  const weightLeftLabel =
    typeof bookingMeta?.weightLeftKg === 'number' ? `${bookingMeta.weightLeftKg} kg` : `${trip.weight_capacity_kg} kg`
  const totalAcceptedNow = (bookingMeta?.acceptedPassengers ?? 0) + (bookingMeta?.acceptedPackages ?? 0)

  return (
    <button
      onClick={onSelect}
      className="traveler-card"
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected
          ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.04) 100%)'
          : 'var(--surface)',
        border: `1.5px solid ${selected ? '#22c55e' : 'var(--border)'}`,
        borderRadius: 20,
        padding: '18px 20px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.18s ease',
        boxShadow: selected
          ? '0 0 0 3px rgba(34,197,94,0.12), 0 8px 32px rgba(34,197,94,0.08)'
          : '0 2px 12px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.45)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
        }
      }}
    >
      <div className="traveler-card__head" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          onClick={(e) => {
            e.stopPropagation()
            onViewProfile?.()
          }}
          title="Se profil"
          role={onViewProfile ? 'button' : undefined}
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            flexShrink: 0,
            background: selected
              ? 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))'
              : 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))',
            border: `1.5px solid ${selected ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 800,
            color: '#22c55e',
            letterSpacing: '-0.02em',
            cursor: onViewProfile ? 'pointer' : 'default',
            transition: 'transform 0.12s ease',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            if (onViewProfile) (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="traveler-card__headline"
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
          >
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: '0.98rem',
                  color: 'var(--text)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {carrier?.name || 'Anonym bärare'}
              </p>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.77rem',
                  color: 'var(--muted)',
                  margin: '6px 0 0',
                }}
              >
                <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{routeLabel}</span>
              </p>
              {onViewProfile && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewProfile()
                  }}
                  role="button"
                  style={{
                    display: 'inline-block',
                    marginTop: 6,
                    fontSize: '0.7rem',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Se profil
                </span>
              )}
            </div>

            <div className="traveler-card__price" style={{ textAlign: 'right', flexShrink: 0 }}>
              <p
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: '#22c55e',
                  margin: 0,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {price} kr
              </p>
              <p
                style={{
                  fontSize: '0.62rem',
                  color: 'var(--muted)',
                  margin: '2px 0 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                uppskattat
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, flexWrap: 'wrap' }}>
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

      <div className="traveler-card__metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Säten kvar', value: seatsLeftLabel, icon: Users },
          { label: 'Vikt kvar', value: weightLeftLabel, icon: Package },
          { label: 'Aktiva nu', value: `${totalAcceptedNow}`, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            style={{
              padding: '12px 12px 11px',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: selected ? 'rgba(34,197,94,0.06)' : 'var(--surface-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.66rem',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              <Icon size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {label}
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 800, lineHeight: 1.2 }}>{value}</strong>
          </div>
        ))}
      </div>

      <div className="traveler-card__badges" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
            color: '#16a34a',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          <Shield size={10} /> BankID
        </span>
        <GonowScoreBadgeCompact result={gonowScore} />
        {trip.vehicle_type && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '0.7rem',
              fontWeight: 500,
            }}
          >
            <Car size={10} /> {trip.vehicle_type}
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            fontSize: '0.7rem',
            fontWeight: 500,
          }}
        >
          <Package size={10} /> Max {trip.weight_capacity_kg} kg
        </span>
      </div>

      <div className="traveler-card__footer" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {myStatusLabel ? (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.16)',
                color: '#2563eb',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {myStatusLabel}
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Jämför kapacitet, pris och status innan du skickar.
            </span>
          )}
        </div>

        {selected ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: '#22c55e',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
              justifyContent: 'flex-end',
            }}
          >
            <CheckCircle2 size={16} style={{ fill: 'rgba(34,197,94,0.15)' }} /> Vald
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              flexShrink: 0,
              transition: 'all 0.15s',
              justifyContent: 'center',
            }}
          >
            Välj <ArrowRight size={12} />
          </div>
        )}
      </div>

      {bookingMeta && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {bookingMeta.acceptedPassengers ? (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                background: 'var(--accent-soft)',
                border: '1px solid rgba(34,197,94,0.22)',
                color: 'var(--text)',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {bookingMeta.acceptedPassengers} bekräftade passagerare
            </span>
          ) : null}

          {bookingMeta.acceptedPackages ? (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {bookingMeta.acceptedPackages} accepterade paket
            </span>
          ) : null}

          {bookingMeta.seatsLeft !== null && typeof bookingMeta.seatsLeft === 'number' ? (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                background: bookingMeta.seatsLeft > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${bookingMeta.seatsLeft > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.18)'}`,
                color: bookingMeta.seatsLeft > 0 ? '#15803d' : '#dc2626',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {bookingMeta.seatsLeft} säten kvar
            </span>
          ) : null}
        </div>
      )}

      <style jsx>{`
        .traveler-card__head,
        .traveler-card__headline,
        .traveler-card__footer,
        .traveler-card__metrics {
          min-width: 0;
        }

        @media (max-width: 700px) {
          .traveler-card {
            padding: 16px 16px 18px !important;
            gap: 12px !important;
            border-radius: 16px !important;
          }

          .traveler-card__head {
            gap: 12px !important;
          }

          .traveler-card__headline {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .traveler-card__price {
            text-align: left !important;
          }

          .traveler-card__metrics {
            grid-template-columns: 1fr !important;
          }

          .traveler-card__footer {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </button>
  )
}
