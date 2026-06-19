import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { sender_id, receiver_id, trip_id, content } = await req.json()
    if (!sender_id || !receiver_id || !content?.trim()) {
      return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })
    }
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id, receiver_id, trip_id: trip_id || null, content: content.trim() })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const withId = searchParams.get('with')
  if (!userId) return NextResponse.json({ error: 'user_id krävs' }, { status: 400 })
  const supabase = createServiceClient()

  if (withId) {
    // Thread between two users — fetch all messages involving either user, then filter in JS
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Keep only messages that are between exactly these two users
    const thread = (data ?? []).filter(
      (m: { sender_id: string; receiver_id: string }) =>
        (m.sender_id === userId && m.receiver_id === withId) ||
        (m.sender_id === withId && m.receiver_id === userId)
    )
    return NextResponse.json({ messages: thread })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}
