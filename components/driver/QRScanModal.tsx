'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Hash, X } from 'lucide-react'

interface Props {
  expectedPackageId: string
  title: string
  onSuccess: () => void
  onClose: () => void
}

type Tab = 'camera' | 'manual'

const GP_ID = (pkgId: string) => pkgId.replace(/-/g, '').slice(0, 8).toUpperCase()
const QR_PREFIX = 'gonow-pkg:'

export default function QRScanModal({ expectedPackageId, title, onSuccess, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('camera')
  const [manualInput, setManualInput] = useState('')
  const [manualError, setManualError] = useState('')
  const [scanStatus, setScanStatus] = useState<'scanning' | 'found' | 'error' | 'no-camera'>('scanning')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const expectedGpId = GP_ID(expectedPackageId)

  // ── Camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scan()
      }
    } catch {
      setScanStatus('no-camera')
      setTab('manual')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const scan = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    import('jsqr').then(({ default: jsQR }) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        const raw = code.data.trim()
        const pkgId = raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw
        if (pkgId === expectedPackageId || GP_ID(pkgId) === expectedGpId) {
          setScanStatus('found')
          stopCamera()
          setTimeout(onSuccess, 600)
          return
        }
        setScanStatus('error')
        setTimeout(() => {
          setScanStatus('scanning')
          rafRef.current = requestAnimationFrame(scan)
        }, 1200)
        return
      }
      rafRef.current = requestAnimationFrame(scan)
    })
  }, [expectedPackageId, expectedGpId, stopCamera, onSuccess])

  useEffect(() => {
    if (tab === 'camera') startCamera()
    else stopCamera()
    return stopCamera
  }, [tab, startCamera, stopCamera])

  // ── Manual input ─────────────────────────────────────────────────────
  function handleManualSubmit() {
    const input = manualInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (input === expectedGpId || input === expectedPackageId.replace(/-/g, '').toUpperCase()) {
      onSuccess()
    } else {
      setManualError(`Fel GP-ID. Förväntade: ${expectedGpId}`)
    }
  }

  const overlayBorderColor =
    scanStatus === 'found' ? '#4ade80' :
    scanStatus === 'error' ? '#ef4444' :
    'rgba(255,255,255,0.5)'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, width: '100%', maxWidth: 420, overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--gn)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>
              Verifiera paket
            </p>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', margin: '16px 20px 0', gap: 6 }}>
          {(['camera', 'manual'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px', borderRadius: 10,
                border: 'none',
                background: tab === t ? 'var(--gn)' : 'var(--surface-2)',
                color: tab === t ? '#0a0a0a' : 'var(--muted)',
                fontWeight: tab === t ? 800 : 500, fontSize: '0.8rem',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {t === 'camera' ? <><Camera size={13} /> Skanna QR</> : <><Hash size={13} /> GP-ID</>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {tab === 'camera' && (
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Scanning overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: 180, height: 180, position: 'relative',
                  border: `3px solid ${overlayBorderColor}`,
                  borderRadius: 16,
                  transition: 'border-color 0.3s',
                }}>
                  {/* Corner markers */}
                  {['tl', 'tr', 'bl', 'br'].map(corner => (
                    <div key={corner} style={{
                      position: 'absolute', width: 20, height: 20,
                      borderColor: scanStatus === 'found' ? '#4ade80' : 'var(--gn)',
                      borderStyle: 'solid',
                      ...(corner === 'tl' ? { top: -2, left: -2, borderWidth: '3px 0 0 3px', borderTopLeftRadius: 6 } :
                          corner === 'tr' ? { top: -2, right: -2, borderWidth: '3px 3px 0 0', borderTopRightRadius: 6 } :
                          corner === 'bl' ? { bottom: -2, left: -2, borderWidth: '0 0 3px 3px', borderBottomLeftRadius: 6 } :
                                            { bottom: -2, right: -2, borderWidth: '0 3px 3px 0', borderBottomRightRadius: 6 }),
                    }} />
                  ))}

                  {scanStatus === 'found' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(74,222,128,0.15)' }}>
                      <CheckCircle2 size={40} color="#4ade80" />
                    </div>
                  )}
                </div>
              </div>

              {/* Status text */}
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                  background: 'rgba(0,0,0,0.7)',
                  color: scanStatus === 'found' ? '#4ade80' : scanStatus === 'error' ? '#ef4444' : 'rgba(255,255,255,0.8)',
                }}>
                  {scanStatus === 'found' ? '✓ Matchat!' :
                   scanStatus === 'error' ? 'Fel paket — försök igen' :
                   scanStatus === 'no-camera' ? 'Kameran är inte tillgänglig' :
                   'Rikta kameran mot QR-koden'}
                </span>
              </div>
            </div>
          )}

          {tab === 'manual' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Ange GP-ID — de 8 första tecknen på paketets ID.<br />
                Avsändaren ser det på spårningssidan.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={manualInput}
                  onChange={e => { setManualInput(e.target.value.toUpperCase()); setManualError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                  placeholder={`ex: ${expectedGpId}`}
                  maxLength={12}
                  style={{
                    flex: 1, padding: '11px 14px', borderRadius: 10,
                    border: `1px solid ${manualError ? '#ef4444' : 'var(--border)'}`,
                    background: 'var(--surface-2)', color: 'var(--text)',
                    fontSize: '1rem', fontFamily: 'monospace', fontWeight: 700,
                    letterSpacing: '0.1em', outline: 'none',
                  }}
                />
                <button
                  onClick={handleManualSubmit}
                  style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: 'var(--gn)', color: '#0a0a0a', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  OK
                </button>
              </div>
              {manualError && <p style={{ fontSize: '0.77rem', color: '#ef4444', margin: '8px 0 0' }}>{manualError}</p>}
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
                  Förväntat GP-ID: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.06em' }}>{expectedGpId}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
