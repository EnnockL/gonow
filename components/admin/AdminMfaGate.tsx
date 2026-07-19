'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Copy, KeyRound, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Enrollment = {
  factorId: string
  qrCode: string
  secret: string
}

export default function AdminMfaGate({ onVerified }: { onVerified: () => void }) {
  const [loading, setLoading] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    async function inspect() {
      const supabase = createClient()
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!active) return
      if (aal?.currentLevel === 'aal2') {
        onVerified()
        return
      }
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (!active) return
      if (factorsError) setError('Kunde inte kontrollera MFA-status. Försök igen.')
      const verified = data?.totp?.find((factor: { id: string; status: string }) => factor.status === 'verified')
      setFactorId(verified?.id ?? null)
      setLoading(false)
    }
    void inspect()
    return () => { active = false }
  }, [onVerified])

  async function enroll() {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Gonow Admin',
    })
    if (enrollError || !data?.totp) {
      setError('MFA kunde inte aktiveras. Försök igen.')
    } else {
      setFactorId(data.id)
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    }
    setSubmitting(false)
  }

  async function verify() {
    if (!factorId || code.length !== 6) return
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (verifyError) {
      setError('Koden stämmer inte eller har gått ut. Ange den senaste koden.')
      setCode('')
      setSubmitting(false)
      return
    }
    onVerified()
  }

  async function copySecret() {
    if (!enrollment?.secret) return
    await navigator.clipboard.writeText(enrollment.secret)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (loading) {
    return <div className="admin-gate"><span className="admin-loader" /><p>Verifierar säkerhetsnivå…</p></div>
  }

  return (
    <div className="admin-gate admin-mfa-gate">
      <section className="admin-mfa-card">
        <div className="admin-mfa-icon"><ShieldCheck size={28} /></div>
        <span className="admin-mfa-eyebrow">Gonow säkerhetskontroll</span>
        <h1>{factorId ? 'Verifiera din identitet' : 'Skydda adminkontot'}</h1>
        <p>
          {factorId
            ? 'Ange den sexsiffriga koden från din autentiseringsapp för att öppna Operations.'
            : 'Adminåtkomst kräver ett extra säkerhetslager. Aktivera en autentiseringsapp innan du fortsätter.'}
        </p>

        {!factorId && !enrollment && (
          <button className="admin-mfa-primary" onClick={enroll} disabled={submitting}>
            <KeyRound size={16} /> {submitting ? 'Aktiverar…' : 'Aktivera MFA'}
          </button>
        )}

        {enrollment && (
          <div className="admin-mfa-enrollment">
            {/* Supabase returns a local SVG data URI, not an external image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="QR-kod för Gonow Admin MFA" />
            <div>
              <strong>Skanna QR-koden</strong>
              <small>Google Authenticator, Microsoft Authenticator eller liknande.</small>
              <button onClick={copySecret} className="admin-mfa-copy">
                <Copy size={13} /> {copied ? 'Kopierad' : 'Kopiera manuell kod'}
              </button>
            </div>
          </div>
        )}

        {factorId && (
          <form onSubmit={(event) => { event.preventDefault(); void verify() }} className="admin-mfa-form">
            <label htmlFor="admin-mfa-code">Säkerhetskod</label>
            <input
              id="admin-mfa-code"
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
            />
            <button className="admin-mfa-primary" disabled={submitting || code.length !== 6}>
              <CheckCircle2 size={16} /> {submitting ? 'Verifierar…' : 'Verifiera och öppna'}
            </button>
          </form>
        )}

        {error && <div className="admin-mfa-error" role="alert">{error}</div>}
        <Link href="/" className="admin-gate-link"><ArrowLeft size={14} /> Till Gonow</Link>
      </section>
    </div>
  )
}
