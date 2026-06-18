'use client'

export type RoleIntent = 'sender' | 'carrier' | 'both'

export interface UserProfileMeta {
  city: string
  address: string
  bio: string
  role_intent: RoleIntent
  vehicle_make: string
  vehicle_model: string
  vehicle_color: string
  vehicle_plate: string
  vehicle_seats_total: number
}

const DEFAULT_META: UserProfileMeta = {
  city: '',
  address: '',
  bio: '',
  role_intent: 'sender',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_color: '',
  vehicle_plate: '',
  vehicle_seats_total: 4,
}

function key(userId: string) {
  return `gonow_profile_meta:${userId}`
}

export function getDefaultProfileMeta(): UserProfileMeta {
  return { ...DEFAULT_META }
}

export function loadUserProfileMeta(userId: string): UserProfileMeta {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return getDefaultProfileMeta()
    return { ...DEFAULT_META, ...JSON.parse(raw) }
  } catch {
    return getDefaultProfileMeta()
  }
}

export function saveUserProfileMeta(userId: string, meta: UserProfileMeta) {
  localStorage.setItem(key(userId), JSON.stringify(meta))
}

export function getProfileCompletion(meta: UserProfileMeta, profile: { name?: string; phone?: string; email?: string | null }) {
  const checks = [
    Boolean(profile.name?.trim()),
    Boolean(profile.phone?.trim()),
    Boolean(profile.email?.trim()),
    Boolean(meta.city.trim()),
    Boolean(meta.address.trim()),
  ]

  if (meta.role_intent === 'carrier' || meta.role_intent === 'both') {
    checks.push(
      Boolean(meta.vehicle_make.trim()),
      Boolean(meta.vehicle_model.trim()),
      Boolean(meta.vehicle_plate.trim()),
      meta.vehicle_seats_total > 0
    )
  }

  const completed = checks.filter(Boolean).length
  return Math.round((completed / checks.length) * 100)
}
