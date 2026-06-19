import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ChatWidgetLoader from '@/components/layout/ChatWidgetLoader'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gonow — Någon kör redan din väg',
  description:
    'P2P-logistik i Sverige. Skicka paket, hämta butiksorders och dela resor med folk som ändå åker samma väg.',
  openGraph: {
    title: 'Gonow — Någon kör redan din väg',
    description: 'P2P-logistik i Sverige. 60% billigare än DHL. BankID-verifierade bärare.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={geist.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Runs synchronously before React hydration — prevents theme flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})()` }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
        <Footer />
        <ChatWidgetLoader />
      </body>
    </html>
  )
}
