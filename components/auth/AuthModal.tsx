'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, Lock, User, Phone, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { getAuthUser, resendSignupOtp, signIn, signUp } from '@/lib/auth'
import { saveSignupEmail } from '@/lib/pending-booking'

interface Props {
  onClose: () => void
  onSuccess?: () => void
  defaultTab?: 'login' | 'signup'
  reason?: string
  redirectTo?: string
  initialEmail?: string
}

type Mode = 'login' | 'signup' | 'verify'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px 10px 36px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.07)',
  color: '#ffffff',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({
  icon: Icon,
  type = 'text',
  rightSlot,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType
  rightSlot?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon
        size={14}
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.35)',
          pointerEvents: 'none',
        }}
      />
      <input
        type={type}
        {...props}
        style={inputStyle}
        onFocus={(e) => (e.target.style.borderColor = '#92ff63')}
        onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
      {rightSlot && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
          {rightSlot}
        </div>
      )}
    </div>
  )
}

function translateAuthError(message: string) {
  if (message.includes('Invalid login')) return 'Fel e-post eller lösenord.'
  if (message.includes('already registered')) return 'E-postadressen används redan.'
  if (message.includes('Password should')) return 'Lösenordet måste vara minst 6 tecken.'
  if (message.toLowerCase().includes('rate limit')) return 'För många försök just nu. Vänta en stund och prova igen.'
  return message
}

export default function AuthModal({
  onClose,
  onSuccess,
  defaultTab = 'login',
  reason,
  redirectTo,
  initialEmail = '',
}: Props) {
  const [mode, setMode] = useState<Mode>(defaultTab)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [checkingLink, setCheckingLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finishSuccess() {
    onSuccess?.()
    onClose()
    window.location.href = redirectTo || '/profil'
  }

  async function checkExistingSession() {
    setCheckingLink(true)
    try {
      const user = await getAuthUser()
      if (user) {
        await finishSuccess()
        return true
      }
      return false
    } finally {
      setCheckingLink(false)
    }
  }

  useEffect(() => {
    if (mode !== 'verify') return

    const interval = window.setInterval(() => {
      void checkExistingSession()
    }, 2500)

    return () => window.clearInterval(interval)
  }, [mode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
        onSuccess?.()
        window.location.href = redirectTo || '/profil'
        return
      }

      if (mode === 'verify') {
        const hasSession = await checkExistingSession()
        if (!hasSession) {
          throw new Error('Ingen bekräftad session hittades ännu. Klicka länken i mailet och prova igen.')
        }
        return
      }

      saveSignupEmail(email)
      await signUp(email, password, name.trim() || email.split('@')[0], phone.trim() || undefined)
      setMode('verify')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ett fel uppstod'
      setError(translateAuthError(message))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email) return
    setError(null)
    setResending(true)

    try {
      await resendSignupOtp(email)
      setResent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kunde inte skicka nytt bekräftelsemail.'
      setError(translateAuthError(message))
    } finally {
      setResending(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Logga in'
      : mode === 'signup'
        ? 'Skapa konto'
        : 'Bekräfta din e-post'

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 20px 20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(10,10,10,0.96)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 24,
          width: '100%',
          maxWidth: 420,
          maxHeight: 'calc(100dvh - 40px)',
          overflowY: 'auto',
          boxShadow: '0 32px 72px rgba(0,0,0,0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            padding: '20px 24px 0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {reason && mode !== 'verify' && (
              <p style={{ fontSize: '0.7rem', color: 'rgba(146,255,99,0.8)', marginBottom: 4, fontWeight: 500 }}>
                {reason}
              </p>
            )}
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>

        {mode !== 'verify' && (
          <div style={{ display: 'flex', gap: 4, padding: '16px 24px 0' }}>
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setMode(tab)
                  setError(null)
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  background: mode === tab ? 'rgba(146,255,99,0.15)' : 'rgba(255,255,255,0.05)',
                  color: mode === tab ? '#92ff63' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s',
                }}
              >
                {tab === 'login' ? 'Logga in' : 'Skapa konto'}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {mode === 'verify' ? (
            <>
              <div style={{ padding: '8px 0 2px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>✉</div>
                <p style={{ color: '#92ff63', fontWeight: 600, fontSize: '0.95rem' }}>Öppna mailet och klicka länken</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: 8, lineHeight: 1.7 }}>
                  Vi skickade ett bekräftelsemail till
                  <br />
                  <strong style={{ color: 'rgba(255,255,255,0.82)' }}>{email}</strong>
                </p>
                <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.76rem', marginTop: 10, lineHeight: 1.6 }}>
                  När du har klickat på länken i mailet kommer vi att känna av sessionen här och fortsätta automatiskt.
                </p>
              </div>

              {resent && (
                <p style={{ fontSize: '0.76rem', color: '#92ff63', textAlign: 'center' }}>
                  Nytt bekräftelsemail skickat.
                </p>
              )}
            </>
          ) : (
            <>
              <Field
                icon={Mail}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-postadress"
                required
                autoFocus
              />

              {mode === 'signup' && (
                <>
                  <Field
                    icon={User}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ditt namn (valfritt)"
                  />
                  <Field
                    icon={Phone}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Telefon (valfritt)"
                  />
                </>
              )}

              <Field
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Lösenord"
                required
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.35)',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
            </>
          )}

          {error && (
            <p
              style={{
                fontSize: '0.78rem',
                color: '#f87171',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              {error}
            </p>
          )}

          {mode === 'verify' ? (
            <>
              <button
                type="submit"
                disabled={loading || checkingLink}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: loading || checkingLink ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: loading || checkingLink ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ExternalLink size={14} />
                {loading || checkingLink ? 'Kontrollerar bekräftelse...' : 'Jag har klickat länken'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                    setResent(false)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Ändra uppgifter
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#92ff63',
                    cursor: resending ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontFamily: 'inherit',
                    padding: 0,
                    opacity: resending ? 0.6 : 1,
                  }}
                >
                  {resending ? 'Skickar...' : 'Skicka nytt mail'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading ? 'rgba(146,255,99,0.5)' : '#92ff63',
                  color: '#0a0a0a',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? 'Loggar in...' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                {mode === 'login' ? (
                  <>
                    Inget konto?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#92ff63',
                        cursor: 'pointer',
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        padding: 0,
                      }}
                    >
                      Skapa ett
                    </button>
                  </>
                ) : (
                  <>
                    Har du redan konto?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#92ff63',
                        cursor: 'pointer',
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        padding: 0,
                      }}
                    >
                      Logga in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body
  )
}
