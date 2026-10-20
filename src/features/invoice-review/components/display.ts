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

export function formatPercent(value: number | null): string {
  if (value === null) return NOT_DETECTED
  return `${formatNumber(value)}%`
}
