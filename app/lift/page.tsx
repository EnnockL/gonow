import { redirect } from 'next/navigation'

export default function LiftRedirect() {
  redirect('/skicka?tab=lift')
}
