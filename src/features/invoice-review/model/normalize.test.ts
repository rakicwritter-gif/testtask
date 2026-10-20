import { describe, expect, it } from 'vitest'
import rawDataset from '../data/invoices.json' with { type: 'json' }
import {
  InvoiceDataError,
  normalizeDataset,
  normalizeInvoice,
  resolveOriginalDocumentUrl,
} from './normalize.ts'

type LooseRecord = Record<string, unknown>

function cloneDataset(): { invoices: LooseRecord[] } {
  return structuredClone(rawDataset) as { invoices: LooseRecord[] }
}

function firstInvoice(): LooseRecord {
  const invoice = cloneDataset().invoices[0]
  if (!invoice) throw new Error('Expected at least one invoice in the fixture.')
  return invoice
}

describe('resolveOriginalDocumentUrl', () => {
  it('maps a dataset path onto the public invoices folder', () => {
    expect(resolveOriginalDocumentUrl('originals/inv-001.jpg')).toBe(
      '/invoices/inv-001.jpg',
    )
    expect(resolveOriginalDocumentUrl('originals/inv-011.pdf')).toBe(
      '/invoices/inv-011.pdf',
    )
  })

  it('rejects empty paths and path traversal', () => {
    expect(() => resolveOriginalDocumentUrl('')).toThrow(InvoiceDataError)
    expect(() => resolveOriginalDocumentUrl('originals/../secret.pdf')).toThrow(
      InvoiceDataError,
    )
    expect(() => resolveOriginalDocumentUrl('originals/')).toThrow(
      InvoiceDataError,
    )
  })
})

describe('normalizeInvoice', () => {
  it('does not mutate the supplied record and freezes the result', () => {
    const dataset = cloneDataset()
    const before = JSON.stringify(dataset)
    const normalized = normalizeDataset(dataset)
    expect(JSON.stringify(dataset)).toBe(before)

    const invoice = normalized.invoices[0]
    expect(invoice).toBeDefined()
    if (!invoice) return
    expect(Object.isFrozen(invoice)).toBe(true)
    expect(Object.isFrozen(invoice.fields.bankAccounts.value)).toBe(true)
    expect(() => {
      const accounts = invoice.fields.bankAccounts.value as string[]
      accounts.push('extra-account')
    }).toThrow(TypeError)
  })

  it('keeps a cleared currency null instead of inventing one', () => {
    const invoice = firstInvoice()
    const fields = invoice.fields as LooseRecord
    const currency = fields.currency as LooseRecord
    currency.value = null
    currency.confidence = 0

    const normalized = normalizeInvoice(invoice)
    expect(normalized.fields.currency).toEqual({ value: null, confidence: 0 })
  })

  it('treats omitted document dimensions as unknown', () => {
    const invoice = firstInvoice()
    const original = invoice.original as LooseRecord
    delete original.width
    delete original.height

    const normalized = normalizeInvoice(invoice)
    expect(normalized.document?.width).toBeNull()
    expect(normalized.document?.height).toBeNull()
    expect(normalized.document?.pages).toBe(1)
  })

  it('keeps a missing original unavailable', () => {
    const invoice = firstInvoice()
    invoice.original = null
    invoice.originalFilename = 'Racun 1416-22 EDO-SLAD.pdf'

    const normalized = normalizeInvoice(invoice)
    expect(normalized.document).toBeNull()
    expect(normalized.originalFilename).toBe('Racun 1416-22 EDO-SLAD.pdf')
    expect(JSON.stringify(normalized)).not.toContain('/invoices/')
  })

  it('preserves bank account order and unit text on a copy', () => {
    const invoice = firstInvoice()
    const fields = invoice.fields as LooseRecord
    const bankAccounts = fields.bankAccounts as LooseRecord
    bankAccounts.value = ['second', 'first']
    const lineItems = invoice.lineItems as LooseRecord[]
    const unit = lineItems[0]?.unit as LooseRecord
    unit.value = 'KO'

    const normalized = normalizeInvoice(invoice)
    expect(normalized.fields.bankAccounts.value).toEqual(['second', 'first'])
    expect(normalized.fields.bankAccounts.value).not.toBe(bankAccounts.value)
    expect(normalized.lineItems[0]?.unit.value).toBe('KO')
  })

  it('scopes line identities to the invoice and source index', () => {
    const dataset = cloneDataset()
    const first = dataset.invoices[0]
    const second = dataset.invoices[1]
    if (!first || !second) throw new Error('Expected two invoices.')
    second.id = 'inv-099'
    first.lineItems = [lineItem('Eggs'), lineItem('Milk')]

    const normalized = normalizeDataset({ invoices: [first, second] })
    const invoice = normalized.byId.get('inv-001')
    const other = normalized.byId.get('inv-099')
    expect(invoice?.lineItems.map((line) => line.id)).toEqual([
      'inv-001:0',
      'inv-001:1',
    ])
    expect(other?.lineItems[0]?.id).toBe('inv-099:0')
    expect(other?.lineItems[0]?.id).not.toBe(invoice?.lineItems[0]?.id)
  })

  it('rejects duplicate invoice ids', () => {
    const dataset = cloneDataset()
    const first = dataset.invoices[0]
    const second = dataset.invoices[1]
    if (!first || !second) throw new Error('Expected two invoices.')
    second.id = first.id
    expect(() => normalizeDataset({ invoices: [first, second] })).toThrow(
      /Duplicate invoice id/,
    )
  })

  it('rejects a header field that is not in the extraction shape', () => {
    const invoice = firstInvoice()
    const fields = invoice.fields as LooseRecord
    delete fields.currency
    expect(() => normalizeInvoice(invoice)).toThrow(InvoiceDataError)
  })

  it('rejects bank accounts that are not an array of strings', () => {
    const invoice = firstInvoice()
    const fields = invoice.fields as LooseRecord
    const bankAccounts = fields.bankAccounts as LooseRecord
    bankAccounts.value = '1610200055610004'
    expect(() => normalizeInvoice(invoice)).toThrow(/array of strings/)
  })

  it('rejects a non-numeric amount instead of coercing it', () => {
    const invoice = firstInvoice()
    const fields = invoice.fields as LooseRecord
    const total = fields.totalAmount as LooseRecord
    total.value = '359,99'
    expect(() => normalizeInvoice(invoice)).toThrow(InvoiceDataError)
  })
})

function lineItem(description: string): LooseRecord {
  const invoice = firstInvoice()
  const source = (invoice.lineItems as LooseRecord[])[0]
  if (!source) throw new Error('Expected a source line item.')
  const copy = structuredClone(source)
  const descriptionField = copy.description as LooseRecord
  descriptionField.value = description
  return copy
}
