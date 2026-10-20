import { toMinorUnits } from '../utils/money.ts'
import {
  getEffectiveInvoice,
  hasBankOverride,
  hasHeaderOverride,
  hasLineOverride,
  type EffectiveInvoice,
  type HeaderField,
  type InvoiceReview,
  type LineField,
  type ReviewStatus,
} from './corrections.ts'
import type { OriginalInvoice } from './types.ts'

/** Present extracted values below this confidence are review cues, not errors. */
export const LOW_CONFIDENCE_THRESHOLD = 0.8

export type IssueSeverity = 'blocking' | 'warning' | 'info'

export type IssueCode =
  | 'missing-document'
  | 'missing-invoice-number'
  | 'missing-total'
  | 'invalid-total'
  | 'total-parts-differ'
  | 'possible-duplicate'
  | 'low-confidence'

export type IssueTarget =
  | { type: 'field'; field: HeaderField | 'bankAccounts' }
  | { type: 'line'; lineId: string; field: LineField }
  | { type: 'invoice'; invoiceId: string }
  | { type: 'document' }

export type ReviewIssue = {
  id: string
  code: IssueCode
  severity: IssueSeverity
  message: string
  target: IssueTarget
}

export type DuplicateCandidate = {
  id: string
  clientId: string
  vendorName: string | null
  invoiceNumber: string | null
  status: ReviewStatus
}

export type ValidationContext = {
  original: OriginalInvoice
  review: InvoiceReview | undefined
  candidates: readonly DuplicateCandidate[]
}

export type QueueGroup =
  'needs_attention' | 'no_issues' | 'set_aside' | 'confirmed'

export type IssueCue = {
  severity: 'blocking' | 'warning'
  label: string
}

const HEADER_CONFIDENCE_FIELDS = [
  'vendorName',
  'vendorTaxId',
  'vendorVatId',
  'buyerName',
  'buyerTaxId',
  'invoiceNumber',
  'issueDate',
  'supplyDate',
  'dueDate',
  'currency',
  'netAmount',
  'vatAmount',
  'totalAmount',
  'paymentReference',
  'bankAccounts',
] as const

const LINE_CONFIDENCE_FIELDS = [
  'description',
  'quantity',
  'unit',
  'unitPrice',
  'vatRate',
  'lineTotal',
] as const satisfies readonly LineField[]

const HEADER_LABELS: Record<(typeof HEADER_CONFIDENCE_FIELDS)[number], string> =
  {
    vendorName: 'Supplier',
    vendorTaxId: 'Supplier tax ID',
    vendorVatId: 'Supplier VAT ID',
    buyerName: 'Buyer',
    buyerTaxId: 'Buyer tax ID',
    invoiceNumber: 'Invoice number',
    issueDate: 'Issue date',
    supplyDate: 'Supply date',
    dueDate: 'Due date',
    currency: 'Currency',
    netAmount: 'Net',
    vatAmount: 'VAT',
    totalAmount: 'Total',
    paymentReference: 'Payment reference',
    bankAccounts: 'Bank accounts',
  }

const LINE_LABELS: Record<LineField, string> = {
  description: 'description',
  quantity: 'quantity',
  unit: 'unit',
  unitPrice: 'unit price',
  vatRate: 'VAT rate',
  lineTotal: 'line total',
}

export function validateInvoice(
  effective: EffectiveInvoice,
  context: ValidationContext,
): ReviewIssue[] {
  return [
    ...requiredIssues(effective, context.original),
    ...totalPartsIssue(effective),
    ...duplicateIssues(effective, context),
    ...headerConfidenceIssues(effective, context),
    ...lineConfidenceIssues(effective, context),
  ]
}

export function duplicateCandidate(
  original: OriginalInvoice,
  review: InvoiceReview | undefined,
): DuplicateCandidate {
  const effective = getEffectiveInvoice(original, review)
  return {
    id: original.id,
    clientId: original.client.id,
    vendorName: effective.fields.vendorName,
    invoiceNumber: effective.fields.invoiceNumber,
    status: review?.status ?? 'pending',
  }
}

/**
 * True only when the original document is available and no issue blocks confirmation.
 * Warnings, including low confidence and possible duplicates, do not block.
 */
export function canConfirmInvoice(
  issues: readonly ReviewIssue[],
  sourceAvailability: boolean,
): boolean {
  return (
    sourceAvailability && !issues.some((issue) => issue.severity === 'blocking')
  )
}

