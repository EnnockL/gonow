'use client'

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Clock, Package as PackageIcon, Plus, Sparkles, X } from 'lucide-react'
import PackageCard, { type UppdragPackage } from '@/components/uppdrag/PackageCard'
import ErbjudModal from '@/components/uppdrag/ErbjudModal'
import PubliceraModal from '@/components/uppdrag/PubliceraModal'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import { PackageCardSkeleton } from '@/components/ui/Skeleton'
import { authedFetch } from '@/lib/auth/authed-fetch'

const FILTERS = ['Alla', 'Idag', 'Min rutt', 'Stockholm', 'Göteborg', 'Express', 'Bråttom', 'Försäkrad', 'Kyl', 'Stort'] as const
type Filter = typeof FILTERS[number]

const PKG_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open: { label: 'Öppen', color: 'var(--gn-dk)', bg: 'var(--gn-008)', border: 'var(--gn-020)' },
  matched: { label: 'Matchad', color: '#2563eb', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  paid: { label: 'Betald', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  picked_up: { label: 'Upphämtad', color: '#d97706', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)' },
  in_transit: { label: 'På väg', color: '#2563eb', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  delivered: { label: 'Levererad', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  confirmed: { label: 'Bekräftad', color: 'var(--gn-dk)', bg: 'var(--gn-008)', border: 'var(--gn-020)' },
  cancelled: { label: 'Avbokad', color: '#dc2626', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)' },
  expired: { label: 'Utgången', color: '#b45309', bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.2)' },
}

const HERO_SURFACE: CSSProperties = {
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%) 0%, var(--surface) 100%)',
  border: '1px solid color-mix(in srgb, var(--border) 84%, var(--gn) 16%)',
  boxShadow: '0 24px 52px rgba(15, 23, 42, 0.08)',
}

const MOCK_PACKAGES: UppdragPackage[] = [
  { id: '1', route: 'Stockholm → Göteborg', from: 'Stockholm', to: 'Göteborg', payout: 280, type: 'Kläder', weight: '3 kg', pickup: 'Vasastan', tags: ['Idag', 'Ömtåligt'], deadline: 'today' },
  { id: '2', route: 'Sundsvall → Stockholm', from: 'Sundsvall', to: 'Stockholm', payout: 210, type: 'Matvaror', weight: '4 kg', pickup: 'Centrum', tags: ['Idag', 'Kyl', 'Bråttom'], deadline: 'today' },
  { id: '3', route: 'Malmö → Stockholm', from: 'Malmö', to: 'Stockholm', payout: 340, type: 'Elektronik', weight: '5 kg', pickup: 'Hyllie', tags: ['Försäkrad', 'Imorgon'], deadline: 'tomorrow' },
  { id: '4', route: 'Göteborg → Uppsala', from: 'Göteborg', to: 'Uppsala', payout: 190, type: 'Böcker', weight: '2 kg', pickup: 'Hisingen', tags: ['Flexibel tid'], deadline: 'flexible' },
  { id: '5', route: 'Stockholm → Umeå', from: 'Stockholm', to: 'Umeå', payout: 520, type: 'Möbeldelar', weight: '12 kg', pickup: 'Nacka', tags: ['Stort'], deadline: 'flexible' },
]

function dbToPackage(row: Record<string, unknown>): UppdragPackage {
  const deadline = (row.deadline as UppdragPackage['deadline']) ?? 'flexible'
  const tags: string[] = []
  if (deadline === 'today') tags.push('Idag')
  if (deadline === 'tomorrow') tags.push('Imorgon')
  if (deadline === 'flexible') tags.push('Flexibel tid')
  if (row.is_fragile) tags.push('Ömtåligt')

  return {
    id: row.id as string,
    route: `${row.from_city} → ${row.to_city}`,
    from: row.from_city as string,
    to: row.to_city as string,
    payout: (row.price_ceiling ?? row.payout_ceiling) as number,
    type: (row.description ?? row.package_type) as string,
    weight: `${row.weight_kg ?? 5} kg`,
    pickup: (row.from_address ?? row.from_city) as string,
    tags,
    deadline,
    created_at: row.created_at as string | undefined,
    status: row.status as string | undefined,
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just nu'
  if (mins < 60) return `${mins} min sedan`
  if (hours < 24) return `${hours} tim sedan`
  if (days < 7) return `${days} dag${days > 1 ? 'ar' : ''} sedan`
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function sortPackages(packages: UppdragPackage[]) {
  return [...packages].sort((a, b) => {
    const score = (pkg: UppdragPackage) => (pkg.deadline === 'today' ? 2 : pkg.deadline === 'tomorrow' ? 1 : 0)
    return score(b) - score(a)
  })
}

function SegmentButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 18,
        border: active ? '1px solid color-mix(in srgb, var(--accent) 72%, transparent)' : '1px solid var(--border)',
        background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface-2)',
        color: 'var(--text)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.45 }}>{subtitle}</div>
    </button>
  )
}

