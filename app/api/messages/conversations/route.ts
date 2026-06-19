import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id krävs' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!messages || messages.length === 0) return NextResponse.json({ conversations: [] })

  // Group by the other user, keep latest message per conversation
  const convMap = new Map<string, { last_message: string; last_at: string; last_sender_id: string }>()
  for (const msg of messages) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
    if (!convMap.has(otherId)) {
      convMap.set(otherId, { last_message: msg.content, last_at: msg.created_at, last_sender_id: msg.sender_id })
    }
  }

  const otherIds = [...convMap.keys()]
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .in('id', otherIds)

  const userMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]))

  const conversations = otherIds.map(id => {
    const conv = convMap.get(id)!
    return {
      other_user_id: id,
      other_user_name: userMap.get(id) ?? 'Okänd',
      last_message: conv.last_message,
      last_at: conv.last_at,
      last_sender_id: conv.last_sender_id,
    }
  }).sort((a, b) => b.last_at.localeCompare(a.last_at))

  return NextResponse.json({ conversations })
}
