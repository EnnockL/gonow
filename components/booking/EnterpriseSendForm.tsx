'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight, Box, CalendarDays, Check, Clock3, FileText, LocateFixed,
  LockKeyhole, MapPin, Package, Palmtree, ShieldCheck, Sparkles, Truck,
} from 'lucide-react'
import { useRoutePrice } from '@/lib/hooks/useRoutePrice'
import type { PendingBookingDraft } from '@/lib/pending-booking'

type Contact = { name: string; phone: string; email: string }
type Props = {
  requestId: string
  sender: Contact
  recipient: Contact
  onContinue: (draft: PendingBookingDraft) => void
  onAI: () => void
}
type ParcelType = 'package' | 'large' | 'pallet' | 'document'
const SEND_FORM_KEY = 'gonow_send_form_v1'

function loadFormDraft() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(sessionStorage.getItem(SEND_FORM_KEY) || 'null') as { type?: ParcelType; weight?: number; description?: string; specialRequirements?: string; from?: string; to?: string; phone?: string; recipientPhone?: string } | null } catch { return null }
}

const parcelTypes = [
  { id: 'package' as const, icon: Box, name: 'Paket', sub: 'Vanliga paket', limit: '0,5 – 20 kg', min: .5, max: 20, initial: 2 },
  { id: 'large' as const, icon: Package, name: 'Stort paket', sub: 'Skrymmande', limit: '20 – 50 kg', min: 20, max: 50, initial: 20 },
  { id: 'pallet' as const, icon: Palmtree, name: 'Pall', sub: 'Pallar & gods', limit: '50 – 1000 kg', min: 50, max: 1000, initial: 100 },
  { id: 'document' as const, icon: FileText, name: 'Dokument', sub: 'Viktiga dokument', limit: '0,1 – 2 kg', min: .1, max: 2, initial: .5 },
]

