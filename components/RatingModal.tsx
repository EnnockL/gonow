'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, X } from 'lucide-react'

interface Props {
  orderId: string
  fromUserId: string
  toUserId: string
  toUserName: string
  role: 'sender' | 'carrier'
  onDone: () => void
}

export default function RatingModal({ orderId, fromUserId, toUserId, toUserName, role, onDone }: Props) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const title = role === 'sender'
    ? `Betygsätt din bärare`
    : `Betygsätt avsändaren`

  async function submit() {
    if (stars === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, from_user_id: fromUserId, to_user_id: toUserId, rating: stars, comment }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fel')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte skicka betyg')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      onClick={onDone}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'rgba(12,12,12,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, width: '100%', maxWidth: 400, padding: '28px 24px', boxShadow: '0 32px 72px rgba(0,0,0,0.7)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gn)', marginBottom: 4 }}>Leverans klar</p>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>{title}</h2>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{toUserName}</p>
          </div>
          <button onClick={onDone} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} />
          </button>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setStars(n)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <Star
                size={36}
                fill={(hovered || stars) >= n ? 'var(--gn)' : 'none'}
                color={(hovered || stars) >= n ? 'var(--gn)' : 'rgba(255,255,255,0.2)'}
                style={{ transition: 'all 0.1s' }}
              />
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>
          {stars === 0 ? 'Välj ett betyg' : stars === 5 ? 'Utmärkt!' : stars === 4 ? 'Bra!' : stars === 3 ? 'Ok' : stars === 2 ? 'Under förväntan' : 'Dålig upplevelse'}
        </p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Kommentar (valfritt)..."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
        />

        {error && <p style={{ fontSize: '0.78rem', color: '#f87171', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDone} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.86rem' }}>
            Hoppa över
          </button>
          <button
            onClick={submit}
            disabled={stars === 0 || loading}
            style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: stars === 0 ? 'rgba(255,255,255,0.1)' : 'var(--gn)', color: stars === 0 ? 'rgba(255,255,255,0.3)' : '#0a0a0a', cursor: stars === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem' }}
          >
            {loading ? 'Skickar...' : 'Skicka betyg'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
