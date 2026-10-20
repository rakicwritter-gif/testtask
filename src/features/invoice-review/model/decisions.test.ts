import { describe, expect, it } from 'vitest'
import { getInvoiceById } from '../data/invoices.ts'
import { applyTextOverride, type InvoiceReview } from './corrections.ts'
import {
  confirmReview,
  nextPendingInvoiceId,
  resumeReview,
  reviewProgress,
  setAsideReview,
} from './decisions.ts'
import { issuesForInvoice } from './selectors.ts'

const NOW = '2026-10-20T18:00:00.000Z'

function issues(id: string, reviews: Record<string, InvoiceReview> = {}) {
  return issuesForInvoice(id, reviews)
}

describe('review decisions', () => {
  it('confirms a pending invoice only when the source is available and nothing blocks', () => {
    const result = confirmReview(undefined, issues('inv-001'), true, NOW)
    expect(result).toEqual({
      ok: true,
      review: {
        status: 'confirmed',
        overrides: { header: {}, lines: {} },
        confirmedAt: NOW,
        updatedAt: NOW,
      },
    })

    const original = getInvoiceById('inv-001')
    expect(original?.fields.vendorName.value).toContain('FARMA KOKA')
  })

  it('rejects confirmation for a missing original and for a blocking field', () => {
    expect(confirmReview(undefined, issues('inv-003'), false, NOW)).toEqual({
      ok: false,
      code: 'source-unavailable',
    })
    expect(confirmReview(undefined, issues('inv-023'), true, NOW)).toEqual({
      ok: false,
      code: 'blocking-issues',
    })
  })

  it('allows confirmation when the only issues are warnings', () => {
    const result = confirmReview(undefined, issues('inv-006'), true, NOW)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.review?.status).toBe('confirmed')
  })

  it('keeps corrections when an invoice is set aside, and drops a blank reason', () => {
    const original = getInvoiceById('inv-003')
    if (!original) throw new Error('Missing inv-003')
    const edited = applyTextOverride(
      undefined,
      original,
      'vendorName',
      'Checked supplier',
      NOW,
    )
    const result = setAsideReview(edited, '  Waiting for the PDF  ', NOW)
    expect(result.ok).toBe(true)
    if (!result.ok || !result.review) throw new Error('Expected a review')
    expect(result.review.status).toBe('set_aside')
    expect(result.review.setAsideReason).toBe('Waiting for the PDF')
    expect(result.review.overrides.header.vendorName).toBe('Checked supplier')
    expect(original.fields.vendorName.value).not.toBe('Checked supplier')

    expect(setAsideReview(edited, '   ', NOW)).toEqual({
      ok: false,
      code: 'missing-reason',
    })
  })

  it('resumes a set-aside invoice without dropping its corrections', () => {
    const setAside: InvoiceReview = {
      status: 'set_aside',
      overrides: { header: { vendorName: 'Checked supplier' }, lines: {} },
      setAsideReason: 'Waiting for the PDF',
      updatedAt: NOW,
    }
    const resumed = resumeReview(setAside, '2026-10-20T19:00:00.000Z')
    expect(resumed).toEqual({
      ok: true,
      review: {
        status: 'pending',
        overrides: { header: { vendorName: 'Checked supplier' }, lines: {} },
        updatedAt: '2026-10-20T19:00:00.000Z',
      },
    })

    const empty = resumeReview(
      { ...setAside, overrides: { header: {}, lines: {} } },
      NOW,
    )
    expect(empty).toEqual({ ok: true, review: undefined })
  })

  it('rejects confirm, set aside, and resume from the wrong status', () => {
    const confirmed: InvoiceReview = {
      status: 'confirmed',
      overrides: { header: {}, lines: {} },
      confirmedAt: NOW,
      updatedAt: NOW,
    }
    const setAside: InvoiceReview = {
      status: 'set_aside',
      overrides: { header: {}, lines: {} },
      setAsideReason: 'Later',
      updatedAt: NOW,
    }

    expect(confirmReview(confirmed, [], true, NOW).ok).toBe(false)
    expect(setAsideReview(confirmed, 'Later', NOW)).toEqual({
      ok: false,
      code: 'not-pending',
    })
    expect(confirmReview(setAside, [], true, NOW)).toEqual({
      ok: false,
      code: 'not-pending',
    })
    expect(resumeReview(undefined, NOW)).toEqual({
      ok: false,
      code: 'not-set-aside',
    })
    expect(resumeReview(confirmed, NOW)).toEqual({
      ok: false,
      code: 'not-set-aside',
    })
  })

  it('counts decisions and chooses the next pending invoice in source order', () => {
    const ids = ['inv-001', 'inv-002', 'inv-003']
    const reviews: Record<string, InvoiceReview> = {
      'inv-002': {
        status: 'confirmed',
        overrides: { header: {}, lines: {} },
        confirmedAt: NOW,
        updatedAt: NOW,
      },
      'inv-003': {
        status: 'set_aside',
        overrides: { header: {}, lines: {} },
        setAsideReason: 'Later',
        updatedAt: NOW,
      },
    }
    expect(reviewProgress(ids, reviews)).toEqual({
      pending: 1,
      setAside: 1,
      confirmed: 1,
      total: 3,
    })
    expect(nextPendingInvoiceId(ids, reviews, 'inv-001')).toBeNull()
    expect(
      nextPendingInvoiceId(
        ids,
        { ...reviews, 'inv-003': undefined },
        'inv-002',
      ),
    ).toBe('inv-003')
    expect(nextPendingInvoiceId(ids, {}, 'inv-003')).toBe('inv-001')
  })
})
