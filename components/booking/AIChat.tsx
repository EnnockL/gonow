'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Loader2, Zap } from 'lucide-react'
import { AIParseResult } from '@/lib/types'

interface Message { role: 'user' | 'assistant'; content: string }
interface AIChatProps { onParsed: (result: AIParseResult) => void }

const SUGGESTIONS = [
  'Skicka 2 kg paket från Vasagatan 11 lgh 302, 111 20 Stockholm till Storgatan 5, 411 38 Göteborg',
  'Hämta IKEA-order i Kungens Kurva, leverera till Solnavägen 4, 113 65 Stockholm',
  'Retur till H&M, 500g från Davidshallsgatan 7, 211 45 Malmö till Uppsala',
  'Söker lift från Drottninggatan 1, Uppsala till Stockholm imorgon',
]

export default function AIChat({ onParsed }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hej! Berätta vad du vill skicka, varifrån och vart.\n\nDu kan skriva hela adressen — gata, nummer, lgh och postnummer — så hittar vi rätt.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text?: string) {
    const msg = text || input
    if (!msg.trim()) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, imageBase64 }),
      })
      const data = await res.json()
      setImageBase64(null)

      if (data.success) {
        const r: AIParseResult = data.data
        const typeLabel = r.type === 'package' ? 'Paket' : r.type === 'pickup' ? 'Butiksupphämtning' : r.type === 'return' ? 'Retur' : 'Lift'
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Perfekt! Jag hittade det här:\n\n**${typeLabel}** · ${r.from_city} → ${r.to_city}${r.weight_kg ? ` · ${r.weight_kg} kg` : ''}${r.departure_date ? ` · ${r.departure_date}` : ''}\n\nUppskattat pris: **${r.estimated_price_sek} SEK**\n\nSöker tillgängliga bärare...`,
          },
        ])
        setTimeout(() => onParsed(r), 10000)
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Hmm, jag förstod inte riktigt. Kan du berätta lite mer — till exempel "skicka 2 kg paket från Stockholm till Göteborg"?' },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Något gick fel. Försök igen om ett ögonblick.' },
      ])
    }
    setLoading(false)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setImageBase64(base64)
      setMessages((prev) => [...prev, { role: 'user', content: '📎 Bild bifogad' }])
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
      {/* Chat window */}
      <div style={{
        height: isMobile ? 200 : 260,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '0 0 8px',
        marginBottom: 10,
        width: '100%',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>
                <Zap size={11} style={{ color: '#22c55e' }} />
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              padding: '9px 13px',
              borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? '#22c55e' : 'rgba(255,255,255,0.1)',
              color: m.role === 'user' ? '#0a0a0a' : 'rgba(255,255,255,0.9)',
              border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.1)' : 'none',
              fontWeight: m.role === 'user' ? 600 : 400,
              backdropFilter: m.role === 'assistant' ? 'blur(8px)' : 'none',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Zap size={11} style={{ color: '#22c55e' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '9px 13px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px 12px 12px 4px' }}>
              {[0, 1, 2].map((n) => (
                <span key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'block', animation: `bounce 1.2s ${n * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              style={{
                fontSize: '0.70rem',
                padding: '5px 11px',
                borderRadius: 100,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = '#22c55e'
                el.style.borderColor = 'rgba(34,197,94,0.35)'
                el.style.background = 'rgba(34,197,94,0.08)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'rgba(255,255,255,0.6)'
                el.style.borderColor = 'rgba(255,255,255,0.15)'
                el.style.background = 'rgba(255,255,255,0.07)'
              }}
            >
              {s.slice(0, 40)}…
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12,
        padding: '6px 8px',
        transition: 'border-color 0.15s',
        width: '100%',
        boxSizing: 'border-box',
      }}
        onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#22c55e' }}
        onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
      >
        <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }}
          title="Bifoga bild"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#22c55e' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
        >
          <Paperclip size={15} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Skriv vad du vill skicka..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', color: '#ffffff', padding: '6px 4px' }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 8, border: 'none',
            background: input.trim() ? '#22c55e' : 'rgba(255,255,255,0.08)',
            color: input.trim() ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
