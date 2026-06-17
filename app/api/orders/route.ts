import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const supabase = createServiceClient()

  const query = supabase
    .from('orders')
    .select('*, trips(from_city, to_city, departure_at)')
    .order('created_at', { ascending: false })

  if (userId) {
    query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServiceClient()

  const commission = Math.round(body.price * 0.15)
  const carrier_payout = body.price - commission

  const { data, error } = await supabase
    .from('orders')
    .insert({ ...body, commission, carrier_payout })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data }, { status: 201 })
}
