export async function sendSmsNotification(to: string, message: string): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('[SMS skippat — env saknas]', { to, message })
    return
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`
    const body = new URLSearchParams({
      From: process.env.TWILIO_PHONE_NUMBER,
      To: to,
      Body: message,
    })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[SMS fel]', err)
    }
  } catch (err) {
    console.error('[SMS exception]', err)
  }
}

export async function sendPushNotification(userId: string, title: string, body: string): Promise<void> {
  if (!process.env.FIREBASE_SERVER_KEY) {
    console.log('[Push skippat — env saknas]', { userId, title, body })
    return
  }
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: `/topics/user_${userId}`,
        notification: { title, body },
        data: { userId },
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Push fel]', err)
    }
  } catch (err) {
    console.error('[Push exception]', err)
  }
}
