'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { MessageCircle, X, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { format, isToday, isYesterday } from 'date-fns'
import { sv } from 'date-fns/locale'
import CarrierProfileModal from '@/components/carrier/CarrierProfileModal'

interface Conversation {
  other_user_id: string
  other_user_name: string
  last_message: string
  last_at: string
  last_sender_id: string
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return 'Igår'
    return format(d, 'd MMM', { locale: sv })
  } catch { return '' }
}

function formatMsgTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

export default function ChatWidget() {
  const { userId } = useAuth()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'thread'>('list')
  const [convs, setConvs] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [unread, setUnread] = useState(0)
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

  const fetchConvs = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/messages/conversations?user_id=${userId}`).then(r => r.json()).catch(() => ({ conversations: [] }))
    const list: Conversation[] = res.conversations ?? []
    setConvs(list)
    // Compute unread badge
    const lastSeen = (() => { try { return localStorage.getItem('msgs_last_seen') ?? new Date(0).toISOString() } catch { return new Date(0).toISOString() } })()
    const count = list.filter(c => c.last_sender_id !== userId && c.last_at > lastSeen).length
    setUnread(count)
  }, [userId])

  const fetchThread = useCallback(async () => {
    if (!userId || !active) return
    const res = await fetch(`/api/messages?user_id=${userId}&with=${active.other_user_id}`).then(r => r.json()).catch(() => ({ messages: [] }))
    setThread(res.messages ?? [])
  }, [userId, active])

  // Poll conversations
  useEffect(() => {
    fetchConvs()
    const id = setInterval(fetchConvs, 30_000)
    return () => clearInterval(id)
  }, [fetchConvs])

  // Poll thread when open
  useEffect(() => {
    if (!open || view !== 'thread' || !active) return
    fetchThread()
    const id = setInterval(fetchThread, 10_000)
    return () => clearInterval(id)
  }, [open, view, active, fetchThread])

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (view === 'thread') {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    }
  }, [thread, view])

  function openWidget() {
    setOpen(true)
    setView('list')
    // mark as seen
    try { localStorage.setItem('msgs_last_seen', new Date().toISOString()) } catch {}
    setUnread(0)
  }

  function openThread(conv: Conversation) {
    setActive(conv)
    setView('thread')
    setThread([])
    setReply('')
    setSent(false)
  }

  async function handleSend() {
    if (!reply.trim() || !userId || !active) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: userId, receiver_id: active.other_user_id, content: reply.trim() }),
      })
      if (!res.ok) throw new Error()
      const optimistic: Message = {
        id: Math.random().toString(),
        sender_id: userId,
        receiver_id: active.other_user_id,
        content: reply.trim(),
        created_at: new Date().toISOString(),
      }
      setThread(prev => [...prev, optimistic])
      setReply('')
      setSent(true)
      setTimeout(() => setSent(false), 2000)
    } catch { /* silent */ }
    finally { setSending(false) }
  }

  if (!userId) return null

  const PANEL_W = 320
  const PANEL_H = 440

  return (
    <>
    <div style={{ position: 'fixed', bottom: 24, right: isMobile ? '50%' : 24, transform: isMobile ? 'translateX(50%)' : undefined, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-end', gap: 12, pointerEvents: 'none' }}>

      {/* Panel */}
      <div style={{
        width: isMobile ? 'calc(100vw - 32px)' : PANEL_W, height: PANEL_H,
        background: isDark ? '#111' : '#fff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 18,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none' as React.CSSProperties['pointerEvents'],
        transform: open ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
        transformOrigin: 'bottom right',
      }}>
        {/* Header */}
        <div style={{
          padding: '13px 16px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: isDark ? '#181818' : '#f7f7f7',
        }}>
          {view === 'thread' && (
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#737373', padding: 2, display: 'flex', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
          )}
          {view === 'thread' && active ? (
            <button onClick={() => setProfileId(active.other_user_id)} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(34,197,94,0.15))', border: '1.5px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: '#15803d' }}>
                {initials(active.other_user_name)}
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isDark ? '#fafafa' : '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {active.other_user_name}
              </span>
            </button>
          ) : (
            <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#fafafa' : '#0a0a0a', letterSpacing: '-0.02em' }}>
              Meddelanden
            </span>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#737373', padding: 2, display: 'flex', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* List view */}
        {view === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 ? (
              <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={22} style={{ color: '#22c55e' }} />
                </div>
                <p style={{ fontSize: '0.84rem', fontWeight: 700, color: isDark ? '#fafafa' : '#0a0a0a', margin: 0 }}>
                  Inga konversationer ännu
                </p>
                <p style={{ fontSize: '0.72rem', color: isDark ? '#a3a3a3' : '#737373', margin: 0, lineHeight: 1.5 }}>
                  Hitta en bärare och starta ett samtal via deras profil.
                </p>
                <a href="/profil?tab=carriers" onClick={() => setOpen(false)} style={{ marginTop: 6, padding: '9px 20px', borderRadius: 999, background: '#22c55e', color: '#0a0a0a', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                  Utforska förare
                </a>
              </div>
            ) : convs.map(conv => {
              const isMe = conv.last_sender_id === userId
              return (
                <button key={conv.other_user_id} onClick={() => openThread(conv)} style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 14px',
                  background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.12))', border: '1.5px solid rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#15803d' }}>
                    {initials(conv.other_user_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? '#fafafa' : '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.other_user_name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: isDark ? '#a3a3a3' : '#737373', flexShrink: 0, marginLeft: 6 }}>
                        {formatTime(conv.last_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: isDark ? '#a3a3a3' : '#737373', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isMe ? 'Du: ' : ''}{conv.last_message}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Thread view */}
        {view === 'thread' && active && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {thread.length === 0 && (
                <p style={{ textAlign: 'center', color: isDark ? '#a3a3a3' : '#737373', fontSize: '0.76rem', margin: '16px 0' }}>
                  Inga meddelanden ännu.
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
                      <p style={{ textAlign: 'center', fontSize: '0.62rem', color: isDark ? '#a3a3a3' : '#737373', margin: '6px 0' }}>
                        {formatMsgTime(msg.created_at)}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2 }}>
                      {senderChanged && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: isDark ? '#a3a3a3' : '#737373', paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                          {isMe ? 'Du' : active.other_user_name.split(' ')[0]}
                        </span>
                      )}
                      <div style={{
                        maxWidth: '78%', padding: '8px 12px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? '#22c55e' : (isDark ? '#2a2a2a' : '#e4e6eb'),
                        color: isMe ? '#0a0a0a' : (isDark ? '#fafafa' : '#111'),
                        fontSize: '0.82rem', lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: isDark ? '#181818' : '#f7f7f7' }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={`Aa`}
                rows={1}
                style={{
                  flex: 1, padding: '9px 13px', borderRadius: 20,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? '#111' : '#fff',
                  color: isDark ? '#fafafa' : '#0a0a0a',
                  fontFamily: 'inherit', fontSize: '0.82rem',
                  resize: 'none', outline: 'none', lineHeight: 1.4,
                  maxHeight: 80, overflowY: 'auto',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!reply.trim() || sending}
                style={{
                  width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: 'none',
                  background: reply.trim() ? (sent ? 'rgba(34,197,94,0.15)' : '#22c55e') : (isDark ? '#222' : '#e5e7eb'),
                  color: reply.trim() ? (sent ? '#16a34a' : '#0a0a0a') : (isDark ? '#555' : '#aaa'),
                  cursor: reply.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {sent ? <CheckCircle2 size={14} /> : <Send size={14} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating button */}
      <button
        onClick={() => open ? setOpen(false) : openWidget()}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#22c55e', border: 'none',
          boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'transform 0.15s, box-shadow 0.15s',
          flexShrink: 0, pointerEvents: 'auto',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(34,197,94,0.5)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(34,197,94,0.4)' }}
      >
        {open
          ? <X size={20} style={{ color: '#0a0a0a' }} />
          : <MessageCircle size={20} style={{ color: '#0a0a0a' }} />
        }
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            minWidth: 18, height: 18, borderRadius: 999,
            background: '#ef4444', color: '#fff',
            fontSize: '0.6rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #fff',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
    <CarrierProfileModal carrierId={profileId} onClose={() => setProfileId(null)} />
    </>
  )
}
