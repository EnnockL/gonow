'use client'

import { Suspense, useEffect } from 'react'
import { SkickaPageContent } from '@/app/skicka/page'

export default function SkickaModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'var(--bg)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Suspense fallback={null}>
        <SkickaPageContent onClose={onClose} />
      </Suspense>
    </div>
  )
}
