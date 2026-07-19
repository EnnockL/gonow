import { expirePendingMatches } from '@/lib/ai/match-expiry'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const result = await expirePendingMatches()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
