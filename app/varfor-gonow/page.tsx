'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Quote } from 'lucide-react'

const SECTIONS = [
  {
    id: 'hero',
    label: 'Hero-budskap',
    color: 'var(--accent)',
    quotes: [
      'Någon kör redan din väg.',
      'Sveriges vänligaste sätt att skicka något.',
      'Du är aldrig ensam på vägen.',
      'Alla åker någonstans. Låt det betyda något.',
      'Grannen din nya budbil.',
      'Det finns redan en bil på väg dit du ska.',
      'Sverige har alltid hjälpt varandra. Nu finns appen för det.',
      'Tomma säten. Tomt bagageutrymme. Onödigt slöseri.',
    ],
  },
  {
    id: 'gemenskap',
    label: 'Gemenskap & vänlighet',
    color: '#4ADE55',
    quotes: [
      'Vi byggde inte en budfirma. Vi byggde ett sätt att hjälpa varandra.',
      'Förr knackade man på grannens dörr. Nu finns appen för det.',
      'Sverige är fortfarande vänligt, vi hade bara glömt hur man frågar.',
      'Bakom varje leverans finns en människa som redan var på väg.',
      'Du känner inte Jonas än. Men han kör redan till Kiruna imorgon.',
      'Det är inte en kurir. Det är en granne som hjälper till.',
      'En leverans. En liten mänsklig kontakt. Det räcker långt.',
      'Ensamheten minskar en resa i taget.',
      'Äldre, glesbygd, pendlare, alla förtjänar att inte vara ensamma på vägen.',
      'Vi litar på varandra igen. BankID. Betyg. Riktiga människor.',
    ],
  },
  {
    id: 'klimat',
    label: 'Klimat & hållbarhet',
    color: '#34C759',
    quotes: [
      'Fyra av fem bilar kör ensamma till jobbet. Vi fyller de tomma platserna.',
      'Det grönaste paketet är det som redan var på väg.',
      'Ingen ny bil. Ingen ny resa. Bara bättre användning av den som redan finns.',
      'Mindre trafik. Samma rörlighet. Det är matematik, inte magi.',
      'Varje delad resa är en resa mindre i onödan.',
      'Hållbarhet behöver inte vara dyrt eller krångligt. Det behöver bara vara smart.',
      'Du skickar inte bara ett paket. Du sparar en resa.',
      'Tomma lastutrymmen är 2020-talets största slöseri. Vi gör något åt det.',
    ],
  },
  {
    id: 'effektivitet',
    label: 'Effektivitet & smarthet',
    color: 'var(--secondary-strong)',
    quotes: [
      '60% billigare än DHL. Lika pålitligt. Mycket mer mänskligt.',
      'Snabbare än posten. Varmare än kuriren.',
      'Varför vänta 5 dagar när någon redan kör dit imorgon?',
      'PostNord har en lastbil. Vi har hela Sverige.',
      'Ingen logistikcentral. Ingen omlastning. Bara en bil som redan var på väg.',
      'Effektivitet handlar inte om snabbare lastbilar. Det handlar om att sluta köra tomt.',
      'Det smartaste sättet att skicka något är att inte skicka något extra alls.',
    ],
  },
  {
    id: 'ekonomi',
    label: 'Ekonomi & tjäna pengar',
    color: 'var(--accent-dark)',
    quotes: [
      'Du kör ändå. Varför inte tjäna på det?',
      'Din bil. Din rutt. Din extra inkomst.',
      'Fyll dina tomma säten med pengar, inte luft.',
      '1 200 kr extra på en resa du redan planerat.',
      'Bensinen betalar sig själv och lite till.',
      'Gör din vardagliga resa till en inkomstkälla.',
      'Du behöver inte hitta nya kunder. Du behöver bara fortsätta köra som vanligt.',
    ],
  },
  {
    id: 'trygghet',
    label: 'Trygghet & förtroende',
    color: '#4ADE55',
    quotes: [
      'BankID-verifierad. Försäkrad. Betygsatt. Trygg.',
      'Vi vet vem du är. Vi vet vem som kör. Det räcker.',
      'Pengarna frigörs inte förrän paketet är framme. Alltid.',
      'Försäkring ingår. Alltid. Utan krångel.',
      'Ingen anonym kurir. Bara verifierade människor som redan var på väg.',
      'Trygghet är inte en avgift. Det är grunden.',
    ],
  },
]

