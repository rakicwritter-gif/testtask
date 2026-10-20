export const CURRENCY_NOT_DETECTED = 'Currency not detected'
export const NOT_DETECTED = 'Not detected'
export const NO_INVOICE_NUMBER = 'No invoice number'
export const PENDING_STATUS = 'Pending'

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return NOT_DETECTED
  return Object.is(value, -0) ? '0' : String(value)
}

export function formatAmount(value: number, currency: string | null): string {
  const amount = formatNumber(value)
  return currency ? `${amount} ${currency}` : amount
}

export function formatOptionalText(value: string | null): string {
  if (value === null || value.trim() === '') return NOT_DETECTED
  return value
}

export function formatInvoiceNumber(value: string | null): string {
  if (value === null || value.trim() === '') return NO_INVOICE_NUMBER
  return value
}

export function formatReviewTimestamp(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
  if (!match) return value
  return `${match[1]} ${match[2]} UTC`
}

export function reviewStatusLabel(status: string | undefined): string {
  if (status === 'set_aside') return 'Set aside'
  if (status === 'confirmed') return 'Confirmed'
  return PENDING_STATUS
}

export function formatPercent(value: number | null): string {
  if (value === null) return NOT_DETECTED
  return `${formatNumber(value)}%`
}
