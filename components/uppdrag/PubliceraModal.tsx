'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, Info, Loader2, MapPin, Package, Scale } from 'lucide-react'
import { UppdragPackage } from './PackageCard'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'

interface PubliceraModalProps {
  onClose: () => void
  onSuccess: (pkg: UppdragPackage) => void
  defaultFrom?: string
  defaultTo?: string
  forecastDepartureId?: string
}

interface PricingResult {
  distanceKm: number
  recommendedPrice: number
  maxPrice: number
  carrierPayout: number
  split: { gonowCommission: number; insurancePool: number }
}

const WEIGHT_OPTIONS = [
  { label: '< 1 kg', value: 0.5 },
  { label: '1–3 kg', value: 2 },
  { label: '3–5 kg', value: 4 },
  { label: '5–10 kg', value: 7 },
  { label: '10+ kg', value: 12 },
]

const DEADLINE_OPTIONS = [
  { value: 'today' as const,    label: 'Idag',     emoji: '⚡' },
  { value: 'tomorrow' as const, label: 'Imorgon',  emoji: '📅' },
  { value: 'flexible' as const, label: 'Flexibelt',emoji: '🕐' },
]

type StepKey = 'route' | 'details' | 'pickup' | 'confirm'

const STEP_META: Record<StepKey, { emoji: string; title: string; sub: string }> = {
  route:   { emoji: '🗺️', title: 'Vart ska paketet?',     sub: 'Ange startstad och destination' },
  details: { emoji: '📦', title: 'Berätta om paketet',    sub: 'Typ, vikt och eventuell ömtålighet' },
  pickup:  { emoji: '📍', title: 'Upphämtning & deadline', sub: 'Adress och när paketet behöver vara framme' },
  confirm: { emoji: '✅', title: 'Ser bra ut!',            sub: 'Granska och publicera paketet' },
}

const STEPS: StepKey[] = ['route', 'details', 'pickup', 'confirm']

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px 12px 38px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
  color: '#ffffff', fontSize: '16px', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

const fieldStyleNoIcon: React.CSSProperties = {
  ...fieldStyle, paddingLeft: 14,
}

function InputField({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
      <input {...props} style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = 'var(--gn)')}
        onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')} />
    </div>
  )
}

