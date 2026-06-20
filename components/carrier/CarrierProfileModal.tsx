'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Star, Shield, CheckCircle2, Calendar, MapPin, User, Send } from 'lucide-react'
import { calculateGonowScore } from '@/lib/gonow-score'
import { GonowScoreBadgeCompact } from '@/components/GonowScoreBadge'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'

interface CarrierProfile {
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

interface Props {
  carrierId: string | null
  onClose: () => void
}

type Tab = 'profil' | 'om' | 'chatt'

const PREF_TAGS = [
  ['🎵 Spotify-mix i bilen', '💬 Pratglad', '🐾 Husdjursvänlig', '🚭 Rökfritt'],
  ['🎵 Podcast-lyssnare', '🤫 Tyst i bilen', '🚭 Rökfritt', '❄️ Frisk luft'],
  ['🎵 Radio P3', '💬 Lagom pratglad', '☀️ Solig stämning', '🚭 Rökfritt'],
]
function seed(name: string) {
  return (name.charCodeAt(0) + (name.charCodeAt(1) || 0) + (name.charCodeAt(2) || 0)) % 3
}
function safeDate(s: string) {
  try { const d = new Date(s); return isNaN(d.getTime()) ? '—' : format(d, 'MMM yyyy', { locale: sv }) } catch { return '—' }
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'profil', label: 'Profil' },
  { key: 'om', label: 'Om mig' },
  { key: 'chatt', label: 'Chatt' },
]

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

function formatMsgTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function CarrierProfileModal({ carrierId, onClose }: Props) {
  const { userId } = useAuth()
  const [profile, setProfile] = useState<CarrierProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('profil')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = document.documentElement
    setIsDark(el.classList.contains('dark'))
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!carrierId) return
    setLoading(true)
    setProfile(null)
    setTab('profil')
    setThread([])
    setMessage('')
    fetch(`/api/users/${carrierId}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .finally(() => setLoading(false))
  }, [carrierId])

  useEffect(() => {
    if (tab !== 'chatt' || !carrierId || !userId) return
    setThreadLoading(true)
    fetch(`/api/messages?user_id=${userId}&with=${carrierId}`)
      .then(r => r.json())
      .then(d => setThread(d.messages ?? []))
      .finally(() => setThreadLoading(false))
  }, [tab, carrierId, userId])

  useEffect(() => {
    if (tab === 'chatt') {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [thread, tab])

  if (!carrierId) return null

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  const rating = Number(profile?.rating_avg ?? 5).toFixed(1)
  const gonowScore = profile ? calculateGonowScore({ rating_avg: profile.rating_avg, rating_count: profile.rating_count, bankid_verified: profile.bankid_verified }) : null
  const genderLabel = profile?.gender === 'man' ? 'Man' : profile?.gender === 'kvinna' ? 'Kvinna' : null
  const tags = profile?.name ? PREF_TAGS[seed(profile.name)] : PREF_TAGS[0]

  async function handleSend() {
    if (!message.trim() || !userId || !carrierId) return
    setSending(true)
    setChatError(null)
    const content = message.trim()
    setMessage('')
    // Optimistically add
    const optimistic: Message = { id: Math.random().toString(), sender_id: userId, receiver_id: carrierId, content, created_at: new Date().toISOString() }
    setThread(prev => [...prev, optimistic])
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: userId, receiver_id: carrierId, content }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Kunde inte skicka')
      setThread(prev => prev.filter(m => m.id !== optimistic.id))
      setMessage(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 901, width: '100%', maxWidth: 380,
        background: 'var(--surface)', borderRadius: isMobile ? 18 : 24,
        border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        overflow: 'hidden', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        margin: isMobile ? '0 12px' : 0,
      }}>
        {/* Header — always visible */}
        <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.06) 100%)', borderBottom: '1px solid rgba(34,197,94,0.15)', padding: isMobile ? '18px 14px 12px' : '22px 20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={13} />
          </button>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(34,197,94,0.15))', border: '2px solid rgba(34,197,94,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
            {loading ? '…' : initials}
          </div>
          {!loading && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', margin: 0 }}>{profile?.name || '—'}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                {genderLabel && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{genderLabel}</span>}
                {profile?.age && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: 'var(--muted)' }}><User size={10} />{profile.age} år</span>}
                {profile?.city && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: 'var(--muted)' }}><MapPin size={10} />{profile.city}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 4 }}>
                <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>{rating}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>({profile?.rating_count ?? 0})</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '11px 0', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer', background: 'transparent', color: tab === t.key ? 'var(--text)' : 'var(--muted)', borderBottom: `2px solid ${tab === t.key ? '#22c55e' : 'transparent'}`, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: isMobile ? '14px 14px' : '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {tab === 'profil' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {profile?.bankid_verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                    <Shield size={11} /> BankID verifierad
                  </span>
                )}
                {gonowScore && <GonowScoreBadgeCompact result={gonowScore} />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}><CheckCircle2 size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uppdrag</span></div>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em' }}>{loading ? '…' : (profile?.completed_trips ?? 0)}</span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--muted)' }}>genomförda</span>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}><Calendar size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medlem</span></div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{loading || !profile ? '…' : safeDate(profile.member_since)}</span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--muted)' }}>sedan</span>
                </div>
              </div>
              {profile && profile.rating_count > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Genomsnittligt betyg</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#d97706' }}>{rating} / 5</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(245,158,11,0.15)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#f59e0b', width: `${Math.min(100, ((profile?.rating_avg ?? 0) / 5) * 100)}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'om' && (
            <>
              {profile?.bio ? (
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Om mig</p>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>{profile.bio}</p>
                </div>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Inget skrivet ännu.</p>
              )}
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Om resan med mig</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.78rem', padding: '6px 13px', borderRadius: 100, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'chatt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '-10px -18px -10px', overflow: 'hidden' }}>
              {/* Thread */}
              <div style={{ overflowY: 'auto', maxHeight: 260, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {threadLoading && (
                  <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--muted)', padding: '12px 0' }}>Laddar…</p>
                )}
                {!threadLoading && thread.length === 0 && (
                  <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--muted)', padding: '12px 0' }}>
                    Inga meddelanden ännu. Skriv något nedan!
                  </p>
                )}
                {thread.map((msg, i) => {
                  const isMe = msg.sender_id === userId
                  const prev = thread[i - 1]
                  const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000
                  const senderChanged = i === 0 || prev.sender_id !== msg.sender_id
                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <p style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--muted)', margin: '4px 0 6px' }}>
                          {formatMsgTime(msg.created_at)}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2 }}>
                        {senderChanged && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                            {isMe ? 'Du' : profile?.name?.split(' ')[0] ?? ''}
                          </span>
                        )}
                        <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isMe ? '#22c55e' : (isDark ? '#2a2a2a' : '#e4e6eb'), color: isMe ? '#0a0a0a' : (isDark ? '#fafafa' : '#111'), fontSize: '0.82rem', lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--surface-2)' }}>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={`Aa`}
                  rows={1}
                  style={{ flex: 1, padding: '9px 13px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', resize: 'none', outline: 'none', lineHeight: 1.4, maxHeight: 80, overflowY: 'auto', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!message.trim() || sending || !userId}
                  style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: 'none', background: message.trim() ? '#22c55e' : 'var(--border)', color: message.trim() ? '#0a0a0a' : 'var(--muted)', cursor: message.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                >
                  <Send size={14} />
                </button>
              </div>
              {chatError && <p style={{ fontSize: '0.74rem', color: '#dc2626', padding: '4px 16px 8px' }}>{chatError}</p>}
            </div>
          )}

          <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', marginTop: 2 }}>
            Stäng
          </button>
        </div>
      </div>
    </>
  )
}
