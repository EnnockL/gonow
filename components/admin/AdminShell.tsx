'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Activity, ArrowLeft, Boxes, ChevronRight, Menu, PackageSearch, Shield, ShieldOff, Truck, X, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import './admin-shell.css'

const navigation = [
  { href: '/admin/dashboard', label: 'Ledningsöversikt', description: 'KPI och affärsläge', icon: Activity },
  { href: '/admin', label: 'Ordercenter', description: 'Ordrar och avvikelser', icon: PackageSearch, exact: true },
  { href: '/admin/dispatcher', label: 'Dispatcher', description: 'Liveflöde och Guardian', icon: Zap },
  { href: '/admin/logistics', label: 'Transportkö', description: 'Paket och tilldelning', icon: Truck, exact: true },
  { href: '/admin/logistics/opportunities', label: 'Logistikuppdrag', description: 'Kapacitet och möjligheter', icon: Boxes },
]

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const current = navigation.find(item => isActive(pathname, item.href, item.exact)) ?? navigation[0]

  if (loading) {
    return <div className="admin-gate"><span className="admin-loader" /><p>Säkrar adminsession…</p></div>
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="admin-gate">
        <div className="admin-gate-icon"><ShieldOff size={26} /></div>
        <h1>Åtkomst nekad</h1>
        <p>Den här arbetsytan kräver administratörsbehörighet.</p>
        <Link href="/" className="admin-gate-link"><ArrowLeft size={15} /> Till Gonow</Link>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <button className="admin-mobile-toggle" onClick={() => setOpen(true)} aria-label="Öppna adminmeny"><Menu size={19} /></button>
      {open && <button className="admin-backdrop" onClick={() => setOpen(false)} aria-label="Stäng adminmeny" />}

      <aside className={`admin-sidebar${open ? ' is-open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-mark"><Zap size={18} fill="currentColor" /></div>
          <div><strong>Gonow</strong><span>Operations</span></div>
          <button className="admin-sidebar-close" onClick={() => setOpen(false)} aria-label="Stäng"><X size={17} /></button>
        </div>

        <div className="admin-environment"><span /><div><strong>Produktion</strong><small>System online</small></div></div>

        <nav className="admin-navigation" aria-label="Adminnavigation">
          <p>Kontrollcenter</p>
          {navigation.map(({ href, label, description, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact)
            return (
              <Link key={href} href={href} className={active ? 'active' : ''} onClick={() => setOpen(false)}>
                <span className="admin-nav-icon"><Icon size={16} /></span>
                <span className="admin-nav-copy"><strong>{label}</strong><small>{description}</small></span>
                <ChevronRight size={14} className="admin-nav-arrow" />
              </Link>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-avatar">{profile.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'A'}</div>
          <div><strong>{profile.name || 'Administratör'}</strong><small>Full åtkomst</small></div>
          <Link href="/" aria-label="Till Gonow"><ArrowLeft size={15} /></Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span>Operations /</span><strong>{current.label}</strong></div>
          <div className="admin-topbar-status"><Shield size={13} /><span>Skyddad session</span><i /></div>
        </header>
        <div className="admin-workspace">{children}</div>
      </main>
    </div>
  )
}
