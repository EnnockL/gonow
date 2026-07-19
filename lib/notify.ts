import { createServiceClient } from './supabase'
import { reportEvent } from './system-guardian/report-event'

interface NotifyPayload {
  user_id: string
  type: string
  title: string
  message: string
  related_type?: string
  related_id?: string
}

export async function notify(payload: NotifyPayload) {
  try {
    const supabase = createServiceClient()
    await supabase.from('notifications').insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body: payload.message,
      data: payload.related_type || payload.related_id
        ? {
            related_type: payload.related_type ?? null,
            related_id: payload.related_id ?? null,
          }
        : null,
    })
  } catch (err) {
    console.error('[notify]', err)
    await reportEvent({
      severity: 'warning',
      source: 'notify',
      event_type: 'notification_failure',
      message: `Notis kunde inte skickas (${payload.type}): ${err instanceof Error ? err.message : String(err)}`,
      user_id: payload.user_id,
      metadata: { type: payload.type, related_type: payload.related_type, related_id: payload.related_id },
    })
  }
}

export async function notifyOrderStatus(
  orderId: string,
  status: string,
  senderId: string,
  carrierId: string | null,
) {
  const msgs: Record<string, { userId: string; title: string; message: string }[]> = {
    matched: [
      { userId: senderId, title: 'Bärare accepterade!', message: 'Din order har matchats med en bärare.' },
    ],
    picked_up: [
      { userId: senderId, title: 'Paketet är hämtat', message: 'Din bärare har hämtat paketet.' },
    ],
    in_transit: [
      { userId: senderId, title: 'Paketet är på väg', message: 'Leveransen är i gång.' },
    ],
    delivered: [
      { userId: senderId, title: 'Paketet levererat!', message: 'Bekräfta leveransen för att slutföra ordern.' },
    ],
    confirmed: [
      ...(carrierId ? [{ userId: carrierId, title: 'Betalning frigjord', message: 'Kunden har bekräftat leveransen.' }] : []),
    ],
  }

  const targets = msgs[status] ?? []
  await Promise.all(
    targets.map((t) =>
      notify({
        user_id: t.userId,
        type: `order_${status}`,
        title: t.title,
        message: t.message,
        related_type: 'order',
        related_id: orderId,
      }),
    ),
  )
}
