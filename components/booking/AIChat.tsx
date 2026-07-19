'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Paperclip, Send, Zap } from 'lucide-react'
import type { AIParseResult, ContactInfo } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AIChatProps {
  onParsed: (result: AIParseResult) => void
  onPreview?: (result: AIParseResult) => void
  sender?: ContactInfo
  recipient?: ContactInfo
  onSenderChange?: (contact: ContactInfo) => void
  onRecipientChange?: (contact: ContactInfo) => void
  onNewPackage?: () => void
}

type ContactStep = 'recipient_name' | 'recipient_phone' | 'sender_name' | 'sender_phone' | null

const SUGGESTIONS = [
  'Skicka 2 kg paket från Vasagatan 11, Stockholm till Storgatan 5, Göteborg',
  'Hämta en IKEA-order i Kungens Kurva och leverera till Solnavägen 4, Stockholm',
  'Retur till H&M, 500 g från Davidshallsgatan 7, Malmö till Uppsala',
  'Söker lift från Drottninggatan 1, Uppsala till Stockholm imorgon',
]
const AI_CONVERSATION_KEY = 'gonow_ai_conversation_v1'
const INITIAL_MESSAGES: Message[] = [{ role: 'assistant', content: 'Beskriv paketet med dina egna ord. Jag frågar bara efter det som saknas – Gonow tar hand om resten.' }]

