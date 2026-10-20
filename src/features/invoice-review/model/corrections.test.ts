import { describe, expect, it } from 'vitest'
import { getInvoiceById } from '../data/invoices.ts'
import {
  applyBankAccountOverride,
  applyLineNumberOverride,
  applyNumberOverride,
  applyTextOverride,
  clearHeaderField,
  getEffectiveInvoice,
  type InvoiceReview,
} from './corrections.ts'

const NOW = '2026-10-20T12:00:00.000Z'

describe('invoice corrections', () => {
  it('updates the effective invoice without mutating the extraction', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const extractedVendor = original.fields.vendorName.value
    const extractedTotal = original.fields.totalAmount.value
    const extractedLineTotal = original.lineItems[0]?.lineTotal.value

    const review = applyTextOverride(
      undefined,
      original,
      'vendorName',
      'Corrected supplier',
      NOW,
    )
    const effective = getEffectiveInvoice(original, review)

    expect(effective.fields.vendorName).toBe('Corrected supplier')
    expect(original.fields.vendorName.value).toBe(extractedVendor)
    expect(effective.fields.totalAmount).toBe(extractedTotal)
    expect(effective.lineItems[0]?.lineTotal).toBe(extractedLineTotal)
    expect(getInvoiceById('inv-001')?.fields.vendorName.value).toBe(
      extractedVendor,
    )
  })

  it('restores the extracted value when the override is removed or repeated', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const edited = applyTextOverride(
      undefined,
      original,
      'vendorName',
      'Corrected supplier',
      NOW,
    )
    expect(clearHeaderField(edited, 'vendorName', NOW)).toBeUndefined()

    const same = applyNumberOverride(
      undefined,
      original,
      'totalAmount',
      original.fields.totalAmount.value,
      NOW,
    )
    expect(same).toBeUndefined()
  })

  it('keeps an explicit empty correction distinct from no correction', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const cleared = applyTextOverride(
      undefined,
      original,
      'invoiceNumber',
      null,
      NOW,
    )
    const effective = getEffectiveInvoice(original, cleared)

    expect(cleared?.overrides.header.invoiceNumber).toBeNull()
    expect(effective.fields.invoiceNumber).toBeNull()
    expect(original.fields.invoiceNumber.value).toBe('1-5/2022')
  })

  it('preserves bank account order when one entry changes', () => {
    const original = getInvoiceById('inv-003')
    if (!original) throw new Error('Missing inv-003')
    const source = original.fields.bankAccounts.value
    expect(source).toHaveLength(7)

    const review = applyBankAccountOverride(
      undefined,
      original,
      1,
      'CHANGED',
      NOW,
    )
    const accounts = getEffectiveInvoice(original, review).fields.bankAccounts

    expect(accounts).toHaveLength(7)
    expect(accounts[0]).toBe(source[0])
    expect(accounts[1]).toBe('CHANGED')
    expect(accounts[6]).toBe(source[6])
    expect([...source]).toEqual([...original.fields.bankAccounts.value])
  })

  it('isolates a line-item edit and does not recalculate other amounts', () => {
    const original = getInvoiceById('inv-003')
    if (!original) throw new Error('Missing inv-003')
    const first = original.lineItems[0]
    const second = original.lineItems[1]
    if (!first || !second) throw new Error('Expected two lines')

    const review = applyLineNumberOverride(
      undefined,
      original,
      first.id,
      'quantity',
      2.5,
      NOW,
    )
    const otherInvoice = applyLineNumberOverride(
      undefined,
      original,
      'inv-002:0',
      'quantity',
      9,
      NOW,
    )
    const effective = getEffectiveInvoice(original, review)

    expect(otherInvoice).toBeUndefined()
    expect(effective.lineItems[0]?.quantity).toBe(2.5)
    expect(effective.lineItems[0]?.lineTotal).toBe(first.lineTotal.value)
    expect(effective.lineItems[0]?.unitPrice).toBe(first.unitPrice.value)
    expect(effective.lineItems[1]?.quantity).toBe(second.quantity.value)
    expect(effective.fields.totalAmount).toBe(original.fields.totalAmount.value)
    expect(first.quantity.value).not.toBe(2.5)
  })

  it('rejects edits once a review is no longer pending', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const confirmed: InvoiceReview = {
      status: 'confirmed',
      overrides: { header: {}, lines: {} },
      updatedAt: NOW,
    }
    const setAside: InvoiceReview = {
      status: 'set_aside',
      overrides: { header: {}, lines: {} },
      setAsideReason: 'Waiting for the original',
      updatedAt: NOW,
    }

    expect(
      applyTextOverride(confirmed, original, 'vendorName', 'Changed', NOW),
    ).toBe(confirmed)
    expect(
      applyLineNumberOverride(
        setAside,
        original,
        original.lineItems[0]?.id ?? '',
        'quantity',
        4,
        NOW,
      ),
    ).toBe(setAside)
  })
})
