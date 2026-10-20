import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getInvoiceById } from '../data/invoices.ts'
import {
  confirmReview,
  resumeReview,
  setAsideReview,
  type DecisionResult,
} from './decisions.ts'
import { issuesForInvoice } from './selectors.ts'
import {
  applyBankAccountOverride,
  applyLineNumberOverride,
  applyLineTextOverride,
  applyNumberOverride,
  applyTextOverride,
  clearBankAccountOverride,
  clearHeaderField,
  clearLineField,
  type HeaderField,
  type InvoiceReview,
  type LineNumberField,
  type LineTextField,
  type NumberHeaderField,
  type TextHeaderField,
} from './corrections.ts'
import type { OriginalInvoice } from './types.ts'

export const REVIEW_STORAGE_KEY = 'invoice-review.corrections.v1'

type ReviewState = {
  reviews: Record<string, InvoiceReview>
  setTextOverride: (
    invoiceId: string,
    field: TextHeaderField,
    value: string | null,
  ) => void
  setNumberOverride: (
    invoiceId: string,
    field: NumberHeaderField,
    value: number | null,
  ) => void
  clearHeaderOverride: (invoiceId: string, field: HeaderField) => void
  setBankAccountOverride: (
    invoiceId: string,
    index: number,
    value: string,
  ) => void
  clearBankAccountOverride: (invoiceId: string, index: number) => void
  setLineTextOverride: (
    invoiceId: string,
    lineId: string,
    field: LineTextField,
    value: string | null,
  ) => void
  setLineNumberOverride: (
    invoiceId: string,
    lineId: string,
    field: LineNumberField,
    value: number | null,
  ) => void
  clearLineOverride: (
    invoiceId: string,
    lineId: string,
    field: LineTextField | LineNumberField,
  ) => void
  confirmInvoice: (invoiceId: string) => DecisionResult
  setAsideInvoice: (invoiceId: string, reason: string) => DecisionResult
  resumeInvoice: (invoiceId: string) => DecisionResult
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: {},
      setTextOverride: (invoiceId, field, value) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review, original) =>
          applyTextOverride(review, original, field, value, now),
        )
      },
      setNumberOverride: (invoiceId, field, value) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review, original) =>
          applyNumberOverride(review, original, field, value, now),
        )
      },
      clearHeaderOverride: (invoiceId, field) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review) =>
          clearHeaderField(review, field, now),
        )
      },
      setBankAccountOverride: (invoiceId, index, value) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review, original) =>
          applyBankAccountOverride(review, original, index, value, now),
        )
      },
      clearBankAccountOverride: (invoiceId, index) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review) =>
          clearBankAccountOverride(review, index, now),
        )
      },
      setLineTextOverride: (invoiceId, lineId, field, value) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review, original) =>
          applyLineTextOverride(review, original, lineId, field, value, now),
        )
      },
      setLineNumberOverride: (invoiceId, lineId, field, value) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review, original) =>
          applyLineNumberOverride(review, original, lineId, field, value, now),
        )
      },
      clearLineOverride: (invoiceId, lineId, field) => {
        const now = new Date().toISOString()
        updateReview(set, invoiceId, (review) =>
          clearLineField(review, lineId, field, now),
        )
      },
      confirmInvoice: (invoiceId) =>
        applyDecision(set, get, invoiceId, (review, original, reviews) =>
          confirmReview(
            review,
            issuesForInvoice(invoiceId, reviews),
            original.document !== null,
            new Date().toISOString(),
          ),
        ),
      setAsideInvoice: (invoiceId, reason) =>
        applyDecision(set, get, invoiceId, (review) =>
          setAsideReview(review, reason, new Date().toISOString()),
        ),
      resumeInvoice: (invoiceId) =>
        applyDecision(set, get, invoiceId, (review) =>
          resumeReview(review, new Date().toISOString()),
        ),
    }),
    {
      name: REVIEW_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({ reviews: state.reviews }),
    },
  ),
)

function applyDecision(
  set: (
    partial:
      Partial<ReviewState> | ((state: ReviewState) => Partial<ReviewState>),
  ) => void,
  get: () => ReviewState,
  invoiceId: string,
  decide: (
    review: InvoiceReview | undefined,
    original: OriginalInvoice,
    reviews: ReviewState['reviews'],
  ) => DecisionResult,
): DecisionResult {
  const original = getInvoiceById(invoiceId)
  if (!original) return { ok: false, code: 'unknown-invoice' }
  const result = decide(get().reviews[invoiceId], original, get().reviews)
  if (!result.ok) return result
  set((state) => {
    const reviews = { ...state.reviews }
    if (result.review) reviews[invoiceId] = result.review
    else delete reviews[invoiceId]
    return { reviews }
  })
  return result
}

function updateReview(
  set: (
    partial:
      Partial<ReviewState> | ((state: ReviewState) => Partial<ReviewState>),
  ) => void,
  invoiceId: string,
  produce: (
    review: InvoiceReview | undefined,
    original: OriginalInvoice,
  ) => InvoiceReview | undefined,
) {
  const original = getInvoiceById(invoiceId)
  if (!original) return
  set((state) => {
    const current = state.reviews[invoiceId]
    const next = produce(current, original)
    if (next === current) return state
    const reviews = { ...state.reviews }
    if (next) reviews[invoiceId] = next
    else delete reviews[invoiceId]
    return { reviews }
  })
}