export default function AIChat({ onParsed, onPreview, sender, recipient, onSenderChange, onRecipientChange, onNewPackage }: AIChatProps) {
  const persistsConversation = Boolean(onNewPackage)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingResult, setPendingResult] = useState<AIParseResult | null>(null)
  const [contactStep, setContactStep] = useState<ContactStep>(null)
  const [conversationLoaded, setConversationLoaded] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMediaType, setImageMediaType] = useState<'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'>('image/jpeg')
  const [isMobile, setIsMobile] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (persistsConversation) {
        try {
          const saved = JSON.parse(sessionStorage.getItem(AI_CONVERSATION_KEY) || 'null') as { messages?: Message[]; pendingResult?: AIParseResult; contactStep?: ContactStep } | null
          if (saved?.messages?.length) setMessages(saved.messages)
          if (saved?.pendingResult) setPendingResult(saved.pendingResult)
          if (saved?.contactStep) setContactStep(saved.contactStep)
        } catch {}
      }
      setConversationLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [persistsConversation])

  useEffect(() => {
    if (!persistsConversation || !conversationLoaded) return
    sessionStorage.setItem(AI_CONVERSATION_KEY, JSON.stringify({ messages, pendingResult, contactStep }))
  }, [messages, pendingResult, contactStep, conversationLoaded, persistsConversation])

  function resetConversation() {
    setMessages(INITIAL_MESSAGES)
    setPendingResult(null)
    setContactStep(null)
    setInput('')
    setImageBase64(null)
    sessionStorage.removeItem(AI_CONVERSATION_KEY)
    onNewPackage?.()
  }

  const nextContactStep = (nextSender = sender, nextRecipient = recipient): ContactStep => {
    if (!onRecipientChange || !onSenderChange) return null
    if (!nextRecipient?.name.trim()) return 'recipient_name'
    if ((nextRecipient.phone.match(/\d/g) || []).length < 7) return 'recipient_phone'
    if (!nextSender?.name.trim()) return 'sender_name'
    if ((nextSender.phone.match(/\d/g) || []).length < 7) return 'sender_phone'
    return null
  }

  const contactQuestion = (step: ContactStep) => ({
    recipient_name: 'Vad heter mottagaren?',
    recipient_phone: 'Vilket telefonnummer ska mottagaren få SMS-aviseringar på?',
    sender_name: 'Vad heter avsändaren?',
    sender_phone: 'Vilket telefonnummer kan transportören nå avsändaren på?',
  } as const)[step as Exclude<ContactStep, null>]

  function handleContactReply(message: string) {
    if (!contactStep || !pendingResult) return false
    const value = message.trim()
    const isPhone = contactStep.endsWith('phone')
    if ((isPhone && (value.match(/\d/g) || []).length < 7) || (!isPhone && value.length < 2)) {
      setMessages(prev => [...prev, { role: 'assistant', content: isPhone ? 'Telefonnumret verkar vara för kort. Kontrollera numret och försök igen.' : 'Skriv minst två tecken så att jag kan spara namnet korrekt.' }])
      return true
    }
    let nextSender = sender ?? { name: '', phone: '', email: '' }
    let nextRecipient = recipient ?? { name: '', phone: '', email: '' }
    if (contactStep === 'recipient_name') nextRecipient = { ...nextRecipient, name: value }
    if (contactStep === 'recipient_phone') nextRecipient = { ...nextRecipient, phone: value }
    if (contactStep === 'sender_name') nextSender = { ...nextSender, name: value }
    if (contactStep === 'sender_phone') nextSender = { ...nextSender, phone: value }
    onRecipientChange?.(nextRecipient)
    onSenderChange?.(nextSender)
    const next = nextContactStep(nextSender, nextRecipient)
    setContactStep(next)
    setMessages(prev => [...prev, { role: 'assistant', content: next ? contactQuestion(next) : `Tack. Bokningen är komplett för ${nextRecipient.name}. Kontrollera sammanfattningen och bekräfta när allt stämmer.` }])
    return true
  }

  async function handleSend(text?: string) {
    const msg = text || input
    if (!msg.trim()) return
    const parserMessage = pendingResult?.from_city === 'Saknas'
      ? `från ${msg}`
      : pendingResult?.to_city === 'Saknas'
        ? `till ${msg}`
        : msg

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    if (handleContactReply(msg)) return
    setPendingResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: parserMessage, imageBase64, imageMediaType, currentDraft: pendingResult }),
      })
      const data = await res.json()
      setImageBase64(null)

      if (data.success) {
        const result: AIParseResult = data.data
        setPendingResult(result)
        const needsFrom = result.from_city === 'Saknas'
        const needsTo = result.to_city === 'Saknas'
        const needsWeight = result.type !== 'lift' && !result.weight_kg
        const nextContact = !needsFrom && !needsTo && !needsWeight && result.type !== 'lift' ? nextContactStep() : null
        const knownRecipient = recipient?.name && recipient?.phone ? `Mottagare: ${recipient.name} · ${recipient.phone}\n\n` : ''
        setContactStep(nextContact)
        const typeLabel =
          result.type === 'package'
            ? 'Paket'
            : result.type === 'pickup'
              ? 'Butikshämtning'
              : result.type === 'return'
                ? 'Retur'
                : 'Lift'

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Jag har detta:\n\n${typeLabel}${!needsFrom && !needsTo ? ` · ${result.from_city} → ${result.to_city}` : ''}${result.weight_kg ? ` · ${result.weight_kg} kg` : ''}${result.departure_date ? ` · ${result.departure_date}` : ''}${result.special_requirements ? `\nViktigt: ${result.special_requirements}` : ''}\n\n${needsFrom ? 'Var ska paketet hämtas?' : needsTo ? 'Vart ska paketet levereras?' : needsWeight ? 'Ungefär hur mycket väger paketet?' : nextContact ? contactQuestion(nextContact) : `${knownRecipient}Stämmer allt? Då tar Gonow hand om pris och transport.`}`,
          },
        ])

        onPreview?.(result)
      } else if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Jag kunde inte läsa uppgifterna just nu. Försök igen om en stund.',
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Jag saknar några uppgifter. Skriv till exempel: “2 kg paket från Stockholm till Göteborg imorgon”.',
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Jag kunde inte läsa uppgifterna. Kontrollera anslutningen och försök igen.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setImageBase64(base64)
      if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        setImageMediaType(file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
      }
      setMessages((prev) => [...prev, { role: 'user', content: 'Bild bifogad' }])
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
      {onNewPackage && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><button type="button" onClick={resetConversation} style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 7, padding: '5px 9px', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.72)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>+ Nytt paket</button></div>}
      <div
        ref={messagesRef}
        style={{
          height: isMobile ? 200 : 260,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '0 0 8px',
          marginBottom: 10,
          width: '100%',
        }}
      >
        {messages.map((message, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {message.role === 'assistant' && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: 'var(--gn-018)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginRight: 8,
                  alignSelf: 'flex-end',
                }}
              >
                <Zap size={11} style={{ color: 'var(--gn)' }} />
              </div>
            )}
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 13px',
                borderRadius: message.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                background: message.role === 'user' ? 'var(--gn)' : 'rgba(255,255,255,0.1)',
                color: message.role === 'user' ? '#0a0a0a' : 'rgba(255,255,255,0.92)',
                border: message.role === 'assistant' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                fontWeight: message.role === 'user' ? 700 : 400,
                backdropFilter: message.role === 'assistant' ? 'blur(8px)' : 'none',
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: 'var(--gn-018)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Zap size={11} style={{ color: 'var(--gn)' }} />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                padding: '9px 13px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px 12px 12px 4px',
              }}
            >
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.55)',
                    display: 'block',
                    animation: `bounce 1.2s ${n * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {pendingResult && !loading && contactStep === null && pendingResult.from_city !== 'Saknas' && pendingResult.to_city !== 'Saknas' && (pendingResult.type === 'lift' || !!pendingResult.weight_kg) && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 32, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onParsed(pendingResult)} style={{ border: 0, borderRadius: 8, padding: '8px 13px', background: 'var(--gn)', color: '#071009', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
              Ja, fortsätt
            </button>
            <button type="button" onClick={() => document.getElementById('gonow-ai-input')?.focus()} style={{ border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, padding: '8px 13px', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Ändra uppgifter
            </button>
          </div>
        )}
        {pendingResult && !loading && contactStep === 'recipient_name' && sender?.name && (
          <button type="button" onClick={() => void handleSend(sender.name)} style={{ alignSelf: 'flex-start', marginLeft: 32, border: '1px solid rgba(53,208,102,.35)', borderRadius: 999, padding: '7px 11px', background: 'rgba(53,208,102,.1)', color: '#35d066', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer' }}>
            Jag är mottagaren · {sender.name}
          </button>
        )}
        {pendingResult && !loading && contactStep === 'recipient_phone' && sender?.phone && recipient?.name === sender.name && (
          <button type="button" onClick={() => void handleSend(sender.phone)} style={{ alignSelf: 'flex-start', marginLeft: 32, border: '1px solid rgba(53,208,102,.35)', borderRadius: 999, padding: '7px 11px', background: 'rgba(53,208,102,.1)', color: '#35d066', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer' }}>
            Använd mitt nummer · {sender.phone}
          </button>
        )}
      </div>

      {messages.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSend(suggestion)}
              style={{
                fontSize: '0.7rem',
                padding: '5px 11px',
                borderRadius: 100,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(event) => {
                const el = event.currentTarget as HTMLElement
                el.style.color = 'var(--gn)'
                el.style.borderColor = 'var(--gn-035)'
                el.style.background = 'var(--gn-008)'
              }}
              onMouseLeave={(event) => {
                const el = event.currentTarget as HTMLElement
                el.style.color = 'rgba(255,255,255,0.6)'
                el.style.borderColor = 'rgba(255,255,255,0.15)'
                el.style.background = 'rgba(255,255,255,0.07)'
              }}
            >
              {suggestion.slice(0, 40)}...
            </button>
          ))}
        </div>
      )}

      <div
        style={{
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
        onFocusCapture={(event) => {
          ;(event.currentTarget as HTMLElement).style.borderColor = 'var(--gn)'
        }}
        onBlurCapture={(event) => {
          ;(event.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'
        }}
      >
        <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color 0.15s',
          }}
          title="Bifoga bild"
          onMouseEnter={(event) => {
            ;(event.currentTarget as HTMLElement).style.color = 'var(--gn)'
          }}
          onMouseLeave={(event) => {
            ;(event.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <Paperclip size={15} />
        </button>
        <input
          id="gonow-ai-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            void handleSend()
          }}
          placeholder="Skriv vad du vill skicka..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.875rem',
            color: '#ffffff',
            padding: '6px 4px',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: input.trim() ? 'var(--gn)' : 'rgba(255,255,255,0.08)',
            color: input.trim() ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
