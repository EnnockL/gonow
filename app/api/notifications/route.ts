import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  const notifications = (data ?? []).map((row: {
    id: string
    type: string
    title: string
    body: string
    data?: { related_type?: string | null; related_id?: string | null } | null
    read: boolean
    created_at: string
  }) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.body,
    related_type: row.data?.related_type ?? null,
    related_id: row.data?.related_id ?? null,
    read_at: row.read ? row.created_at : null,
    created_at: row.created_at,
  }))
  const unread_count = notifications.filter((n: { read_at: string | null }) => !n.read_at).length

  return NextResponse.json({ notifications, unread_count })
}
