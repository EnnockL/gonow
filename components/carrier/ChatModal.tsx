'use client'

import { useState } from 'react'
import { X, Send, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  receiverId: string
  receiverName: string
  tripId?: string
  onClose: () => void
}

export default function ChatModal({ receiverId, receiverName, tripId, onClose }: Props) {
  const { userId } = useAuth()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim() || !userId) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: userId, receiver_id: receiverId, trip_id: tripId, content: message }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skicka')
    } finally {
      setSending(false)
    }
  }

  const initials = receiverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1001, width: '100%', maxWidth: 400,
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(146,255,99,0.25), rgba(146,255,99,0.1))',
            border: '1.5px solid rgba(146,255,99,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.82rem', fontWeight: 800, color: '#15803d',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', margin: 0 }}>Fråga {receiverName}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0 }}>Meddelandet syns i appen</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <CheckCircle2 size={40} style={{ color: '#15803d' }} />
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', margin: 0 }}>Meddelande skickat!</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
                {receiverName} ser ditt meddelande i appen och kan svara dig direkt.
              </p>
              <button onClick={onClose} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Stäng
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {['Kan du ta mitt paket?', 'Hur stor är bagageutrymmet?', 'Har du husdjur?'].map(q => (
                  <button key={q} onClick={() => setMessage(q)} style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 500 }}>
                    {q}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Skriv till ${receiverName}...`}
                rows={4}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.84rem',
                  resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {error && <p style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: 6 }}>{error}</p>}
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending || !userId}
                style={{
                  width: '100%', marginTop: 10, padding: '12px',
                  borderRadius: 12, border: 'none',
                  background: message.trim() && userId ? '#92ff63' : 'var(--surface-2)',
                  color: message.trim() && userId ? '#0a0a0a' : 'var(--muted)',
                  cursor: message.trim() && userId ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all 0.15s',
                }}
              >
                <Send size={14} /> {sending ? 'Skickar...' : 'Skicka meddelande'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
