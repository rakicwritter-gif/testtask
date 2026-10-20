import { describe, expect, it } from 'vitest'
import {
  CURRENCY_NOT_DETECTED,
  formatAmount,
  formatInvoiceNumber,
  formatNumber,
  formatOptionalText,
  formatPercent,
} from './display.ts'

describe('display formatting', () => {
  it('keeps source precision and leaves a missing currency unnamed', () => {
    expect(formatNumber(0.2566)).toBe('0.2566')
    expect(formatNumber(13.1)).toBe('13.1')
    expect(formatNumber(16632.74)).toBe('16632.74')
    expect(formatAmount(85.56, null)).toBe('85.56')
    expect(formatAmount(359.99, 'BAM')).toBe('359.99 BAM')
    expect(formatAmount(85.56, null)).not.toContain('BAM')
    expect(CURRENCY_NOT_DETECTED).toBe('Currency not detected')
  })

  it('labels missing text, invoice numbers, and VAT rates', () => {
    expect(formatOptionalText(null)).toBe('Not detected')
    expect(formatOptionalText('   ')).toBe('Not detected')
    expect(formatOptionalText('KO')).toBe('KO')
    expect(formatInvoiceNumber(null)).toBe('No invoice number')
    expect(formatInvoiceNumber('1-41/22')).toBe('1-41/22')
    expect(formatPercent(null)).toBe('Not detected')
    expect(formatPercent(17)).toBe('17%')
  })
})
