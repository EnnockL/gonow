'use client'

import { useState, useRef } from 'react'
import { Camera, CheckCircle2, Loader2, RotateCcw, ArrowRight, AlertCircle, Upload } from 'lucide-react'

type State = 'upload' | 'checking' | 'approved' | 'booked'

const inputStyle = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: '0.875rem',
  color: 'var(--text)',
  transition: 'border-color 0.15s',
  outline: 'none',
  fontFamily: 'inherit',
}

export default function ReturPage() {
  const [state, setState] = useState<State>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState({ store_name: '', from_city: '' })
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function focusIn(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--accent)'
  }
  function focusOut(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border)'
  }

  async function processImage(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      setState('checking')
      await new Promise((r) => setTimeout(r, 1600))
      setState('approved')
    }
    reader.readAsDataURL(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processImage(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) processImage(file)
  }

  if (state === 'booked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 10 }}>
            Retur bokad!
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.6 }}>
            En resenär hämtar paketet och lämnar in det i {form.store_name || 'butiken'}. Spårning aktiveras vid upphämtning.
          </p>
          <a href="/profil" className="btn-primary" style={{ display: 'inline-flex', padding: '12px 24px', gap: 8 }}>
            Följ min retur <ArrowRight size={14} />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ paddingTop: 32, paddingBottom: 48 }}>
          <p className="label" style={{ marginBottom: 10 }}>Returnera paket</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 12, lineHeight: 1.1 }}>
            Foto. AI-kontroll.<br />Klart.
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 420 }}>
            Ta en bild på paketet — vår AI verifierar returskicket automatiskt — en resenär lämnar in det åt dig.
          </p>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 40, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 4 }}>
          {[
            { key: 'upload', label: 'Ladda upp foto' },
            { key: 'checking', label: 'AI-kontroll' },
            { key: 'approved', label: 'Boka bärare' },
          ].map((s, i) => {
            const states: State[] = ['upload', 'checking', 'approved']
            const curIdx = states.indexOf(state)
            const sIdx = i
            const isActive = sIdx === curIdx
            const isDone = sIdx < curIdx
            return (
              <div key={s.key} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, textAlign: 'center', background: isActive ? 'var(--accent-soft)' : 'transparent' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: isActive || isDone ? 600 : 400, color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--muted)' }}>
                  {isDone ? '✓ ' : ''}{s.label}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>

          {/* Main content */}
          <div>
            {state === 'upload' && (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                  height: 240, borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                  background: dragging ? 'var(--accent-softer)' : 'var(--surface)',
                }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                    {dragging ? 'Släpp bilden här' : 'Klicka eller dra och släpp'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>JPG, PNG upp till 10 MB</p>
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ fontSize: '0.8rem', padding: '8px 18px', pointerEvents: 'none' }}
                >
                  <Camera size={13} /> Välj bild
                </button>
              </div>
            )}

            {state === 'checking' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40 }}>
                {preview && (
                  <img src={preview} alt="paket" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={28} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>AI kontrollerar paketets skick...</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.7 }}>Analyserar förpackning, etiketter och skador</p>
                </div>
              </div>
            )}

            {state === 'approved' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {preview && (
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                    <img src={preview} alt="paket" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.46), transparent)' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>Godkänt returskick</span>
                    </div>
                  </div>
                )}

                <div className="card-sm" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    Paketet ser ut att vara i returnerbart skick. Fyll i uppgifterna för att boka en bärare.
                  </p>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); setState('booked') }}
                  className="card"
                  style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Butik att returnera till</label>
                    <input required placeholder="t.ex. H&M, Zara, NetOnNet" value={form.store_name}
                      onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
                      onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Din stad (upphämtning)</label>
                    <input required placeholder="t.ex. Malmö" value={form.from_city}
                      onChange={(e) => setForm((p) => ({ ...p, from_city: e.target.value }))}
                      onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => { setState('upload'); setPreview(null) }}
                      className="btn-outline" style={{ flex: 1, borderRadius: 10, padding: '11px 0', fontSize: '0.8rem' }}>
                      <RotateCcw size={13} /> Ny bild
                    </button>
                    <button type="submit" className="btn-primary"
                      style={{ flex: 2, borderRadius: 10, padding: '11px 0' }}>
                      Boka retur <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            <input ref={fileRef} type="file" style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
          </div>

          {/* Right info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-sm">
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                AI kontrollerar
              </p>
              {[
                'Förpackningsintegritet',
                'Synliga skador',
                'Returetiketter',
                'Artikelmatchning',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item}</span>
                </div>
              ))}
            </div>

            <div className="card-sm" style={{ background: 'var(--accent-softer)', borderColor: 'rgba(146,255,99,0.15)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Inga postkontor</p>
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Slipp stå i kö. En resenär hämtar upp din retur och lämnar in den — du spårar allt live.
              </p>
            </div>

            <div className="card-sm" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)' }}>
              <AlertCircle size={14} style={{ color: 'var(--success)', marginBottom: 6 }} />
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Betalning (0–99 kr) dras först vid bekräftad inlämning. Alltid inbyggd försäkring.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
