'use client'

import { ArrowLeft, ArrowRight, Box, CheckCircle2, Clock3, FileText, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import type { AIParseResult } from '@/lib/types'

type Contact = { name: string; phone: string; email: string }

export default function EnterpriseSendReview({ draft, packageType, sender, recipient, price, loading, error, onSenderChange, onRecipientChange, onBack, onConfirm }: {
  draft: AIParseResult
  packageType: 'package' | 'large' | 'pallet' | 'document'
  sender: Contact
  recipient: Contact
  price: number
  loading: boolean
  error: string | null
  onSenderChange: (contact: Contact) => void
  onRecipientChange: (contact: Contact) => void
  onBack: () => void
  onConfirm: () => void
}) {
  const valid = sender.name.trim().length >= 2 && sender.phone.trim().length >= 7 && recipient.name.trim().length >= 2 && recipient.phone.trim().length >= 7 && price > 0
  const typeLabel = { package: 'Paket', large: 'Stort paket', pallet: 'Pall', document: 'Dokument' }[packageType]

  return <section className="review-shell">
    <div className="enterprise-bar"><div><span>GONOW SHIPPING</span><i/><strong>Ny sändning</strong></div><div><span>SE · SEK</span><b>LIVE</b></div></div>
    <nav className="review-steps" aria-label="Bokningsflöde">
      <div className="review-step-list">
        <div className="done"><b><CheckCircle2 size={14}/></b><span><strong>Ditt paket</strong><small>Information</small></span><i /></div>
        <div className="active"><b>2</b><span><strong>Granska</strong><small>Kontrollera allt</small></span><i /></div>
        <div><b>3</b><span><strong>Boka</strong><small>Bekräfta bokningen</small></span><i /></div>
        <div><b>4</b><span><strong>Klart</strong><small>Följ paketet</small></span></div>
      </div>
      <div className="review-ready"><i/> Redo för bokning</div>
    </nav>
    <div className="review-grid">
      <div className="main-card">
        <div className="route">
          <RouteAddr label="FRÅN" addr={draft.from_city}/>
          <i/>
          <RouteAddr label="TILL" addr={draft.to_city}/>
        </div>
        <div className="facts"><div><Box size={15}/><span>Pakettyp</span><strong>{typeLabel}</strong></div><div><span>Vikt</span><strong>{draft.weight_kg} kg</strong></div><div><FileText size={15}/><span>Innehåll</span><strong title={draft.description}>{draft.description}</strong></div><div><Clock3 size={15}/><span>Leverans</span><strong>{draft.urgency === 'today' ? 'Idag' : draft.urgency === 'tomorrow' ? 'Imorgon' : 'Flexibel'}</strong></div></div>
        {draft.special_requirements && <div className="booking-note"><FileText size={13}/><span><small>Beskrivning och instruktion</small><strong>{draft.special_requirements}</strong></span></div>}
        <h2>Kontaktuppgifter</h2>
        <div className="contacts">
          <ContactFields label="Avsändare" contact={sender} onChange={onSenderChange}/>
          <ContactFields label="Mottagare" contact={recipient} onChange={onRecipientChange}/>
        </div>
      </div>
      <aside>
        <span>BERÄKNAT PRIS</span><strong className="price">{price > 0 ? `${price} kr` : '—'}</strong><small>Du ser priset innan bokningen bekräftas</small>
        <div className="process"><div><CheckCircle2 size={15}/><p><strong>Du är klar efter bokningen</strong><small>Gonow hittar transport och följer leveransen.</small></p></div><div><ShieldCheck size={15}/><p><strong>Tryggt hela vägen</strong><small>Mottagaren får status och samma paket-ID följer resan.</small></p></div></div>
      </aside>
    </div>
    {error && <p className="error">{error}</p>}
    <footer><button className="back" onClick={onBack}><ArrowLeft size={14}/> Ändra uppgifter</button><button className="confirm" disabled={!valid || loading} onClick={onConfirm}>{loading ? 'Bokar…' : 'Bekräfta och boka'} <ArrowRight size={14}/></button></footer>
    <style jsx>{`
      .review-shell{color:#f5f7f6;background:transparent;border:1px solid rgba(255,255,255,.1);border-top:2px solid #2fc463;border-radius:16px;padding:20px;box-shadow:0 28px 70px rgba(0,0,0,.38);height:570px;max-height:calc(100vh - 116px);overflow:hidden;display:flex;flex-direction:column}header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.09)}header span,aside>span{font-size:9px;letter-spacing:.12em;color:#3bd36b;font-weight:800}h1{font-size:22px;margin:5px 0 3px}header p{font-size:11px;color:#9ca5a0}.status{font-size:8px;letter-spacing:.08em;color:#90a098;display:flex;align-items:center;gap:7px}.status i{width:6px;height:6px;border-radius:50%;background:#35d066;box-shadow:0 0 0 4px rgba(53,208,102,.12)}.review-grid{display:grid;grid-template-columns:1fr 300px;gap:12px;margin-top:12px;flex:1;min-height:0}.main-card,aside{background:rgba(15,20,18,.82);border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:16px;backdrop-filter:blur(14px)}.route{display:grid;grid-template-columns:1fr 52px 1fr;align-items:center;padding:10px 0 12px}.route>i{display:block;height:1px;background:linear-gradient(90deg,rgba(47,196,99,.5),rgba(255,255,255,.1));margin:0 10px}.facts span{font-size:8px;letter-spacing:.09em;color:#87908b}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.facts>div{position:relative;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:9px}.facts svg{color:#30ca62;float:right}.facts span,.facts strong{display:block}.facts strong{font-size:11px;margin-top:3px}h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 8px}.contacts{display:grid;grid-template-columns:1fr 1fr;gap:8px}aside{text-align:center}.price{display:block;color:#36d166;font-size:29px;margin:6px 0 2px}aside>small{color:#8d9691;font-size:8px}.process{display:flex;flex-direction:column;text-align:left;margin-top:15px}.process>div{display:flex;gap:9px;padding:9px 0;border-top:1px solid rgba(255,255,255,.07)}.process svg{color:#32cc63;flex:none}.process p strong,.process p small{display:block}.process p strong{font-size:10px}.process p small{font-size:8px;color:#8d9691;margin-top:2px}.error{color:#ff8f8f;font-size:10px;margin:10px 0 0}footer{display:flex;justify-content:space-between;margin-top:12px}.back,.confirm{display:flex;align-items:center;gap:7px;border-radius:8px;padding:10px 15px;font-size:10px;font-weight:750;cursor:pointer}.back{color:#b1b8b4;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.confirm{color:#061109;background:#35d066;border:0;min-width:230px;justify-content:center}.confirm:disabled{opacity:.4;cursor:not-allowed}@media(max-width:760px){.review-shell{height:auto;max-height:none;overflow:visible}.review-grid{grid-template-columns:1fr}.contacts{grid-template-columns:1fr}.route{grid-template-columns:1fr;gap:12px}.route>i{display:none}header{gap:12px}.status{display:none}footer{flex-direction:column-reverse;gap:8px}.back,.confirm{width:100%;justify-content:center}}
      .review-shell{padding-top:14px}.review-steps{display:flex;align-items:center;padding-bottom:10px;margin-bottom:11px;border-bottom:1px solid rgba(255,255,255,.09)}.review-steps>div{display:flex;align-items:center;flex:1;min-width:0;color:#87908b}.review-steps b{display:grid;place-items:center;width:29px;height:29px;border:1px solid rgba(255,255,255,.13);border-radius:50%;font-size:10px;flex:none}.review-steps span{padding-left:8px;white-space:nowrap}.review-steps strong,.review-steps small{display:block}.review-steps strong{font-size:10px}.review-steps small{font-size:8px;margin-top:2px}.review-steps i{height:1px;flex:1;margin:0 12px;background:rgba(255,255,255,.1)}.review-steps .done,.review-steps .active{color:#f5f7f6}.review-steps .done b{color:#35d066;border-color:rgba(53,208,102,.45);background:rgba(53,208,102,.1)}.review-steps .done i{background:#35d066}.review-steps .active b{color:#071009;border-color:#35d066;background:#35d066;box-shadow:0 0 0 4px rgba(53,208,102,.1)}.review-steps .active i{background:linear-gradient(90deg,#258d49,rgba(255,255,255,.1))}header{padding-bottom:9px}h1{font-size:20px;margin:4px 0 2px}.review-grid{margin-top:9px}.main-card,aside{padding-top:12px;padding-bottom:12px}.facts{margin-top:10px;margin-bottom:10px}h2{margin-top:8px}.process{margin-top:10px}.process>div{padding-top:7px;padding-bottom:7px}footer{margin-top:9px}
      .review-shell{padding:12px 20px 16px}.enterprise-bar{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.09);font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:#929895}.enterprise-bar>div{display:flex;align-items:center;gap:8px}.enterprise-bar>div:first-child>span{color:#1caf50;font-weight:800}.enterprise-bar i{display:block;width:1px;height:10px;background:#292f2d}.enterprise-bar strong{color:#f5f7f6;font-weight:650}.enterprise-bar b{position:relative;color:#20a94e;font-size:8px;padding-left:9px}.enterprise-bar b:before{content:'';position:absolute;left:0;top:50%;width:5px;height:5px;border-radius:50%;background:#2bd35d;transform:translateY(-50%);box-shadow:0 0 0 3px rgba(43,211,93,.12)}.review-steps{display:flex;align-items:center;gap:18px;padding:0;margin:0 0 10px;border-bottom:0;min-height:38px}.review-step-list{display:flex!important;align-items:center;flex:1!important;min-width:0}.review-step-list>div{display:flex;align-items:center;flex:1;min-width:0;color:#87908b}.review-step-list b{width:30px;height:30px}.review-ready{display:flex!important;flex:none!important;align-items:center!important;justify-content:center;gap:7px;width:128px;min-height:34px;border:1px solid rgba(53,208,102,.3);border-radius:8px;background:rgba(21,148,71,.12);color:#35d066!important;font-size:8px;font-weight:750;text-transform:uppercase;letter-spacing:.05em}.review-ready i{width:6px!important;height:6px!important;flex:none!important;margin:0!important;border-radius:50%;background:#35d066!important;box-shadow:0 0 0 4px rgba(53,208,102,.1)}.review-grid{margin-top:0}
      .facts{grid-template-columns:repeat(4,minmax(0,1fr))}.facts strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.booking-note{display:flex;align-items:flex-start;gap:8px;margin:-3px 0 8px;padding:7px 9px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(255,255,255,.035)}.booking-note svg{color:#30ca62;flex:none}.booking-note span{min-width:0}.booking-note small,.booking-note strong{display:block}.booking-note small{font-size:8px;color:#87908b}.booking-note strong{margin-top:2px;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:760px){.enterprise-bar>div:last-child span,.review-step-list span,.review-step-list i,.review-ready{display:none!important}.facts{grid-template-columns:1fr 1fr}}
    `}</style>
  </section>
}

function RouteAddr({ label, addr }: { label: string; addr: string }) {
  const i = addr.indexOf(', ')
  const street = i > -1 ? addr.slice(0, i) : addr
  const loc = i > -1 ? addr.slice(i + 2) : ''
  const city = loc ? loc.replace(/^\d[\d\s]*/, '').trim() : street
  const postal = loc ? (loc.match(/^[\d\s]+/) || [''])[0].trim() : ''
  const detail = loc ? [postal, street].filter(Boolean).join(' · ') : ''
  return (
    <div className="ra">
      <p className="ra-lbl"><MapPin size={10}/>{label}</p>
      <strong className="ra-city">{city}</strong>
      {detail && <small className="ra-street">{detail}</small>}
      <style jsx>{`
        .ra{min-width:0;overflow:hidden}
        .ra-lbl{display:flex;align-items:center;gap:4px;font-size:8px;letter-spacing:.1em;font-weight:800;color:#4fc970;text-transform:uppercase;margin:0 0 5px}
        .ra-city{display:block;font-size:17px;font-weight:750;color:#eef3f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.01em}
        .ra-street{display:block;font-size:11px;color:#7d8882;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </div>
  )
}

function ContactFields({label,contact,onChange}:{label:string;contact:Contact;onChange:(contact:Contact)=>void}){return <div className="contact"><span>{label}</span><label><User size={12}/><input value={contact.name} onChange={e=>onChange({...contact,name:e.target.value})} placeholder="Namn"/></label><label><Phone size={12}/><input value={contact.phone} onChange={e=>onChange({...contact,phone:e.target.value})} placeholder="Telefon" type="tel" inputMode="tel"/></label><label><Mail size={12}/><input value={contact.email} onChange={e=>onChange({...contact,email:e.target.value})} placeholder="E-post" type="email" inputMode="email" autoComplete="email"/></label><style jsx>{`.contact{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:9px}.contact>span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#8b948f;margin-bottom:6px}.contact label{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:6px 8px}.contact label+label{margin-top:5px}.contact svg{color:#30c961}.contact input{width:100%;color:#fff;background:transparent;border:0;outline:0;font-size:9px}.contact input::placeholder{color:#747d78}`}</style></div>}
