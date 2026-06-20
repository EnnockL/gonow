'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Send } from 'lucide-react'

interface ChatMessage {
  id: string
  lift_request_id: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

export default function LiftChat({ liftId }: { liftId: string }) {
  const { userId, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const prevCountRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchMessages() {
    const res = await fetch(`/api/lift/${liftId}/chat`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      const msgs = (data.messages ?? []) as ChatMessage[]
      setMessages(msgs)
      if (!open) {
        const newCount = msgs.filter(m => m.sender_id !== userId).length
        if (newCount > prevCountRef.current) setUnread(newCount - prevCountRef.current)
        prevCountRef.current = newCount
      }
    }
  }

  useEffect(() => {
    fetchMessages()
    const id = setInterval(fetchMessages, 5000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liftId])

  useEffect(() => {
    if (open) {
      setUnread(0)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  async function handleSend() {
    if (!text.trim() || !userId || !profile) return
    setSending(true)
    try {
      const res = await fetch(`/api/lift/${liftId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: userId, sender_name: profile.name, content: text.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setText('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--surface-2)',
          color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
        }}
      >
        <span>&#128172;</span>
        {open ? 'Stang chatt' : 'Chatta'}
        {!open && messages.length > 0 && (
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>({messages.length})</span>
        )}
        {unread > 0 && !open && (
          <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#22c55e', color: '#0a0a0a', fontSize: '0.58rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', margin: '20px 0' }}>
                Starta konversationen med din reskamrat.
              </p>
            ) : messages.map(msg => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? '#22c55e' : 'var(--surface-2)',
                    color: isMe ? '#0a0a0a' : 'var(--text)',
                    fontSize: '0.83rem', lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: 3 }}>
                    {isMe ? 'Du' : msg.sender_name} &middot; {new Date(msg.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Skriv ett meddelande..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              style={{
                padding: '8px 12px', borderRadius: 10, border: 'none',
                background: text.trim() ? '#22c55e' : 'var(--border)',
                color: text.trim() ? '#0a0a0a' : 'var(--muted)',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
