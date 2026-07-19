import { NextResponse } from 'next/server'

export async function PATCH() {
  return NextResponse.json(
    { error: 'Utbetalningsstatus uppdateras endast av betalningsleverantörens verifierade webhook.' },
    { status: 405, headers: { Allow: 'GET' } },
  )
}
