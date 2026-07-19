import https from 'https'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const BASE_URL = process.env.BANKID_API_URL ?? 'https://appapi2.test.bankid.com/rp/v6.0'
const CERT_PATH = process.env.BANKID_CERT_PATH ?? './certs/bankid-test.p12'
const PASSPHRASE = process.env.BANKID_CERT_PASSPHRASE ?? 'qwerty123'
const LIB_DIR = path.dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = path.resolve(LIB_DIR, '..', 'certs')
const DEFAULT_CERT_FILE = path.join(CERTS_DIR, 'bankid-test.p12')

let cachedPfx: Buffer | null = null

function resolveCertPath() {
  if (!CERT_PATH || CERT_PATH === './certs/bankid-test.p12' || CERT_PATH === 'certs/bankid-test.p12') {
    return DEFAULT_CERT_FILE
  }

  if (path.isAbsolute(CERT_PATH)) {
    return CERT_PATH
  }

  return path.join(CERTS_DIR, path.basename(CERT_PATH))
}

function getPfx() {
  if (cachedPfx) return cachedPfx
  cachedPfx = fs.readFileSync(resolveCertPath())
  return cachedPfx
}

function getAgent() {
  return new https.Agent({
    pfx: getPfx(),
    passphrase: PASSPHRASE,
    rejectUnauthorized: false, // test CA not trusted by default
  })
}

async function call(endpoint: string, body: object) {
  const agent = getAgent()
  const url = `${BASE_URL}/${endpoint}`
  const data = JSON.stringify(body)

  return new Promise<{ ok: boolean; status: number; data: unknown }>((resolve, reject) => {
    const parsed = new URL(url)
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      pfx: (agent as unknown as { options: { pfx: Buffer } }).options.pfx,
      passphrase: PASSPHRASE,
      rejectUnauthorized: false,
    }

    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try {
          resolve({ ok: (res.statusCode ?? 0) < 400, status: res.statusCode ?? 0, data: JSON.parse(raw) })
        } catch {
          resolve({ ok: false, status: res.statusCode ?? 0, data: raw })
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

export type BankIDAuthResponse = {
  orderRef: string
  autoStartToken: string
  qrStartToken: string
  qrStartSecret: string
}

export type BankIDCollectResponse = {
  orderRef: string
  status: 'pending' | 'failed' | 'complete'
  hintCode?: string
  completionData?: {
    user: { personalNumber: string; name: string; givenName: string; surname: string }
    device: { ipAddress: string; uhi?: string }
    bankIdIssueDate: string
    signature: string
    ocspResponse: string
  }
}

export async function bankidAuth(endUserIp: string): Promise<BankIDAuthResponse> {
  const res = await call('auth', { endUserIp })
  if (!res.ok) throw new Error(`BankID auth failed: ${JSON.stringify(res.data)}`)
  return res.data as BankIDAuthResponse
}

export async function bankidCollect(orderRef: string): Promise<BankIDCollectResponse> {
  const res = await call('collect', { orderRef })
  if (!res.ok) throw new Error(`BankID collect failed: ${JSON.stringify(res.data)}`)
  return res.data as BankIDCollectResponse
}

export async function bankidCancel(orderRef: string): Promise<void> {
  await call('cancel', { orderRef })
}

// Animated QR code: regenerate every second
export function generateQrContent(qrStartToken: string, qrStartSecret: string, seconds: number): string {
  const qrAuthCode = crypto
    .createHmac('sha256', qrStartSecret)
    .update(String(seconds))
    .digest('hex')
  return `bankid.${qrStartToken}.${seconds}.${qrAuthCode}`
}
