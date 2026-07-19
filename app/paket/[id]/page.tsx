'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Shield, Star, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { authedFetch } from '@/lib/auth/authed-fetch'
import { createClient } from '@/lib/supabase'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const gpId = (id: string) => 'GP-' + id.replace(/-/g, '').slice(0, 6).toUpperCase()

function fmtTs(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('sv-SE', opts ?? {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just nu'
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`
  return `${Math.floor(diff / 86400)} dag sedan`
}

function fmtDeadline(value: string | null | undefined) {
  if (!value) return null
  if (value === 'today') return 'Idag'
  if (value === 'tomorrow') return 'Imorgon'
  if (value === 'flexible') return 'Flexibel'
  return fmtTs(value, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function statusProgress(s: string): number {
  const m: Record<string, number> = {
    open: 15,
    matched: 35,
    paid: 50,
    picked_up: 58,
    in_transit: 72,
    delivered: 88,
    confirmed: 100,
    cancelled: 0,
  }
  return m[s] ?? 15
}

function getPaymentHoldText(status: string, linkedOrderStatus: string | null) {
  if (status === 'cancelled') return 'Ingen betalning hålls eftersom paketet är avbokat.'
  if (status === 'open') return 'Ingen betalning reserverad ännu. Gonow väntar först på att säkra transporten.'
  if (status === 'matched' && (linkedOrderStatus === 'pending' || linkedOrderStatus === 'matched')) {
    return 'Transporten är klar. Betala för att starta paketresan.'
  }
  if (status === 'matched') {
    return 'Transporten är klar. Gonow förbereder nästa steg.'
  }
  if (['paid', 'picked_up', 'in_transit', 'delivered'].includes(status)) {
    return 'Betalningen hålls tryggt hos Gonow tills leveransen är bekräftad av kunden.'
  }
  if (status === 'confirmed') {
    return 'Leveransen är bekräftad och betalningen avslutas tryggt.'
  }
  return 'Gonow hanterar betalningen i samma paketresa.'
}

function getConfirmationText(status: string, deliveryConfirmedAt: string | null) {
  if (status === 'cancelled') return 'Ingen leveransbekräftelse behövs för ett avbokat paket.'
  if (status === 'confirmed') {
    return deliveryConfirmedAt
      ? `Bekräftad ${fmtTs(deliveryConfirmedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
      : 'Leveransen är bekräftad av mottagaren.'
  }
  if (status === 'delivered') return 'Paketet är levererat och väntar på kundens bekräftelse.'
  if (['paid', 'picked_up', 'in_transit'].includes(status)) return 'Bekräftelse öppnas automatiskt när transporten markerat paketet som levererat.'
  return 'Bekräftelse öppnas först när paketet är levererat.'
}

function getPayoutText(status: string) {
  if (status === 'confirmed') return 'Gonow slutför betalningen till transportören.'
  if (status === 'delivered') return 'Betalningen slutförs när leveransen har bekräftats.'
  if (status === 'matched') return 'Betalningen hanteras tryggt när paketresan startar.'
  if (['paid', 'picked_up', 'in_transit'].includes(status)) return 'Pengarna är säkrade hos Gonow tills leveransen är bekräftad.'
  return 'Gonow hanterar betalningen när paketresan är slutförd.'
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PkgData {
  id: string
  sender_id: string
  from_city: string
  to_city: string
  from_address: string | null
  to_address: string | null
  description: string
  weight_kg: number
  is_fragile: boolean | null
  status: string
  matched_carrier_id: string | null
  pickup_confirmed_at: string | null
  delivery_confirmed_at: string | null
  created_at: string
  deadline: string | null
  price_ceiling: number | null
  receiver_name?: string | null
  receiver_phone?: string | null
  sender?: { name: string } | null
}

interface Driver {
  id: string
  name: string
  rating_avg: number
  avatar_url: string | null
}

// â”€â”€ Order adapter (legacy orders → PkgData shape) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Source = 'package' | 'order'

interface OrderApiResponse {
  order: {
    id: string; sender_id: string; carrier_id?: string
    pickup_address?: string; dropoff_address?: string
    description?: string; weight_kg?: number; price: number; status: string
    picked_up_at?: string; delivered_at?: string; created_at: string
    trips?: { from_city: string; to_city: string; departure_at: string } | null
  }
  carrier?: { id?: string; name: string; rating_avg?: number; avatar_url?: string | null } | null
  sender?: { name: string } | null
  recipient?: { name: string; phone?: string } | null
}

function mapOrderStatus(s: string): string {
  const m: Record<string, string> = {
    pending: 'matched', matched: 'matched', picked_up: 'in_transit',
    in_transit: 'in_transit', delivered: 'delivered', confirmed: 'confirmed', cancelled: 'cancelled',
  }
  return m[s] ?? 'open'
}

function cityFromAddress(addr?: string): string {
  if (!addr) return 'Okänd'
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean)
  return parts[parts.length - 1] || addr.slice(0, 14)
}

function orderToPkg(r: OrderApiResponse): PkgData {
  const o = r.order
  return {
    id: o.id, sender_id: o.sender_id,
    from_city: o.trips?.from_city ?? cityFromAddress(o.pickup_address),
    to_city: o.trips?.to_city ?? cityFromAddress(o.dropoff_address),
    from_address: o.pickup_address ?? null, to_address: o.dropoff_address ?? null,
    description: o.description ?? 'Paket', weight_kg: o.weight_kg ?? 0, is_fragile: null,
    status: mapOrderStatus(o.status), matched_carrier_id: o.carrier_id ?? null,
    pickup_confirmed_at: o.picked_up_at ?? null, delivery_confirmed_at: o.delivered_at ?? null,
    created_at: o.created_at, deadline: o.trips?.departure_at ?? null, price_ceiling: o.price,
  }
}

// â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS = {
  paid:       { label: 'Betalning säkrad', sub: 'Gonow håller betalningen tryggt tills paketet är levererat',     color: '#10b981', glow: 'rgba(16,185,129,0.18)',  dot: '#10b981' },
  open:       { label: 'Söker transport',    sub: 'Gonow samordnar nu bästa nästa steg för paketet', color: '#94a3b8', glow: 'rgba(148,163,184,0.18)', dot: '#94a3b8' },
  matched:    { label: 'Transport klar',  sub: 'Gonow har säkrat transporten och väntar nu på betalning', color: '#60a5fa', glow: 'rgba(96,165,250,0.18)',  dot: '#60a5fa' },
  in_transit: { label: 'På väg',            sub: 'Ditt paket transporteras just nu mot destinationen',          color: '#fbbf24', glow: 'rgba(251,191,36,0.18)',  dot: '#fbbf24' },
  delivered:  { label: 'Levererad',          sub: 'Paketet är levererat — bekräfta mottagning för att slutföra',color: '#4ade80', glow: 'rgba(74,222,128,0.22)',  dot: '#4ade80' },
  confirmed:  { label: 'Slutförd',           sub: 'Leveransen är bekräftad av mottagaren',                      color: '#92ff63', glow: 'rgba(146,255,99,0.18)', dot: '#92ff63' },
  cancelled:  { label: 'Avbokat',            sub: 'Transporten avbokades',                                      color: '#ef4444', glow: 'rgba(239,68,68,0.15)',  dot: '#ef4444' },
} as const

const STATUS_DISPLAY = {
  ...STATUS,
  picked_up: {
    label: 'Upphämtat',
    sub: 'Paketet är upphämtat och redo för avfärd',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.18)',
    dot: '#7c3aed',
  },
} as const

type StatusKey = keyof typeof STATUS_DISPLAY

// â”€â”€ CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CSS = `
@keyframes gn-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(.96)} }
@keyframes gn-ping   { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.4);opacity:0} }
@keyframes gn-shimmer{ 0%{background-position:-400px 0} 100%{background-position:400px 0} }
@keyframes gn-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes gn-check  { 0%{stroke-dashoffset:24} 100%{stroke-dashoffset:0} }
@keyframes gn-truck      { 0%{offset-distance:2%} 100%{offset-distance:98%} }
@keyframes gn-draw       { from{stroke-dashoffset:700} to{stroke-dashoffset:0} }
@keyframes gn-route-fill { from{stroke-dashoffset:540} to{stroke-dashoffset:0} }
@keyframes gn-ripple     { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(1.8);opacity:0} }
@keyframes gn-gps        { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.6);opacity:0} }
@keyframes gn-scan       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(160px)} }
@keyframes gn-float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
.gn-fadein { animation: gn-fadein 0.4s ease both }
.gn-pulse  { animation: gn-pulse  2s ease-in-out infinite }
`

// â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Sk({ h = 18, w = '100%', r = 10 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,var(--surface-2) 25%,rgba(255,255,255,0.06) 50%,var(--surface-2) 75%)',
      backgroundSize: '800px 100%',
      animation: 'gn-shimmer 1.4s infinite linear',
    }} />
  )
}

function SkeletonPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '84px 16px 80px' }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Sk h={22} w={120} r={8} />
        <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 24, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Sk h={40} w={80} r={12} />
          <Sk h={28} w="55%" />
          <Sk h={15} w="75%" />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Sk h={28} w={90} r={999} />
            <Sk h={28} w={110} r={999} />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 20, padding: 20, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Sk h={14} w="35%" />
            <Sk h={14} w={`${[80, 60, 70][i - 1]}%`} />
          </div>
        ))}
      </div>
    </main>
  )
}

// â”€â”€ QR Code component (has canvas ref state) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PackageQRCode({ pkgId }: { pkgId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    import('qrcode').then(QRCode => {
      if (!canvasRef.current) return
      QRCode.toCanvas(canvasRef.current, `gonow-pkg:${pkgId}`, {
        width: 180, margin: 2, color: { dark: '#0a0a0a', light: '#ffffff' },
      }).then(() => setReady(true)).catch(() => {})
    })
  }, [pkgId])
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <div style={{ display: 'inline-block', background: '#fff', padding: 14, borderRadius: 18 }}>
        {!ready && (
          <div style={{
            width: 180, height: 180, borderRadius: 10,
            backgroundImage: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
            backgroundSize: '400px 100%', animation: 'gn-shimmer 1.4s infinite linear',
          }} />
        )}
        <canvas ref={canvasRef} style={{ display: ready ? 'block' : 'none', borderRadius: 10 }} />
      </div>
      <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', margin: '10px 0 2px', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
        {gpId(pkgId)}
      </p>
      <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0 }}>
        Visa QR-koden när transporten hämtas
      </p>
    </div>
  )
}

// â”€â”€ Inline Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InlineReview({ packageId, driver, onDone }: {
  packageId: string; driver: Driver; onDone: () => void
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (stars === 0) return
    setLoading(true)
    try {
      const res = await authedFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, to_user_id: driver.id, rating: stars, comment }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setDone(true); onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fel')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="gn-fadein" style={{ borderRadius: 18, padding: '16px 18px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 12, textAlign: 'center' }}>
      <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f59e0b', margin: 0 }}>★ Betyg skickat — tack!</p>
    </div>
  )

  return (
    <div className="gn-fadein" style={{ borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 18px', marginBottom: 12 }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 14px' }}>
        Hur var upplevelsen?
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gn),#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#0a0a0a', flexShrink: 0 }}>
          {driver.name.charAt(0)}
        </div>
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{driver.name}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0 }}>Din transportkontakt</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n}
            onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)} onClick={() => setStars(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transform: hovered >= n || stars >= n ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.1s' }}
          >
            <Star size={28} color="#f59e0b" fill={hovered >= n || stars >= n ? '#f59e0b' : 'none'} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <div className="gn-fadein">
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Kommentar (valfritt)…" rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {error && <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0 0 8px' }}>{error}</p>}
          <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', background: 'var(--gn)', color: '#0a0a0a', fontWeight: 800, fontSize: '0.88rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Skickar…' : 'Skicka betyg'}
          </button>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PaketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { userId } = useAuth()
  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [pkg, setPkg]               = useState<PkgData | null>(null)
  const [driver, setDriver]         = useState<Driver | null>(null)
  const [loading, setLoading]       = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)
  const [reviewed, setReviewed]     = useState(false)
  const [error, setError]           = useState('')
  const [source, setSource]         = useState<Source>('package')
  const [eta, setEta]               = useState<string | null>(null)
  const [paymentBanner, setPaymentBanner] = useState<'success' | 'cancelled' | null>(null)
  const [sender, setSender]           = useState<{ name: string } | null>(null)
  const [recipient, setRecipient]     = useState<{ name: string; phone?: string } | null>(null)
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null)
  const [linkedOrderStatus, setLinkedOrderStatus] = useState<string | null>(null)

  // Payment query param banner
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const p = qs.get('payment')
    if (p === 'success') setPaymentBanner('success')
    else if (p === 'cancelled') setPaymentBanner('cancelled')
  }, [])

  // Load package (packages first, orders fallback)
  useEffect(() => {
    const sb = createClient()
    async function loadDriver(carrierId: string) {
      const { data: u } = await sb.from('users').select('id, name, rating_avg, avatar_url').eq('id', carrierId).single()
      if (u) setDriver(u as Driver)
    }
    async function loadLinkedOrder(packageId: string) {
      const { data: order } = await sb
        .from('orders')
        .select('id, status, metadata')
        .contains('metadata', { package_id: packageId })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (order) {
        setLinkedOrderId(order.id)
        setLinkedOrderStatus(order.status ?? null)
      } else {
        setLinkedOrderId(null)
        setLinkedOrderStatus(null)
      }
    }
    authedFetch(`/api/packages/${id}`)
      .then(async (res) => res.ok ? await res.json() as { package?: PkgData } : { package: undefined })
      .then(async ({ package: data }) => {
        if (data) {
          setPkg(data); setSource('package')
          if (data.sender?.name) setSender({ name: data.sender.name })
          if (data.receiver_name) setRecipient({ name: data.receiver_name, phone: data.receiver_phone ?? undefined })
          if (data.matched_carrier_id) await loadDriver(data.matched_carrier_id)
          await loadLinkedOrder(data.id)
          setLoading(false); return
        }
        const res = await authedFetch(`/api/orders/${id}`).catch(() => null)
        if (res?.ok) {
          const json: OrderApiResponse = await res.json()
          if (json.order) {
            setPkg(orderToPkg(json)); setSource('order')
            setLinkedOrderId(json.order.id)
            setLinkedOrderStatus(json.order.status)
            if (json.order.trips?.departure_at) {
              setEta(new Date(json.order.trips.departure_at).toLocaleString('sv-SE', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              }))
            }
            if (json.carrier) setDriver({ id: json.carrier.id ?? json.order.carrier_id ?? '', name: json.carrier.name, rating_avg: json.carrier.rating_avg ?? 0, avatar_url: json.carrier.avatar_url ?? null })
            if (json.sender) setSender(json.sender)
            if (json.recipient) setRecipient(json.recipient)
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  // Check if already reviewed
  useEffect(() => {
    if (!userId || !pkg || !['delivered', 'confirmed'].includes(pkg.status)) return
    fetch(`/api/reviews?package_id=${id}&from_user_id=${userId}`)
      .then(r => r.json()).then(d => setReviewed(d.reviewed)).catch(() => {})
  }, [userId, pkg, id])

  async function handlePay() {
    if (!linkedOrderId) return
    setError('')
    try {
      const res = await authedFetch(`/api/orders/${linkedOrderId}/checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta betalningen.')

      if (data.mock) {
        setLinkedOrderStatus('paid')
        setPkg((prev) => (prev ? { ...prev, status: 'paid' } : prev))
        setPaymentBanner('success')
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      throw new Error('Ingen checkout-länk kunde skapas.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte starta betalningen.')
    }
  }

  async function handleCancel() {
    if (!confirm('Avboka paketet?')) return
    setCancelling(true); setError('')
    try {
      const res = await authedFetch(`/api/packages/${id}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPkg(prev => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch (e) { setError(e instanceof Error ? e.message : 'Fel') }
    finally { setCancelling(false) }
  }

  async function handleConfirm() {
    setConfirming(true); setError('')
    try {
      const res = source === 'order'
        ? await authedFetch(`/api/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) })
        : await authedFetch(`/api/packages/${id}/confirm`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Fel')
      setPkg(prev => prev ? { ...prev, status: 'confirmed', delivery_confirmed_at: new Date().toISOString() } : prev)
    } catch (e) { setError(e instanceof Error ? e.message : 'Fel') }
    finally { setConfirming(false) }
  }

  async function handleOpenConversation() {
    if (!userId || !pkg) return

    const otherUserId = userId === pkg.sender_id
      ? pkg.matched_carrier_id
      : pkg.sender_id

    if (!otherUserId) {
      setError('Ingen aktiv transportkontakt finns ännu för detta paket.')
      return
    }

    setOpeningChat(true)
    setError('')

    try {
      const res = await authedFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_type: 'package',
          context_id: pkg.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.conversation?.id) {
        throw new Error(data.error || 'Kunde inte öppna konversationen.')
      }
      router.push(`/meddelanden?conversation=${data.conversation.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte öppna konversationen.')
    } finally {
      setOpeningChat(false)
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading) return <SkeletonPage />

  if (!pkg) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '100px 20px', textAlign: 'center' }}>
        <style>{CSS}</style>
        <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 }}>📦</div>
        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Paketet hittades inte</p>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>Kontrollera länken eller öppna paketet från din profil.</p>
      </main>
    )
  }

  const isSender   = userId === pkg.sender_id
  const status     = pkg.status as StatusKey
  const cfg        = STATUS_DISPLAY[status] ?? STATUS_DISPLAY.open
  const progress   = statusProgress(pkg.status)
  const isActive   = !['confirmed', 'cancelled'].includes(pkg.status)
  const canCancel  = source === 'package' && isSender && ['open', 'matched'].includes(pkg.status)
  const canConfirm = pkg.status === 'delivered' && isSender
  const canPay     = source === 'package' && isSender && pkg.status === 'matched' && (linkedOrderStatus === 'pending' || linkedOrderStatus === 'matched') && Boolean(linkedOrderId)
  const showQR     = source === 'package' && isSender && pkg.status === 'paid'

  // Timeline steps
  const STEPS = [
    { key: 'booked',     label: 'Paket bokat',                          sub: `Bokat ${timeAgo(pkg.created_at)}` },
    { key: 'searching',  label: 'Gonow söker transport', sub: 'Gonow samordnar tillgänglig kapacitet' },
    { key: 'matched',    label: 'Transport klar',                     sub: driver ? `${driver.name} bekräftad - väntar på betalning` : 'Transport bekräftad - väntar på betalning' },
    { key: 'paid',       label: 'Betalning säkrad',                    sub: 'Gonow håller pengarna tryggt tills leveransen är bekräftad' },
    { key: 'pickup',     label: 'Transporten är upphämtad',              sub: pkg.pickup_confirmed_at ? `${fmtTs(pkg.pickup_confirmed_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Upphämtning pågår' },
    { key: 'transit',    label: 'Paketet är på väg',                     sub: `Till ${pkg.to_city}` },
    { key: 'delivered',  label: 'Levererat',                             sub: pkg.delivery_confirmed_at ? `${fmtTs(pkg.delivery_confirmed_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Väntar på bekräftelse' },
    { key: 'confirmed',  label: 'Leverans bekräftad',                    sub: 'Utbetalning frigörs till transporten' },
  ]
  const STEP_IDX: Record<string, number> = { open: 1, matched: 2, paid: 3, picked_up: 4, in_transit: 5, delivered: 6, confirmed: 7, cancelled: 1 }
  const currentStep = STEP_IDX[pkg.status] ?? 1

  // "What is happening now" copy
  const WHAT_NOW: Record<string, string> = {
    open:       'Gonow söker kontinuerligt efter den bästa transporten för ditt paket. Du meddelas när en lösning är klar.',
    matched:    `Transporten är klar${driver ? ` med ${driver.name}` : ''}. Betala för att starta paketresan.`,
    paid:       'Betalningen är nu säkrad hos Gonow. Visa QR-koden vid upphämtning så att transporten kan kvittera paketet och starta leveransen.',
    picked_up:  `Paketet är upphämtat. Gonow följer leveransen till ${pkg.to_city}.`,
    in_transit: `Ditt paket är på väg mot ${pkg.to_city}. Gonow övervakar nu leveransen tills paketet markeras levererat och du kan bekräfta mottagandet.`,
    delivered:  'Paketet är framme. Bekräfta leveransen för att avsluta paketresan.',
    confirmed:  'Paketresan är slutförd. Leveransen är bekräftad och Gonow frigör nu utbetalningen till transporten.',
    cancelled:  'Transporten har avbokats. Publicera ett nytt paket för att komma igång igen.',
  }

  // Next step copy
  const NEXT_STEP: Record<string, { label: string; when: string } | null> = {
    open:       { label: 'Matcha transport', when: 'Inom kort' },
    matched:    { label: 'Betala och starta paketresan', when: 'Nu' },
    paid:       { label: 'Visa QR vid upphämtning', when: 'När transporten anländer' },
    picked_up:  { label: 'Invänta att transporten markerar paketet på väg', when: 'Snart' },
    in_transit: { label: 'Invänta leverans till mottagaren', when: 'Nästa stopp' },
    delivered:  { label: 'Bekräfta att paketet är framme', when: 'Nu' },
    confirmed:  null,
    cancelled:  null,
  }
  const nextStep = NEXT_STEP[pkg.status]

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 18px', marginBottom: 12, ...extra }}>
      {children}
    </div>
  )
  const label = (text: string) => (
    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 14px' }}>{text}</p>
  )

  // Shared card helper (stays inside PaketPage so isMobile is in scope)
  const gapPx = isMobile ? 12 : 14

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '80px 14px 96px' : '88px 24px 96px' }}>
      <style>{CSS}</style>

      {/* â”€â”€ Payment banners — full width â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {paymentBanner === 'success' && (
        <div className="gn-fadein" style={{ borderRadius: 14, padding: '14px 16px', background: 'rgba(146,255,99,0.08)', border: '1px solid rgba(146,255,99,0.25)', marginBottom: 14 }}>
          <p style={{ fontWeight: 700, color: 'var(--gn)', margin: '0 0 2px', fontSize: '0.9rem' }}>Betalningen gick igenom ✓</p>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0 }}>Gonow har nu säkrat betalningen och transporten kan starta.</p>
        </div>
      )}
      {paymentBanner === 'cancelled' && (
        <div className="gn-fadein" style={{ borderRadius: 14, padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 14 }}>
          <p style={{ fontWeight: 700, color: '#b45309', margin: '0 0 2px', fontSize: '0.9rem' }}>Betalningen avbröts</p>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0 }}>Gå till Mina sidor och starta betalningen igen.</p>
        </div>
      )}
      {error && (
        <div className="gn-fadein" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14 }}>
          <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', color: '#ef4444', margin: 0, flex: 1 }}>{error}</p>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, flexShrink: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* â”€â”€ A Â· HERO — full width â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="gn-fadein" style={{
        borderRadius: 24, padding: '24px 22px', marginBottom: 12,
        background: `linear-gradient(140deg, var(--surface) 0%, ${cfg.glow} 120%)`,
        border: `1.5px solid ${cfg.color}33`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* glow blob */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: cfg.glow, filter: 'blur(52px)', pointerEvents: 'none' }} />

        {/* GP-ID + route */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: cfg.color, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
            {gpId(pkg.id)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>
            {pkg.from_city} → {pkg.to_city}
          </span>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div className={isActive ? 'gn-pulse' : ''} style={{ width: 52, height: 52, borderRadius: 14, background: `${cfg.color}18`, border: `2px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              {status === 'open'
                ? '🤖'
                : status === 'matched'
                  ? '✅'
                  : status === 'paid'
                    ? '💳'
                    : status === 'picked_up'
                      ? '📦'
                      : status === 'in_transit'
                        ? '🚚'
                        : status === 'delivered'
                          ? '📍'
                          : status === 'confirmed'
                            ? '🎉'
                            : '❌'}
            </div>
            {isActive && <span style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: cfg.color, animation: 'gn-ping 1.4s cubic-bezier(0,0,.2,1) infinite' }} />}
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{cfg.label}</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.4 }}>{cfg.sub}</p>
          </div>
        </div>

        {/* Meta badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', padding: '4px 9px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            📅 {fmtTs(pkg.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          {pkg.weight_kg > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', padding: '4px 9px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              ⚖️ {pkg.weight_kg} kg
            </span>
          )}
          {pkg.price_ceiling && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', padding: '4px 9px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              💰 {pkg.price_ceiling} kr
            </span>
          )}
          {pkg.is_fragile && (
            <span style={{ fontSize: '0.7rem', color: '#f97316', padding: '4px 9px', borderRadius: 7, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
              ⚠ Fragile
            </span>
          )}
          {eta && (
            <span style={{ fontSize: '0.7rem', color: '#60a5fa', padding: '4px 9px', borderRadius: 7, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              🕐 {eta}
            </span>
          )}
        </div>
      </div>

      {/* â”€â”€ F Â· Live Tracking — full width, direkt under hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {pkg.status === 'in_transit' && (
        <div className="gn-fadein" style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: isMobile ? 12 : 20 }}>

          {/* Header */}
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(146,255,99,0.1)', border: '1px solid rgba(146,255,99,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🗺️</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Live Tracking</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '1px 0 0' }}>Realtidsposition Â· {pkg.from_city} → {pkg.to_city}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(146,255,99,0.1)', border: '1px solid rgba(146,255,99,0.3)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gn)', animation: 'gn-ping 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.63rem', fontWeight: 800, color: 'var(--gn)', letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          </div>

          {/* Map area — Google Maps style */}
          <div style={{ margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', height: 210 }}>

            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="gnTerrain" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#eaf0e6"/>
                  <stop offset="100%" stopColor="#dde8d8"/>
                </linearGradient>
                <pattern id="gnRoads" width="80" height="80" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="40" x2="80" y2="40" stroke="#cfd9c9" strokeWidth="2"/>
                  <line x1="40" y1="0" x2="40" y2="80" stroke="#cfd9c9" strokeWidth="1"/>
                  <line x1="0" y1="20" x2="80" y2="20" stroke="#d8e2d3" strokeWidth="0.5"/>
                  <line x1="0" y1="60" x2="80" y2="60" stroke="#d8e2d3" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gnTerrain)"/>
              <rect width="100%" height="100%" fill="url(#gnRoads)" opacity="0.6"/>
              <ellipse cx="15%" cy="35%" rx="12%" ry="18%" fill="rgba(163,198,140,0.35)"/>
              <ellipse cx="80%" cy="65%" rx="10%" ry="15%" fill="rgba(163,198,140,0.3)"/>
              <ellipse cx="50%" cy="20%" rx="8%" ry="12%" fill="rgba(163,198,140,0.2)"/>
            </svg>

            <svg viewBox="0 0 500 140" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <filter id="gnf-pin">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.25)"/>
                </filter>
                <filter id="gnf-dot">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(34,197,94,0.4)"/>
                </filter>
              </defs>

              <path d="M 55 100 C 160 55, 340 55, 445 100" fill="none" stroke="white" strokeWidth="11" strokeLinecap="round"/>
              <path d="M 55 100 C 160 55, 340 55, 445 100" fill="none" stroke="#b0c4aa" strokeWidth="7" strokeLinecap="round"/>
              <path d="M 55 100 C 160 55, 340 55, 445 100" fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" strokeDasharray="540" strokeDashoffset="270"/>

              <circle cx="55" cy="100" r="8" fill="white" filter="url(#gnf-pin)"/>
              <circle cx="55" cy="100" r="5" fill="#22c55e"/>

              <g filter="url(#gnf-pin)">
                <path d="M 447 84 C 447 76, 452 70, 459 70 C 466 70, 471 76, 471 84 C 471 91, 459 102, 459 102 C 459 102, 447 91, 447 84 Z" fill="#ea4335"/>
                <circle cx="459" cy="83" r="4" fill="white"/>
              </g>

              <g style={{ offsetPath: 'path("M 55 100 C 160 55, 340 55, 445 100")', offsetDistance: '50%' } as React.CSSProperties}>
                <circle r="22" fill="rgba(34,197,94,0.1)" style={{ animation: 'gn-gps 3.5s ease-in-out infinite' }}/>
                <circle r="11" fill="white" filter="url(#gnf-dot)"/>
                <circle r="8" fill="#22c55e"/>
                <circle r="3" fill="white"/>
              </g>
            </svg>

            <div style={{ position: 'absolute', top: 10, left: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.92)', padding: '4px 10px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#111' }}>{pkg.from_city}</span>
              </div>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.92)', padding: '4px 10px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea4335' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#111' }}>{pkg.to_city}</span>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)' }}>
              <div style={{ background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'gn-pulse 2.5s ease-in-out infinite' }} />
                <span style={{ fontSize: '0.68rem', color: '#374151', fontWeight: 600 }}>GPS aktiv Â· uppdateras live</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ 2-column grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: isMobile ? 12 : 20, alignItems: 'start' }}>

        {/* â”€â”€ LEFT COLUMN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gapPx }}>

          {/* B Â· What's happening now */}
          {card(
            <>
              {label(isActive ? (pkg.status === 'in_transit' ? 'LIVE Â· NU' : 'Vad händer nu') : 'Vad händer nu')}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: isActive ? 'rgba(146,255,99,0.08)' : 'var(--surface-2)', border: isActive ? '1px solid rgba(146,255,99,0.2)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', ...(isActive ? { animation: 'gn-pulse 3s ease-in-out infinite' } : {}) }}>
                  {pkg.status === 'matched'
                    ? '💳'
                    : pkg.status === 'paid'
                      ? '📱'
                      : pkg.status === 'picked_up'
                        ? '📦'
                        : pkg.status === 'in_transit'
                          ? '📡'
                          : pkg.status === 'confirmed'
                            ? '🎉'
                            : pkg.status === 'cancelled'
                              ? '⚠️'
                              : 'ℹ️'}
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: 0, lineHeight: 1.65 }}>{WHAT_NOW[pkg.status] ?? ''}</p>
              </div>
            </>
          )}

          {/* C Â· Next step */}
          {nextStep && (
            <div className="gn-fadein" style={{ borderRadius: 18, padding: '14px 18px', background: 'rgba(146,255,99,0.04)', border: '1px solid rgba(146,255,99,0.15)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <p style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--gn)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 3px' }}>Nästa</p>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', margin: 0 }}>{nextStep.when}</p>
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(146,255,99,0.2)', flexShrink: 0 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{nextStep.label}</p>
            </div>
          )}

          {/* D Â· Progress */}
          {card(
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                {label('Framdrift')}
                <strong style={{ fontSize: '0.9rem', color: cfg.color, marginBottom: 14 }}>{progress}%</strong>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: isActive ? `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` : cfg.color, borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {['Publicerat', 'Matchat', 'Betald', 'På väg', 'Levererat', 'Klart'].map((s, i) => {
                  const active = progress >= [15, 35, 50, 72, 88, 100][i]
                  return <span key={s} style={{ fontSize: '0.62rem', fontWeight: active ? 700 : 400, color: active ? cfg.color : 'var(--muted)', transition: 'color 0.3s' }}>{s}</span>
                })}
              </div>
            </>,
            { padding: '20px 18px 16px' }
          )}

          {/* E Â· Driver */}
          {driver && pkg.status !== 'open' && card(
            <>
              {label('Din transportkontakt')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {driver.avatar_url ? (
                  <img src={driver.avatar_url} alt={driver.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gn)' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--gn), #60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, color: '#0a0a0a', boxShadow: '0 0 0 3px rgba(146,255,99,0.2)' }}>
                    {driver.name.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 5px' }}>{driver.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={11} color="#f59e0b" fill={n <= Math.round(driver.rating_avg) ? '#f59e0b' : 'none'} />)}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text)', fontWeight: 700, marginLeft: 4 }}>{driver.rating_avg > 0 ? driver.rating_avg.toFixed(1) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                      <Shield size={10} color="#60a5fa" />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#60a5fa' }}>Verifierad</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={handleOpenConversation}
                  disabled={openingChat}
                  style={{
                    flex: 1,
                    minWidth: 180,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(146,255,99,0.22)',
                    background: 'rgba(146,255,99,0.08)',
                    color: 'var(--gn-dk)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: openingChat ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: openingChat ? 0.65 : 1,
                  }}
                >
                  {openingChat ? 'Öppnar chatten…' : 'Kontakta i Gonow-chatten'}
                </button>
              </div>
            </>
          )}

          {/* G Â· Timeline */}
          {card(
            <>
              {label('Händelselogg')}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pkg.status === 'cancelled' ? (
                  [STEPS[0], { key: 'cancelled', label: 'Avbokat', sub: 'Transporten avbokades' }].map((ev, i, arr) => {
                    const isLast = i === arr.length - 1; const isDone = i === 0; const isCurr = i === 1
                    return (
                      <div key={ev.key} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: isCurr ? 'rgba(239,68,68,0.2)' : '#4ade80', border: `2px solid ${isCurr ? '#ef4444' : '#4ade80'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                            {isDone && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, marginTop: 3, background: '#4ade8044' }} />}
                        </div>
                        <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: isCurr ? 800 : 600, color: isCurr ? '#ef4444' : 'var(--text)', margin: 0 }}>{ev.label}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0' }}>{ev.sub}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  STEPS.map((ev, i) => {
                    const isDone = i < currentStep; const isCurr = i === currentStep; const isLast = i === STEPS.length - 1
                    const dotColor = isDone ? '#4ade80' : isCurr ? 'var(--gn)' : 'var(--surface-2)'
                    return (
                      <div key={ev.key} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: dotColor, border: `2px solid ${isDone ? '#4ade80' : isCurr ? 'var(--gn)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', ...(isCurr ? { animation: 'gn-pulse 2s ease-in-out infinite' } : {}) }}>
                            {isDone && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 24, strokeDashoffset: 0, animation: 'gn-check 0.4s ease forwards' }} /></svg>}
                          </div>
                          {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, marginTop: 3, background: isDone ? '#4ade8044' : 'var(--border)', transition: 'background 0.4s' }} />}
                        </div>
                        <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: isCurr ? 800 : 600, color: isCurr || isDone ? 'var(--text)' : 'var(--muted)', margin: 0, lineHeight: 1.3 }}>{ev.label}</p>
                          {(isDone || isCurr) && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0' }}>{ev.sub}</p>}
                          {isCurr && ev.key === 'searching' && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                              {[0.2, 0.35, 0.5].map((d, j) => <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gn)', animation: `gn-pulse 1.2s ease-in-out ${d}s infinite` }} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* â”€â”€ RIGHT SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gapPx }}>

          {canPay && (
            <div className="gn-fadein" style={{ borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--surface) 100%)', border: '1.5px solid rgba(16,185,129,0.24)' }}>
              <div style={{ padding: '22px 20px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: '2rem' }}>💳</div>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', margin: 0 }}>Betala och lås transporten</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>
                      Gonow tar emot betalningen tryggt och transporten kan sedan paborjas.
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', borderTop: '1px solid rgba(16,185,129,0.15)' }}>
                <button onClick={handlePay} style={{ flex: 1, padding: '15px 12px', border: 'none', background: '#10b981', color: '#04130b', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Betala nu
                </button>
              </div>
            </div>
          )}

          {/* J Â· Delivery confirm */}
          {canConfirm && (
            <div className="gn-fadein" style={{ borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, var(--surface) 100%)', border: '1.5px solid rgba(74,222,128,0.25)' }}>
              <div style={{ padding: '22px 20px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: '2rem', animation: 'gn-pulse 2s ease-in-out infinite' }}>📦</div>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 900, color: '#4ade80', margin: 0 }}>Ditt paket har anlänt!</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>Bekräfta leveransen för att frigöra betalningen.</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', borderTop: '1px solid rgba(74,222,128,0.15)' }}>
                <button onClick={handleConfirm} disabled={confirming} style={{ flex: 2, padding: '15px 12px', border: 'none', background: confirming ? 'rgba(74,222,128,0.15)' : '#4ade80', color: confirming ? '#4ade80' : '#0a0a0a', fontWeight: 800, fontSize: '0.9rem', cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <CheckCircle2 size={16} />{confirming ? 'Bekräftar…' : 'Bekräfta leverans'}
                </button>
                <button onClick={() => setError('Kontakta support via appen. Vi hjälper dig omgående.')} style={{ flex: 1, padding: '15px 10px', border: 'none', borderLeft: '1px solid rgba(74,222,128,0.15)', background: 'transparent', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <AlertCircle size={13} /> Problem
                </button>
              </div>
            </div>
          )}

          {/* Confirmed */}
          {pkg.status === 'confirmed' && (
            <div className="gn-fadein" style={{ borderRadius: 20, padding: '22px 20px', background: 'linear-gradient(135deg, rgba(146,255,99,0.08) 0%, var(--surface) 100%)', border: '1.5px solid rgba(146,255,99,0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎉</div>
              <p style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--gn)', margin: '0 0 4px' }}>Tack! Uppdraget slutfört.</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                Bekräftat {pkg.delivery_confirmed_at ? fmtTs(pkg.delivery_confirmed_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.6 }}>
                {reviewed
                  ? 'Din recension är skickad. Gonow avslutar nu paketresan och utbetalningen frigörs till transporten.'
                  : 'Paketresan är klar. Om du vill kan du lämna ett omdöme om transportupplevelsen nedan.'}
              </p>
            </div>
          )}

          {/* K Â· Review */}
          {pkg.status === 'confirmed' && !reviewed && driver && isSender && (
            <InlineReview packageId={id} driver={driver} onDone={() => setReviewed(true)} />
          )}

          {showQR && (
            <div className="gn-fadein" style={{ borderRadius: 20, background: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, var(--surface) 100%)', border: '1px solid rgba(96,165,250,0.2)', padding: '20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: '1.1rem' }}>📱</div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Upphämtnings-QR</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '2px 0 0' }}>Visa vid upphämtning</p>
                </div>
              </div>
              <PackageQRCode pkgId={pkg.id} />
            </div>
          )}

          {/* H Â· Package info — receipt style */}
          <div className="metal-receipt" style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>

            {/* Receipt header */}
            <div className="metal-receipt-head" style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="metal-package-mark" style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>📦</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>Paketinformation</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{gpId(pkg.id)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--muted)' }}>Rutt</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{pkg.from_city} → {pkg.to_city}</p>
              </div>
            </div>

            {/* Dashed divider — receipt style */}
            <div style={{ padding: '0 18px' }}>
              <div className="metal-separator" />
            </div>

            <div className="metal-content">
              <p className="metal-section-label">Sändning</p>
              <div className="metal-facts">
                <div className="wide"><span>Innehåll</span><strong>{pkg.description ?? 'Paket'}</strong></div>
                <div><span>Vikt</span><strong>{pkg.weight_kg ? `${pkg.weight_kg} kg` : '—'}</strong></div>
                <div><span>Maxpris</span><strong>{pkg.price_ceiling ? `${pkg.price_ceiling} kr` : '—'}</strong></div>
                <div><span>Leverans</span><strong>{fmtDeadline(pkg.deadline) ?? 'Flexibel'}</strong></div>
                {pkg.is_fragile && <div><span>Hantering</span><strong>Varsamt</strong></div>}
                {eta && <div><span>Beräknad avgång</span><strong>{eta}</strong></div>}
              </div>

              <p className="metal-section-label">Parter och adresser</p>
              <div className="metal-parties">
                <div className="metal-party">
                  <span>FRÅN · AVSÄNDARE</span>
                  <strong>{sender?.name ?? 'Kontaktuppgift saknas'}</strong>
                  <small>{pkg.from_address ?? pkg.from_city}</small>
                </div>
                <div className="metal-party">
                  <span>TILL · MOTTAGARE</span>
                  <strong>{recipient?.name ?? 'Kontaktuppgift saknas'}</strong>
                  <small>{pkg.to_address ?? pkg.to_city}</small>
                  {recipient?.phone && <em>{recipient.phone}</em>}
                </div>
              </div>

              <div className="metal-booked">
                <span>Bokad</span>
                <strong>{fmtTs(pkg.created_at) ?? '—'}</strong>
              </div>

              <p className="metal-section-label">Trygghet och betalning</p>
              {[
                ['Betalning', getPaymentHoldText(pkg.status, linkedOrderStatus)],
                ['Leveransbekräftelse', getConfirmationText(pkg.status, pkg.delivery_confirmed_at)],
                ['Till transportören', getPayoutText(pkg.status)],
              ].map(([lbl, val]) => (
                <div className="metal-policy" key={lbl}>
                  <span>{lbl}</span><strong>{val}</strong>
                </div>
              ))}
            </div>

            {/* Receipt footer */}
            <div className="metal-receipt-foot" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>GONOW LOGISTICS</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{fmtTs(pkg.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <style jsx>{`
              .metal-receipt{position:relative;background:linear-gradient(135deg,#f8fafb 0%,#d9dee3 42%,#f4f6f7 68%,#cbd1d6 100%);border:1px solid #b9c0c7;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),inset 0 -1px 0 rgba(68,76,84,.12),0 14px 34px rgba(31,41,55,.12)}
              .metal-receipt:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.22;background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0,rgba(255,255,255,.2) 1px,rgba(25,35,45,.035) 1px,rgba(25,35,45,.035) 2px)}
              .metal-receipt>*{position:relative}
              .metal-receipt-head{background:linear-gradient(180deg,rgba(255,255,255,.58),rgba(255,255,255,.12));border-bottom:1px solid rgba(65,75,85,.18)}
              .metal-package-mark{background:linear-gradient(145deg,#fff,#c8cfd5);border:1px solid #aeb7bf;box-shadow:inset 1px 1px 0 #fff,0 3px 8px rgba(31,41,55,.14)}
              .metal-separator{border-top:1px solid rgba(63,72,81,.22);border-bottom:1px solid rgba(255,255,255,.55)}
              .metal-content{padding:14px 18px 16px}
              .metal-section-label{margin:0 0 7px;font-size:.58rem;font-weight:850;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
              .metal-section-label:not(:first-child){margin-top:15px}
              .metal-facts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}
              .metal-facts>div{min-width:0;padding:9px 10px;border:1px solid rgba(62,72,81,.16);border-radius:9px;background:rgba(255,255,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
              .metal-facts .wide{grid-column:1/-1}
              .metal-facts span,.metal-party span,.metal-booked span,.metal-policy span{display:block;font-size:.61rem;color:var(--muted);letter-spacing:.04em}
              .metal-facts strong{display:block;margin-top:3px;color:var(--text);font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
              .metal-parties{display:grid;grid-template-columns:1fr 1fr;gap:8px}
              .metal-party{min-width:0;padding:11px;border-radius:10px;border:1px solid rgba(62,72,81,.18);background:linear-gradient(145deg,rgba(255,255,255,.38),rgba(255,255,255,.12))}
              .metal-party strong,.metal-party small,.metal-party em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
              .metal-party strong{margin-top:5px;color:var(--text);font-size:.78rem}
              .metal-party small{margin-top:3px;color:var(--muted);font-size:.67rem}
              .metal-party em{margin-top:5px;color:var(--text);font-size:.67rem;font-style:normal;font-family:monospace}
              .metal-booked{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:7px 2px;border-bottom:1px solid rgba(67,76,85,.13)}
              .metal-booked strong{font-size:.68rem;color:var(--text)}
              .metal-policy{display:grid;grid-template-columns:112px 1fr;gap:12px;padding:9px 0;border-bottom:1px solid rgba(67,76,85,.13)}
              .metal-policy:last-child{border-bottom:0;padding-bottom:0}
              .metal-policy strong{font-size:.69rem;line-height:1.45;color:var(--text);font-weight:620;text-align:left}
              .metal-receipt-foot{background:rgba(72,82,91,.08);border-top:1px solid rgba(67,76,85,.18)}
              :global(.dark) .metal-receipt{background:linear-gradient(135deg,#30353a 0%,#171b1f 42%,#292e33 70%,#111519 100%);border-color:#4a5158;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 18px 42px rgba(0,0,0,.38)}
              :global(.dark) .metal-receipt:before{opacity:.14}
              :global(.dark) .metal-receipt-head{background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.015));border-bottom-color:rgba(255,255,255,.1)}
              :global(.dark) .metal-package-mark{background:linear-gradient(145deg,#4b5259,#20252a);border-color:#606870;box-shadow:inset 1px 1px 0 rgba(255,255,255,.16),0 4px 10px rgba(0,0,0,.35)}
              :global(.dark) .metal-separator{border-top-color:rgba(255,255,255,.11);border-bottom-color:rgba(0,0,0,.45)}
              :global(.dark) .metal-facts>div,:global(.dark) .metal-party{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
              :global(.dark) .metal-booked,:global(.dark) .metal-policy{border-bottom-color:rgba(255,255,255,.08)}
              :global(.dark) .metal-receipt-foot{background:rgba(0,0,0,.18);border-top-color:rgba(255,255,255,.09)}
              @media(max-width:520px){.metal-facts{grid-template-columns:1fr 1fr}.metal-facts>div:last-child{grid-column:1/-1}.metal-parties{grid-template-columns:1fr}.metal-policy{grid-template-columns:1fr;gap:4px}}
            `}</style>
          </div>

          {/* Cancel */}
          {canCancel && (
            <button onClick={handleCancel} disabled={cancelling} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: cancelling ? 0.6 : 1 }}>
              {cancelling ? 'Avbokar…' : 'Avboka paket'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
