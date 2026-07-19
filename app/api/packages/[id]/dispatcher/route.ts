import { createServiceClient } from '@/lib/supabase'
import { isValidTransition, type DispatcherStage } from '@/lib/ai/dispatcher-priority'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('packages')
      .select('id, dispatcher_stage, logistics_offer_expires_at, fallback_opened_at, assigned_provider_type, assigned_provider_id, from_city, to_city, status, created_at')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ dispatcher: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json() as { dispatcher_stage: DispatcherStage; assigned_provider_type?: string; assigned_provider_id?: string }
    const supabase = createServiceClient()

    const { data: pkg, error: fetchErr } = await supabase
      .from('packages')
      .select('dispatcher_stage')
      .eq('id', id)
      .single()

    if (fetchErr || !pkg) return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })

    const currentStage = (pkg.dispatcher_stage ?? 'logistics_first') as DispatcherStage
    const nextStage = body.dispatcher_stage

    if (!isValidTransition(currentStage, nextStage)) {
      return NextResponse.json(
        { error: `Ogiltig övergång: ${currentStage} → ${nextStage}` },
        { status: 409 },
      )
    }

    const update: Record<string, unknown> = { dispatcher_stage: nextStage }
    if (nextStage === 'private_fallback') update.fallback_opened_at = new Date().toISOString()
    if (nextStage === 'matched') {
      if (body.assigned_provider_type) update.assigned_provider_type = body.assigned_provider_type
      if (body.assigned_provider_id) update.assigned_provider_id = body.assigned_provider_id
    }

    const { data, error } = await supabase
      .from('packages')
      .update(update)
      .eq('id', id)
      .select('id, dispatcher_stage, logistics_offer_expires_at, fallback_opened_at, assigned_provider_type, assigned_provider_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ dispatcher: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
