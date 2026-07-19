import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { notify } from '@/lib/notify'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

type ConversationRow = {
  id: string
  context_type: string
  context_id: string
  participant_a: string
  participant_b: string
  last_message_at: string | null
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  created_at: string
  read_at?: string | null
}

async function resolveConversationId(params: {
  supabase: ReturnType<typeof createServiceClient>
  senderId: string
  receiverId: string
  tripId?: string | null
  conversationId?: string | null
}) {
  const { supabase, senderId, receiverId, tripId, conversationId } = params

  if (conversationId) return conversationId

  if (tripId) {
    const { data: existingByTrip } = await supabase
      .from('conversations')
      .select('id')
      .eq('context_id', tripId)
      .or(
        `and(participant_a.eq.${senderId},participant_b.eq.${receiverId}),` +
        `and(participant_a.eq.${receiverId},participant_b.eq.${senderId})`,
      )
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (existingByTrip?.id) return existingByTrip.id
  }

  const { data: latestConv } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_a.eq.${senderId},participant_b.eq.${receiverId}),` +
      `and(participant_a.eq.${receiverId},participant_b.eq.${senderId})`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestConv?.id) return latestConv.id

  const contextType = tripId ? 'delivery' : 'message'
  const contextId = tripId ?? `${senderId}:${receiverId}`
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      context_type: contextType,
      context_id: contextId,
      participant_a: senderId,
      participant_b: receiverId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return created.id as string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const { receiver_id, trip_id, conversation_id, content } = await req.json()
    const sender_id = user.id
    if (!receiver_id || !content?.trim()) {
      return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })
    }

    const supabase = createServiceClient()
    if (conversation_id) {
      const { data: requestedConversation } = await supabase
        .from('conversations')
        .select('participant_a, participant_b')
        .eq('id', conversation_id)
        .maybeSingle()
      if (!requestedConversation ||
          ![requestedConversation.participant_a, requestedConversation.participant_b].includes(sender_id) ||
          ![requestedConversation.participant_a, requestedConversation.participant_b].includes(receiver_id)) {
        return NextResponse.json({ error: 'Du har inte tillgång till konversationen.' }, { status: 403 })
      }
    }
    const text = content.trim()
    const convId = await resolveConversationId({
      supabase,
      senderId: sender_id,
      receiverId: receiver_id,
      tripId: trip_id ?? null,
      conversationId: conversation_id ?? null,
    })

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id, body: text })
      .select('id, conversation_id, sender_id, body, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('conversations')
      .update({ last_message: text, last_message_at: new Date().toISOString() })
      .eq('id', convId)

    const { data: sender } = await supabase.from('users').select('name').eq('id', sender_id).single()
    notify({
      user_id: receiver_id,
      type: 'message',
      title: `Nytt meddelande från ${sender?.name ?? 'Gonow'}`,
      message: text.slice(0, 80),
      related_type: 'conversation',
      related_id: convId,
    }).catch(() => {})

    return NextResponse.json({
      id: data.id,
      conversation_id: convId,
      message: {
        id: data.id,
        sender_id,
        receiver_id,
        content: data.body ?? text,
        trip_id: trip_id ?? null,
        created_at: data.created_at,
      },
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()
  const { searchParams } = new URL(req.url)
  const userId = user.id
  const withId = searchParams.get('with')

  const supabase = createServiceClient()

  if (withId) {
    const { data: convRows, error: convErr } = await supabase
      .from('conversations')
      .select('id, context_type, context_id, participant_a, participant_b, last_message_at')
      .or(
        `and(participant_a.eq.${userId},participant_b.eq.${withId}),` +
        `and(participant_a.eq.${withId},participant_b.eq.${userId})`,
      )
      .order('last_message_at', { ascending: true, nullsFirst: true })

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

    const convs = (convRows ?? []) as ConversationRow[]
    if (convs.length === 0) return NextResponse.json({ messages: [] })

    const convIds = convs.map((conv) => conv.id)
    const contextByConv = new Map(convs.map((conv) => [conv.id, conv.context_id]))

    const { data: rows, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at, read_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const messages = ((rows ?? []) as MessageRow[]).map((row) => ({
      id: row.id,
      sender_id: row.sender_id,
      receiver_id: row.sender_id === userId ? withId : userId,
      content: row.body ?? '',
      trip_id: contextByConv.get(row.conversation_id) ?? null,
      created_at: row.created_at,
      read_at: row.read_at ?? null,
      conversation_id: row.conversation_id,
    }))

    return NextResponse.json({ messages })
  }

  const { data: userConversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
  if (conversationsError) return NextResponse.json({ error: conversationsError.message }, { status: 500 })
  const conversationIds = (userConversations ?? []).map((row: { id: string }) => row.id)
  if (conversationIds.length === 0) return NextResponse.json({ messages: [] })

  const { data: rows, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, read_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const messages = ((rows ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: null,
    content: row.body ?? '',
    trip_id: null,
    created_at: row.created_at,
    read_at: row.read_at ?? null,
    conversation_id: row.conversation_id,
  }))

  return NextResponse.json({ messages })
}
