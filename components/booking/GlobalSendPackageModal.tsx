'use client'

import { useEffect, useState } from 'react'
import TripBookingModal from './TripBookingModal'

export default function GlobalSendPackageModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openPackageFlow = () => {
      setOpen(true)
    }

    window.addEventListener('gonow_open_package_booking', openPackageFlow)
    return () => {
      window.removeEventListener('gonow_open_package_booking', openPackageFlow)
    }
  }, [])

  if (!open) return null
  return <TripBookingModal trip={{ id: 'quick-package', from: 'Sverige', to: 'Sverige', carrier: 'Gonow', price: 0 }} onClose={() => setOpen(false)} initialType="package" lockType entryMode="package" createWithoutTrip />
}