export function getQueueGroup(
  review: InvoiceReview | undefined,
  issues: readonly ReviewIssue[],
): QueueGroup {
  const status = review?.status ?? 'pending'
  if (status === 'set_aside') return 'set_aside'
  if (status === 'confirmed') return 'confirmed'
  const needsAttention = issues.some(
    (issue) => issue.severity === 'blocking' || issue.severity === 'warning',
  )
  return needsAttention ? 'needs_attention' : 'no_issues'
}

export function attentionLabel(
  issues: readonly ReviewIssue[],
): 'Blocking' | 'Warning' | null {
  if (issues.some((issue) => issue.severity === 'blocking')) return 'Blocking'
  if (issues.some((issue) => issue.severity === 'warning')) return 'Warning'
  return null
}

export function fieldCue(
  issues: readonly ReviewIssue[],
  field: HeaderField | 'bankAccounts',
): IssueCue | null {
  return cueFor(
    issues.filter(
      (issue) => issue.target.type === 'field' && issue.target.field === field,
    ),
  )
}

export function lineCue(
  issues: readonly ReviewIssue[],
  lineId: string,
  field: LineField,
): IssueCue | null {
  return cueFor(
    issues.filter(
      (issue) =>
        issue.target.type === 'line' &&
        issue.target.lineId === lineId &&
        issue.target.field === field,
    ),
  )
}

/** Case and surrounding or repeated whitespace only. Quotes and diacritics stay. */
export function normalizeIdentity(value: string | null): string | null {
  if (value === null) return null
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized === '' ? null : normalized
}

function cueFor(issues: readonly ReviewIssue[]): IssueCue | null {
  if (issues.some((issue) => issue.severity === 'blocking')) {
    return { severity: 'blocking', label: 'Required' }
  }
  if (issues.some((issue) => issue.code === 'total-parts-differ')) {
    return { severity: 'warning', label: 'Check amounts' }
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return { severity: 'warning', label: 'Needs a closer look' }
  }
  return null
}

function requiredIssues(
  effective: EffectiveInvoice,
  original: OriginalInvoice,
): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  if (!original.document) {
    issues.push(
      createIssue({
        code: 'missing-document',
        severity: 'blocking',
        message:
          'Original document is unavailable, so this invoice cannot be confirmed from its source.',
        target: { type: 'document' },
      }),
    )
  }

  const invoiceNumber = effective.fields.invoiceNumber
  if (invoiceNumber === null || invoiceNumber.trim() === '') {
    issues.push(
      createIssue({
        code: 'missing-invoice-number',
        severity: 'blocking',
        message:
          'Invoice number is required before this invoice can be confirmed.',
        target: { type: 'field', field: 'invoiceNumber' },
      }),
    )
  }

  const total = effective.fields.totalAmount
  if (total === null) {
    issues.push(
      createIssue({
        code: 'missing-total',
        severity: 'blocking',
        message: 'Total is required before this invoice can be confirmed.',
        target: { type: 'field', field: 'totalAmount' },
      }),
    )
  } else if (!Number.isFinite(total)) {
    issues.push(
      createIssue({
        code: 'invalid-total',
        severity: 'blocking',
        message: 'Total is not a valid amount.',
        target: { type: 'field', field: 'totalAmount' },
      }),
    )
  }

  return issues
}

/**
 * Header net + VAT is an exact cent match to the total on 24 of 25 invoices.
 * inv-023 differs, so a mismatch is a warning. Line totals are not compared:
 * they are gross, net, or neither depending on the invoice.
 */
function totalPartsIssue(effective: EffectiveInvoice): ReviewIssue[] {
  const net = effective.fields.netAmount
  const vat = effective.fields.vatAmount
  const total = effective.fields.totalAmount
  if (net === null || vat === null || total === null) return []

  const netMinor = toMinorUnits(net)
  const vatMinor = toMinorUnits(vat)
  const totalMinor = toMinorUnits(total)
  if (netMinor === null || vatMinor === null || totalMinor === null) return []

  const sum = netMinor + vatMinor
  if (sum === totalMinor) return []

  return [
    createIssue({
      code: 'total-parts-differ',
      severity: 'warning',
      message: `Net ${formatMinor(netMinor)} + VAT ${formatMinor(vatMinor)} = ${formatMinor(sum)}, which does not match the total ${formatMinor(totalMinor)}.`,
      target: { type: 'field', field: 'totalAmount' },
    }),
  ]
}

