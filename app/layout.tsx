import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ChatWidgetLoader from '@/components/layout/ChatWidgetLoader'
import GlobalSendPackageModal from '@/components/booking/GlobalSendPackageModal'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gonow - Nagon kor redan din vag',
  description:
    'Gonow samordnar transporter fr?n bokning till leverans. Skicka paket, h?mta butiksorders och dela resor i en sammanh?ngande upplevelse.',
  openGraph: {
    title: 'Gonow - Nagon kor redan din vag',
    description:
      'Gonow tar ansvar f?r transporten fr?n bokning till leverans. Trygg betalning, sp?rning och bekr?ftad leverans i samma resa.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={geist.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
        <Footer />
        <GlobalSendPackageModal />
        <ChatWidgetLoader />
      </body>
    </html>
  )
}
