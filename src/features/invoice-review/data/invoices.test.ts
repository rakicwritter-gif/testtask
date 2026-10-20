import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getInvoiceById, invoices, clients } from './invoices.ts'
import rawDataset from './invoices.json' with { type: 'json' }
import type { OriginalInvoice } from '../model/types.ts'

const publicInvoicesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../public/invoices',
)

const invoiceIds = Array.from({ length: 25 }, (_, index) => {
  return `inv-${String(index + 1).padStart(3, '0')}`
})

describe('supplied invoices', () => {
  it('loads every invoice in source order for the two clients', () => {
    expect(invoices.map((invoice) => invoice.id)).toEqual(invoiceIds)
    expect(
      clients.map((client) => [client.id, client.name, client.taxId]),
    ).toEqual([
      ['bili-brig', 'BILI BRIG d.o.o. Grude', '4272080450006'],
      ['call-ero', 'CALL ERO d.o.o. Mostar', '4227805140002'],
    ])
    expect(getInvoiceById('inv-001')?.id).toBe('inv-001')
    expect(getInvoiceById('missing')).toBeUndefined()
  })

  it('leaves missing originals unavailable and resolves the files that exist', () => {
    const missingIds = ['inv-003', 'inv-005', 'inv-010', 'inv-016', 'inv-018']
    for (const id of missingIds) {
      const invoice = expectInvoice(id)
      expect(invoice.document).toBeNull()
      expect(invoice.originalFilename.trim()).not.toBe('')
    }

    const available = invoices.filter((invoice) => invoice.document !== null)
    expect(available).toHaveLength(20)
    for (const invoice of available) {
      const document = invoice.document
      if (!document) continue
      expect(document.url).toBe(`/invoices/${document.fileName}`)
      expect(document.sourcePath).toBe(`originals/${document.fileName}`)
      expect(existsSync(join(publicInvoicesDir, document.fileName))).toBe(true)
      expect(document.url).not.toContain(invoice.originalFilename)
    }
  })

  it('retains multi-page PDF metadata that matches the supplied files', () => {
    expect(expectInvoice('inv-011').document).toMatchObject({
      url: '/invoices/inv-011.pdf',
      mimeType: 'application/pdf',
      pages: 2,
      width: null,
      height: null,
    })
    expect(expectInvoice('inv-022').document).toMatchObject({
      url: '/invoices/inv-022.pdf',
      mimeType: 'application/pdf',
      pages: 2,
      width: null,
      height: null,
    })
    expect(
      countPdfPages(readFileSync(join(publicInvoicesDir, 'inv-011.pdf'))),
    ).toBe(2)
    expect(
      countPdfPages(readFileSync(join(publicInvoicesDir, 'inv-022.pdf'))),
    ).toBe(2)
    expect(expectInvoice('inv-001').document).toMatchObject({
      mimeType: 'image/jpeg',
      pages: 1,
      width: 1950,
      height: 2600,
    })
  })

  it('does not replace a missing currency or repair tax identifiers', () => {
    expect(expectInvoice('inv-006').fields.currency).toEqual({
      value: null,
      confidence: 0,
    })
    expect(expectInvoice('inv-007').fields.currency.value).toBeNull()
    expect(expectInvoice('inv-001').fields.currency.value).toBe('BAM')

    const inv021 = expectInvoice('inv-021')
    expect(inv021.fields.vendorTaxId.value).toBe('4227009870104')
    expect(inv021.fields.vendorVatId.value).toBe('227009870007')
    const inv025 = expectInvoice('inv-025')
    expect(inv025.fields.vendorTaxId.value).toBe('4272033700045')
    expect(inv025.fields.vendorVatId.value).toBe('272033700002')
  })

  it('preserves bank account arrays, unit text, and nullable line values', () => {
    const raw003 = rawDataset.invoices.find(
      (invoice) => invoice.id === 'inv-003',
    )
    const inv003 = expectInvoice('inv-003')
    expect(inv003.fields.bankAccounts.value).toEqual(
      raw003?.fields.bankAccounts.value,
    )
    expect(inv003.fields.bankAccounts.value).toHaveLength(7)

    const units = new Set(
      invoices.flatMap((invoice) =>
        invoice.lineItems.map((line) => line.unit.value),
      ),
    )
    expect(units.has('KOM')).toBe(true)
    expect(units.has('kom')).toBe(true)
    expect(units.has('Kom')).toBe(true)
    expect(units.has('KO')).toBe(true)
    expect(units.has(null)).toBe(true)

    const quantities = expectInvoice('inv-005').lineItems.map(
      (line) => line.quantity.value,
    )
    expect(quantities).toContain(28.04)
    expect(quantities).toContain(3.76)

    const prices = expectInvoice('inv-022').lineItems.map(
      (line) => line.unitPrice.value,
    )
    expect(prices).toEqual(expect.arrayContaining([0.2566, 0.1283, 0.0042]))
    expect(
      expectInvoice('inv-015').lineItems.some(
        (line) => line.unitPrice.value === null,
      ),
    ).toBe(true)
    expect(expectInvoice('inv-023').fields.invoiceNumber.value).toBeNull()
  })

  it('gives every line a stable invoice-scoped id', () => {
    const inv011 = expectInvoice('inv-011')
    expect(inv011.lineItems).toHaveLength(45)
    expect(inv011.lineItems[0]?.id).toBe('inv-011:0')
    expect(inv011.lineItems[44]?.id).toBe('inv-011:44')
    expect(expectInvoice('inv-001').lineItems[0]?.id).toBe('inv-001:0')
    expect(expectInvoice('inv-012').lineItems[0]?.id).toBe('inv-012:0')

    const ids = invoices.flatMap((invoice) =>
      invoice.lineItems.map((line) => line.id),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves line totals that do not share one net or gross meaning', () => {
    const inv001 = expectInvoice('inv-001')
    expect(sumLineCents(inv001)).toBe(toCents(inv001.fields.totalAmount.value))
    expect(sumLineCents(inv001)).not.toBe(
      toCents(inv001.fields.netAmount.value),
    )

    const inv002 = expectInvoice('inv-002')
    expect(sumLineCents(inv002)).toBe(toCents(inv002.fields.netAmount.value))
    expect(sumLineCents(inv002)).not.toBe(
      toCents(inv002.fields.totalAmount.value),
    )
    const discounted = inv002.lineItems.find(
      (line) => line.quantity.value === 24 && line.unitPrice.value === 1.48,
    )
    expect(discounted?.lineTotal.value).toBe(31.97)
    expect(toCents(24 * 1.48)).not.toBe(toCents(31.97))

    const inv019 = expectInvoice('inv-019')
    expect(
      sumLineCents(inv019) - toCents(inv019.fields.totalAmount.value),
    ).toBe(8)

    const inv023 = expectInvoice('inv-023')
    expect(sumLineCents(inv023)).toBe(toCents(inv023.fields.netAmount.value))
    expect(
      toCents(inv023.fields.netAmount.value + inv023.fields.vatAmount.value),
    ).not.toBe(toCents(inv023.fields.totalAmount.value))

    const inv006 = expectInvoice('inv-006')
    const inv007 = expectInvoice('inv-007')
    expect(inv006.client.id).toBe(inv007.client.id)
    expect(inv006.fields.vendorName.value).toBe(inv007.fields.vendorName.value)
    expect(inv006.fields.invoiceNumber.value).toBe(
      inv007.fields.invoiceNumber.value,
    )
    expect(inv006.document?.url).not.toBe(inv007.document?.url)

    const inv012 = expectInvoice('inv-012')
    expect(inv001.fields.totalAmount.value).toBe(
      inv012.fields.totalAmount.value,
    )
    expect(inv001.fields.invoiceNumber.value).not.toBe(
      inv012.fields.invoiceNumber.value,
    )
  })
})

function expectInvoice(id: string): OriginalInvoice {
  const invoice = getInvoiceById(id)
  expect(invoice).toBeDefined()
  if (!invoice) throw new Error(`Missing ${id}`)
  return invoice
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function sumLineCents(invoice: OriginalInvoice): number {
  return invoice.lineItems.reduce(
    (sum, line) => sum + toCents(line.lineTotal.value),
    0,
  )
}

function countPdfPages(contents: Buffer): number {
  const matches = contents.toString('latin1').match(/\/Type\s*\/Page(?!s)/g)
  return matches?.length ?? 0
}