export default function EnterpriseSendForm({ requestId, sender, recipient, onContinue, onAI }: Props) {
  const [type, setType] = useState<ParcelType>('package')
  const [weight, setWeight] = useState(2)
  const [description, setDescription] = useState('')
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const saved = loadFormDraft()
    if (!saved) return
    if (saved.type) setType(saved.type)
    if (saved.weight !== undefined) setWeight(saved.weight)
    if (saved.description) setDescription(saved.description)
    if (saved.specialRequirements) setSpecialRequirements(saved.specialRequirements)
    if (saved.from) setFrom(saved.from)
    if (saved.to) setTo(saved.to)
  }, [])
  const { result: quote, loading: quoteLoading, error: quoteError, calculate } = useRoutePrice()
  const selectedType = parcelTypes.find(item => item.id === type) ?? parcelTypes[0]
  const dates = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const format = (date: Date) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date)
    return { pickup: `Idag, ${format(today)}`, delivery: `Tidigast ${format(tomorrow)}` }
  }, [])

  useEffect(() => {
    if (from.trim().length < 3 || to.trim().length < 3) return
    const timer = window.setTimeout(() => calculate(from, to, weight, 'tomorrow'), 500)
    return () => window.clearTimeout(timer)
  }, [from, to, weight, calculate])

  useEffect(() => {
    sessionStorage.setItem(SEND_FORM_KEY, JSON.stringify({ type, weight, description, specialRequirements, from, to }))
  }, [type, weight, description, specialRequirements, from, to])

  const canContinue = description.trim().length > 1 && from.trim().length > 2 && to.trim().length > 2 && !!quote
  const submit = () => canContinue && onContinue({
    request_id: requestId,
    service_type: 'package',
    package_type: type,
    weight_kg: weight,
    description: description.trim(),
    special_requirements: specialRequirements.trim() || undefined,
    pickup_address: from,
    dropoff_address: to,
    deadline: 'tomorrow',
    sender_name: sender.name,
    sender_phone: '',
    sender_email: sender.email,
    recipient_name: recipient.name,
    recipient_phone: '',
    recipient_email: recipient.email,
    status: 'pending',
    price_est: quote?.price ?? 0,
  })

  return (
    <section className="send-workspace" aria-label="Boka pakettransport">
      <div className="enterprise-bar">
        <div><span>GONOW SHIPPING</span><i /> <strong>Ny sändning</strong></div>
        <div className="enterprise-meta"><span>SE · SEK</span><span><LockKeyhole size={10} /> Säker bokning</span><b>LIVE</b></div>
      </div>
      <header className="send-topbar">
        <div className="send-steps">
          {[
            ['1', 'Ditt paket', 'Information'], ['2', 'Granska', 'Kontrollera allt'],
            ['3', 'Boka', 'Bekräfta bokningen'], ['4', 'Klart', 'Följ paketet'],
          ].map(([n, title, sub], index) => (
            <div className={`send-step ${index === 0 ? 'active' : ''}`} key={n}>
              <span>{n}</span><div><strong>{title}</strong><small>{sub}</small></div>
              {index < 3 && <i />}
            </div>
          ))}
        </div>
        <button className="send-ai" type="button" onClick={onAI}><Sparkles size={15} /> GIS-assistent</button>
      </header>

      <div className="send-panel parcel-panel">
        <h2>Vad vill du skicka?</h2>
        <div className="parcel-grid">
          {parcelTypes.map(({ id, icon: Icon, name, sub, limit, initial }) => (
            <button type="button" key={id} className={type === id ? 'selected' : ''} onClick={() => { setType(id); setWeight(initial) }}>
              <span className="parcel-icon"><Icon size={17} /></span><div><strong>{name}</strong><small>{sub}</small><small className="parcel-limit">{limit}</small></div>
              {type === id && <Check className="parcel-check" size={14} />}
            </button>
          ))}
        </div>
        <div className="weight-row">
          <div className="weight-copy"><small>Hur mycket väger det?</small><strong>{weight} kg</strong></div>
          <div className="range-wrap"><input type="range" min={selectedType.min} max={selectedType.max} step={type === 'pallet' ? 10 : type === 'document' ? .1 : .5} value={weight} onChange={e => setWeight(Number(e.target.value))} />
            <div><span>{selectedType.min} kg</span><span>{Math.round((selectedType.min + selectedType.max) / 2)} kg</span><span>{selectedType.max} kg</span></div>
          </div>
          <label className="contents-field"><Package size={15} /><span><small>Vad innehåller paketet?</small><input value={description} onChange={e => setDescription(e.target.value)} placeholder="T.ex. kläder eller reservdelar" maxLength={160} /></span></label>
        </div>
      </div>

      <div className="route-grid">
        <RouteCard title="Från" value={from} onChange={setFrom} mode="Hämtning" date={dates.pickup} />
        <button className="swap" type="button" onClick={() => { setFrom(to); setTo(from) }} aria-label="Byt adresser"><ArrowLeftRight size={17} /></button>
        <RouteCard title="Till" value={to} onChange={setTo} mode="Leverans" date={dates.delivery} />
      </div>

      <div className="trust-strip">
        <Trust icon={Clock3} title="Beräknad leverans" text={dates.delivery} />
        <Trust icon={ShieldCheck} title="Försäkrat" text="Upp till 10 000 kr ingår" />
        <Trust icon={Truck} title="SMS-avisering" text="Mottagaren får uppdateringar" />
      </div>
      <footer className="send-footer">
        <div><small>Beräknat pris</small><strong>{quoteLoading ? 'Beräknar…' : quote ? `${quote.price} kr` : '—'}</strong></div>
        <label className="notes-field"><FileText size={13}/><input value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)} placeholder="Valfri beskrivning eller instruktion" maxLength={240}/></label>
        <button type="button" disabled={!canContinue} onClick={submit}>{quoteError ? 'Kontrollera rutten' : 'Nästa'} <span>→</span></button>
      </footer>

      <style jsx>{`
        .send-workspace{--sw-bg:transparent;--sw-panel:rgba(15,20,18,.76);--sw-card:rgba(21,25,26,.84);--sw-card-active:linear-gradient(135deg,rgba(25,55,35,.88),rgba(18,24,21,.88));--sw-field:rgba(23,27,28,.86);--sw-border:rgba(255,255,255,.09);--sw-border-strong:rgba(255,255,255,.13);--sw-text:#f5f7f6;--sw-muted:#929895;--sw-line:#292f2d;--sw-tip:rgba(23,28,28,.86);--sw-icon-bg:#173220;--sw-shadow:0 24px 70px rgba(0,0,0,.42);position:relative;color:var(--sw-text);background:var(--sw-bg);border-top:2px solid rgba(34,197,94,.7);border-bottom:1px solid var(--sw-border);padding:12px max(20px,calc(50vw - 580px)) 16px;box-shadow:var(--sw-shadow);font-size:12px;height:570px;max-height:calc(100vh - 116px);overflow:hidden;width:100vw;left:50%;transform:translateX(-50%);}
        :global(html.dark) .send-workspace{--sw-bg:transparent;--sw-panel:rgba(15,20,18,.76);--sw-card:rgba(21,25,26,.84);--sw-card-active:linear-gradient(135deg,rgba(25,55,35,.88),rgba(18,24,21,.88));--sw-field:rgba(23,27,28,.86);--sw-border:rgba(255,255,255,.09);--sw-border-strong:rgba(255,255,255,.13);--sw-text:#f5f7f6;--sw-muted:#929895;--sw-line:#292f2d;--sw-tip:rgba(23,28,28,.86);--sw-icon-bg:#173220;--sw-shadow:0 24px 70px rgba(0,0,0,.42)}
        .enterprise-bar{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--sw-border);font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:var(--sw-muted)}.enterprise-bar>div{display:flex;align-items:center;gap:8px}.enterprise-bar>div:first-child>span{color:#1caf50;font-weight:800}.enterprise-bar i{display:block;width:1px;height:10px;background:var(--sw-line)}.enterprise-bar strong{color:var(--sw-text);font-weight:650}.enterprise-meta span{display:flex;align-items:center;gap:4px}.enterprise-meta b{position:relative;color:#20a94e;font-size:8px;letter-spacing:.08em;padding-left:9px}.enterprise-meta b:before{content:'';position:absolute;left:0;top:50%;width:5px;height:5px;border-radius:50%;background:#2bd35d;transform:translateY(-50%);box-shadow:0 0 0 3px rgba(43,211,93,.12)}
        .send-topbar{display:flex;align-items:center;gap:18px;margin-bottom:10px;min-height:38px}.send-steps{display:flex;align-items:center;flex:1}.send-step{display:flex;align-items:center;flex:1;min-width:0;color:var(--sw-muted)}.send-step>span{width:30px;height:30px;border-radius:50%;border:1px solid var(--sw-border-strong);display:grid;place-items:center;font-weight:800;flex:none}.send-step>div{padding-left:8px;white-space:nowrap}.send-step strong,.send-step small{display:block}.send-step strong{font-size:10px;letter-spacing:.01em}.send-step small{font-size:8px;margin-top:2px}.send-step i{height:1px;background:var(--sw-line);flex:1;margin:0 11px}.send-step.active{color:var(--sw-text)}.send-step.active>span{background:#35d066;color:#071009;border-color:#35d066;box-shadow:0 0 0 4px rgba(53,208,102,.1)}.send-step.active i{background:linear-gradient(90deg,#258d49,var(--sw-line))}.send-ai{display:flex;gap:6px;align-items:center;background:var(--sw-icon-bg);color:#159447;border:1px solid rgba(21,148,71,.35);border-radius:8px;padding:8px 11px;font-size:10px;font-weight:750;cursor:pointer;transition:transform .16s,border-color .16s,box-shadow .16s}.send-ai:hover{transform:translateY(-1px);border-color:#25b456;box-shadow:0 8px 20px rgba(30,160,75,.12)}
        .send-panel,.trust-strip,.send-footer{border:1px solid var(--sw-border);background:var(--sw-panel);border-radius:10px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}.parcel-panel{padding:7px 10px}h2{font-size:9px;letter-spacing:.035em;text-transform:uppercase;margin:0 0 8px}.parcel-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.parcel-grid button{position:relative;display:flex;align-items:center;gap:7px;text-align:left;color:var(--sw-text);background:var(--sw-card);border:1px solid var(--sw-border-strong);border-radius:8px;padding:5px 8px;cursor:pointer;min-height:44px;backdrop-filter:blur(10px);transition:transform .14s,border-color .14s,box-shadow .14s}.parcel-grid button:hover{transform:translateY(-1px);border-color:rgba(34,197,94,.48);box-shadow:0 8px 18px rgba(20,60,35,.07)}.parcel-grid button:focus-visible,.swap:focus-visible,.send-ai:focus-visible,.send-footer button:focus-visible{outline:2px solid #2fc463;outline-offset:2px}.parcel-grid button.selected{border-color:#2fc463;background:var(--sw-card-active);box-shadow:inset 3px 0 0 #2fc463}.parcel-icon{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:rgba(184,117,66,.09);flex:none}.parcel-grid svg{color:#b87542;flex:none;width:15px}.parcel-grid strong,.parcel-grid small{display:block}.parcel-grid strong{font-size:9px}.parcel-grid small{color:var(--sw-muted);font-size:7px;margin-top:2px}.parcel-limit{font-variant-numeric:tabular-nums}.parcel-check{position:absolute;right:7px;top:7px;background:#35d066!important;color:#071009!important;border-radius:50%;padding:2px}.weight-row{display:grid;grid-template-columns:110px 1fr 190px;align-items:center;gap:18px;margin-top:8px;padding:8px 11px;border:1px solid var(--sw-border);border-radius:8px;min-height:55px;background:rgba(255,255,255,.015)}.weight-copy small,.weight-copy strong{display:block}.weight-copy small{font-size:8px;text-transform:uppercase;letter-spacing:.04em}.weight-copy strong{color:#22b957;font-size:15px;margin-top:3px;font-variant-numeric:tabular-nums}.range-wrap input{width:100%;height:12px}.range-wrap>div{display:flex;justify-content:space-between;color:var(--sw-muted);font-size:7px;font-variant-numeric:tabular-nums}.weight-row aside{display:flex;gap:8px;background:var(--sw-tip);border:1px solid var(--sw-border);border-radius:7px;padding:7px 9px}.weight-row aside svg,.weight-row aside strong{color:#22b957}.weight-row aside small{display:block;color:var(--sw-muted);font-size:7px;line-height:1.35;margin-top:2px}
        .contents-field{display:flex;align-items:center;gap:8px;background:var(--sw-tip);border:1px solid var(--sw-border);border-radius:7px;padding:6px 9px;min-width:0}.contents-field:focus-within{border-color:#2fc463}.contents-field>svg{color:#22b957;flex:none}.contents-field>span{display:block;min-width:0;flex:1}.contents-field small{display:block;color:var(--sw-muted);font-size:7px;margin-bottom:2px}.contents-field input{display:block;width:100%;border:0;outline:0;background:transparent;color:var(--sw-text);font-size:8px}.contents-field input::placeholder{color:var(--sw-muted)}
        .route-grid{display:grid;grid-template-columns:1fr 36px 1fr;align-items:center;gap:8px;margin:8px 0}.swap{width:32px;height:32px;border-radius:50%;border:1px solid var(--sw-border-strong);background:var(--sw-card);color:#22b957;display:grid;place-items:center;cursor:pointer;transition:transform .18s,border-color .18s}.swap:hover{transform:rotate(180deg);border-color:#2fc463}.trust-strip{display:grid;grid-template-columns:repeat(3,1fr);padding:8px 13px;margin-bottom:7px;min-height:45px}.trust-strip>div+div{border-left:1px solid var(--sw-line);padding-left:18px}.send-footer{display:grid;grid-template-columns:130px 1fr 44%;align-items:center;padding:7px 13px;min-height:52px}.send-footer small{display:block;color:var(--sw-muted);font-size:7px;text-transform:uppercase;letter-spacing:.04em}.send-footer strong{display:block;color:#22b957;font-size:18px;margin-top:2px;font-variant-numeric:tabular-nums}.send-footer p{color:var(--sw-muted);font-size:7px;border-left:1px solid var(--sw-line);padding-left:16px}.send-footer p span{color:var(--sw-text)}.send-footer button{height:34px;border:0;border-radius:7px;background:linear-gradient(135deg,#3ed168,#28b956);color:#061109;font-size:10px;font-weight:850;letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 18px rgba(34,185,87,.18);transition:transform .15s,box-shadow .15s}.send-footer button:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(34,185,87,.25)}.send-footer button:disabled{opacity:.45;transform:none;box-shadow:none}
        .notes-field{display:flex;align-items:center;gap:7px;margin-right:12px;padding:7px 9px;border:1px solid var(--sw-border-strong);border-radius:7px;background:var(--sw-field);color:#22b957}.notes-field:focus-within{border-color:#2fc463}.notes-field input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--sw-text);font-size:8px}.notes-field input::placeholder{color:var(--sw-muted)}
        .weight-row{grid-template-columns:110px minmax(180px,1fr) 230px}
        @media(max-width:850px){.send-workspace{padding:16px;height:auto;max-height:none;overflow:visible}.enterprise-meta>span{display:none}.send-topbar{align-items:flex-start}.send-step>div,.send-step i{display:none}.send-ai{margin-left:auto}.parcel-grid{grid-template-columns:1fr 1fr}.weight-row{grid-template-columns:1fr}.route-grid{grid-template-columns:1fr}.swap{transform:rotate(90deg);margin:auto}.swap:hover{transform:rotate(270deg)}.trust-strip{grid-template-columns:1fr;gap:12px}.trust-strip>div+div{border-left:0;padding-left:0}.send-footer{grid-template-columns:1fr;gap:14px}.send-footer p{border-left:0;padding-left:0}.send-footer button{width:100%}}
        @media(max-width:480px){.parcel-grid{grid-template-columns:1fr}.send-step>span{width:29px;height:29px}.send-workspace{border-radius:16px}.send-ai{font-size:0;width:38px;height:38px;justify-content:center;padding:0}.send-ai svg{width:16px}.send-footer{position:sticky;bottom:8px;background:var(--sw-card)}}
      `}</style>
    </section>
  )
}

