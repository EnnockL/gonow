'use client'

import { Suspense, use, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, PackageCheck } from 'lucide-react'

function RedirectCard({
  title,
  body,
  href,
}: {
  title: string
  body: string
  href: string
}) {
  return (
    <div
      style={{
        width: 'min(100%, 520px)',
        borderRadius: 28,
        padding: '28px 24px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(243,248,255,0.99))',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -56,
          top: -56,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(146,255,99,0.24), rgba(146,255,99,0))',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: 'rgba(146,255,99,0.14)',
          border: '1px solid rgba(146,255,99,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#166534',
          marginBottom: 18,
        }}
      >
        <PackageCheck size={26} />
      </div>

      <p
        style={{
          margin: '0 0 8px',
          fontSize: '0.74rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#65a30d',
        }}
      >
        Gonow spårning
      </p>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 'clamp(1.6rem, 4vw, 2rem)',
          lineHeight: 1.02,
          letterSpacing: '-0.05em',
          color: '#0f172a',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: '0.96rem',
          lineHeight: 1.7,
          color: '#475569',
          maxWidth: 420,
        }}
      >
        {body}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#92ff63',
            boxShadow: '0 0 0 8px rgba(146,255,99,0.14)',
            animation: 'gonow-redirect-pulse 1.5s ease-in-out infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
          Vi öppnar din paketvy och tar dig vidare i samma Gonow-flöde.
        </p>
      </div>

      <Link
        href={href}
        style={{
          marginTop: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 15px',
          borderRadius: 999,
          textDecoration: 'none',
          color: '#0f172a',
          background: 'rgba(146,255,99,0.2)',
          border: '1px solid rgba(146,255,99,0.36)',
          fontWeight: 700,
          fontSize: '0.84rem',
        }}
      >
        Öppna paket manuellt <ArrowRight size={14} />
      </Link>
    </div>
  )
}

function RedirectInner({ id }: { id: string }) {
  const router = useRouter()
  const href = `/paket/${id}`

  useEffect(() => {
    const qs = window.location.search
    const target = `${href}${qs}`
    const t = window.setTimeout(() => {
      router.replace(target)
    }, 120)
    return () => window.clearTimeout(t)
  }, [href, id, router])

  return (
    <main
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '88px 16px 40px',
        background:
          'radial-gradient(circle at top, rgba(146,255,99,0.15), transparent 34%), linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
      }}
    >
      <style>{`
        @keyframes gonow-redirect-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.9); opacity: 0.75; }
        }
      `}</style>
      <RedirectCard
        title="Vi öppnar din spårning."
        body="Din gamla spårningslänk pekar nu vidare till den samlade paketvyn där betalning, status, leverans och bekräftelse hålls ihop."
        href={href}
      />
    </main>
  )
}

export default function SparaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Suspense>
      <RedirectInner id={id} />
    </Suspense>
  )
}
