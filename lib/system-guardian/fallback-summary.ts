export interface GuardianSummaryEvent {
  severity: string
  source: string
  event_type: string
  message: string
}

export function buildGuardianFallbackSummary(events: GuardianSummaryEvent[]): string {
  if (events.length === 0) {
    return 'Inga olösta händelser de senaste 2 timmarna. Den regelbaserade kontrollen visar normal drift.'
  }

  const critical = events.filter(event => event.severity === 'critical')
  const warnings = events.filter(event => event.severity === 'warning')
  const primary = critical[0] ?? warnings[0] ?? events[0]
  const affected = [...new Set(events.map(event => event.source).filter(Boolean))].slice(0, 3)
  const level = critical.length > 0 ? `${critical.length} kritiska händelser` : `${warnings.length} varningar`

  return [
    `Regelbaserad driftanalys: ${level} och ${events.length} olösta händelser totalt.`,
    `Prioritera: ${primary.message}`,
    affected.length > 0 ? `Berörda källor: ${affected.join(', ')}.` : '',
    'Rekommenderat: kontrollera den senaste händelsen, verifiera det berörda flödet och eskalera manuellt om felet kvarstår.',
  ].filter(Boolean).join(' ')
}