function RouteCard({ title, value, onChange, mode, date }: { title:string;value:string;onChange:(v:string)=>void;mode:string;date:string }) {
  const [sugg, setSugg] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const q = value.trim()
    if (q.length < 3) { setSugg([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=se&addressdetails=1`,
          { headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' } }
        )
        if (!res.ok) return
        const data = await res.json() as Array<{display_name:string;address:{road?:string;house_number?:string;postcode?:string;city?:string;town?:string;village?:string;municipality?:string;residential?:string}}>
        const items = data.map(d => {
          const a = d.address
          const road = a.road || a.residential || ''
          const num = a.house_number ? ' ' + a.house_number : ''
          const pc = a.postcode || ''
          const city = a.city || a.town || a.village || a.municipality || ''
          return road ? `${road}${num}${pc ? ', ' + pc : ''} ${city}`.trim() : d.display_name.split(',').slice(0, 3).join(',').trim()
        }).filter((v, i, a) => a.indexOf(v) === i)
        setSugg(items)
      } catch {}
    }, 320)
    return () => clearTimeout(t)
  }, [value])
  return <div className="route-card">
    <h3><MapPin size={15}/>{title}</h3>
    <div style={{position:'relative'}}>
      <label>
        <LocateFixed size={15}/>
        <input value={value} onChange={e=>{onChange(e.target.value);setOpen(true)}} onFocus={()=>{if(sugg.length)setOpen(true)}} onBlur={()=>setTimeout(()=>setOpen(false),160)} placeholder={title==='Från'?'T.ex. Storgatan 5, 97452 Luleå':'T.ex. Kungsgatan 12, 11143 Stockholm'} autoComplete="off" />
      </label>
      {open && sugg.length > 0 && (
        <div className="addr-drop">
          {sugg.map((s, i) => {
            const ci = s.indexOf(', ')
            const st = ci > -1 ? s.slice(0, ci) : s
            const loc = ci > -1 ? s.slice(ci + 2) : ''
            return (
              <button key={i} type="button" onMouseDown={()=>{onChange(s);setSugg([]);setOpen(false)}}>
                <span className="sug-city">{st}</span>
                {loc && <span className="sug-detail">{loc}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
    <div className="route-meta"><span>{mode}</span><span><CalendarDays size={13}/>{date}</span></div>
    <style jsx>{`.route-card{padding:16px 18px;background:var(--sw-panel);border:1px solid var(--sw-border);border-radius:12px}.route-card h3{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 11px}.route-card h3 svg{color:#22b957}.route-card label{display:flex;align-items:center;gap:10px;background:var(--sw-field);border:1px solid var(--sw-border-strong);padding:14px 16px;border-radius:10px;min-height:54px}.route-card input{width:100%;color:var(--sw-text);background:transparent;border:0;outline:0;font-size:16px}.route-card input::placeholder{color:var(--sw-muted)}.route-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 2px}.route-meta span{display:flex;align-items:center;gap:6px;color:var(--sw-text);background:var(--sw-field);border:1px solid var(--sw-border-strong);padding:9px 11px;border-radius:8px;font-size:11px;min-height:38px}.addr-drop{position:absolute;top:calc(100% + 5px);left:0;right:0;background:#0e1512;border:1px solid rgba(53,208,102,.22);border-radius:10px;overflow:hidden;z-index:200;box-shadow:0 16px 40px rgba(0,0,0,.6)}.addr-drop button{display:block;width:100%;text-align:left;padding:10px 14px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;cursor:pointer;font-family:inherit}.addr-drop button:last-child{border-bottom:0}.addr-drop button:hover{background:rgba(53,208,102,.08)}.addr-drop .sug-city{display:block;font-size:13px;font-weight:650;color:#eef3f0;line-height:1.2}.addr-drop .sug-detail{display:block;font-size:10px;color:#6d7872;margin-top:3px}.addr-drop button:hover .sug-city{color:#5ee090}.addr-drop button:hover .sug-detail{color:#4a8c5e}`}</style>
  </div>
}

function Trust({icon:Icon,title,text}:{icon:typeof Clock3;title:string;text:string}){return <div className="trust"><Icon size={17}/><div><small>{title}</small><strong>{text}</strong></div><style jsx>{`.trust{display:flex;align-items:center;gap:11px}.trust svg{color:#22b957;background:var(--sw-icon-bg);border-radius:50%;padding:5px;box-sizing:content-box}.trust small,.trust strong{display:block}.trust small{color:var(--sw-muted);font-size:9px}.trust strong{color:var(--sw-text);font-size:10px;margin-top:3px}`}</style></div>}
