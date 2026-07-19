import { useState, useCallback } from 'react'

export interface RouteResult {
  from:         { city: string; lat: number; lng: number }
  to:           { city: string; lat: number; lng: number }
  distance_km:  number
  duration_min: number
  price:        number
  commission:   number
  carrier_payout: number
  breakdown: {
    base_fee:       number
    km_fee:         number
    kg_fee:         number
    commission_pct: number
  }
}

export function useRoutePrice() {
  const [result,  setResult]  = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const calculate = useCallback(async (from: string, to: string, weight_kg = 1, urgency: 'today' | 'tomorrow' | 'flexible' = 'flexible') => {
    if (!from.trim() || !to.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const distRes = await fetch(`/api/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      const dist = await distRes.json()
      if (!distRes.ok) throw new Error(dist.error ?? 'Ruttfel')

      const priceRes = await fetch(`/api/price?distance_km=${dist.distance_km}&weight_kg=${weight_kg}&urgency=${urgency}`)
      const price = await priceRes.json()
      if (!priceRes.ok) throw new Error(price.error ?? 'Prisfel')

      setResult({ ...dist, ...price })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, calculate }
}
