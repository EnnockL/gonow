'use client'

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
    color: '#92ff63',
    quotes: [
      'Vi byggde inte en budfirma. Vi byggde ett sätt att hjälpa varandra.',
      'Förr knackade man på grannens dörr. Nu finns appen för det.',
      'Sverige är fortfarande vänligt — vi hade bara glömt hur man frågar.',
      'Bakom varje leverans finns en människa som redan var på väg.',
      'Du känner inte Jonas än. Men han kör redan till Kiruna imorgon.',
      'Det är inte en kurir. Det är en granne som hjälper till.',
      'En leverans. En liten mänsklig kontakt. Det räcker långt.',
      'Ensamheten minskar en resa i taget.',
      'Äldre, glesbygd, pendlare — alla förtjänar att inte vara ensamma på vägen.',
      'Vi litar på varandra igen. BankID. Betyg. Riktiga människor.',
    ],
  },
  {
    id: 'klimat',
    label: 'Klimat & hållbarhet',
    color: '#68db43',
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
      'Bensinen betalar sig själv — och lite till.',
      'Gör din vardagliga resa till en inkomstkälla.',
      'Du behöver inte hitta nya kunder. Du behöver bara fortsätta köra som vanligt.',
    ],
  },
  {
    id: 'trygghet',
    label: 'Trygghet & förtroende',
    color: '#22c55e',
    quotes: [
      'BankID-verifierad. Försäkrad. Betygsatt. Trygg.',
      'Vi vet vem du är. Vi vet vem som kör. Det räcker.',
      'Pengarna frigörs inte förrän paketet är framme. Alltid.',
      'Försäkring ingår. Alltid. Utan krångel.',
      'Ingen anonym kurir. Bara verifierade människor som redan var på väg.',
      'Trygghet är inte en avgift. Det är grunden.',
    ],
  },
  {
    id: 'norrland',
    label: 'Norrland & glesbygd',
    color: '#92ff63',
    quotes: [
      'PostNord glömde Norrland. Vi gjorde det inte.',
      'Avstånd ska inte betyda ensamhet.',
      '900+ orter i Sverige saknar bra kollektivtrafik. Vi fyller hålen.',
      'Stockholm till Kiruna känns inte så långt när någon redan kör dit.',
      'Glesbygden förtjänar samma snabbhet som storstaden.',
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
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 96 }}>

      {/* Header */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '64px 24px 80px' }}>
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none',
          marginBottom: 40, transition: 'color 0.15s',
        }}>
          <ArrowLeft size={14} /> Tillbaka
        </Link>

        <p className="label" style={{ marginBottom: 14 }}>Vår filosofi</p>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 5rem)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: 'var(--text)',
          lineHeight: 1.0,
          marginBottom: 20,
          maxWidth: 700,
        }}>
          Gonow —<br />
          <span className="gradient-text">Budskap & copy</span>
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.75, maxWidth: 560 }}>
          Samling av alla budskap för landningssida, sociala medier och marknadsföring.
          Klicka på ett citat för att kopiera det.
        </p>
      </div>

      {/* Quote sections */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px 80px' }}>
        {SECTIONS.map((section) => (
          <div key={section.id} style={{ marginBottom: 72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div style={{ width: 4, height: 24, borderRadius: 2, background: section.color, flexShrink: 0 }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {section.label}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {section.quotes.map((quote) => (
                <QuoteCard key={quote} quote={quote} />
              ))}
            </div>
          </div>
        ))}

        {/* Slogans */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Korta slogans & taglines
            </h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {SLOGANS.map((s) => (
              <QuoteChip key={s} text={s} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: '#fbbf24', flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Statistik-påståenden
            </h2>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 20, paddingLeft: 16 }}>
            ⚠️ Verifiera mot officiella källor (SCB, Trafikanalys, Transportstyrelsen) innan publicering.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {STATS.map((s) => (
              <div key={s} style={{
                padding: '14px 18px', borderRadius: 12,
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.22)',
                fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5,
              }}>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: 'var(--secondary-strong)', flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Call-to-actions
            </h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {CTAS.map((c) => (
              <div key={c} style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '10px 20px', borderRadius: 999,
                background: 'var(--accent)',
                fontSize: '0.85rem', fontWeight: 600, color: '#0a0a0a',
              }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

function QuoteCard({ quote }: { quote: string }) {
  return (
    <div
      title="Klicka för att kopiera"
      onClick={() => { try { navigator.clipboard.writeText(quote) } catch {} }}
      style={{
        padding: '20px 22px', borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(146,255,99,0.45)'
        el.style.background = 'var(--accent-softer)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.background = 'var(--surface)'
      }}
    >
      <Quote size={14} style={{ color: 'var(--secondary-strong)', marginBottom: 8, opacity: 0.7 }} />
      <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>
        {quote}
      </p>
    </div>
  )
}

function QuoteChip({ text }: { text: string }) {
  return (
    <div
      onClick={() => { try { navigator.clipboard.writeText(text) } catch {} }}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '9px 18px', borderRadius: 999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: '0.85rem', color: 'var(--text)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(146,255,99,0.5)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      {text}
    </div>
  )
}
