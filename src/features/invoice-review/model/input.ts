export type TextParse = { status: 'empty' } | { status: 'ok'; value: string }

export type FieldParse =
  | { status: 'empty' }
  | { status: 'ok'; value: string }
  | { status: 'invalid'; message: string }

const DATE_MESSAGE = 'Enter the date as YYYY-MM-DD.'
const CURRENCY_MESSAGE =
  'Enter a 3-letter currency code, or leave the field empty.'

export function parseOptionalText(raw: string): TextParse {
  const trimmed = raw.trim()
  if (trimmed === '') return { status: 'empty' }
  return { status: 'ok', value: trimmed }
}

export function parseIsoDate(raw: string): FieldParse {
  const trimmed = raw.trim()
  if (trimmed === '') return { status: 'empty' }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return { status: 'invalid', message: DATE_MESSAGE }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  if (!real) return { status: 'invalid', message: DATE_MESSAGE }

  return { status: 'ok', value: trimmed }
}

export function parseCurrencyCode(raw: string): FieldParse {
  const trimmed = raw.trim()
  if (trimmed === '') return { status: 'empty' }
  if (!/^[A-Za-z]{3}$/.test(trimmed)) {
    return { status: 'invalid', message: CURRENCY_MESSAGE }
  }
  return { status: 'ok', value: trimmed.toUpperCase() }
}
