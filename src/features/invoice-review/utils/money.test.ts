import { describe, expect, it } from 'vitest'
import { DECIMAL_SCALE, parseDecimal } from './money.ts'

describe('parseDecimal', () => {
  it('accepts a decimal comma and a decimal point as the same value', () => {
    expect(parseDecimal('139,18', DECIMAL_SCALE.money)).toEqual({
      status: 'ok',
      value: 139.18,
    })
    expect(parseDecimal('139.18', DECIMAL_SCALE.money)).toEqual({
      status: 'ok',
      value: 139.18,
    })
    expect(parseDecimal(' 28,04 ', DECIMAL_SCALE.quantity)).toEqual({
      status: 'ok',
      value: 28.04,
    })
  })

  it('keeps 1.234 as a decimal and allows it only within the field scale', () => {
    expect(parseDecimal('1.234', DECIMAL_SCALE.unitPrice)).toEqual({
      status: 'ok',
      value: 1.234,
    })
    expect(parseDecimal('0,2566', DECIMAL_SCALE.unitPrice)).toEqual({
      status: 'ok',
      value: 0.2566,
    })
    expect(parseDecimal('1.234', DECIMAL_SCALE.money).status).toBe('invalid')
    expect(parseDecimal('1,234', DECIMAL_SCALE.money).status).toBe('invalid')
    expect(parseDecimal('17.5', DECIMAL_SCALE.vatRate).status).toBe('invalid')
    expect(parseDecimal('17', DECIMAL_SCALE.vatRate)).toEqual({
      status: 'ok',
      value: 17,
    })
  })

  it('rejects grouping separators, blanks, and malformed numbers without coercing them to zero', () => {
    expect(parseDecimal('1,234.56', DECIMAL_SCALE.money).status).toBe('invalid')
    expect(parseDecimal('1.234,56', DECIMAL_SCALE.money).status).toBe('invalid')
    expect(parseDecimal('', DECIMAL_SCALE.money)).toEqual({ status: 'empty' })
    expect(parseDecimal('   ', DECIMAL_SCALE.money)).toEqual({
      status: 'empty',
    })
    expect(parseDecimal('12.5.1', DECIMAL_SCALE.unitPrice).status).toBe(
      'invalid',
    )
    expect(parseDecimal('abc', DECIMAL_SCALE.money).status).toBe('invalid')
    expect(parseDecimal('1.', DECIMAL_SCALE.money).status).toBe('invalid')

    const rejected = parseDecimal('1.234', DECIMAL_SCALE.money)
    expect(rejected).not.toEqual({ status: 'ok', value: 0 })
    expect(rejected).not.toEqual({ status: 'ok', value: 1234 })
  })
})