function MyPackageRow({ pkg, onCancel }: { pkg: UppdragPackage; onCancel: (id: string) => void }) {
  const st = PKG_STATUS[pkg.status ?? 'open'] ?? PKG_STATUS.open
  const canCancel = ['open', 'matched'].includes(pkg.status ?? 'open')
  const timeAgo = pkg.created_at ? relativeTime(pkg.created_at) : null
  const isLive = ['open', 'matched', 'paid', 'picked_up', 'in_transit'].includes(pkg.status ?? 'open')
  const journeyHref = `/paket/${pkg.id}`
  const nextStepText =
    pkg.status === 'open'
      ? 'Gonow söker nu efter rätt transport för paketet.'
      : pkg.status === 'matched'
        ? 'Transporten är säkrad. Nästa steg i resan följer under paketvyn.'
        : pkg.status === 'paid'
          ? 'Betalningen är låst hos Gonow och paketresan är redo att starta.'
          : pkg.status === 'picked_up'
            ? 'Paketet är upphämtat och resan pågår under Gonow-kontroll.'
            : pkg.status === 'in_transit'
              ? 'Paketet är på väg och alla nästa steg följs i samma paketresa.'
              : pkg.status === 'delivered'
                ? 'Leveransen är framme och väntar på slutlig bekräftelse.'
                : pkg.status === 'confirmed'
                  ? 'Paketresan är avslutad och bekräftad.'
                  : pkg.status === 'cancelled'
                    ? 'Det här paketet avbokades innan resan slutfördes.'
                    : 'Det här paketet har avslutats i Gonow-flödet.'
  const journeyCta =
    pkg.status === 'confirmed'
      ? 'Visa avslutad resa'
      : pkg.status === 'cancelled' || pkg.status === 'expired'
        ? 'Visa historik'
        : 'Öppna paketresa'

  return (
    <div
      style={{
        background: isLive
          ? 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%) 0%, var(--surface) 100%)'
          : 'var(--surface)',
        border: `1.5px solid ${pkg.status === 'matched' ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
        borderRadius: 22,
        padding: '18px 18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: isLive ? '0 18px 38px rgba(15,23,42,0.06)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isLive && (
        <div
          style={{
            position: 'absolute',
            right: -42,
            top: -42,
            width: 132,
            height: 132,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(146,255,99,0.14) 0%, rgba(146,255,99,0.03) 55%, transparent 76%)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {isLive ? 'Aktiv Gonow-resa' : 'Avslutad resa'}
          </p>
          <p style={{ fontSize: '1.02rem', fontWeight: 850, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>{pkg.from} → {pkg.to}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.55 }}>{pkg.type} • {pkg.weight} • {pkg.pickup}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '5px 10px', borderRadius: 999, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
            {st.label}
          </span>
          {canCancel && (
            <button
              onClick={() => onCancel(pkg.id)}
              title="Avboka"
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.25)',
                background: 'rgba(239,68,68,0.06)',
                color: '#dc2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 13px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Utbetalningstak</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 850, color: 'var(--gn-dk)', marginTop: 5 }}>Upp till {pkg.payout} kr</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 13px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Publicerad</div>
          <div style={{ fontSize: '0.82rem', fontWeight: 750, color: 'var(--text)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> {timeAgo ?? 'Nyss'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 2,
          borderTop: '1px solid var(--border)',
        }}
      >
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          {nextStepText}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Link
            href={journeyHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 42,
              padding: '0 16px',
              borderRadius: 12,
              background: '#0a0a0a',
              color: 'var(--gn)',
              border: '1px solid var(--gn)',
              fontSize: '0.8rem',
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {journeyCta}
          </Link>
        </div>
      </div>
    </div>
  )
}

function UppdragContent() {
  const { userId } = useAuth()
  const searchParams = useSearchParams()
  const forecastDepartureId = searchParams.get('forecast_departure_id') ?? undefined
  const forecastFrom = searchParams.get('from') ?? ''
  const forecastTo = searchParams.get('to') ?? ''

  const [tab, setTab] = useState<'sender' | 'driver'>('driver')
  const [packages, setPackages] = useState<UppdragPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('Alla')
  const [recommendedIds, setRecommendedIds] = useState<string[]>([])
  const [aiExpanded, setAiExpanded] = useState(false)
  const [myPackages, setMyPackages] = useState<UppdragPackage[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [erbjudPkg, setErbjudPkg] = useState<UppdragPackage | null>(null)
  const [showPublicera, setShowPublicera] = useState(!!forecastDepartureId)
  const [showAuth, setShowAuth] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/packages')
        const json = await res.json()
        setPackages(json.packages?.length > 0 ? json.packages.map(dbToPackage) : MOCK_PACKAGES)
      } catch {
        setPackages(MOCK_PACKAGES)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (tab !== 'sender' || !userId) return
    setMyLoading(true)
    authedFetch(`/api/packages?sender_id=${userId}`)
      .then((r) => r.json())
      .then((json) => setMyPackages((json.packages ?? []).map(dbToPackage)))
      .catch(() => undefined)
      .finally(() => setMyLoading(false))
  }, [tab, userId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handlePubliceraClick() {
    if (!userId) setShowAuth(true)
    else setShowPublicera(true)
  }

  function handlePubliceraSuccess(pkg: UppdragPackage) {
    setPackages((prev) => [pkg, ...prev])
    setMyPackages((prev) => [pkg, ...prev])
    setShowPublicera(false)
    showToast('Paketet är publicerat.')
    setRecommendedIds([])
    setAiExpanded(false)
    setTab('sender')
  }

  async function handleCancelMyPackage(id: string) {
    try {
      await fetch(`/api/packages/${id}/cancel`, { method: 'POST' })
      setMyPackages((prev) => prev.map((pkg) => (pkg.id === id ? { ...pkg, status: 'cancelled' } : pkg)))
      showToast('Paketet avbokades.')
    } catch {
      showToast('Kunde inte avboka paketet.')
    }
  }

  function handleErbjudClick(pkg: UppdragPackage) {
    if (!userId) setShowAuth(true)
    else setErbjudPkg(pkg)
  }

  const filtered = useMemo(() => {
    let result = packages
    switch (filter) {
      case 'Idag':
        result = result.filter((pkg) => pkg.deadline === 'today')
        break
      case 'Min rutt':
      case 'Stockholm':
        result = result.filter((pkg) => pkg.from.includes('Stockholm') || pkg.to.includes('Stockholm'))
        break
      case 'Göteborg':
        result = result.filter((pkg) => pkg.from.includes('Göteborg') || pkg.to.includes('Göteborg'))
        break
      case 'Express':
        result = result.filter((pkg) => pkg.tags.includes('Express'))
        break
      case 'Bråttom':
        result = result.filter((pkg) => pkg.tags.includes('Bråttom'))
        break
      case 'Försäkrad':
        result = result.filter((pkg) => pkg.tags.includes('Försäkrad'))
        break
      case 'Kyl':
        result = result.filter((pkg) => pkg.tags.includes('Kyl'))
        break
      case 'Stort':
        result = result.filter((pkg) => pkg.tags.includes('Stort'))
        break
    }
    return sortPackages(result)
  }, [filter, packages])

  const aiRecommended = useMemo(() => [...packages].sort((a, b) => b.payout - a.payout).slice(0, 3), [packages])
  const aiTotal = aiRecommended.reduce((sum, pkg) => sum + pkg.payout, 0)

  const driverStats = [
    { value: String(filtered.length), label: 'öppna uppdrag', hint: 'Paket redo att matchas' },
    { value: `${aiRecommended.length}`, label: 'AI-prioriterade', hint: 'Snabbaste intäktskombon' },
    { value: `${aiTotal} kr`, label: 'potentiell payout', hint: 'Summerad toppkombination' },
  ]

  const senderActive = myPackages.filter((pkg) => ['open', 'matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status ?? 'open'))
  const senderHistory = myPackages.filter((pkg) => ['confirmed', 'cancelled', 'expired'].includes(pkg.status ?? ''))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gn)' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>
        <div style={{ ...HERO_SURFACE, borderRadius: isMobile ? 26 : 30, padding: isMobile ? '20px 18px' : '28px 28px 24px', marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -30, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(146,255,99,0.16) 0%, rgba(146,255,99,0.03) 52%, transparent 78%)' }} />
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 22 }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 800, color: 'var(--gn-dk)', background: 'var(--gn-010)', border: '1px solid var(--gn-020)', padding: '7px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                <PackageIcon size={13} /> Gonow-flode
              </span>
              <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.35rem', fontWeight: 950, color: 'var(--text)', margin: 0, letterSpacing: '-0.05em', lineHeight: 1.02 }}>
                {tab === 'sender' ? 'Publicera paket. Gonow foljer resten.' : 'Ta ratt uppdrag langs din rutt.'}
              </h1>
              <p style={{ fontSize: isMobile ? '0.92rem' : '0.98rem', color: 'var(--muted)', marginTop: 12, marginBottom: 0, lineHeight: 1.7, maxWidth: 640 }}>
                {tab === 'sender'
                  ? 'Publicera en leverans en gang. Folj matchning, status och nasta steg i samma sammanhallna Gonow-resa.'
                  : 'Se relevanta uppdrag, prioritera de som passar din kapacitet och svara i ett lugnt arbetsflode.'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {(tab === 'sender'
                ? [
                    { value: String(senderActive.length), label: 'aktiva paket', hint: 'Synliga för förare nu' },
                    { value: String(senderHistory.length), label: 'historik', hint: 'Tidigare avslutade uppdrag' },
                    { value: userId ? 'Redo' : 'Logga in', label: 'konto', hint: 'Skapa och hantera publiceringar' },
                  ]
                : driverStats
              ).map((item) => (
                <div key={item.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 18, padding: '14px 14px 12px', minHeight: 118 }}>
                  <div style={{ fontSize: '1.68rem', fontWeight: 950, color: 'var(--text)', letterSpacing: '-0.05em' }}>{item.value}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 10 }}>{item.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 12, alignItems: 'stretch', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <SegmentButton active={tab === 'driver'} title="For dig som kor" subtitle="Se relevanta uppdrag och svara med ratt kapacitet." onClick={() => setTab('driver')} />
            <SegmentButton active={tab === 'sender'} title="For dig som skickar" subtitle="Publicera paket och folj hela resan i ett flode." onClick={() => setTab('sender')} />
          </div>

          {tab === 'sender' && (
            <button
              onClick={handlePubliceraClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                flexShrink: 0,
                background: 'var(--accent)',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 999,
                padding: isMobile ? '12px 16px' : '0 22px',
                minHeight: isMobile ? 48 : 'auto',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={15} /> Publicera paket
            </button>
          )}
        </div>

        {tab === 'sender' ? (
          <>
            {!userId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PackageIcon size={24} style={{ color: 'var(--muted)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Logga in för att se dina paket</p>
                  <p style={{ fontSize: '0.84rem', color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>Du behöver vara inloggad för att publicera, spåra och hantera egna uppdrag.</p>
                </div>
                <button onClick={() => setShowAuth(true)} style={{ minHeight: 44, padding: '0 20px', background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Logga in
                </button>
              </div>
            ) : myLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} style={{ height: 88, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease infinite' }} />
                ))}
              </div>
            ) : myPackages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PackageIcon size={24} style={{ color: 'var(--muted)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Inga paket publicerade ännu</p>
                  <p style={{ fontSize: '0.84rem', color: 'var(--muted)', maxWidth: 320, margin: '0 auto' }}>Publicera ditt första paket och låt förare längs rutten hitta det direkt i nätverket.</p>
                </div>
                <button onClick={handlePubliceraClick} style={{ minHeight: 44, padding: '0 20px', background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} /> Publicera ett paket
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 24 }}>
                {senderActive.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Aktiva paket</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {senderActive.map((pkg) => (
                        <MyPackageRow key={pkg.id} pkg={pkg} onCancel={handleCancelMyPackage} />
                      ))}
                    </div>
                  </div>
                )}

                {senderHistory.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Historik</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {senderHistory.map((pkg) => (
                        <MyPackageRow key={pkg.id} pkg={pkg} onCancel={handleCancelMyPackage} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 16 }}>
              {FILTERS.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setFilter(item)
                    if (item !== 'Alla') {
                      setRecommendedIds([])
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '1px solid',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: filter === item ? 'var(--accent)' : 'var(--surface)',
                    color: filter === item ? '#0a0a0a' : 'var(--muted)',
                    borderColor: filter === item ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(135deg, var(--gn-010) 0%, var(--gn-004) 100%)', border: '1px solid var(--gn-025)', borderRadius: 18, padding: isMobile ? '16px 16px' : '16px 18px', marginBottom: 24, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Sparkles size={16} style={{ color: 'var(--gn)' }} />
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--gn-dk)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gonow rekommenderar</span>
                </div>
                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  {aiExpanded ? `Prioriterad vy: ${aiRecommended.length} uppdrag med totalt ${aiTotal} kr i mojlig intakt.` : `Gonow har prioriterat ${aiRecommended.length} uppdrag som passar din vy bast just nu.`}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
                  Visa den prioriterade ordningen nar du vill borja med de starkaste leveransmojligheterna.
                </p>
              </div>
              <button
                onClick={aiExpanded ? () => { setRecommendedIds([]); setAiExpanded(false) } : () => { setRecommendedIds(aiRecommended.map((pkg) => pkg.id)); setAiExpanded(true); setFilter('Alla') }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  minHeight: 44,
                  background: aiExpanded ? 'var(--surface-2)' : 'var(--gn-015)',
                  color: aiExpanded ? 'var(--muted)' : 'var(--gn-dk)',
                  border: `1px solid ${aiExpanded ? 'var(--border)' : 'var(--gn-035)'}`,
                  borderRadius: 999,
                  padding: '0 16px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {aiExpanded ? 'Aterga till full vy' : 'Visa prioriterad vy'}
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <PackageCardSkeleton key={index} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PackageIcon size={24} style={{ color: 'var(--muted)' }} />
                </div>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {filter === 'Alla' ? 'Inga uppdrag just nu' : `Inga uppdrag för "${filter}"`}
                </p>
                {filter !== 'Alla' && (
                  <button onClick={() => setFilter('Alla')} style={{ minHeight: 44, padding: '0 20px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Visa alla uppdrag
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} recommended={recommendedIds.includes(pkg.id)} onErbjud={handleErbjudClick} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false)
            setShowPublicera(true)
          }}
          reason="Logga in för att publicera eller svara på uppdrag"
        />
      )}

      {erbjudPkg && userId && (
        <ErbjudModal
          pkg={erbjudPkg}
          carrierId={userId}
          onClose={() => setErbjudPkg(null)}
          onSuccess={() => {
            setErbjudPkg(null)
            showToast('Erbjudandet skickades.')
          }}
        />
      )}

      {showPublicera && (
        <PubliceraModal
          onClose={() => setShowPublicera(false)}
          onSuccess={handlePubliceraSuccess}
          defaultFrom={forecastFrom}
          defaultTo={forecastTo}
          forecastDepartureId={forecastDepartureId}
        />
      )}
    </div>
  )
}

export default function UppdragPage() {
  return (
    <Suspense>
      <UppdragContent />
    </Suspense>
  )
}
