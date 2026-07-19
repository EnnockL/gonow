import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `Payout-${crypto.randomBytes(18).toString('base64url')}!`
const runId = crypto.randomUUID()
const users = []
let packageId = null
let orderId = null

async function makeUser(role) {
  const email = `codex-payout-${role}-${runId}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error(`Kunde inte skapa ${role}.`)
  users.push(data.user.id)
  await admin.from('users').insert({ id: data.user.id, email, name: `QA ${role}`, phone: '0700000000' })
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password })
  if (loginError || !login.session) throw loginError ?? new Error(`Kunde inte logga in ${role}.`)
  return { id: data.user.id, token: login.session.access_token }
}

const call = async (path, token, init = {}) => {
  const response = await fetch(`http://localhost:3000${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  return { response, json: await response.json().catch(() => ({})) }
}

try {
  const [sender, driver, outsider] = await Promise.all([makeUser('sender'), makeUser('driver'), makeUser('outsider')])
  const { data: pkg, error: packageError } = await admin.from('packages').insert({
    sender_id: sender.id, matched_carrier_id: driver.id, status: 'delivered', from_city: 'Örebro', from_address: 'Örebro',
    to_city: 'Umeå', to_address: 'Umeå', description: 'Payoutkontroll', weight_kg: 2,
    receiver_name: 'QA mottagare', receiver_phone: '0700000001', delivery_confirmed_at: new Date().toISOString(),
  }).select('id').single()
  if (packageError || !pkg) throw packageError ?? new Error('Kunde inte skapa paket.')
  packageId = pkg.id

  const { data: order, error: orderError } = await admin.from('orders').insert({
    sender_id: sender.id, receiver_id: driver.id, type: 'package', description: 'Payoutkontroll',
    pickup_address: 'Örebro', dropoff_address: 'Umeå', price: 200, commission: 30, carrier_payout: 170,
    status: 'delivered', metadata: { package_id: packageId, source: 'package_match' },
  }).select('id').single()
  if (orderError || !order) throw orderError ?? new Error('Kunde inte skapa order.')
  orderId = order.id

  const confirm = await call(`/api/packages/${packageId}/confirm`, sender.token, { method: 'POST' })
  const retry = await call(`/api/packages/${packageId}/confirm`, sender.token, { method: 'POST' })
  if (!confirm.response.ok || confirm.json.package?.status !== 'confirmed') throw new Error(`Paketet kunde inte bekräftas: ${confirm.response.status} ${JSON.stringify(confirm.json)}`)
  if (!retry.response.ok || retry.json.reused !== true) throw new Error('Dubbel leveransbekräftelse var inte idempotent.')

  const { data: syncedOrder } = await admin.from('orders').select('status, metadata, carrier_payout').eq('id', orderId).single()
  if (syncedOrder?.status !== 'confirmed' || syncedOrder.metadata?.package_id !== packageId) throw new Error('Ordern tappade paketkopplingen vid confirmed.')

  const first = await call('/api/payouts', driver.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId }),
  })
  const second = await call('/api/payouts', driver.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId }),
  })
  if (!first.response.ok || !first.json.payout?.id || Number(first.json.payout.amount) !== 170) throw new Error('Rätt payout skapades inte.')
  if (!second.response.ok || second.json.payout?.id !== first.json.payout.id || second.json.reused !== true) throw new Error('Payout-retry skapade en dublett.')

  const forbidden = await call(`/api/payouts/${first.json.payout.id}`, outsider.token, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }),
  })
  if (forbidden.response.status !== 405) throw new Error('Klienten kunde fortfarande ändra payout-status manuellt.')

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const webhookPayload = JSON.stringify({
    id: `evt_${runId.replaceAll('-', '')}`,
    object: 'event',
    type: 'payout.paid',
    data: { object: { id: `po_${runId.replaceAll('-', '')}`, object: 'payout', status: 'paid', metadata: { payout_id: first.json.payout.id, order_id: orderId } } },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload: webhookPayload, secret: env.STRIPE_WEBHOOK_SECRET })
  const webhook = await fetch('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body: webhookPayload,
  })
  const { data: paidPayout } = await admin.from('payouts').select('status, paid_at').eq('id', first.json.payout.id).single()
  if (!webhook.ok || paidPayout?.status !== 'paid' || !paidPayout.paid_at) throw new Error(`Signerad payout.paid-webhook slutförde inte payouten: ${webhook.status} ${JSON.stringify(paidPayout)}`)

  console.log(JSON.stringify({ ok: true, packageAndOrderConfirmedTogether: true, confirmationIdempotent: true, payoutAmountCorrect: true, payoutIdempotent: true, clientPayoutCompletionBlocked: true, signedWebhookCompletedPayout: true }))
} finally {
  if (orderId) {
    await admin.from('escrow_ledger').delete().eq('order_id', orderId)
    await admin.from('payouts').delete().eq('order_id', orderId)
    await admin.from('orders').delete().eq('id', orderId)
  }
  if (packageId) {
    await admin.from('notifications').delete().eq('related_id', packageId)
    await admin.from('packages').delete().eq('id', packageId)
  }
  for (const id of users) {
    await admin.from('users').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
}
