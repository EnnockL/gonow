'use client'

/**
 * Gonow Messaging — Enterprise Design
 * Philosophy: Linear Ã— Slack Ã— Intercom
 * Grid: 8px base unit  |  No gradients  |  Flat, precise color tokens
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown, ArrowLeft, Check, CheckCheck, ChevronDown,
  Copy, Edit3, MessageSquare, Package, Phone, Search, Send, ShieldCheck, Sparkles, Truck, Users, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { authedFetch } from '@/lib/auth/authed-fetch'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ConvEntry = {
  id:              string
  context_type:    string
  context_label:   string | null
  context_route:   string | null
  other_user_id:   string
  other_user_name: string
  other_avatar:    string | null
  other_phone:     string | null
  last_message:    string
  last_at:         string
  unread_count:    number
}
type MsgEntry = {
  id:              string
  conversation_id: string
  sender_id:       string
  receiver_id:     string
  content:         string
  created_at:      string
  read_at:         string | null
}
type ContextInfo = {
  type:        'package' | 'lift'
  context_id:  string | null
  from_city:   string
  to_city:     string
  status:      string | null
  ceiling:     number | null
  max_price:   number | null
  travel_date: string | null
  passengers:  number | null
} | null
type FilterKey = 'all' | 'package' | 'lift' | 'unread' | 'active' | 'ended'
type ReadStatus = 'sent' | 'delivered' | 'read' | null

// â”€â”€â”€ Design constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'Alla'      },
  { key: 'package', label: 'Paket'     },
  { key: 'lift',    label: 'Lift'      },
  { key: 'unread',  label: 'Olästa'    },
  { key: 'active',  label: 'Aktiva'    },
  { key: 'ended',   label: 'Avslutade' },
]

const AI_OPTIONS = [
  { label: 'Föreslå svar',        action: 'suggest'   },
  { label: 'Skriv vänligare',     action: 'nicer'     },
  { label: 'Sammanfatta chatten', action: 'summarize' },
  { label: 'Översätt till engelska', action: 'translate' },
]

// Avatar seed palette — deterministic, professional
const AV_PALETTES: [string, string][] = [
  ['#EFF6FF', '#1D4ED8'], ['var(--gn-bg1)', '#166534'], ['#FFF7ED', '#9A3412'],
  ['#FAF5FF', '#6D28D9'], ['#FFF1F2', '#BE123C'], ['#F0FDFA', '#0F766E'],
  ['#FFFBEB', '#92400E'], ['#EEF2FF', '#3730A3'],
]

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function relTime(d: string) {
  const ms  = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1)  return 'Nu'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}t`
  if (h < 48)   return 'Igår'
  if (h < 168)  return new Date(d).toLocaleDateString('sv-SE', { weekday: 'short' })
  return new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(d: string) {
  const dt = new Date(d), now = new Date(), yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  if (dt.toDateString() === now.toDateString())  return 'Idag'
  if (dt.toDateString() === yest.toDateString()) return 'Igår'
  const days = Math.floor((now.getTime() - dt.getTime()) / 86400_000)
  if (days < 7) return dt.toLocaleDateString('sv-SE', { weekday: 'long' })
  return dt.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function avPalette(name: string): [string, string] {
  return AV_PALETTES[name.charCodeAt(0) % AV_PALETTES.length]
}

function statusConfig(status: string | null, type: 'package' | 'lift'): { label: string; dot: string } {
  const mk = (label: string, dot: string) => ({ label, dot })
  if (type === 'package') {
    switch (status) {
      case 'open':      return mk('Söker transport', '#F59E0B')
      case 'matched':   return mk('Transport klar',      '#3B82F6')
      case 'paid':      return mk('Betald',        '#8B5CF6')
      case 'picked_up': return mk('På väg',        '#3B82F6')
      case 'delivered': return mk('Levererad',     'var(--gn-dk)')
      case 'completed': return mk('Slutförd',      'var(--gn-dk)')
      default:           return mk(status ?? '—',  '#9CA3AF')
    }
  }
  switch (status) {
    case 'open':    return mk('Söker resa',    '#F59E0B')
    case 'offered': return mk('Förslag', '#8B5CF6')
    case 'matched': return mk('Resa klar',  'var(--gn-dk)')
    default:         return mk('Aktiv',   'var(--gn-dk)')
  }
}

function getQuickActions(ctx: ContextInfo, phone: string | null) {
  const pos  = { label: 'Dela position',  text: '📍 Jag är vid: [beskriv platsen]' }
  const call = { label: 'Ring',            text: '__CALL__' }
  const arr  = { label: 'Jag är framme',  text: 'Jag är framme! 🙌' }
  const del  = { label: 'Levererat',       text: 'Leveransen är klar! ✅' }
  const tel  = phone ? [call] : []
  if (!ctx)                   return [pos, arr, del, ...tel]
  if (ctx.type === 'package') return [arr, del, pos, ...tel]
  return [pos, ...tel]
}

// â”€â”€â”€ Avatar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Av({ name, size }: { name: string; size: number }) {
  const [bg, fg] = avPalette(name)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.36), color: fg, letterSpacing: '-0.01em', flexShrink: 0, userSelect: 'none' }}>
      {initials(name)}
    </div>
  )
}

// â”€â”€â”€ Bubble radius â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function br(own: boolean, first: boolean, last: boolean): string {
  // 16px = full, 4px = tight connector corner
  const [F, T] = [16, 4]
  if (own)  return `${F}px ${first ? F : T}px ${last ? F : T}px ${F}px`
  return `${first ? F : T}px ${F}px ${F}px ${last ? F : T}px`
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LAST_CONV = 'gonow:last-conv'

function MeddelandenPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // â”€â”€ Environment
  const [isDark,   setIsDark]   = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  // â”€â”€ Auth
  const [userId, setUserId] = useState<string | null>(null)

  // â”€â”€ Conversations
  const [convs,        setConvs]        = useState<ConvEntry[]>([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [filter,       setFilter]       = useState<FilterKey>('all')
  const [search,       setSearch]       = useState('')
  const [selId,        setSelId]        = useState<string | null>(null)
  const [mobileChat,   setMobileChat]   = useState(false)

  // â”€â”€ Thread
  const [messages,    setMessages]    = useState<MsgEntry[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [ctxInfo,     setCtxInfo]     = useState<ContextInfo>(null)
  const [ctxCache,    setCtxCache]    = useState<Map<string, ContextInfo>>(new Map())

  // â”€â”€ Compose
  const [draft,        setDraft]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [readStatus,   setReadStatus]   = useState<ReadStatus>(null)
  const [inputFocused, setInputFocused] = useState(false)

  // â”€â”€ Extras
  const [aiOpen,   setAiOpen]   = useState(false)
  const [aiToast,  setAiToast]  = useState('')
  const [aiLoad,   setAiLoad]   = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [newIds,   setNewIds]   = useState<Set<string>>(new Set())
  const [showJump, setShowJump] = useState(false)
  const [copied,   setCopied]   = useState<string | null>(null)

  // â”€â”€ Refs
  const scrollRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const aiRef      = useRef<HTMLDivElement>(null)
  const chanRef    = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const firstLoad  = useRef(false)

  // â”€â”€ Theme
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // â”€â”€ Responsive
  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 768); setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1100) }
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // â”€â”€ AI click-outside
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (aiRef.current && !aiRef.current.contains(e.target as Node)) setAiOpen(false) }
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn)
  }, [])

  // â”€â”€ Auth
  useEffect(() => {
    createClient().auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => setUserId(data.user?.id ?? null))
  }, [])

  // â”€â”€ Conversations
  useEffect(() => {
    if (!userId) return
    setConvsLoading(true)
    authedFetch('/api/conversations')
      .then(r => r.ok ? r.json() : { conversations: [] })
      .then(d => {
        const list = ((d.conversations ?? []) as Array<{
          id: string
          context_type: string
          context_label: string | null
          context_route: string | null
          other_user: { id: string; name: string; avatar_url: string | null; phone?: string | null }
          last_message: string | null
          last_message_at: string | null
          unread_count: number
        }>).map((conv) => ({
          id: conv.id,
          context_type: conv.context_type,
          context_label: conv.context_label,
          context_route: conv.context_route,
          other_user_id: conv.other_user.id,
          other_user_name: conv.other_user.name ?? 'Okänd',
          other_avatar: conv.other_user.avatar_url ?? null,
          other_phone: conv.other_user.phone ?? null,
          last_message: conv.last_message ?? '',
          last_at: conv.last_message_at ?? '',
          unread_count: conv.unread_count ?? 0,
        })) as ConvEntry[]
        setConvs(list)
        const requested = searchParams.get('conversation')
        const last = (() => { try { return localStorage.getItem(LAST_CONV) } catch { return null } })()
        if (requested && list.find(c => c.id === requested)) setSelId(requested)
        else if (last && list.find(c => c.id === last)) setSelId(last)
        else if (list.length > 0) setSelId(p => p ?? list[0].id)
      })
      .finally(() => setConvsLoading(false))
  }, [searchParams, userId])

  // â”€â”€ Load thread
  const loadThread = useCallback((id: string, silent = false) => {
    if (!userId) return
    if (!silent) {
      firstLoad.current = true
      setMsgsLoading(true); setMessages([]); setCtxInfo(null); setReadStatus(null); setNewIds(new Set())
    }
    authedFetch(`/api/conversations/${id}/messages`)
      .then(r => r.ok ? r.json() : { messages: [], context_data: null })
      .then((d: {
        messages?: Array<{
          id: string
          conversation_id: string
          sender_id: string
          body?: string | null
          content?: string | null
          created_at: string
          read_at?: string | null
        }>
        context_data?: {
          from_city?: string
          to_city?: string
          status?: string | null
          ceiling?: number | null
          max_price?: number | null
          travel_date?: string | null
          passengers?: number | null
        } | null
        context?: { context_type?: string; context_id?: string | null } | null
      }) => {
        setMessages((d.messages ?? []).map((msg) => ({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          receiver_id: '',
          content: msg.body ?? msg.content ?? '',
          created_at: msg.created_at,
          read_at: msg.read_at ?? null,
        })))

        const type = d.context?.context_type
        if (d.context_data?.from_city && d.context_data?.to_city && (type === 'package' || type === 'lift')) {
          const info: ContextInfo = {
            type,
            context_id: d.context?.context_id ?? null,
            from_city: d.context_data.from_city,
            to_city: d.context_data.to_city,
            status: d.context_data.status ?? null,
            ceiling: d.context_data.ceiling ?? null,
            max_price: d.context_data.max_price ?? null,
            travel_date: d.context_data.travel_date ?? null,
            passengers: d.context_data.passengers ?? null,
          }
          setCtxInfo(info)
          setCtxCache(prev => new Map(prev).set(id, info))
        }
      })
      .finally(() => { if (!silent) setMsgsLoading(false) })
  }, [userId])

  useEffect(() => {
    if (!selId || !userId) return
    loadThread(selId)
    try { localStorage.setItem(LAST_CONV, selId) } catch {}
    if (selId.startsWith('package:')) {
      const timer = window.setInterval(() => loadThread(selId, true), 4000)
      return () => window.clearInterval(timer)
    }
    const supabase = createClient()
    if (chanRef.current) supabase.removeChannel(chanRef.current)
    const ch = supabase.channel(`th:${userId}:${selId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selId}` },
        (payload: { new: { id: string; conversation_id: string; sender_id: string; body?: string | null; content?: string | null; created_at: string; read_at?: string | null } }) => {
          const msg = payload.new
          const mapped: MsgEntry = {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            receiver_id: '',
            content: msg.body ?? msg.content ?? '',
            created_at: msg.created_at,
            read_at: msg.read_at ?? null,
          }
          setIsTyping(false)
          setMessages(prev => prev.find(m => m.id === mapped.id) ? prev : [...prev, mapped])
          setNewIds(prev => new Set(prev).add(mapped.id))
          setConvs(prev => prev.map(c => c.id === selId
            ? { ...c, last_message: mapped.content, last_at: mapped.created_at, unread_count: msg.sender_id === userId ? 0 : c.unread_count }
            : c))
        })
      .subscribe()
    chanRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [selId, userId, loadThread])

  // â”€â”€ Scroll
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    smooth ? el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) : (el.scrollTop = el.scrollHeight)
  }, [])

  useEffect(() => {
    if (msgsLoading) return
    if (firstLoad.current) { scrollToBottom(false); firstLoad.current = false }
    else scrollToBottom(true)
  }, [messages, isTyping, msgsLoading, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 180)
  }, [])

  // â”€â”€ Send
  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim()
    if (!text || !selId || !userId || sending) return
    const optId = `opt-${Date.now()}`
    if (!override) {
      setDraft('')
      if (inputRef.current) { inputRef.current.style.height = 'auto' }
    }
    setSending(true); setReadStatus('sent')
    setNewIds(prev => new Set(prev).add(optId))
    const opt: MsgEntry = {
      id: optId,
      conversation_id: selId,
      sender_id: userId,
      receiver_id: '',
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages(prev => [...prev, opt])
    setConvs(prev => prev.map(c => c.id === selId ? { ...c, last_message: text, last_at: opt.created_at, unread_count: 0 } : c))
    try {
      await authedFetch(`/api/conversations/${selId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) })
      setTimeout(() => setReadStatus('delivered'), 900)
      setTimeout(() => setReadStatus('read'), 3200)
    } catch {}
    setSending(false); inputRef.current?.focus()
  }, [draft, selId, userId, sending])

  // â”€â”€ AI suggest
  const aiSuggest = useCallback(async () => {
    if (!selId || aiLoad) return
    const conv = convs.find(c => c.id === selId)
    if (!conv) return
    setAiLoad(true)
    try {
      const res = await fetch('/api/ai/suggest-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_type: ctxInfo?.type ?? 'general', context_route: ctxInfo ? `${ctxInfo.from_city} → ${ctxInfo.to_city}` : null, other_name: conv.other_user_name, recent_messages: messages.slice(-4).map(m => `${m.sender_id === userId ? 'Jag' : conv.other_user_name}: ${m.content}`), hint: draft }),
      })
      if (res.status === 503) { setAiToast('Gonow Assist ?r inte aktiverat ?nnu'); setTimeout(() => setAiToast(''), 3000); return }
      const data = await res.json() as { suggestion?: string }
      if (data.suggestion) { setDraft(data.suggestion); inputRef.current?.focus() }
    } catch {}
    setAiLoad(false)
  }, [selId, convs, messages, userId, draft, aiLoad, ctxInfo])

  function handleAi(action: string) {
    setAiOpen(false)
    if (action === 'suggest') { aiSuggest(); return }
    setAiToast('Kommer snart'); setTimeout(() => setAiToast(''), 2500)
  }

  async function copyMsg(id: string, text: string) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  // â”€â”€ Derived
  const selConv    = convs.find(c => c.id === selId) ?? null
  const dispCtx    = ctxInfo ?? (selId ? ctxCache.get(selId) ?? null : null)
  const unreadCnt  = convs.reduce((sum, conv) => sum + (conv.unread_count ?? 0), 0)
  const lastOwnIdx = messages.reduce((n, m, i) => m.sender_id === userId ? i : n, -1)
  const firstNewIdx = newIds.size > 0 ? messages.findIndex(m => newIds.has(m.id) && m.sender_id !== userId) : -1

  const filtered = convs
    .filter(c => {
      if (filter === 'package') return c.context_type === 'package'
      if (filter === 'lift') return c.context_type === 'lift'
      if (filter === 'unread') return (c.unread_count ?? 0) > 0
      if (filter === 'active') return Date.now() - new Date(c.last_at).getTime() < 7 * 86400_000
      if (filter === 'ended')  return Date.now() - new Date(c.last_at).getTime() >= 7 * 86400_000
      return true
    })
    .filter(c => !search || [c.other_user_name, c.last_message, c.context_route ?? '', c.context_label ?? ''].some(s => s.toLowerCase().includes(search.toLowerCase())))

  // The inbox is contact-first. Individual package/lift conversations remain
  // separate underneath so messages never leak between two transports.
  const contactGroups = Array.from(filtered.reduce((groups, conversation) => {
    const current = groups.get(conversation.other_user_id) ?? []
    current.push(conversation)
    groups.set(conversation.other_user_id, current)
    return groups
  }, new Map<string, ConvEntry[]>()).entries()).map(([contactId, threads]) => {
    const sorted = [...threads].sort((a, b) => new Date(b.last_at || 0).getTime() - new Date(a.last_at || 0).getTime())
    return {
      contactId,
      threads: sorted,
      latest: sorted[0],
      unread: sorted.reduce((sum, thread) => sum + thread.unread_count, 0),
    }
  }).sort((a, b) => new Date(b.latest.last_at || 0).getTime() - new Date(a.latest.last_at || 0).getTime())

  const selectedContactThreads = selConv
    ? convs
        .filter(c => c.other_user_id === selConv.other_user_id)
        .sort((a, b) => new Date(b.last_at || 0).getTime() - new Date(a.last_at || 0).getTime())
    : []

  // â”€â”€ Design tokens — enterprise flat system
  const C = isDark ? {
    // Dark palette
    bg:       '#0D1117',
    surface:  '#161B22',
    elevated: '#1C2128',
    border:   '#30363D',
    borderSub:'rgba(255,255,255,0.06)',
    text:     '#E6EDF3',
    textSub:  '#8B949E',
    textMuted:'#6E7681',
    accent:   'var(--gn)',
    accentFg: '#fff',
    ownBubble:'var(--gn-dk)',
    ownText:  '#FFFFFF',
    otherBubble: '#1C2128',
    otherText:   '#E6EDF3',
    otherBorder: '#30363D',
    inputBg:  '#161B22',
    hover:    'rgba(255,255,255,0.04)',
    selRow:   'var(--gn-006)',
    selBorder:'var(--gn)',
  } : {
    // Light palette
    bg:       '#F6F8FA',
    surface:  '#FFFFFF',
    elevated: '#FFFFFF',
    border:   '#D0D7DE',
    borderSub:'rgba(0,0,0,0.06)',
    text:     '#1F2328',
    textSub:  '#636C76',
    textMuted:'#9CA3AF',
    accent:   'var(--gn-dk)',
    accentFg: '#fff',
    ownBubble:'var(--gn-dk)',
    ownText:  '#FFFFFF',
    otherBubble: '#F3F4F6',
    otherText:   '#1F2328',
    otherBorder: '#E5E7EB',
    inputBg:  '#FFFFFF',
    hover:    'rgba(0,0,0,0.03)',
    selRow:   'var(--gn-006)',
    selBorder:'var(--gn-dk)',
  }

  const SIDE_W  = isMobile ? '100%' : '320px'
  const ROW_H   = 56 // px — strict grid

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LEFT PANEL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const LeftPanel = (
    <aside style={{
      width: SIDE_W, minWidth: isMobile ? undefined : 240, maxWidth: isMobile ? undefined : 320,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: C.surface, borderRight: `1px solid ${C.border}`, flexShrink: 0,
    }}>

      {/* â”€â”€ Sidebar header */}
      <div style={{ height: 64, minHeight: 64, padding: '0 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 800, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gonow operations</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.875rem', fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Meddelanden</p>
        </div>
        {unreadCnt > 0 && (
          <span style={{ height: 18, minWidth: 18, borderRadius: 999, background: C.accent, color: C.accentFg, fontSize: '0.6875rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', letterSpacing: '0.02em' }}>
            {unreadCnt}
          </span>
        )}
        <button title="Nytt meddelande" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', flexShrink: 0 }}
          className="icon-btn">
          <Edit3 size={13} />
        </button>
      </div>

      {/* â”€â”€ Search */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, pointerEvents: 'none' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Sök…"
            style={{ width: '100%', padding: '6px 28px 6px 26px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            className="search-input"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 1, display: 'flex', borderRadius: 3 }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Filter strip */}
      <div style={{ padding: '0 4px', borderBottom: `1px solid ${C.border}`, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'], flexShrink: 0 }}>
        {FILTERS.map(f => {
          const on = filter === f.key
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ flexShrink: 0, padding: '8px 9px', border: 'none', borderBottom: `2px solid ${on ? C.accent : 'transparent'}`, background: 'transparent', color: on ? C.accent : C.textMuted, fontWeight: on ? 600 : 400, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.12s, border-color 0.12s', marginBottom: -1, whiteSpace: 'nowrap' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {/* â”€â”€ Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Section label */}
        {!search && contactGroups.length > 0 && (
          <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {filter === 'all' ? 'Alla' : FILTERS.find(f => f.key === filter)?.label}
            </span>
            <span style={{ fontSize: '0.6875rem', color: C.textMuted }}>{contactGroups.length}</span>
          </div>
        )}

        {convsLoading ? (
          <div style={{ padding: '4px 0' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
                <div className="sk" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 11, width: '50%', borderRadius: 4, marginBottom: 6 }} />
                  <div className="sk" style={{ height: 10, width: '75%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : contactGroups.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 13px', color: C.accent, boxShadow: '0 10px 28px rgba(34,197,94,.12)' }}>
              <MessageSquare size={20} />
            </div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text, margin: '0 0 4px' }}>
              {convs.length === 0 ? 'Inga konversationer' : 'Inga resultat'}
            </p>
            <p style={{ fontSize: '0.75rem', color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
              {convs.length === 0 ? 'Din första dialog visas här när en paketresa eller lift har startat. 💬' : `Inga träffar för "${search}".`}
            </p>
            {convs.length === 0 && (
              <button onClick={() => window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))}
                style={{ marginTop: 14, padding: '7px 16px', borderRadius: 6, background: C.accent, color: C.accentFg, fontWeight: 600, fontSize: '0.8125rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Starta en transport →
              </button>
            )}
          </div>
        ) : contactGroups.map(group => {
          const c      = group.threads.find(thread => thread.id === selId) ?? group.latest
          const on     = group.threads.some(thread => thread.id === selId)
          const unread = group.unread > 0
          const ctx    = ctxCache.get(c.id)
          const st     = ctx ? statusConfig(ctx.status, ctx.type) : null

          return (
            <button key={group.contactId} className="conv-row"
              onClick={() => { setSelId(c.id); if (isMobile) setMobileChat(true) }}
              style={{
                width: '100%', textAlign: 'left', height: ROW_H, padding: '0 16px',
                border: 'none', borderLeft: `3px solid ${on ? C.accent : 'transparent'}`,
                background: on ? C.selRow : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                gap: 10, transition: 'background 0.1s, border-left-color 0.1s',
              }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Av name={c.other_user_name} size={32} />
                {unread && (
                  <span style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.accent, border: `2px solid ${C.surface}` }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: unread ? 750 : 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {c.other_user_name}
                  </span>
                  {group.threads.length > 1 && (
                    <span style={{ fontSize: '0.625rem', color: C.accent, background: C.selRow, borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>
                      {group.threads.length} ärenden
                    </span>
                  )}
                  <span style={{ fontSize: '0.6875rem', color: unread ? C.accent : C.textMuted, fontWeight: unread ? 700 : 400, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {relTime(c.last_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {ctx && <span style={{ fontSize: '0.6875rem', color: C.textMuted, flexShrink: 0 }}>{ctx.type === 'package' ? '📦' : '👤'}</span>}
                  <p style={{ margin: 0, fontSize: '0.75rem', color: unread ? C.text : C.textMuted, fontWeight: unread ? 650 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {c.context_route || c.last_message || 'Ny paketdialog'}
                  </p>
                  {unread && (
                    <span aria-label={`${group.unread} olästa meddelanden`} style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, background: C.accent, color: C.accentFg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 800, flexShrink: 0 }}>
                      {group.unread > 99 ? '99+' : group.unread}
                    </span>
                  )}
                  {st && !unread && (
                    <span style={{ fontSize: '0.625rem', color: st.dot, flexShrink: 0 }}>â—</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* â”€â”€ Sidebar footer */}
      {!convsLoading && convs.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 16px', display: 'flex', gap: 24, flexShrink: 0 }}>
          {[{ n: new Set(convs.map(c => c.other_user_id)).size, l: 'Kontakter' }, { n: unreadCnt, l: 'Olästa' }].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: s.n > 0 && s.l === 'Olästa' ? C.accent : C.text, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: '0.625rem', color: C.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  )

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RIGHT PANEL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const RightPanel = selConv ? (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>

      {/* â”€â”€ Chat header */}
      <header style={{
        height: 64, minHeight: 64, padding: '0 22px',
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={() => setMobileChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, padding: '4px 8px 4px 0', display: 'flex' }}>
            <ArrowLeft size={16} />
          </button>
        )}

        <Av name={selConv.other_user_name} size={32} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: C.text, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selConv.other_user_name}
          </p>
          {dispCtx && (() => {
            const s = statusConfig(dispCtx.status, dispCtx.type)
            return (
              <p style={{ margin: '1px 0 0', fontSize: '0.6875rem', color: C.textMuted, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <span>{dispCtx.type === 'package' ? '📦' : '👤'}</span>
                <span>{dispCtx.from_city.split(',')[0]} → {dispCtx.to_city.split(',')[0]}</span>
                <span style={{ color: C.border }}>·</span>
                <span style={{ color: s.dot, fontWeight: 600 }}>{s.label}</span>
              </p>
            )
          })()}
        </div>

        {selectedContactThreads.length > 1 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', height: 32, border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, color: C.textSub, flexShrink: 0 }}>
            <Package size={12} color={C.accent} />
            <select
              aria-label="Välj paketärende"
              value={selId ?? ''}
              onChange={event => setSelId(event.target.value)}
              style={{ maxWidth: isTablet ? 190 : 260, border: 0, outline: 0, background: 'transparent', color: C.text, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {selectedContactThreads.map((thread, index) => (
                <option key={thread.id} value={thread.id}>
                  {thread.context_route || `${thread.context_type === 'package' ? 'Paket' : 'Lift'} ${index + 1}`}
                  {thread.id.startsWith('package:') ? ` · #${thread.id.slice(-8).toUpperCase()}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Header actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {selConv.other_phone && (
            <a href={`tel:${selConv.other_phone}`} className="icon-btn"
              style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSub, textDecoration: 'none', transition: 'all 0.12s' }}>
              <Phone size={13} />
            </a>
          )}

          {/* AI dropdown */}
          <div ref={aiRef} style={{ position: 'relative' }}>
            <button onClick={() => setAiOpen(p => !p)} className="icon-btn"
              style={{ height: 32, padding: '0 10px', borderRadius: 7, border: `1px solid ${aiOpen ? C.accent : C.border}`, background: aiOpen ? 'rgba(34,197,94,.1)' : 'transparent', color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
              {aiLoad ? <span style={{ width: 12, height: 12, border: '1.5px solid rgba(34,197,94,.3)', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> : <Sparkles size={12} />}
              Assist
              <ChevronDown size={10} style={{ opacity: 0.5 }} />
            </button>

            {aiOpen && (
              <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', zIndex: 50, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200 }}>
                <div style={{ padding: '4px' }}>
                  {AI_OPTIONS.map((o, idx) => (
                    <button key={o.action} onClick={() => handleAi(o.action)} className="menu-row"
                      style={{ width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent', color: C.text, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 5, transition: 'background 0.1s' }}>
                      <Sparkles size={11} color={C.accent} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{o.label}</span>
                      {idx === 0 && <span style={{ fontSize: '0.5625rem', background: `${C.accent}18`, color: C.accent, padding: '1px 5px', borderRadius: 999, fontWeight: 700 }}>LIVE</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* â”€â”€ Context banner */}
      {dispCtx && (() => {
        const s     = statusConfig(dispCtx.status, dispCtx.type)
        const route = `${dispCtx.from_city.split(',')[0]} → ${dispCtx.to_city.split(',')[0]}`
        return (
          <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '8px 14px' : '0 20px', flexShrink: 0 }}>
            <div style={{ maxWidth: 700, margin: '0 auto', minHeight: isMobile ? 0 : 36, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.textSub }}>
                {dispCtx.type === 'package' ? '📦' : '👤'} {dispCtx.type === 'package' ? 'Paket' : 'Lift'}
              </span>
              <span style={{ fontSize: '0.6875rem', color: C.textMuted, flexBasis: isMobile ? '100%' : 'auto' }}>{route}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 600, color: s.dot }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                {s.label}
              </span>
              {dispCtx.ceiling   != null && <span style={{ fontSize: '0.6875rem', color: C.textMuted }}>Takpris <b style={{ color: C.textSub }}>{dispCtx.ceiling} kr</b></span>}
              {dispCtx.max_price != null && <span style={{ fontSize: '0.6875rem', color: C.textMuted }}>Max <b style={{ color: C.textSub }}>{dispCtx.max_price} kr</b></span>}
              {dispCtx.passengers != null && <span style={{ fontSize: '0.6875rem', color: C.textMuted }}><b style={{ color: C.textSub }}>{dispCtx.passengers}</b> pass.</span>}
              {dispCtx.type === 'package' && dispCtx.context_id && (
                <Link href={`/paket/${dispCtx.context_id}`} style={{ marginLeft: isMobile ? 0 : 'auto', fontSize: '0.6875rem', color: C.accent, fontWeight: 700, textDecoration: 'none', paddingTop: isMobile ? 2 : 0 }}>
                  Öppna spårning
                </Link>
              )}
            </div>
          </div>
        )
      })()}

      {/* â”€â”€ Messages */}
      <div ref={scrollRef} onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column' }}>

          {/* Loading skeletons */}
          {msgsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([['38%','r'],['26%','l'],['51%','r'],['34%','l'],['44%','r']] as [string,string][]).map(([w,s],i) => (
                <div key={i} style={{ display: 'flex', justifyContent: s==='r' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {s==='l' && <div className="sk" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />}
                  <div className="sk" style={{ width: w, height: 38, borderRadius: 12 }} />
                </div>
              ))}
            </div>

          ) : messages.length === 0 ? (
            /* Empty thread */
            <div style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
              <Av name={selConv.other_user_name} size={56} />
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1rem', color: C.text }}>{selConv.other_user_name}</p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: C.textMuted }}>Ingen dialog ännu. Starta tråden här så hålls allt samlat i samma Gonow-flöde.</p>
              </div>
              <button
                onClick={() => { setDraft('Hej 👋'); inputRef.current?.focus() }}
                style={{ padding: '7px 16px', borderRadius: 6, background: C.accent, color: C.accentFg, border: 'none', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Säg hej
              </button>
            </div>

          ) : (() => {
            const nodes: React.ReactNode[] = []

            messages.forEach((msg, i) => {
              const own      = msg.sender_id === userId
              const prev     = messages[i - 1]
              const next     = messages[i + 1]
              const newDay   = i === 0 || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
              const crossDay = !!prev && new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
              const sameG    = !!prev && prev.sender_id === msg.sender_id && !crossDay
              const lastG    = !next || next.sender_id !== msg.sender_id || new Date(next.created_at).toDateString() !== new Date(msg.created_at).toDateString()
              const firstG   = !sameG
              const isLastOw = own && i === lastOwnIdx
              const isNew    = newIds.has(msg.id)
              const isInNew  = i === firstNewIdx

              // â”€â”€ Day separator
              if (newDay) nodes.push(
                <div key={`day-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: `${i === 0 ? 0 : 24}px 0 20px` }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: '0.6875rem', color: C.textMuted, fontWeight: 500, whiteSpace: 'nowrap', padding: '2px 8px', background: isDark ? C.elevated : C.bg, border: `1px solid ${C.border}`, borderRadius: 999 }}>
                    {fmtDay(msg.created_at)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
              )

              // â”€â”€ Unread separator
              if (isInNew) nodes.push(
                <div key={`new-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
                  <div style={{ flex: 1, height: 1, background: `${C.accent}35` }} />
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: C.accent, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', background: `${C.accent}12`, borderRadius: 999 }}>
                    Olästa
                  </span>
                  <div style={{ flex: 1, height: 1, background: `${C.accent}35` }} />
                </div>
              )

              const gap = firstG ? 12 : 2

              nodes.push(
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', marginTop: gap, animation: isNew ? 'slide-up 0.18s ease' : undefined }}>

                  {/* Sender name — first in incoming group */}
                  {!own && firstG && (
                    <p style={{ margin: '0 0 4px', fontSize: '0.6875rem', fontWeight: 600, color: C.textSub, paddingLeft: 32 }}>
                      {selConv.other_user_name.split(' ')[0]}
                    </p>
                  )}

                  {/* Bubble row */}
                  <div className="msg-wrap" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: own ? 'row-reverse' : 'row', position: 'relative' }}>

                    {/* Hover toolbar */}
                    <div className="msg-bar" style={{
                      position: 'absolute', top: -30,
                      [own ? 'right' : 'left']: !own ? 32 : 0,
                      display: 'flex', alignItems: 'center', gap: 1,
                      background: C.elevated, border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '2px', zIndex: 10,
                      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
                      opacity: 0, pointerEvents: 'none', transition: 'opacity 0.12s',
                    }}>
                      <button onClick={() => copyMsg(msg.id, msg.content)}
                        title={copied === msg.id ? 'Kopierat!' : 'Kopiera'}
                        style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: copied === msg.id ? `${C.accent}15` : 'transparent', color: copied === msg.id ? C.accent : C.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}>
                        {copied === msg.id ? <Check size={10} /> : <Copy size={10} />}
                      </button>
                      <button
                        onClick={() => { setDraft(`â†© "${msg.content.slice(0, 36)}${msg.content.length > 36 ? '…' : ''}" `); inputRef.current?.focus() }}
                        style={{ height: 24, padding: '0 6px', borderRadius: 4, border: 'none', background: 'transparent', color: C.textSub, cursor: 'pointer', fontSize: '0.6875rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, transition: 'background 0.1s' }}
                        className="bar-btn">
                        â†© Svara
                      </button>
                    </div>

                    {/* Avatar — only bottom of received group */}
                    {!own && (
                      <div style={{ width: 24, flexShrink: 0, opacity: lastG ? 1 : 0 }}>
                        <Av name={selConv.other_user_name} size={24} />
                      </div>
                    )}

                    {/* Bubble */}
                    <div style={{
                      width: 'fit-content',
                      maxWidth: isMobile ? 240 : 500,
                      padding: '8px 12px',
                      borderRadius: br(own, firstG, lastG),
                      background: own ? C.ownBubble : C.otherBubble,
                      color: own ? C.ownText : C.otherText,
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      border: own ? 'none' : `1px solid ${C.otherBorder}`,
                    }}>
                      <p style={{ margin: 0, overflowWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>

                  {/* Meta row — time + read status; hidden until hover */}
                  {lastG && (
                    <p className="msg-ts" style={{
                      fontSize: '0.625rem', color: C.textMuted, lineHeight: 1,
                      margin: '3px 0 0', marginLeft: !own ? 30 : 0,
                      display: 'flex', alignItems: 'center', gap: 4,
                      opacity: 0, maxHeight: 0, overflow: 'hidden',
                      transition: 'opacity 0.18s, max-height 0.18s, margin-top 0.18s',
                    }}>
                      {fmtTime(msg.created_at)}
                      {isLastOw && readStatus && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: readStatus === 'read' ? C.accent : C.textMuted }}>
                          <CheckCheck size={10} />
                          {readStatus === 'read' ? 'Läst' : readStatus === 'delivered' ? 'Levererat' : 'Skickat'}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            })

            return nodes
          })()}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 12, animation: 'slide-up 0.15s ease' }}>
              <Av name={selConv.other_user_name} size={24} />
              <div style={{ padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: C.otherBubble, border: `1px solid ${C.otherBorder}`, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {[0,1,2].map(n => <span key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: C.textMuted, animation: `bounce 1.1s ease-in-out ${n * 0.16}s infinite` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* Jump-to-bottom */}
        {showJump && (
          <button onClick={() => scrollToBottom(true)} className="jump-chip"
            style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, background: C.elevated, border: `1px solid ${C.border}`, color: C.textSub, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)', animation: 'slide-up 0.15s ease', zIndex: 20, whiteSpace: 'nowrap' }}>
            <ArrowDown size={12} /> Scrolla ner
          </button>
        )}
      </div>

      {/* â”€â”€ Quick actions */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: '5px 20px 4px', display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'], flexShrink: 0 }}>
        {getQuickActions(dispCtx, selConv.other_phone).map(a => (
          <button key={a.label} className="qa-btn"
            onClick={() => { if (a.text === '__CALL__') { window.location.href = `tel:${selConv.other_phone}`; return }; setDraft(a.text); inputRef.current?.focus() }}
            style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSub, fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.1s' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ Input */}
      <div style={{ background: C.surface, padding: '8px 16px 12px', flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
        {aiToast && (
          <div style={{ marginBottom: 6, padding: '6px 12px', borderRadius: 7, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.22)', fontSize: '0.75rem', color: C.accent, textAlign: 'center' }}>
            {aiToast}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: C.inputBg, borderRadius: 8, padding: '4px 4px 4px 12px', border: `1px solid ${inputFocused ? C.accent : C.border}`, transition: 'border-color 0.15s' }}>
          <textarea
            ref={inputRef} value={draft}
            onChange={e => setDraft(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={`Meddelande till ${selConv.other_user_name.split(' ')[0]}…`}
            rows={1}
            style={{ flex: 1, padding: '8px 0', background: 'transparent', color: C.text, fontFamily: 'inherit', fontSize: '0.875rem', resize: 'none', outline: 'none', border: 'none', lineHeight: 1.5, minHeight: 34, maxHeight: 128, overflowY: 'auto', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, padding: '2px' }}>
            {draft.trim() ? (
              <button onClick={() => sendMessage()} disabled={sending}
                style={{ width: 32, height: 32, borderRadius: 6, background: C.accent, color: C.accentFg, border: 'none', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.12s', opacity: sending ? 0.6 : 1, flexShrink: 0 }}>
                <Send size={13} />
              </button>
            ) : (
              <button onClick={() => sendMessage('👍')} disabled={sending}
                style={{ width: 32, height: 32, borderRadius: 6, background: 'transparent', color: C.accent, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, transition: 'all 0.12s' }}>
                👍
              </button>
            )}
          </div>
        </div>
        {!isMobile && (
          <p style={{ margin: '5px 0 0', fontSize: '0.625rem', color: C.textMuted, textAlign: 'right', letterSpacing: '0.02em' }}>
            Enter skickar · Shift+Enter ger en ny rad
          </p>
        )}
      </div>
    </div>
  ) : (
    /* â”€â”€ Empty right state */
    <div className="chat-empty-hero" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: isDark ? 'radial-gradient(circle at 50% 42%,rgba(34,197,94,.11),transparent 42%),#0D1117' : 'radial-gradient(circle at 50% 42%,rgba(34,197,94,.12),transparent 42%),#F6F8FA' }}>
      <div style={{ width: '100%', maxWidth: 760, textAlign: 'center', padding: 36 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', marginBottom: 18, borderRadius: 999, border: '1px solid rgba(34,197,94,.28)', background: 'rgba(34,197,94,.08)', color: C.accent, fontSize: '.625rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}><ShieldCheck size={12}/> Säker Gonow-chatt</div>
        <div className="chat-orbit" style={{ width: 88, height: 88, margin: '0 auto 20px', position: 'relative', display: 'grid', placeItems: 'center', borderRadius: 28, background: C.surface, border: '1px solid rgba(34,197,94,.24)', boxShadow: '0 18px 46px rgba(34,197,94,.16)' }}><MessageSquare size={34} color={C.accent}/><span style={{ position: 'absolute', right: -7, top: -7, width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, background: C.accent, color: '#fff', border: `4px solid ${C.bg}` }}><Sparkles size={13}/></span></div>
        <h2 style={{ margin: '0 0 9px', fontSize: 'clamp(1.35rem,2.3vw,2rem)', fontWeight: 800, color: C.text, letterSpacing: '-.04em' }}>Allt kring resan. I samma dialog.</h2>
        <p style={{ maxWidth: 520, margin: '0 auto 24px', fontSize: '.875rem', color: C.textSub, lineHeight: 1.7 }}>Chatta med förare och kunder, följ paketets sammanhang och få AI-hjälp med tydliga svar — utan att lämna Gonow.</p>
        <div className="empty-capabilities" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'left' }}>
          {[{icon:Truck,t:'Transportkontakt',d:'Direktkontakt under leveransen',color:'#22C55E'},{icon:Users,t:'Lift och samåkning',d:'Samla tider och mötesplats',color:'#3B82F6'},{icon:Package,t:'Paketresa',d:'Status och dialog i samma flöde',color:'#F59E0B'}].map(({icon:Icon,t,d,color}) => <div key={t} className="empty-capability" style={{ padding: 15, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, boxShadow: isDark ? 'none' : '0 8px 24px rgba(31,41,55,.05)' }}><span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, background: `${color}16`, color }}><Icon size={16}/></span><strong style={{ display: 'block', marginTop: 11, color: C.text, fontSize: '.78rem' }}>{t}</strong><small style={{ display: 'block', marginTop: 3, color: C.textMuted, fontSize: '.68rem', lineHeight: 1.45 }}>{d}</small></div>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 9, marginTop: 20, flexWrap: 'wrap' }}><button onClick={() => window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: 0, borderRadius: 8, background: C.accent, color: '#fff', fontSize: '.78rem', fontWeight: 750, cursor: 'pointer' }}><Package size={14}/> Skicka paket</button><Link href="/resor" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '.78rem', fontWeight: 700, textDecoration: 'none' }}><Users size={14}/> Hitta lift</Link></div>
      </div>
    </div>
  )

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <main className="messages-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '88px 24px 24px', boxSizing: 'border-box', background: isDark ? 'radial-gradient(circle at 8% 24%, rgba(34,197,94,.08), transparent 28%), #0D1117' : 'radial-gradient(circle at 8% 24%, rgba(34,197,94,.08), transparent 28%), #F6F8FA' }}>
      <div className="messages-shell" style={{ width: '100%', maxWidth: 1480, margin: '0 auto', flex: 1, display: 'flex', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: 18, boxShadow: isDark ? '0 28px 70px rgba(0,0,0,.42)' : '0 24px 64px rgba(31,41,55,.14)' }}>
        {isMobile ? (mobileChat ? RightPanel : LeftPanel) : <>{LeftPanel}{RightPanel}</>}
      </div>

      <style>{`
        /* Skeleton shimmer */
        .sk { background: ${C.border}; animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }

        /* Message enter */
        @keyframes slide-up { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

        /* Spinner */
        @keyframes spin { to{transform:rotate(360deg)} }

        /* Typing bounce */
        @keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-4px);opacity:1} }

        /* Dropdown appear */
        .dropdown { animation: appear 0.12s ease; }
        @keyframes appear { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }

        /* Jump chip */
        .jump-chip:hover { background: ${C.hover === 'rgba(0,0,0,0.03)' ? C.bg : C.elevated} !important; }

        /* Conversation row */
        .conv-row:hover { background: ${C.hover} !important; }

        /* Icon buttons */
        .icon-btn:hover { background: ${C.hover} !important; color: ${C.text} !important; }

        /* Quick action buttons */
        .qa-btn:hover { background: ${C.hover} !important; color: ${C.text} !important; border-color: ${C.border} !important; }

        /* AI menu rows */
        .menu-row:hover { background: ${C.hover} !important; }

        /* Toolbar action buttons */
        .bar-btn:hover { background: ${C.hover} !important; }

        /* Bubble hover → show toolbar + timestamp */
        .msg-wrap:hover .msg-bar { opacity: 1 !important; pointer-events: auto !important; }
        .msg-wrap:hover + .msg-ts { opacity: 0.85 !important; max-height: 20px !important; margin-top: 4px !important; }

        /* Search input focus */
        .search-input:focus { border-color: ${C.accent} !important; }

        /* Textarea reset */
        textarea { color-scheme: ${isDark ? 'dark' : 'light'}; }

        /* Thin scrollbars */
        ::-webkit-scrollbar       { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }

        /* Remove filter scrollbar */
        div::-webkit-scrollbar { display: none; }

        .chat-orbit { animation: chat-float 4s ease-in-out infinite; }
        @keyframes chat-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .empty-capability { transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .empty-capability:hover { transform: translateY(-3px); border-color: rgba(34,197,94,.34) !important; box-shadow: 0 14px 34px rgba(34,197,94,.10) !important; }

        @media (max-width: 700px) {
          .messages-page { padding: 72px 0 0 !important; }
          .messages-shell { border-left: 0 !important; border-right: 0 !important; border-bottom: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .empty-capabilities { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}

export default function MeddelandenPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: '100vh', background: 'var(--background, #f6f8fa)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 16px 32px' }}>
            <div style={{ height: 72, borderRadius: 20, background: 'rgba(0,0,0,0.04)', marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
              <div style={{ minHeight: 560, borderRadius: 24, background: 'rgba(0,0,0,0.04)' }} />
              <div style={{ minHeight: 560, borderRadius: 24, background: 'rgba(0,0,0,0.04)' }} />
            </div>
          </div>
        </main>
      }
    >
      <MeddelandenPageInner />
    </Suspense>
  )
}
