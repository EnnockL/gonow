'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, MessageSquareText } from 'lucide-react'

function ConversationRedirectCard({ href }: { href: string }) {
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
          background: 'radial-gradient(circle, rgba(146,255,99,0.22), rgba(146,255,99,0))',
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
        <MessageSquareText size={26} />
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
        Gonow meddelanden
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
        Vi öppnar rätt konversation.
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: '0.96rem',
          lineHeight: 1.7,
          color: '#475569',
          maxWidth: 430,
        }}
      >
        All kommunikation hålls i samma Gonow-flöde. Du skickas nu vidare till den fulla meddelandevyn med rätt konversation förvald.
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
            animation: 'gonow-conversation-pulse 1.5s ease-in-out infinite',
          }}
        />
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
          Vi kopplar dig vidare till chatten utan att du tappar sammanhanget.
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
        Öppna konversation manuellt <ArrowRight size={14} />
      </Link>
    </div>
  )
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const href = id ? `/meddelanden?conversation=${id}` : '/meddelanden'

  useEffect(() => {
    if (!id) {
      router.replace('/meddelanden')
      return
    }
    const t = window.setTimeout(() => {
      router.replace(`/meddelanden?conversation=${id}`)
    }, 120)
    return () => window.clearTimeout(t)
  }, [id, router])

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
        @keyframes gonow-conversation-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.9); opacity: 0.75; }
        }
      `}</style>
      <ConversationRedirectCard href={href} />
    </main>
  )
}
