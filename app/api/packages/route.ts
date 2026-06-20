import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const deadline = searchParams.get('deadline')
    const supabase = createServiceClient()

    let query = supabase
      .from('packages')
      .select('*')
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (from) query = query.ilike('from_city', `%${from}%`)
    if (to) query = query.ilike('to_city', `%${to}%`)
    if (deadline) query = query.eq('deadline', deadline)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ packages: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createServiceClient()

    const weightKg = typeof body.weight_kg === 'number'
      ? body.weight_kg
      : parseFloat(String(body.weight_kg ?? '5').replace(/[^\d.]/g, '')) || 5

    const { data, error } = await supabase
      .from('packages')
      .insert({
        sender_id: body.sender_id ?? null,
        from_city: body.from_city,
        from_address: body.from_address ?? null,
        to_city: body.to_city,
        to_address: body.to_address ?? null,
        description: body.description,
        weight_kg: weightKg,
        is_fragile: body.is_fragile ?? false,
        deadline: body.deadline ?? 'flexible',
        price_ceiling: body.price_ceiling,
        status: 'open',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ package: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
