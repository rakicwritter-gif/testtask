import type { InvoiceReview } from './corrections.ts'
import { canConfirmInvoice, type ReviewIssue } from './validation.ts'

export type DecisionCode =
  | 'unknown-invoice'
  | 'not-pending'
  | 'source-unavailable'
  | 'blocking-issues'
  | 'missing-reason'
  | 'not-set-aside'

export type DecisionResult =
  | { ok: true; review: InvoiceReview | undefined }
  | { ok: false; code: DecisionCode }

const EMPTY_OVERRIDES = { header: {}, lines: {} } as const

export function confirmReview(
  review: InvoiceReview | undefined,
  issues: readonly ReviewIssue[],
  sourceAvailability: boolean,
  now: string,
): DecisionResult {
  if ((review?.status ?? 'pending') !== 'pending') {
    return { ok: false, code: 'not-pending' }
  }
  if (!sourceAvailability) return { ok: false, code: 'source-unavailable' }
  if (!canConfirmInvoice(issues, true)) {
    return { ok: false, code: 'blocking-issues' }
  }
  return {
    ok: true,
    review: {
      status: 'confirmed',
      overrides: review?.overrides ?? EMPTY_OVERRIDES,
      confirmedAt: now,
      updatedAt: now,
    },
  }
}

export function setAsideReview(
  review: InvoiceReview | undefined,
  reason: string,
  now: string,
): DecisionResult {
  if ((review?.status ?? 'pending') !== 'pending') {
    return { ok: false, code: 'not-pending' }
  }
  const trimmed = reason.trim()
  if (trimmed === '') return { ok: false, code: 'missing-reason' }
  return {
    ok: true,
    review: {
      status: 'set_aside',
      overrides: review?.overrides ?? EMPTY_OVERRIDES,
      setAsideReason: trimmed,
      updatedAt: now,
    },
  }
}

export function resumeReview(
  review: InvoiceReview | undefined,
  now: string,
): DecisionResult {
  if (review?.status !== 'set_aside') {
    return { ok: false, code: 'not-set-aside' }
  }
  const next: InvoiceReview = {
    status: 'pending',
    overrides: review.overrides,
    updatedAt: now,
  }
  if (isEmptyPending(next)) return { ok: true, review: undefined }
  return { ok: true, review: next }
}

export type ReviewProgress = {
  pending: number
  setAside: number
  confirmed: number
  total: number
}

export function reviewProgress(
  invoiceIds: readonly string[],
  reviews: Readonly<Record<string, InvoiceReview | undefined>>,
): ReviewProgress {
  const progress: ReviewProgress = {
    pending: 0,
    setAside: 0,
    confirmed: 0,
    total: invoiceIds.length,
  }
  for (const id of invoiceIds) {
    const status = reviews[id]?.status ?? 'pending'
    if (status === 'confirmed') progress.confirmed += 1
    else if (status === 'set_aside') progress.setAside += 1
    else progress.pending += 1
  }
  return progress
}

/**
 * Next pending invoice in source order, wrapping after the current one.
 * The current invoice is not returned, even when it is still pending.
 */
export function nextPendingInvoiceId(
  invoiceIds: readonly string[],
  reviews: Readonly<Record<string, InvoiceReview | undefined>>,
  currentId: string,
): string | null {
  const index = invoiceIds.indexOf(currentId)
  const ordered =
    index === -1
      ? invoiceIds
      : [...invoiceIds.slice(index + 1), ...invoiceIds.slice(0, index)]
  return (
    ordered.find((id) => (reviews[id]?.status ?? 'pending') === 'pending') ??
    null
  )
}

function isEmptyPending(review: InvoiceReview): boolean {
  return (
    review.status === 'pending' &&
    !review.setAsideReason &&
    Object.keys(review.overrides.header).length === 0 &&
    Object.keys(review.overrides.lines).length === 0
  )
}
