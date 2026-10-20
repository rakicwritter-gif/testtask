export type DecimalParse =
  | { status: 'empty' }
  | { status: 'ok'; value: number }
  | { status: 'invalid'; message: string }

/**
 * Maximum fraction digits for each editable numeric field.
 * Limits follow the supplied dataset: quantities reach 2 places (inv-005),
 * unit prices reach 4 (inv-022), VAT rates are whole numbers, and
 * currency amounts and line totals use 2 places.
 */
export const DECIMAL_SCALE = {
  quantity: 2,
  unitPrice: 4,
  vatRate: 0,
  money: 2,
} as const

const AMBIGUOUS_SEPARATOR =
  'Enter one decimal separator. A dot or comma is the decimal mark, not a thousands separator.'

const MALFORMED_NUMBER =
  'Enter a number with digits, using either a decimal comma or a decimal point.'

export function parseDecimal(raw: string, scale: number): DecimalParse {
  const trimmed = raw.trim()
  if (trimmed === '') return { status: 'empty' }
  if (/[.,].*[.,]/.test(trimmed)) {
    return { status: 'invalid', message: AMBIGUOUS_SEPARATOR }
  }

  const match = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(trimmed)
  if (!match) return { status: 'invalid', message: MALFORMED_NUMBER }

  const fraction = match[3] ?? ''
  if (fraction.length > scale) {
    return { status: 'invalid', message: excessPrecision(scale) }
  }

  const numeric = Number(
    `${match[1]}${match[2]}${fraction ? `.${fraction}` : ''}`,
  )
  if (!Number.isFinite(numeric)) {
    return { status: 'invalid', message: MALFORMED_NUMBER }
  }

  return { status: 'ok', value: Object.is(numeric, -0) ? 0 : numeric }
}

function excessPrecision(scale: number): string {
  if (scale === 0) {
    return 'Enter a whole number. A separator here is a decimal mark, not a thousands separator.'
  }
  const places = scale === 1 ? '1 decimal place' : `${scale} decimal places`
  return `Use at most ${places}. A separator here is a decimal mark, not a thousands separator.`
}