function duplicateIssues(
  effective: EffectiveInvoice,
  context: ValidationContext,
): ReviewIssue[] {
  const vendor = normalizeIdentity(effective.fields.vendorName)
  const invoiceNumber = normalizeIdentity(effective.fields.invoiceNumber)
  if (!vendor || !invoiceNumber) return []

  return context.candidates
    .filter((candidate) => {
      if (candidate.id === context.original.id) return false
      if (candidate.clientId !== context.original.client.id) return false
      return (
        normalizeIdentity(candidate.vendorName) === vendor &&
        normalizeIdentity(candidate.invoiceNumber) === invoiceNumber
      )
    })
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((candidate) =>
      createIssue({
        code: 'possible-duplicate',
        severity: 'warning',
        message: `Possible duplicate of ${candidate.id}, currently ${statusLabel(candidate.status)}. Matched on client, supplier, and invoice number.`,
        target: { type: 'invoice', invoiceId: candidate.id },
      }),
    )
}

function headerConfidenceIssues(
  effective: EffectiveInvoice,
  context: ValidationContext,
): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  for (const field of HEADER_CONFIDENCE_FIELDS) {
    if (field === 'bankAccounts') {
      if (
        bankAccountsOverridden(
          context.review,
          context.original.fields.bankAccounts.value.length,
        )
      ) {
        continue
      }
      if (!presentList(effective.fields.bankAccounts)) continue
      if (
        !(
          context.original.fields.bankAccounts.confidence <
          LOW_CONFIDENCE_THRESHOLD
        )
      ) {
        continue
      }
    } else {
      if (hasHeaderOverride(context.review, field)) continue
      if (!presentHeaderValue(effective.fields[field])) continue
      if (
        !(context.original.fields[field].confidence < LOW_CONFIDENCE_THRESHOLD)
      ) {
        continue
      }
    }

    const label = HEADER_LABELS[field]
    const confidence =
      field === 'bankAccounts'
        ? context.original.fields.bankAccounts.confidence
        : context.original.fields[field].confidence
    issues.push(
      createIssue({
        code: 'low-confidence',
        severity: 'warning',
        message:
          field === 'bankAccounts'
            ? `${label} need a closer look. The extracted values are present with confidence ${confidence}.`
            : `${label} needs a closer look. The extracted value is present with confidence ${confidence}.`,
        target: { type: 'field', field },
      }),
    )
  }
  return issues
}

function lineConfidenceIssues(
  effective: EffectiveInvoice,
  context: ValidationContext,
): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  for (const line of context.original.lineItems) {
    const current = effective.lineItems.find((item) => item.id === line.id)
    if (!current) continue
    for (const field of LINE_CONFIDENCE_FIELDS) {
      if (hasLineOverride(context.review, line.id, field)) continue
      if (!(line[field].confidence < LOW_CONFIDENCE_THRESHOLD)) continue
      if (!presentHeaderValue(current[field])) continue
      issues.push(
        createIssue({
          code: 'low-confidence',
          severity: 'warning',
          message: `Line ${line.index + 1} ${LINE_LABELS[field]} needs a closer look. The extracted value is present with confidence ${line[field].confidence}.`,
          target: { type: 'line', lineId: line.id, field },
        }),
      )
    }
  }
  return issues
}

function bankAccountsOverridden(
  review: InvoiceReview | undefined,
  count: number,
): boolean {
  for (let index = 0; index < count; index += 1) {
    if (hasBankOverride(review, index)) return true
  }
  return false
}

function presentList(values: readonly string[]): boolean {
  return values.some((value) => value.trim() !== '')
}

function presentHeaderValue(value: string | number | null): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== ''
  return false
}

function statusLabel(status: ReviewStatus): string {
  if (status === 'set_aside') return 'Set aside'
  if (status === 'confirmed') return 'Confirmed'
  return 'Pending'
}

function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const absolute = Math.abs(minor)
  const whole = Math.trunc(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

function createIssue(issue: Omit<ReviewIssue, 'id'>): ReviewIssue {
  return { ...issue, id: `${issue.code}:${targetKey(issue.target)}` }
}

function targetKey(target: IssueTarget): string {
  switch (target.type) {
    case 'field':
      return `field:${target.field}`
    case 'line':
      return `line:${target.lineId}:${target.field}`
    case 'invoice':
      return `invoice:${target.invoiceId}`
    case 'document':
      return 'document'
  }
}
