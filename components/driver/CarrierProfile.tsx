'use client'

import { useEffect, useState } from 'react'
import { Shield, Star, MapPin, User, Send, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  name: string
  carrierId?: string
  tripId?: string
  variant: 'full' | 'light'
  tripFrom: string
  tripTo: string
  mutedBadge?: boolean
}

interface CarrierData {
  id: string
  name: string
  rating_avg: number
  rating_count: number
  bankid_verified: boolean
  member_since: string
  completed_trips: number
  age?: number | null
  city?: string | null
  gender?: string | null
  bio?: string | null
}

type Tab = 'profil' | 'om' | 'chatt'

function seed(name: string) {
  return (name.charCodeAt(0) + (name.charCodeAt(1) || 0) + (name.charCodeAt(2) || 0)) % 3
}
function initials(name: string) {
  return name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
function safeFormat(dateStr: string) {
  try { const d = new Date(dateStr); return isNaN(d.getTime()) ? null : format(d, 'MMM yyyy', { locale: sv }) } catch { return null }
}
function yearsOnPlatform(dateStr: string) {
  try { const d = new Date(dateStr); return isNaN(d.getTime()) ? '0' : String(Math.max(0, new Date().getFullYear() - d.getFullYear())) } catch { return '0' }
}

const PREF_TAGS = [
  ['🎵 Spotify-mix i bilen', '💬 Pratglad', '🐾 Husdjursvänlig', '🚭 Rökfritt'],
  ['🎵 Podcast-lyssnare', '🤫 Tyst i bilen', '🚭 Rökfritt', '❄️ Frisk luft'],
  ['🎵 Radio P3', '💬 Lagom pratglad', '☀️ Solig stämning', '🚭 Rökfritt'],
]

const TABS: { key: Tab; label: string }[] = [
  { key: 'profil', label: 'Profil' },
  { key: 'om', label: 'Om mig' },
  { key: 'chatt', label: 'Chatt' },
]

export default function CarrierProfile({ name, carrierId, tripId, mutedBadge }: Props) {
  const { userId } = useAuth()
  const s = seed(name)
  const [isMobile, setIsMobile] = useState(false)
  const [data, setData] = useState<CarrierData | null>(null)
  const [tab, setTab] = useState<Tab>('profil')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!carrierId) return
    fetch(`/api/users/${carrierId}`)
      .then(r => r.json())
      .then(d => { if (d?.name) setData(d as CarrierData) })
      .catch(() => {})
  }, [carrierId])

  const rating = data ? Number(data.rating_avg).toFixed(1) : [4.7, 4.9, 5.0][s]
  const trips  = data ? data.completed_trips : [67, 89, 124][s]
  const since  = data?.member_since ? safeFormat(data.member_since) : ['jan 2025', 'mars 2026', 'sep 2024'][s]
  const years  = data?.member_since ? yearsOnPlatform(data.member_since) : ['1', '2', '3'][s]
  const bankid = data?.bankid_verified ?? true
  const genderLabel = data?.gender === 'man' ? 'Man' : data?.gender === 'kvinna' ? 'Kvinna' : null
  const tags = PREF_TAGS[s]

  async function handleSend() {
    if (!message.trim() || !userId || !carrierId) return
    setSending(true)
    setChatError(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: userId, receiver_id: carrierId, trip_id: tripId, content: message }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSent(true)
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Kunde inte skicka')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Avatar + name */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 700 }}>
          {initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', margin: 0 }}>{name}</p>
            {bankid && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: mutedBadge ? 'var(--text)' : 'rgba(34,197,94,0.1)', color: mutedBadge ? 'var(--bg)' : '#22c55e', border: mutedBadge ? '1px solid var(--text)' : '1px solid rgba(34,197,94,0.22)' }}>
                <Shield size={8} /> BankID
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0 }}>
            {since ? `Medlem sedan ${since} · ` : ''}{years} år på Gonow
          </p>
          {(genderLabel || data?.age || data?.city) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {genderLabel && <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{genderLabel}</span>}
              {data?.age && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: 'var(--muted)' }}><User size={10} /> {data.age} år</span>}
              {data?.city && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: 'var(--muted)' }}><MapPin size={10} /> {data.city}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderRadius: 11, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8rem',
              border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === t.key ? '#22c55e' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profil' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Snittbetyg', value: rating, star: true },
            { label: 'Resor', value: trips, star: false },
            { label: 'År på Gonow', value: years, star: false },
          ].map(({ label, value, star }) => (
            <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 3, margin: 0 }}>
                {star && <Star size={12} style={{ color: '#fbbf24', fill: '#fbbf24' }} />}{value}
              </p>
              <p style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'om' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data?.bio ? (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Om mig</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{data.bio}</p>
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>Inget skrivet ännu.</p>
          )}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Om resan med mig</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: '0.75rem', padding: '5px 11px', borderRadius: 100, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'chatt' && carrierId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 0' }}>
              <CheckCircle2 size={40} style={{ color: '#15803d' }} />
              <p style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', margin: 0 }}>Meddelande skickat!</p>
              <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
                {name} ser ditt meddelande och kan svara dig direkt.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', margin: 0 }}>Skicka ett meddelande till {name}.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Kan du ta mitt paket?', 'Hur stor är bagageutrymmet?', 'Har du husdjur?'].map(q => (
                  <button key={q} type="button" onClick={() => setMessage(q)} style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 500 }}>
                    {q}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Skriv till ${name}...`}
                rows={3}
                style={{ width: '100%', padding: '11px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              {chatError && <p style={{ fontSize: '0.74rem', color: '#dc2626', margin: 0 }}>{chatError}</p>}
              <button
                type="button"
                onClick={handleSend}
                disabled={!message.trim() || sending || !userId}
                style={{ width: '100%', padding: '11px', borderRadius: 11, border: 'none', background: message.trim() && userId ? '#22c55e' : 'var(--surface-2)', color: message.trim() && userId ? '#0a0a0a' : 'var(--muted)', cursor: message.trim() && userId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
              >
                <Send size={13} /> {sending ? 'Skickar...' : 'Skicka meddelande'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
