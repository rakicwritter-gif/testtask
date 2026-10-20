import { beforeEach, describe, expect, it } from 'vitest'
import { getInvoiceById } from '../data/invoices.ts'
import { REVIEW_STORAGE_KEY, useReviewStore } from './review-store.ts'

describe('review store', () => {
  beforeEach(() => {
    localStorage.clear()
    useReviewStore.setState({ reviews: {} })
  })

  it('persists a draft correction and restores it into a new session', async () => {
    const original = getInvoiceById('inv-006')
    if (!original) throw new Error('Missing inv-006')

    useReviewStore.getState().setTextOverride('inv-006', 'currency', 'EUR')
    useReviewStore.getState().setNumberOverride('inv-006', 'totalAmount', 90)
    const saved = localStorage.getItem(REVIEW_STORAGE_KEY)
    expect(saved).toContain('EUR')
    expect(saved).toContain('90')

    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved ?? '')
    await useReviewStore.persist.rehydrate()

    const review = useReviewStore.getState().reviews['inv-006']
    expect(review?.overrides.header.currency).toBe('EUR')
    expect(review?.overrides.header.totalAmount).toBe(90)
    expect(original.fields.currency.value).toBeNull()
    expect(original.fields.totalAmount.value).not.toBe(90)
  })

  it('does not store an edit on a confirmed invoice', () => {
    useReviewStore.setState({
      reviews: {
        'inv-001': {
          status: 'confirmed',
          overrides: { header: {}, lines: {} },
          updatedAt: '2026-10-20T12:00:00.000Z',
        },
      },
    })

    useReviewStore
      .getState()
      .setTextOverride('inv-001', 'vendorName', 'Changed')

    expect(
      useReviewStore.getState().reviews['inv-001']?.overrides.header.vendorName,
    ).toBeUndefined()
    expect(useReviewStore.getState().reviews['inv-001']?.status).toBe(
      'confirmed',
    )
  })

  it('keeps line edits on the targeted row only', () => {
    const original = getInvoiceById('inv-011')
    if (!original) throw new Error('Missing inv-011')
    const first = original.lineItems[0]
    const second = original.lineItems[1]
    if (!first || !second) throw new Error('Expected lines')

    useReviewStore
      .getState()
      .setLineNumberOverride('inv-011', first.id, 'unitPrice', 1.25)
    useReviewStore
      .getState()
      .setLineTextOverride('inv-002', second.id, 'description', 'Wrong invoice')

    const review = useReviewStore.getState().reviews['inv-011']
    expect(review?.overrides.lines[first.id]?.unitPrice).toBe(1.25)
    expect(review?.overrides.lines[second.id]).toBeUndefined()
    expect(review?.overrides.lines[first.id]?.lineTotal).toBeUndefined()
    expect(useReviewStore.getState().reviews['inv-002']).toBeUndefined()
    expect(first.unitPrice.value).not.toBe(1.25)
  })

  it('persists confirmation and refuses a second confirm or a later edit', async () => {
    const original = getInvoiceById('inv-001')
    if (!original) throw new Error('Missing inv-001')
    const confirmed = useReviewStore.getState().confirmInvoice('inv-001')
    expect(confirmed.ok).toBe(true)
    const saved = localStorage.getItem(REVIEW_STORAGE_KEY)
    expect(saved).toContain('confirmed')

    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved ?? '')
    await useReviewStore.persist.rehydrate()

    const review = useReviewStore.getState().reviews['inv-001']
    expect(review?.status).toBe('confirmed')
    expect(review?.confirmedAt).toEqual(expect.any(String))
    const again = useReviewStore.getState().confirmInvoice('inv-001')
    expect(again).toEqual({ ok: false, code: 'not-pending' })
    expect(useReviewStore.getState().reviews['inv-001']?.confirmedAt).toBe(
      review?.confirmedAt,
    )
    useReviewStore
      .getState()
      .setTextOverride('inv-001', 'vendorName', 'Changed after confirm')
    expect(
      useReviewStore.getState().reviews['inv-001']?.overrides.header.vendorName,
    ).toBeUndefined()
    expect(original.fields.totalAmount.value).toBe(359.99)
  })

  it('rejects confirmation when the original or a required field is missing', () => {
    expect(useReviewStore.getState().confirmInvoice('inv-003')).toEqual({
      ok: false,
      code: 'source-unavailable',
    })
    expect(useReviewStore.getState().confirmInvoice('inv-023')).toEqual({
      ok: false,
      code: 'blocking-issues',
    })
    expect(useReviewStore.getState().reviews['inv-003']).toBeUndefined()
    expect(useReviewStore.getState().reviews['inv-023']).toBeUndefined()
    expect(useReviewStore.getState().confirmInvoice('missing')).toEqual({
      ok: false,
      code: 'unknown-invoice',
    })
  })

  it('persists a set-aside reason and corrections, then resumes without losing them', async () => {
    useReviewStore
      .getState()
      .setTextOverride('inv-003', 'vendorName', 'Checked supplier')
    expect(useReviewStore.getState().setAsideInvoice('inv-003', '   ')).toEqual(
      {
        ok: false,
        code: 'missing-reason',
      },
    )
    const setAside = useReviewStore
      .getState()
      .setAsideInvoice('inv-003', ' Waiting for the PDF ')
    expect(setAside.ok).toBe(true)

    const saved = localStorage.getItem(REVIEW_STORAGE_KEY) ?? ''
    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved)
    await useReviewStore.persist.rehydrate()

    const stored = useReviewStore.getState().reviews['inv-003']
    expect(stored?.status).toBe('set_aside')
    expect(stored?.setAsideReason).toBe('Waiting for the PDF')
    expect(stored?.overrides.header.vendorName).toBe('Checked supplier')

    expect(useReviewStore.getState().confirmInvoice('inv-003')).toEqual({
      ok: false,
      code: 'not-pending',
    })
    useReviewStore
      .getState()
      .setTextOverride('inv-003', 'buyerName', 'Should not stick')
    expect(
      useReviewStore.getState().reviews['inv-003']?.overrides.header.buyerName,
    ).toBeUndefined()

    const resumed = useReviewStore.getState().resumeInvoice('inv-003')
    expect(resumed.ok).toBe(true)
    expect(useReviewStore.getState().reviews['inv-003']?.status).toBe('pending')
    expect(
      useReviewStore.getState().reviews['inv-003']?.overrides.header.vendorName,
    ).toBe('Checked supplier')
    expect(
      useReviewStore.getState().reviews['inv-003']?.setAsideReason,
    ).toBeUndefined()
    expect(useReviewStore.getState().resumeInvoice('inv-001')).toEqual({
      ok: false,
      code: 'not-set-aside',
    })
  })
})
