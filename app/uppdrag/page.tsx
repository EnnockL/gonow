'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Sparkles, ChevronRight, Package as PkgIcon } from 'lucide-react'
import PackageCard, { UppdragPackage } from '@/components/uppdrag/PackageCard'
import ErbjudModal from '@/components/uppdrag/ErbjudModal'
import PubliceraModal from '@/components/uppdrag/PubliceraModal'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import { PackageCardSkeleton } from '@/components/ui/Skeleton'

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
  }
}

const MOCK_PACKAGES: UppdragPackage[] = [
  { id: '1', route: 'Stockholm → Göteborg', from: 'Stockholm', to: 'Göteborg', payout: 280, type: 'Kläder', weight: '3 kg', pickup: 'Vasastan', tags: ['Idag', 'Ömtåligt'], deadline: 'today' },
  { id: '2', route: 'Malmö → Stockholm', from: 'Malmö', to: 'Stockholm', payout: 340, type: 'Elektronik', weight: '5 kg', pickup: 'Hyllie', tags: ['Försäkrad', 'Imorgon'], deadline: 'tomorrow' },
  { id: '3', route: 'Göteborg → Uppsala', from: 'Göteborg', to: 'Uppsala', payout: 190, type: 'Böcker', weight: '2 kg', pickup: 'Hisingen', tags: ['Flexibel tid'], deadline: 'flexible' },
  { id: '4', route: 'Stockholm → Umeå', from: 'Stockholm', to: 'Umeå', payout: 520, type: 'Möbeldelar', weight: '12 kg', pickup: 'Nacka', tags: ['Stort'], deadline: 'flexible' },
  { id: '5', route: 'Sundsvall → Stockholm', from: 'Sundsvall', to: 'Stockholm', payout: 210, type: 'Matvaror', weight: '4 kg', pickup: 'Centrum', tags: ['Idag', 'Kyl', 'Bråttom'], deadline: 'today' },
]

const FILTERS = ['Alla', 'Idag', 'Min rutt', 'Stockholm', 'Göteborg', 'Express', 'Bråttom', 'Försäkrad', 'Kyl', 'Stort'] as const
type Filter = typeof FILTERS[number]

function sortPackages(pkgs: UppdragPackage[]) {
  return [...pkgs].sort((a, b) => {
    const urgencyScore = (p: UppdragPackage) => (p.deadline === 'today' ? 2 : p.deadline === 'tomorrow' ? 1 : 0)
    return urgencyScore(b) - urgencyScore(a)
  })
}

