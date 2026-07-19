'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { authedFetch } from '@/lib/auth/authed-fetch'

interface Match {
  id: string
  status: string
  proposed_pickup_date: string | null
  proposed_price: number | null
  ai_message_customer: string | null
  ai_message_driver: string | null
  expires_at: string | null
  packages: { id: string; from_city: string; to_city: string; description: string; weight_kg: number } | null
  trips: { id: string; from_city: string; to_city: string; departure_at: string } | null
  drivers: { id: string; name: string; rating_avg: number; avatar_url: string | null } | null
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  suggested: { label: 'Väntar på ditt svar', color: '#d97706', bg: 'rgba(251,191,36,0.1)' },
  customer_accepted: { label: 'Du accepterade', color: '#2563eb', bg: 'rgba(59,130,246,0.08)' },
  driver_pending_confirmation: { label: 'Väntar på transport', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  matched: { label: 'Bekräftad', color: 'var(--gn-dk)', bg: 'var(--gn-008)' },
  expired: { label: 'Svarstiden gick ut', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  cancelled: { label: 'Avbokad', color: '#dc2626', bg: 'rgba(239,68,68,0.07)' },
}

function timeLeft(iso: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Utgånget'
  const min = Math.ceil(ms / 60000)
  return `${min} min kvar`
}

export default function MatchSuggestions({ packageId, driverId }: { packageId?: string; driverId?: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (!packageId && !driverId) return
    const params = packageId ? `package_id=${packageId}` : `driver_id=${driverId}`
    fetch(`/api/matches?${params}`)
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [packageId, driverId])

  async function act(matchId: string, action: string) {
    setActingId(matchId)
    try {
      const res = await authedFetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const { match } = await res.json()
        setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...match } : m)))
      }
    } finally {
      setActingId(null)
    }
  }

  const active = matches.filter((m) => !['expired', 'cancelled'].includes(m.status))
  const history = matches.filter((m) => ['expired', 'cancelled'].includes(m.status))

  if (loading) return null
  if (!matches.length) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gn-010)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={14} color="var(--gn-dk)" />
        </div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          {packageId ? 'Gonow-förslag' : 'Bekräftelsebegäran'}
        </h3>
        {active.length > 0 && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--gn)', color: '#0a0a0a' }}>
            {active.length}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {active.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            isDriver={!!driverId}
            acting={actingId === m.id}
            onAct={(action) => act(m.id, action)}
          />
        ))}
        {history.map((m) => (
          <MatchCard key={m.id} match={m} isDriver={!!driverId} acting={false} />
        ))}
      </div>
    </div>
  )
}

function MatchCard({
  match, isDriver, acting, onAct,
}: {
  match: Match
  isDriver: boolean
  acting: boolean
  onAct?: (action: string) => void
}) {
  const meta = STATUS_META[match.status] ?? STATUS_META.suggested
  const pkg = match.packages
  const trip = match.trips
  const driver = match.drivers
  const tLeft = match.status === 'driver_pending_confirmation' ? timeLeft(match.expires_at) : null
  const isExpired = match.status === 'expired'
  const expiredMsg = isExpired && !isDriver
    ? 'Transporten bekräftades inte i tid. Gonow fortsätter söka en ny lösning åt dig.'
    : null
  const msg = expiredMsg ?? (isDriver ? match.ai_message_driver : match.ai_message_customer)

  const isSuggested = match.status === 'suggested'
  const isDriverPending = match.status === 'driver_pending_confirmation'
  const isDone = ['matched', 'expired', 'cancelled'].includes(match.status)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${isSuggested ? 'rgba(251,191,36,0.4)' : isDriverPending ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      opacity: isDone ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {pkg && (
            <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {pkg.from_city} {'\u2192'} {pkg.to_city}
            </p>
          )}
          {trip?.departure_at && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0' }}>
              {new Date(trip.departure_at).toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' kl. '}
              {new Date(trip.departure_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.color, flexShrink: 0 }}>
          {meta.label}
        </span>
      </div>

      {msg && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
          {msg}
        </div>
      )}

      {driver && !isDriver && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {driver.avatar_url
            ? <img src={driver.avatar_url} alt={driver.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#0a0a0a' }}>{driver.name[0]}</div>
          }
          <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{driver.name.split(' ')[0]}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>★ {driver.rating_avg?.toFixed(1)}</span>
          {match.proposed_price && (
            <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' }}>{match.proposed_price} kr</span>
          )}
        </div>
      )}

      {tLeft && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
          <Clock size={12} /> {tLeft} för transporten att bekräftas
        </div>
      )}

      {onAct && !isDone && (
        <div style={{ display: 'flex', gap: 8 }}>
          {isSuggested && !isDriver && (
            <>
              <button
                onClick={() => onAct('customer_accept')}
                disabled={acting}
                style={{ flex: 1, padding: '10px', minHeight: 40, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontSize: '0.82rem', fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: acting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                {acting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
                Ja, acceptera alternativet
              </button>
              <button
                onClick={() => onAct('customer_decline')}
                disabled={acting}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <XCircle size={13} />
              </button>
            </>
          )}

          {isDriverPending && isDriver && (
            <>
              <button
                onClick={() => onAct('driver_confirm')}
                disabled={acting}
                style={{ flex: 1, padding: '10px', minHeight: 40, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontSize: '0.82rem', fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: acting ? 0.6 : 1 }}
              >
                Bekräfta uppdraget
              </button>
              <button
                onClick={() => onAct('driver_decline')}
                disabled={acting}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Avvisa
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
