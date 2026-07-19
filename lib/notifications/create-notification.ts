import { createServiceClient } from '@/lib/supabase'

interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  message: string
  relatedType?: string
  relatedId?: string
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedType,
  relatedId,
}: CreateNotificationInput): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
    })
  } catch (err) {
    console.error('[createNotification]', err)
  }
}
