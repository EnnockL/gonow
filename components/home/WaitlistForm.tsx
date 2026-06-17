'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'sender' | 'carrier' | 'both'>('sender')
  const [city, setCity] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('waitlist').insert({ email, role, city })
      if (error && error.code !== '23505') throw error
      setState('success')
    } catch {
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]/20 text-2xl">
          ✓
        </div>
        <p className="font-semibold text-[var(--text)]">Du är med på listan!</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Vi meddelar dig när Gonow lanserar i din stad.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        placeholder="din@email.se"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />

      <div className="grid grid-cols-3 gap-2">
        {([['sender', 'Vill skicka'], ['carrier', 'Vill tjäna'], ['both', 'Båda']] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setRole(v)}
            className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
              role === v
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Din stad (t.ex. Stockholm)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === 'loading' ? 'Sparar...' : 'Gå med på väntelistan →'}
      </button>

      {state === 'error' && (
        <p className="text-center text-xs text-red-400">Något gick fel — försök igen.</p>
      )}
    </form>
  )
}