const SLOGANS = [
  "Someone's already going your way.",
  'Alla är redan på väg. Vi gör resan lönsam.',
  'Skicka med nån som ändå åker.',
  'Din granne levererar. På riktigt.',
  'Sveriges decentraliserade transportnätverk.',
  'Built by people already on the way.',
  'Go now. Deliver always.',
  'Mindre ensamhet. Mindre trafik. Mer Sverige.',
]

const STATS = [
  '4 av 5 bilar kör ensamma till jobbet varje dag',
  '900+ orter i Sverige saknar regelbunden kollektivtrafik',
  '1,2 miljoner svenskar saknar tillgång till bil',
  '60% billigare än DHL Express',
  'BankID-verifierade resenärer',
  'Försäkring upp till 5 000 kr ingår alltid',
]

const CTAS = [
  'Skicka något',
  'Tjäna på din resa',
  'Hitta en skjuts',
  'Bli resenär',
  'Se vad du kan tjäna',
  'Kör & tjäna idag',
  'Gå med på väntelistan',
  'Häng med oss från start',
]

export default function VarforGonow() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: isMobile ? 72 : 96 }}>
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '32px 16px 40px' : '64px 24px 80px' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8rem',
            color: 'var(--muted)',
            textDecoration: 'none',
            marginBottom: isMobile ? 24 : 40,
          }}
        >
          <ArrowLeft size={14} /> Tillbaka
        </Link>

        <p className="label" style={{ marginBottom: 14 }}>Vår filosofi</p>
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 9vw, 5rem)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
            lineHeight: 1,
            marginBottom: 16,
            maxWidth: 700,
          }}
        >
          Gonow
          <br />
          <span className="gradient-text">Budskap & copy</span>
        </h1>
        <p style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', color: 'var(--muted)', lineHeight: 1.75, maxWidth: 560 }}>
          Samling av alla budskap för landningssida, sociala medier och marknadsföring.
          Klicka på ett citat för att kopiera det.
        </p>
      </div>

      <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '0 16px 56px' : '0 24px 80px' }}>
        {SECTIONS.map((section) => (
          <div key={section.id} style={{ marginBottom: isMobile ? 40 : 72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : 28 }}>
              <div style={{ width: 4, height: 24, borderRadius: 2, background: section.color, flexShrink: 0 }} />
              <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {section.label}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: isMobile ? 10 : 12 }}>
              {section.quotes.map((quote) => (
                <QuoteCard key={quote} quote={quote} isMobile={isMobile} />
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: isMobile ? 40 : 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : 28 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Korta slogans & taglines
            </h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {SLOGANS.map((text) => (
              <QuoteChip key={text} text={text} isMobile={isMobile} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: isMobile ? 40 : 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: '#fbbf24', flexShrink: 0 }} />
            <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Statistik-påståenden
            </h2>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 20, paddingLeft: 16 }}>
            Verifiera mot officiella källor innan publicering.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {STATS.map((text) => (
              <div
                key={text}
                style={{
                  padding: isMobile ? '14px 16px' : '14px 18px',
                  borderRadius: 12,
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.22)',
                  fontSize: '0.85rem',
                  color: 'var(--text)',
                  lineHeight: 1.5,
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : 24 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: 'var(--secondary-strong)', flexShrink: 0 }} />
            <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Call-to-actions
            </h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {CTAS.map((text) => (
              <div
                key={text}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: isMobile ? '10px 16px' : '10px 20px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  fontWeight: 600,
                  color: '#0a0a0a',
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuoteCard({ quote, isMobile }: { quote: string; isMobile: boolean }) {
  return (
    <div
      title="Klicka för att kopiera"
      onClick={() => {
        try {
          navigator.clipboard.writeText(quote)
        } catch {}
      }}
      style={{
        padding: isMobile ? '16px' : '20px 22px',
        borderRadius: isMobile ? 14 : 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(74,222,85,0.45)'
        el.style.background = 'var(--accent-softer)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.background = 'var(--surface)'
      }}
    >
      <Quote size={14} style={{ color: 'var(--secondary-strong)', marginBottom: 8, opacity: 0.7 }} />
      <p style={{ fontSize: isMobile ? '0.84rem' : '0.88rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>
        {quote}
      </p>
    </div>
  )
}

function QuoteChip({ text, isMobile }: { text: string; isMobile: boolean }) {
  return (
    <div
      onClick={() => {
        try {
          navigator.clipboard.writeText(text)
        } catch {}
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isMobile ? '8px 14px' : '9px 18px',
        borderRadius: 999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        color: 'var(--text)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,85,0.5)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
      }}
    >
      {text}
    </div>
  )
}