export default function PubliceraModal({ onClose, onSuccess, defaultFrom = '', defaultTo = '', forecastDepartureId }: PubliceraModalProps) {
  const { userId } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  const [from, setFrom]           = useState(defaultFrom)
  const [to, setTo]               = useState(defaultTo)
  const [description, setDescription] = useState('')
  const [weightKg, setWeightKg]   = useState(4)
  const [pickup, setPickup]       = useState('')
  const [deadline, setDeadline]   = useState<'today' | 'tomorrow' | 'flexible'>('flexible')
  const [isFragile, setIsFragile] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  const [pricing, setPricing]           = useState<PricingResult | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  const [stepIdx, setStepIdx] = useState(0)
  const currentStep = STEPS[stepIdx]
  const meta = STEP_META[currentStep]

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchPricing = useCallback(async (f: string, t: string, kg: number, urg: string, frag: boolean) => {
    if (!f.trim() || !t.trim() || f.length < 2 || t.length < 2) return
    setPricingLoading(true); setPricingError(null)
    try {
      const res = await fetch(`/api/price-ceiling?type=package&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&kg=${kg}&urgency=${urg}&fragile=${frag}`)
      const json = await res.json()
      if (!res.ok) { setPricingError(json.error ?? 'Priset kunde inte beräknas'); return }
      setPricing(json as PricingResult)
    } catch { setPricingError('Nätverksfel') }
    finally { setPricingLoading(false) }
  }, [])

  // Fetch pricing when we reach confirm step
  useEffect(() => {
    if (currentStep === 'confirm' && from && to) {
      const urgency = deadline === 'today' ? 'today' : 'standard'
      fetchPricing(from, to, weightKg, urgency, isFragile)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  function canProceed(): boolean {
    switch (currentStep) {
      case 'route':   return from.trim().length >= 2 && to.trim().length >= 2
      case 'details': return description.trim().length >= 2
      case 'pickup':  return pickup.trim().length >= 3
      case 'confirm': return true
    }
  }

  async function handleNext() {
    if (currentStep === 'confirm') {
      if (!userId) { setShowAuth(true); return }
      await handleSubmit()
      return
    }
    if (canProceed()) setStepIdx(i => i + 1)
  }

  function handleBack() {
    if (stepIdx > 0) setStepIdx(i => i - 1)
  }

  async function handleSubmit() {
    setSubmitting(true)
    const priceCeiling = pricing?.maxPrice ?? 0
    const tags: string[] = []
    if (deadline === 'today') tags.push('Idag')
    if (deadline === 'tomorrow') tags.push('Imorgon')
    if (deadline === 'flexible') tags.push('Flexibel tid')
    if (isFragile) tags.push('Ömtåligt')

    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_city: from, to_city: to, description,
          weight_kg: weightKg, from_address: pickup,
          deadline, price_ceiling: priceCeiling, is_fragile: isFragile,
          ...(forecastDepartureId ? { forecast_departure_id: forecastDepartureId } : {}),
        }),
      })
      const json = await res.json()
      onSuccess({
        id: json.package?.id ?? `local-${Date.now()}`,
        route: `${from} → ${to}`, from, to,
        payout: priceCeiling, type: description,
        weight: `${weightKg} kg`, pickup, tags, deadline,
      })
    } catch {
      onSuccess({
        id: `local-${Date.now()}`, route: `${from} → ${to}`, from, to,
        payout: priceCeiling, type: description,
        weight: `${weightKg} kg`, pickup, tags, deadline,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--gn)' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'var(--gn-015)' : 'rgba(255,255,255,0.06)',
    color: active ? 'var(--gn)' : 'rgba(255,255,255,0.65)',
    fontSize: '0.88rem', fontWeight: 700, fontFamily: 'inherit',
    transition: 'all 0.15s',
  })

  return (
    <>
      {showAuth && (
        <AuthModal
          reason="Logga in för att publicera ett paket"
          defaultTab="login"
          onClose={() => setShowAuth(false)}
          onSuccess={() => { setShowAuth(false); handleSubmit() }}
        />
      )}

      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 10 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(10,10,10,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: isMobile ? 20 : 24, width: '100%', maxWidth: 480, boxShadow: '0 32px 72px rgba(0,0,0,0.65)', display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '96vh' : '92vh', overflow: 'hidden' }}>

          {/* Sticky header */}
          <div style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>Skicka via Gonow</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Publicera paket</p>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px 24px' : '24px 22px 28px' }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ width: i === stepIdx ? 20 : 6, height: 6, borderRadius: 99, background: i === stepIdx ? 'var(--gn)' : i < stepIdx ? 'var(--gn-040)' : 'rgba(255,255,255,0.15)', transition: 'all 0.25s' }} />
              ))}
            </div>

            {/* Step header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>{meta.emoji}</div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{meta.title}</h2>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>{meta.sub}</p>
            </div>

            {/* ── Step: Route ─────────────────────────────────── */}
            {currentStep === 'route' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Från</label>
                  <InputField icon={MapPin} value={from} onChange={e => setFrom(e.target.value)} placeholder="Stockholm" autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Till</label>
                  <InputField icon={MapPin} value={to} onChange={e => setTo(e.target.value)} placeholder="Göteborg" />
                </div>
              </div>
            )}

            {/* ── Step: Details ───────────────────────────────── */}
            {currentStep === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Vad skickas?</label>
                  <InputField icon={Package} value={description} onChange={e => setDescription(e.target.value)} placeholder="Kläder, elektronik, böcker…" autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Vikt</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {WEIGHT_OPTIONS.map(w => (
                      <button key={w.label} type="button" onClick={() => setWeightKg(w.value)} style={{ ...chipBtn(weightKg === w.value), display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Scale size={13} style={{ opacity: 0.7 }} /> {w.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${isFragile ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.1)'}`, background: isFragile ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => setIsFragile(v => !v)}>
                  <div style={{ width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', background: isFragile ? '#9333ea' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 2, left: isFragile ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: isFragile ? '#c084fc' : 'rgba(255,255,255,0.7)', margin: 0 }}>Ömtåligt innehåll</p>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>+25 kr för extra försiktighet</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: Pickup ────────────────────────────────── */}
            {currentStep === 'pickup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Upphämtningsadress</label>
                  <InputField icon={MapPin} value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Vasagatan 11, Stockholm" autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Senast leverans</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {DEADLINE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setDeadline(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `1.5px solid ${deadline === opt.value ? 'var(--gn)' : 'rgba(255,255,255,0.1)'}`, background: deadline === opt.value ? 'var(--gn-012)' : 'rgba(255,255,255,0.05)', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: deadline === opt.value ? 'var(--gn)' : '#fff' }}>{opt.label}</span>
                        {deadline === opt.value && <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: 'var(--gn)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem', color: '#0a0a0a', fontWeight: 900 }}>✓</div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step: Confirm ───────────────────────────────── */}
            {currentStep === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Från',         value: from },
                  { label: 'Till',         value: to },
                  { label: 'Paket',        value: description },
                  { label: 'Vikt',         value: `${weightKg} kg` },
                  { label: 'Upphämtning', value: pickup },
                  { label: 'Deadline',    value: DEADLINE_OPTIONS.find(d => d.value === deadline)?.label ?? deadline },
                  ...(isFragile ? [{ label: 'Ömtåligt', value: 'Ja (+25 kr)' }] : []),
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}

                {/* Pricing box */}
                <div style={{ marginTop: 8 }}>
                  {pricingLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Loader2 size={14} style={{ color: 'var(--gn)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>Beräknar pris...</span>
                    </div>
                  )}
                  {!pricingLoading && pricingError && (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,100,100,0.9)', margin: 0 }}>{pricingError}</p>
                    </div>
                  )}
                  {!pricingLoading && pricing && (
                    <div style={{ borderRadius: 14, padding: '16px', border: '1.5px solid var(--gn-025)', background: 'linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 100%)' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gn)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Gonow prisuppskattning</p>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                          <p style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--gn)', margin: '0 0 2px', lineHeight: 1 }}>{pricing.recommendedPrice} kr</p>
                          <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rekommenderat</p>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                          <p style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: '0 0 2px', lineHeight: 1 }}>{pricing.maxPrice} kr</p>
                          <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maxpris (tak)</p>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {[
                          ['Föraren får ca', `${pricing.carrierPayout} kr`],
                          ['Gonow avgift (15%)', `${pricing.split.gonowCommission} kr`],
                          ['Försäkringspool (5%)', `${pricing.split.insurancePool} kr`],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '3px 0' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!pricingLoading && !pricing && !pricingError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Info size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Priset beräknas automatiskt av Gonow baserat på rutt och vikt.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div style={{ padding: isMobile ? '12px 16px 20px' : '14px 22px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, flexShrink: 0 }}>
            {stepIdx > 0 && (
              <button type="button" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
                <ChevronLeft size={15} /> Tillbaka
              </button>
            )}
            <button type="button" onClick={handleNext} disabled={!canProceed() || submitting} style={{
              flex: 1, padding: '13px', borderRadius: 10, border: 'none',
              background: canProceed() && !submitting ? 'var(--gn)' : 'rgba(74,222,128,0.2)',
              color: canProceed() && !submitting ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
              fontSize: '0.92rem', fontWeight: 800, cursor: canProceed() && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {submitting ? 'Publicerar...' : currentStep === 'confirm' ? 'Publicera paket →' : 'Nästa →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
