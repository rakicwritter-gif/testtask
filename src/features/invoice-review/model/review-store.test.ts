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
})
