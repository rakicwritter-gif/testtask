import { invoices } from '../data/invoices.ts'
import { getEffectiveInvoice, type InvoiceReview } from './corrections.ts'
import {
  duplicateCandidate,
  validateInvoice,
  type ReviewIssue,
} from './validation.ts'

export function issuesForInvoice(
  invoiceId: string,
  reviews: Readonly<Record<string, InvoiceReview>>,
): ReviewIssue[] {
  const original = invoices.find((invoice) => invoice.id === invoiceId)
  if (!original) return []
  const review = reviews[invoiceId]
  return validateInvoice(getEffectiveInvoice(original, review), {
    original,
    review,
    candidates: invoices.map((invoice) =>
      duplicateCandidate(invoice, reviews[invoice.id]),
    ),
  })
}
