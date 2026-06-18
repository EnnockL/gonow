'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { saveBooking } from '@/lib/bookings'
import {
  clearPendingBookingDraft,
  clearSignupEmail,
  loadPendingBookingDraft,
  loadSignupEmail,
} from '@/lib/pending-booking'

type SessionUser = {
  id: string
  email?: string | null
  user_metadata?: {
    name?: string
    phone?: string
  }
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const supabase = createClient()
    const next = params.get('next') || '/profil'

    let active = true
    let handled = false

    async function ensureProfile(user: SessionUser) {
      const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).single()
      if (existing) return

      await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Anvandare',
          phone: user.user_metadata?.phone || null,
        }),
      }).catch(() => {})
    }

    async function finalizeSignedIn(user: SessionUser) {
      if (!active || handled) return
      handled = true

      await ensureProfile(user)

      const draft = loadPendingBookingDraft()
      if (draft) {
        try {
          await saveBooking({
            ...draft,
            sender_id: user.id,
            sender_email: draft.sender_email || user.email || '',
          })
          clearPendingBookingDraft()
        } catch {
          handled = false
          setError('Din inloggning lyckades, men bokningen kunde inte skickas automatiskt.')
          return
        }
      }

      clearSignupEmail()
      router.replace(next)
    }

    if (hash.includes('error=')) {
      const hp = new URLSearchParams(hash.slice(1))
      const code = hp.get('error_code')
      setError(code === 'otp_expired' || code === 'access_denied' ? 'expired' : hp.get('error_description') || 'Nagot gick fel')
      return
    }

    if (hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(hash.slice(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          subscription.unsubscribe()
          void finalizeSignedIn(session.user as SessionUser)
        }
      })

      if (accessToken && refreshToken) {
        void supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then((result: { data: { session: Session | null }; error: Error | null }) => {
          const { data, error } = result
          if (error) {
            setError(error.message)
            return
          }

          if (data.session?.user) {
            void finalizeSignedIn(data.session.user as SessionUser)
            return
          }

          supabase.auth.getUser().then(({ data: { user } }: { data: { user: Session['user'] | null } }) => {
            if (user) {
              void finalizeSignedIn(user as SessionUser)
            }
          })
        })
      } else {
        supabase.auth.getUser().then(({ data: { user } }: { data: { user: Session['user'] | null } }) => {
          if (user) {
            void finalizeSignedIn(user as SessionUser)
          }
        })
      }

      return () => {
        active = false
        subscription.unsubscribe()
      }
    }

    const code = params.get('code')
    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then((result: { error: Error | null }) => {
        const err = result.error
        if (err) {
          setError(err.message)
          return
        }

        supabase.auth.getUser().then(({ data: { user } }: { data: { user: Session['user'] | null } }) => {
          if (user) {
            void finalizeSignedIn(user as SessionUser)
          }
        })
      })
      return () => {
        active = false
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        subscription.unsubscribe()
        void finalizeSignedIn(session.user as SessionUser)
      }
    })

    supabase.auth.getUser().then(({ data: { user } }: { data: { user: Session['user'] | null } }) => {
      if (user) {
        void finalizeSignedIn(user as SessionUser)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  async function resendEmail() {
    const email = loadSignupEmail()
    if (!email) {
      router.push('/')
      return
    }

    const supabase = createClient()
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setResent(true)
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem' }}>⏱</div>
        <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', maxWidth: 360 }}>
          {error === 'expired' ? 'Lanken har gatt ut' : 'Nagot gick fel'}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', maxWidth: 320, lineHeight: 1.7 }}>
          {error === 'expired'
            ? 'Bekraftelselnaken ar for gammal. Begar en ny sa skickar vi en f�rsk lank.'
            : error}
        </p>
        {resent ? (
          <p style={{ color: '#92ff63', fontSize: '0.85rem' }}>Ny lank skickad, kolla inkorgen.</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={resendEmail}
              style={{ padding: '11px 20px', borderRadius: 10, background: '#92ff63', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Skicka ny lank
            </button>
            <a href="/" style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
              Tillbaka
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #92ff63', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Loggar in och aterupptar din bokning...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
