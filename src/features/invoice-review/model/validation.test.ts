import { describe, expect, it } from 'vitest'
import { getInvoiceById, invoices } from '../data/invoices.ts'
import type { OriginalInvoice } from './types.ts'
import {
  applyNumberOverride,
  applyTextOverride,
  getEffectiveInvoice,
  type InvoiceReview,
} from './corrections.ts'
import {
  attentionLabel,
  canConfirmInvoice,
  duplicateCandidate,
  getQueueGroup,
  normalizeIdentity,
  validateInvoice,
  type DuplicateCandidate,
  type ReviewIssue,
} from './validation.ts'

const NOW = '2026-10-20T00:00:00.000Z'

function issuesFor(
  id: string,
  reviews: Readonly<Record<string, InvoiceReview>> = {},
): ReviewIssue[] {
  const original = getInvoiceById(id)
  if (!original) throw new Error(`Missing ${id}`)
  return validateInvoice(getEffectiveInvoice(original, reviews[id]), {
    original,
    review: reviews[id],
    candidates: invoices.map((invoice) =>
      duplicateCandidate(invoice, reviews[invoice.id]),
    ),
  })
}

function codes(issues: readonly ReviewIssue[]): string[] {
  return issues.map((issue) => issue.code)
}

describe('validateInvoice', () => {
  it('flags inv-006 and inv-007 as possible duplicates without using the amount', () => {
    const issues = issuesFor('inv-006')
    const duplicate = issues.find(
      (issue) => issue.code === 'possible-duplicate',
    )

    expect(duplicate).toMatchObject({
      severity: 'warning',
      target: { type: 'invoice', invoiceId: 'inv-007' },
    })
    expect(duplicate?.message).toContain('currently Pending')
    expect(duplicate?.message).toContain('client, supplier, and invoice number')
    expect(
      issuesFor('inv-007').some(
        (issue) =>
          issue.target.type === 'invoice' &&
          issue.target.invoiceId === 'inv-006',
      ),
    ).toBe(true)
  })

  it('does not treat inv-001 and inv-012 as duplicates though their totals match', () => {
    const left = getInvoiceById('inv-001')
    const right = getInvoiceById('inv-012')
    expect(left?.fields.totalAmount.value).toBe(right?.fields.totalAmount.value)
    expect(codes(issuesFor('inv-001'))).not.toContain('possible-duplicate')
    expect(codes(issuesFor('inv-012'))).not.toContain('possible-duplicate')
  })

  it('matches only normalized supplier and invoice number, not diacritics, quotes, or amount', () => {
    const loaded = getInvoiceById('inv-001')
    if (!loaded) throw new Error('Missing inv-001')
    const source: OriginalInvoice = loaded
    const effective = getEffectiveInvoice(source, undefined)
    const vendor = effective.fields.vendorName ?? ''
    const invoiceNumber = effective.fields.invoiceNumber ?? ''
    const sameClient = source.client.id

    function candidates(extra: DuplicateCandidate[]): ReviewIssue[] {
      return validateInvoice(effective, {
        original: source,
        review: undefined,
        candidates: [
          {
            id: source.id,
            clientId: sameClient,
            vendorName: vendor,
            invoiceNumber,
            status: 'pending',
          },
          ...extra,
        ],
      })
    }

    const match = candidates([
      {
        id: 'other',
        clientId: sameClient,
        vendorName: `  ${vendor.toUpperCase().replace(/ /g, '   ')} `,
        invoiceNumber: ` ${invoiceNumber.toLowerCase()} `,
        status: 'set_aside',
      },
    ])
    expect(
      match.find((issue) => issue.code === 'possible-duplicate')?.message,
    ).toContain('currently Set aside')

    expect(
      codes(
        candidates([
          {
            id: 'other',
            clientId: sameClient,
            vendorName: vendor.replace('Č', 'C'),
            invoiceNumber,
            status: 'pending',
          },
        ]),
      ),
    ).not.toContain('possible-duplicate')

    expect(
      codes(
        candidates([
          {
            id: 'other',
            clientId: sameClient,
            vendorName: vendor.replaceAll('"', ''),
            invoiceNumber,
            status: 'pending',
          },
        ]),
      ),
    ).not.toContain('possible-duplicate')

    expect(
      codes(
        candidates([
          {
            id: 'other',
            clientId: 'call-ero',
            vendorName: vendor,
            invoiceNumber,
            status: 'confirmed',
          },
        ]),
      ),
    ).not.toContain('possible-duplicate')

    expect(normalizeIdentity('  ')).toBeNull()
    expect(normalizeIdentity(null)).toBeNull()
  })

  it('drops a duplicate when a correction changes the effective invoice number', () => {
    const original = getInvoiceById('inv-006')
    if (!original) throw new Error('Missing inv-006')
    const review = applyTextOverride(
      undefined,
      original,
      'invoiceNumber',
      '1-41/22-checked',
      NOW,
    )
    expect(review).toBeDefined()
    const reviews = { 'inv-006': review as InvoiceReview }

    expect(codes(issuesFor('inv-006', reviews))).not.toContain(
      'possible-duplicate',
    )
    expect(codes(issuesFor('inv-007', reviews))).not.toContain(
      'possible-duplicate',
    )
    expect(original.fields.invoiceNumber.value).toBe('1-41/22')
  })

  it('warns on the eleven low-confidence header fields of inv-006 and ignores null optionals', () => {
    const issues = issuesFor('inv-006')
    const headerFields = issues
      .filter(
        (issue) =>
          issue.code === 'low-confidence' && issue.target.type === 'field',
      )
      .map((issue) => (issue.target.type === 'field' ? issue.target.field : ''))

    expect(headerFields).toEqual([
      'vendorName',
      'vendorTaxId',
      'vendorVatId',
      'buyerName',
      'buyerTaxId',
      'invoiceNumber',
      'issueDate',
      'netAmount',
      'vatAmount',
      'totalAmount',
      'bankAccounts',
    ])
    expect(issues.every((issue) => issue.severity !== 'info')).toBe(true)
    expect(headerFields).not.toContain('currency')
    expect(headerFields).not.toContain('paymentReference')
    expect(headerFields).not.toContain('supplyDate')
    expect(headerFields).not.toContain('dueDate')
    expect(
      issues.filter(
        (issue) =>
          issue.code === 'low-confidence' && issue.target.type === 'line',
      ).length,
    ).toBeGreaterThan(0)
    expect(new Set(issues.map((issue) => issue.id)).size).toBe(issues.length)
  })

  it('removes the low-confidence warning for a field once it is corrected', () => {
    const original = getInvoiceById('inv-006')
    if (!original) throw new Error('Missing inv-006')
    const review = applyTextOverride(
      undefined,
      original,
      'vendorName',
      'Checked supplier',
      NOW,
    )
    const issues = issuesFor('inv-006', { 'inv-006': review as InvoiceReview })
    expect(
      issues.some(
        (issue) =>
          issue.target.type === 'field' && issue.target.field === 'vendorName',
      ),
    ).toBe(false)
    expect(original.fields.vendorName.value).toContain('IVA KOLAČI')
    expect(
      issues.find((issue) => issue.code === 'low-confidence')?.severity,
    ).toBe('warning')
  })

  it('blocks missing originals and leaves those invoices unconfirmable', () => {
    for (const id of ['inv-003', 'inv-005', 'inv-010', 'inv-016', 'inv-018']) {
      const issues = issuesFor(id)
      expect(issues[0]).toMatchObject({
        code: 'missing-document',
        severity: 'blocking',
        target: { type: 'document' },
      })
      expect(canConfirmInvoice(issues, false)).toBe(false)
    }
  })

  it('blocks a missing invoice number and warns, without blocking, when net plus VAT differs from the total', () => {
    const issues = issuesFor('inv-023')
    const missing = issues.find(
      (issue) => issue.code === 'missing-invoice-number',
    )
    const amounts = issues.find((issue) => issue.code === 'total-parts-differ')

    expect(missing).toMatchObject({
      severity: 'blocking',
      target: { type: 'field', field: 'invoiceNumber' },
    })
    expect(amounts).toMatchObject({
      severity: 'warning',
      target: { type: 'field', field: 'totalAmount' },
    })
    expect(amounts?.message).toContain('119.18')
    expect(amounts?.message).toContain('23.63')
    expect(amounts?.message).toContain('142.81')
    expect(amounts?.message).toContain('139.18')
    expect(canConfirmInvoice(issues, true)).toBe(false)

    const original = getInvoiceById('inv-023')
    if (!original) throw new Error('Missing inv-023')
    const numbered = applyTextOverride(
      undefined,
      original,
      'invoiceNumber',
      '23-1',
      NOW,
    )
    const afterNumber = issuesFor('inv-023', {
      'inv-023': numbered as InvoiceReview,
    })
    expect(codes(afterNumber)).not.toContain('missing-invoice-number')
    expect(codes(afterNumber)).toContain('total-parts-differ')
    expect(canConfirmInvoice(afterNumber, true)).toBe(true)
  })

  it('does not invent line-total, quantity, or currency rules', () => {
    expect(codes(issuesFor('inv-001'))).toEqual([])
    expect(codes(issuesFor('inv-002'))).toEqual([])
    expect(codes(issuesFor('inv-012'))).toEqual([])

    const inv019 = issuesFor('inv-019')
    expect(codes(inv019).every((code) => code === 'low-confidence')).toBe(true)
    expect(codes(inv019)).not.toContain('total-parts-differ')

    const inv006 = codes(issuesFor('inv-006'))
    expect(inv006).not.toContain('total-parts-differ')
    expect(inv006).not.toContain('missing-total')
    expect(
      issuesFor('inv-006').some(
        (issue) =>
          issue.target.type === 'field' && issue.target.field === 'currency',
      ),
    ).toBe(false)
  })

  it('blocks a cleared total and an invalid total without treating warnings as blocking', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const cleared = applyNumberOverride(
      undefined,
      original,
      'totalAmount',
      null,
      NOW,
    )
    const issues = issuesFor('inv-001', { 'inv-001': cleared as InvoiceReview })

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'missing-total',
        severity: 'blocking',
        target: { type: 'field', field: 'totalAmount' },
      }),
    ])
    expect(canConfirmInvoice(issues, true)).toBe(false)
    expect(original.fields.totalAmount.value).toBe(359.99)

    const effective = getEffectiveInvoice(original, undefined)
    const invalid = validateInvoice(
      {
        ...effective,
        fields: { ...effective.fields, totalAmount: Number.NaN },
      },
      {
        original,
        review: undefined,
        candidates: [],
      },
    )
    expect(invalid.map((issue) => issue.code)).toEqual(['invalid-total'])
    expect(canConfirmInvoice([], true)).toBe(true)
    expect(canConfirmInvoice([], false)).toBe(false)
    expect(canConfirmInvoice(issuesFor('inv-006'), true)).toBe(true)
  })

  it('keeps confidence of exactly 0.80 from becoming a warning', () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const tweaked = {
      ...original,
      fields: {
        ...original.fields,
        vendorName: { ...original.fields.vendorName, confidence: 0.8 },
      },
    }
    const issues = validateInvoice(getEffectiveInvoice(tweaked, undefined), {
      original: tweaked,
      review: undefined,
      candidates: [],
    })
    expect(issues).toEqual([])

    tweaked.fields.vendorName = {
      ...original.fields.vendorName,
      confidence: 0.79,
    }
    expect(
      validateInvoice(getEffectiveInvoice(tweaked, undefined), {
        original: tweaked,
        review: undefined,
        candidates: [],
      }).map((issue) => issue.target),
    ).toEqual([{ type: 'field', field: 'vendorName' }])
  })
})

