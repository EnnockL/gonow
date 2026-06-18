'use client'

import { useState } from 'react'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { clearDemoLocalData, seedDemoLocalData } from '@/lib/demo-data'

export default function DemoDataPanel() {
  const [message, setMessage] = useState<string | null>(null)

  function handleSeed() {
    seedDemoLocalData()
    setMessage('Demo-data inlagd. Du kan nu testa pending → acceptera/avboj.')
  }

  function handleClear() {
    clearDemoLocalData()
    setMessage('Demo-data rensad.')
  }

  return (
    <div
      className="card-sm"
      style={{
        borderRadius: 20,
        padding: 18,
        border: '1px solid var(--enterprise-panel-border)',
        background: 'var(--enterprise-panel-soft-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <Database size={16} />
        </div>
        <div>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Demo-data
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.55 }}>
            Lagger in lokala testresor och bokningsforfragan sa att du kan prova godkann-flodet direkt.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={handleSeed}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            color: '#0a0a0a',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={13} />
          Fyll demo-data
        </button>
        <button
          onClick={handleClear}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Trash2 size={13} />
          Rensa
        </button>
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.55 }}>
        Testa sedan i `Mina resor` att expandera Kiruna → Lulea och klicka `Acceptera`.
      </p>

      {message && (
        <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text)', fontWeight: 500 }}>
          {message}
        </p>
      )}
    </div>
  )
}