export default function UppdragPage() {
  const { userId } = useAuth()
  const [packages, setPackages] = useState<UppdragPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('Alla')
  const [erbjudPkg, setErbjudPkg] = useState<UppdragPackage | null>(null)
  const [showPublicera, setShowPublicera] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [recommendedIds, setRecommendedIds] = useState<string[]>([])
  const [aiExpanded, setAiExpanded] = useState(false)

  function handlePubliceraClick() {
    if (!userId) {
      setShowAuth(true)
    } else {
      setShowPublicera(true)
    }
  }
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
        if (json.packages && json.packages.length > 0) {
          setPackages(json.packages.map(dbToPackage))
        } else {
          // Fall back to mock data if no packages in DB yet
          setPackages(MOCK_PACKAGES)
        }
      } catch {
        setPackages(MOCK_PACKAGES)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // Filter logic
  const filtered = useMemo(() => {
    let result = packages
    switch (filter) {
      case 'Idag':       result = result.filter(p => p.deadline === 'today'); break
      case 'Min rutt':   result = result.filter(p => p.from.includes('Stockholm') || p.to.includes('Stockholm')); break
      case 'Stockholm':  result = result.filter(p => p.from.includes('Stockholm') || p.to.includes('Stockholm')); break
      case 'Göteborg':   result = result.filter(p => p.from.includes('Göteborg') || p.to.includes('Göteborg')); break
      case 'Express':    result = result.filter(p => p.tags.includes('Express')); break
      case 'Bråttom':    result = result.filter(p => p.tags.includes('Bråttom')); break
      case 'Försäkrad':  result = result.filter(p => p.tags.includes('Försäkrad')); break
      case 'Kyl':        result = result.filter(p => p.tags.includes('Kyl')); break
      case 'Stort':      result = result.filter(p => p.tags.includes('Stort')); break
    }
    return sortPackages(result)
  }, [packages, filter])

  // AI recommendation: pick top 3 by payout
  const aiRecommended = useMemo(() => {
    return [...packages].sort((a, b) => b.payout - a.payout).slice(0, 3)
  }, [packages])

  const aiTotal = aiRecommended.reduce((sum, p) => sum + p.payout, 0)

  function handleShowBestKombination() {
    setRecommendedIds(aiRecommended.map(p => p.id))
    setAiExpanded(true)
    setFilter('Alla')
  }

  function handleErbjudClick(pkg: UppdragPackage) {
    if (!userId) {
      setShowAuth(true)
    } else {
      setErbjudPkg(pkg)
    }
  }

  function handleErbjudSuccess() {
    setErbjudPkg(null)
    showToast('Erbjudande skickat.')
  }

  function handlePubliceraSuccess(pkg: UppdragPackage) {
    setPackages(prev => [pkg, ...prev])
    setShowPublicera(false)
    showToast('Paketet är publicerat!')
    setRecommendedIds([])
    setAiExpanded(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20000, background: '#0a0a0a', color: '#fff',
          padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
          animation: 'toast-in 0.2s ease both',
        }}>
          <span style={{ color: '#22c55e' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Paket att köra
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 6, marginBottom: 0, lineHeight: 1.6 }}>
              Avsändare publicerar paket — förare hittar dem och erbjuder körning.
            </p>
          </div>
          <button
            onClick={handlePubliceraClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: 'var(--accent)', color: '#0a0a0a',
              border: 'none', borderRadius: 999,
              padding: isMobile ? '9px 14px' : '10px 20px',
              fontSize: isMobile ? '0.78rem' : '0.85rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} /> Publicera paket
          </button>
        </div>

        {/* Filter chips */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
          scrollbarWidth: 'none', marginBottom: 20,
        }}>
          <style>{`.uppdrag-chips::-webkit-scrollbar { display: none; }`}</style>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); if (f !== 'Alla') setRecommendedIds([]) }}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 999,
                border: '1px solid',
                fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: filter === f ? 'var(--accent)' : 'var(--surface)',
                color: filter === f ? '#0a0a0a' : 'var(--muted)',
                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* AI-komponera sektion */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.04) 100%)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 14, padding: '14px 18px',
          marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {aiExpanded
                  ? `Totalt: +${aiTotal} kr för ${aiRecommended.length} paket`
                  : `💰 Du kan tjäna +${aiTotal} kr genom att ta ${aiRecommended.length} paket längs din rutt.`}
              </p>
              {aiExpanded && (
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Paket markerade med grön ram nedan
                </p>
              )}
            </div>
          </div>
          <button
            onClick={aiExpanded ? () => { setRecommendedIds([]); setAiExpanded(false) } : handleShowBestKombination}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: aiExpanded ? 'var(--surface-2)' : 'rgba(34,197,94,0.15)',
              color: aiExpanded ? 'var(--muted)' : '#16a34a',
              border: `1px solid ${aiExpanded ? 'var(--border)' : 'rgba(34,197,94,0.35)'}`,
              borderRadius: 999, padding: '7px 14px',
              fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {aiExpanded ? 'Rensa' : 'Visa bästa kombination'} <ChevronRight size={13} />
          </button>
        </div>

        {/* Package grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <PackageCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PkgIcon size={24} style={{ color: 'var(--muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {filter === 'Alla' ? 'Inga paket längs din rutt just nu' : `Inga paket för "${filter}"`}
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>
                {filter === 'Alla'
                  ? 'Var den första att publicera ett paket eller kolla igen senare.'
                  : 'Prova ett annat filter eller visa alla paket.'}
              </p>
            </div>
            {filter !== 'Alla' ? (
              <button onClick={() => setFilter('Alla')} style={{ minHeight: 44, padding: '0 20px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Visa alla paket
              </button>
            ) : (
              <button onClick={handlePubliceraClick} style={{ minHeight: 44, padding: '0 20px', background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> Publicera ett paket
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
            animation: 'fade-in 0.3s ease both',
          }}>
            {filtered.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                recommended={recommendedIds.includes(pkg.id)}
                onErbjud={handleErbjudClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => { setShowAuth(false); setShowPublicera(true) }}
          reason="Logga in för att publicera ett paket"
        />
      )}
      {erbjudPkg && (
        <ErbjudModal
          pkg={erbjudPkg}
          onClose={() => setErbjudPkg(null)}
          onSuccess={handleErbjudSuccess}
        />
      )}
      {showPublicera && (
        <PubliceraModal
          onClose={() => setShowPublicera(false)}
          onSuccess={handlePubliceraSuccess}
        />
      )}
    </div>
  )
}
