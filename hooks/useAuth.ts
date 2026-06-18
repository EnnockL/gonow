'use client'

import { useState, useEffect } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import type { User } from '@/lib/types'

export interface AuthState {
  userId: string | null
  profile: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [userId, setUserId]   = useState<string | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let unsubscribed = false
    let subscription: { unsubscribe: () => void } | null = null

    function buildFallbackProfile(session: Session): User {
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: (session.user.user_metadata?.name as string | undefined) || session.user.email?.split('@')[0] || 'Anvandare',
        phone: (session.user.user_metadata?.phone as string | undefined) || undefined,
        bankid_verified: false,
        role: 'user',
        rating_avg: 0,
        rating_count: 0,
        created_at: session.user.created_at || new Date().toISOString(),
      }
    }

    async function fetchProfile(uid: string) {
      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle()
      return (data as User | null) ?? null
    }

    async function ensureProfile(session: Session) {
      await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Anvandare',
          phone: session.user.user_metadata?.phone || null,
        }),
      }).catch(() => {})
    }

    async function bootstrapStoredSession() {
      if (typeof window === 'undefined') return null

      try {
        const raw = window.localStorage.getItem('gonow-auth')
        if (!raw) return null

        const stored = JSON.parse(raw) as {
          access_token?: string
          refresh_token?: string
        }

        if (!stored.access_token || !stored.refresh_token) return null

        const result = await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        })

        return result.data.session ?? null
      } catch {
        return null
      }
    }

    async function syncFromSession(session: Session | null) {
      const uid = session?.user?.id ?? null
      setUserId(uid)

      if (!uid || !session) {
        setProfile(null)
        setLoading(false)
        return
      }

      let nextProfile = await fetchProfile(uid)

      if (!nextProfile) {
        await ensureProfile(session)
        nextProfile = await fetchProfile(uid)
      }

      setProfile(nextProfile ?? buildFallbackProfile(session))
      setLoading(false)
    }

    async function init() {
      const { data: { session } }: { data: { session: Session | null } } = await supabase.auth.getSession()
      const activeSession = session ?? await bootstrapStoredSession()
      if (unsubscribed) return
      await syncFromSession(activeSession)
      if (unsubscribed) return

      const authListener = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, nextSession: Session | null) => {
        if (event === 'INITIAL_SESSION' && !nextSession) return
        await syncFromSession(nextSession)
      })

      subscription = authListener.data.subscription
    }

    void init()

    return () => {
      unsubscribed = true
      subscription?.unsubscribe()
    }
  }, [])

  return { userId, profile, loading }
}