describe('queue grouping', () => {
  it('derives attention from blocking and warning issues, not from stored status names', () => {
    expect(getQueueGroup(undefined, issuesFor('inv-001'))).toBe('no_issues')
    expect(getQueueGroup(undefined, issuesFor('inv-003'))).toBe(
      'needs_attention',
    )
    expect(getQueueGroup(undefined, issuesFor('inv-006'))).toBe(
      'needs_attention',
    )
    expect(attentionLabel(issuesFor('inv-003'))).toBe('Blocking')
    expect(attentionLabel(issuesFor('inv-006'))).toBe('Warning')
    expect(attentionLabel(issuesFor('inv-001'))).toBeNull()

    const info: ReviewIssue = {
      id: 'info:field:vendorName',
      code: 'low-confidence',
      severity: 'info',
      message: 'Context only',
      target: { type: 'field', field: 'vendorName' },
    }
    expect(getQueueGroup(undefined, [info])).toBe('no_issues')

    const setAside: InvoiceReview = {
      status: 'set_aside',
      overrides: { header: {}, lines: {} },
      setAsideReason: 'Waiting on the source file',
      updatedAt: NOW,
    }
    expect(getQueueGroup(setAside, issuesFor('inv-003'))).toBe('set_aside')
    expect(
      getQueueGroup(
        { ...setAside, status: 'confirmed', setAsideReason: undefined },
        issuesFor('inv-006'),
      ),
    ).toBe('confirmed')
  })
})
