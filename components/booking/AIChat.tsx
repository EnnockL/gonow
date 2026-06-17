'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Loader2, Zap } from 'lucide-react'
import { AIParseResult } from '@/lib/types'

interface Message { role: 'user' | 'assistant'; content: string }
interface AIChatProps { onParsed: (result: AIParseResult) => void }

const SUGGESTIONS = [
  'Skicka ett paket från Stockholm till Göteborg på fredag, ca 2 kg',
  'Hämta min IKEA-order i Kungens Kurva, leverera till Sundbyberg',
  'Retur till H&M, paket 500g från Malmö',
  'Söker lift från Uppsala till Stockholm imorgon',
]

export default function AIChat({ onParsed }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hej! Berätta vad du vill skicka, varifrån och vart — skriv precis som du tänker.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        onParsed(r)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Chat window */}
      <div style={{
        height: 340,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '0 0 8px',
        marginBottom: 12,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>
                <Zap size={12} style={{ color: 'var(--accent)' }} />
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: '0.84rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
              color: m.role === 'user' ? '#0a0a0a' : 'var(--text)',
              border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontWeight: m.role === 'user' ? 500 : 400,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Zap size={12} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px' }}>
              {[0, 1, 2].map((n) => (
                <span key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)', display: 'block', animation: `bounce 1.2s ${n * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              style={{
                fontSize: '0.72rem',
                padding: '5px 12px',
                borderRadius: 100,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--muted-2)',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--accent)'
                el.style.borderColor = 'rgba(146,255,99,0.3)'
                el.style.background = 'var(--accent-softer)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--muted-2)'
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--surface)'
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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '6px 8px',
        transition: 'border-color 0.15s',
      }}
        onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
        onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }}
          title="Bifoga bild"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
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
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.875rem', color: 'var(--text)', padding: '6px 4px' }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 8, border: 'none',
            background: input.trim() ? 'var(--accent)' : 'var(--surface-3)',
            color: input.trim() ? '#fff' : 'var(--muted)',
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
