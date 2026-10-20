import { describe, expect, it } from 'vitest'
import { parseCurrencyCode, parseIsoDate, parseOptionalText } from './input.ts'

describe('field input parsing', () => {
  it('parses dates and rejects calendar dates that do not exist', () => {
    expect(parseIsoDate('2022-01-04')).toEqual({
      status: 'ok',
      value: '2022-01-04',
    })
    expect(parseIsoDate('')).toEqual({ status: 'empty' })
    expect(parseIsoDate('04.01.2022').status).toBe('invalid')
    expect(parseIsoDate('2022-02-31').status).toBe('invalid')
  })

  it('accepts a 3-letter currency code and does not invent one for a blank field', () => {
    expect(parseCurrencyCode('bam')).toEqual({ status: 'ok', value: 'BAM' })
    expect(parseCurrencyCode('')).toEqual({ status: 'empty' })
    expect(parseCurrencyCode('dollar').status).toBe('invalid')
    expect(parseOptionalText('  ')).toEqual({ status: 'empty' })
    expect(parseOptionalText(' KO ')).toEqual({ status: 'ok', value: 'KO' })
  })
})
