import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const runId = crypto.randomUUID()
const password = `Lifecycle-${crypto.randomBytes(18).toString('base64url')}!`
const users = []
const messages = []
let packageId = null

async function makeUser(role) {
  const email = `codex-lifecycle-${role}-${runId}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error(`Kunde inte skapa ${role}.`)
  const id = data.user.id
  users.push(id)
  const { error: profileError } = await admin.from('users').insert({ id, email, name: `QA ${role}`, phone: '0700000000' })
  if (profileError) throw profileError
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password })
  if (loginError || !login.session) throw loginError ?? new Error(`Kunde inte logga in ${role}.`)
  return { id, token: login.session.access_token }
}

const call = async (path, token, init = {}) => {
  const response = await fetch(`http://localhost:3000${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  const json = await response.json().catch(() => ({}))
  return { response, json }
}

try {
  const [sender, driver, outsider] = await Promise.all([makeUser('sender'), makeUser('driver'), makeUser('outsider')])
  const { data: pkg, error } = await admin.from('packages').insert({
    sender_id: sender.id, matched_carrier_id: driver.id, status: 'matched',
    from_city: 'Örebro', from_address: 'Örebro', to_city: 'Umeå', to_address: 'Umeå',
    description: 'Livscykelkontroll', weight_kg: 2, receiver_name: 'QA mottagare', receiver_phone: '0700000001',
  }).select('id').single()
  if (error || !pkg) throw error ?? new Error('Kunde inte skapa livscykelpaket.')
  packageId = pkg.id
  const conversationId = `package:${packageId}`

  const senderList = await call(`/api/packages?sender_id=${sender.id}`, sender.token)
  const driverList = await call(`/api/packages?carrier_id=${driver.id}&statuses=matched,paid,picked_up,in_transit,delivered`, driver.token)
  const outsiderList = await call(`/api/packages?sender_id=${sender.id}`, outsider.token)
  if (!senderList.response.ok || !senderList.json.packages?.some(item => item.id === packageId)) throw new Error('Kunden hittar inte paketet efter matchning.')
  if (!driverList.response.ok || !driverList.json.packages?.some(item => item.id === packageId)) throw new Error('Föraren hittar inte det matchade paketet.')
  if (outsiderList.response.status !== 403) throw new Error('En utomstående kunde läsa kundens paketlista.')

  const initialMessage = await call(`/api/conversations/${conversationId}/messages`, sender.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Följer samma paket hela vägen' }),
  })
  if (!initialMessage.response.ok) throw new Error('Pakettråden kunde inte startas.')
  messages.push(initialMessage.json.message.id)

  const forbiddenPayment = await call(`/api/packages/${packageId}/driver-status`, driver.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm_payment' }),
  })
  if (forbiddenPayment.response.status !== 400) throw new Error('Föraren kan fortfarande sätta betalningsstatus.')

  await admin.from('packages').update({ status: 'paid' }).eq('id', packageId)
  const expected = [['pickup', 'picked_up'], ['start_transit', 'in_transit'], ['deliver', 'delivered']]
  for (const [action, status] of expected) {
    const result = await call(`/api/packages/${packageId}/driver-status`, driver.token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (!result.response.ok || result.json.package?.id !== packageId || result.json.package?.status !== status) {
      throw new Error(`Statusövergången ${action} tappade paketidentiteten.`)
    }
    const thread = await call(`/api/conversations/${conversationId}/messages`, sender.token)
    if (!thread.response.ok || !thread.json.messages?.some(message => message.id === messages[0])) {
      throw new Error(`Pakettråden tappades vid status ${status}.`)
    }
  }

  const confirmed = await call(`/api/packages/${packageId}/confirm`, sender.token, { method: 'POST' })
  if (!confirmed.response.ok || confirmed.json.package?.id !== packageId || confirmed.json.package?.status !== 'confirmed') {
    throw new Error('Kundens leveransbekräftelse tappade paketidentiteten.')
  }
  const finalConversations = await call('/api/conversations', sender.token)
  if (!finalConversations.response.ok || !finalConversations.json.conversations?.some(conv => conv.id === conversationId)) {
    throw new Error('Meddelandetråden försvann efter slutförd leverans.')
  }

  console.log(JSON.stringify({ ok: true, samePackageThroughLifecycle: true, customerAndDriverCanFindPackage: true, paymentOwnedByPaymentFlow: true, conversationPersistedThroughConfirmed: true }))
} finally {
  for (const id of messages) await admin.from('messages').delete().eq('id', id)
  if (packageId) {
    await admin.from('notifications').delete().eq('related_id', packageId)
    await admin.from('packages').delete().eq('id', packageId)
  }
  for (const id of users) {
    await admin.from('users').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
}
