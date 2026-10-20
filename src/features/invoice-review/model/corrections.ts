import type { OriginalInvoice, OriginalLineItem } from './types.ts'

export const TEXT_HEADER_FIELDS = [
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
  'paymentReference',
] as const

export const NUMBER_HEADER_FIELDS = [
  'netAmount',
  'vatAmount',
  'totalAmount',
] as const

export const LINE_TEXT_FIELDS = ['description', 'unit'] as const
export const LINE_NUMBER_FIELDS = [
  'quantity',
  'unitPrice',
  'vatRate',
  'lineTotal',
] as const

export type TextHeaderField = (typeof TEXT_HEADER_FIELDS)[number]
export type NumberHeaderField = (typeof NUMBER_HEADER_FIELDS)[number]
export type HeaderField = TextHeaderField | NumberHeaderField
export type LineTextField = (typeof LINE_TEXT_FIELDS)[number]
export type LineNumberField = (typeof LINE_NUMBER_FIELDS)[number]
export type LineField = LineTextField | LineNumberField

export type HeaderOverrides = {
  vendorName?: string | null
  vendorTaxId?: string | null
  vendorVatId?: string | null
  buyerName?: string | null
  buyerTaxId?: string | null
  invoiceNumber?: string | null
  issueDate?: string | null
  supplyDate?: string | null
  dueDate?: string | null
  currency?: string | null
  paymentReference?: string | null
  netAmount?: number | null
  vatAmount?: number | null
  totalAmount?: number | null
  bankAccounts?: Readonly<Record<string, string>>
}

export type LineItemOverrides = {
  description?: string | null
  quantity?: number | null
  unit?: string | null
  unitPrice?: number | null
  vatRate?: number | null
  lineTotal?: number | null
}

export type InvoiceOverrides = {
  header: HeaderOverrides
  lines: Readonly<Record<string, LineItemOverrides>>
}

export type ReviewStatus = 'pending' | 'set_aside' | 'confirmed'

export type InvoiceReview = {
  status: ReviewStatus
  overrides: InvoiceOverrides
  setAsideReason?: string
  updatedAt: string
}

export type EffectiveFields = {
  vendorName: string | null
  vendorTaxId: string | null
  vendorVatId: string | null
  buyerName: string | null
  buyerTaxId: string | null
  invoiceNumber: string | null
  issueDate: string | null
  supplyDate: string | null
  dueDate: string | null
  currency: string | null
  paymentReference: string | null
  netAmount: number | null
  vatAmount: number | null
  totalAmount: number | null
  bankAccounts: readonly string[]
}

export type EffectiveLineItem = {
  id: string
  invoiceId: string
  index: number
  description: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  vatRate: number | null
  lineTotal: number | null
}

export type EffectiveInvoice = {
  id: string
  fields: EffectiveFields
  lineItems: readonly EffectiveLineItem[]
}

export function getEffectiveInvoice(
  original: OriginalInvoice,
  review: InvoiceReview | undefined,
): EffectiveInvoice {
  const header = review?.overrides.header
  return {
    id: original.id,
    fields: {
      vendorName: textValue(
        header,
        'vendorName',
        original.fields.vendorName.value,
      ),
      vendorTaxId: textValue(
        header,
        'vendorTaxId',
        original.fields.vendorTaxId.value,
      ),
      vendorVatId: textValue(
        header,
        'vendorVatId',
        original.fields.vendorVatId.value,
      ),
      buyerName: textValue(
        header,
        'buyerName',
        original.fields.buyerName.value,
      ),
      buyerTaxId: textValue(
        header,
        'buyerTaxId',
        original.fields.buyerTaxId.value,
      ),
      invoiceNumber: textValue(
        header,
        'invoiceNumber',
        original.fields.invoiceNumber.value,
      ),
      issueDate: textValue(
        header,
        'issueDate',
        original.fields.issueDate.value,
      ),
      supplyDate: textValue(
        header,
        'supplyDate',
        original.fields.supplyDate.value,
      ),
      dueDate: textValue(header, 'dueDate', original.fields.dueDate.value),
      currency: textValue(header, 'currency', original.fields.currency.value),
      paymentReference: textValue(
        header,
        'paymentReference',
        original.fields.paymentReference.value,
      ),
      netAmount: numberValue(
        header,
        'netAmount',
        original.fields.netAmount.value,
      ),
      vatAmount: numberValue(
        header,
        'vatAmount',
        original.fields.vatAmount.value,
      ),
      totalAmount: numberValue(
        header,
        'totalAmount',
        original.fields.totalAmount.value,
      ),
      bankAccounts: effectiveBankAccounts(original, header?.bankAccounts),
    },
    lineItems: original.lineItems.map((line) =>
      effectiveLine(line, review?.overrides.lines[line.id]),
    ),
  }
}

export function hasHeaderOverride(
  review: InvoiceReview | undefined,
  field: HeaderField,
): boolean {
  return !!review && Object.hasOwn(review.overrides.header, field)
}

export function hasBankOverride(
  review: InvoiceReview | undefined,
  index: number,
): boolean {
  const accounts = review?.overrides.header.bankAccounts
  return !!accounts && Object.hasOwn(accounts, String(index))
}

export function hasLineOverride(
  review: InvoiceReview | undefined,
  lineId: string,
  field: LineField,
): boolean {
  const line = review?.overrides.lines[lineId]
  return !!line && Object.hasOwn(line, field)
}

export function applyTextOverride(
  review: InvoiceReview | undefined,
  original: OriginalInvoice,
  field: TextHeaderField,
  value: string | null,
  now: string,
): InvoiceReview | undefined {
  return writeHeader(review, field, value, original.fields[field].value, now)
}

export function applyNumberOverride(
  review: InvoiceReview | undefined,
  original: OriginalInvoice,
  field: NumberHeaderField,
  value: number | null,
  now: string,
): InvoiceReview | undefined {
  return writeHeader(review, field, value, original.fields[field].value, now)
}

export function applyBankAccountOverride(
  review: InvoiceReview | undefined,
  original: OriginalInvoice,
  index: number,
  value: string,
  now: string,
): InvoiceReview | undefined {
  if (review && review.status !== 'pending') return review
  const accounts = original.fields.bankAccounts.value
  if (!Number.isInteger(index) || index < 0 || index >= accounts.length) {
    return review
  }

  const key = String(index)
  const current = { ...(review?.overrides.header.bankAccounts ?? {}) }
  if (value === accounts[index]) {
    if (!Object.hasOwn(current, key)) return review
    delete current[key]
  } else {
    current[key] = value
  }

  const header: HeaderOverrides = {
    ...(review?.overrides.header ?? {}),
    bankAccounts: current,
  }
  return seal(review, header, review?.overrides.lines ?? {}, now)
}

export function applyLineTextOverride(
  review: InvoiceReview | undefined,
  original: OriginalInvoice,
  lineId: string,
  field: LineTextField,
  value: string | null,
  now: string,
): InvoiceReview | undefined {
  const line = lineOnInvoice(original, lineId)
  if (!line) return review
  return writeLine(review, line, field, value, line[field].value, now)
}

export function applyLineNumberOverride(
  review: InvoiceReview | undefined,
  original: OriginalInvoice,
  lineId: string,
  field: LineNumberField,
  value: number | null,
  now: string,
): InvoiceReview | undefined {
  const line = lineOnInvoice(original, lineId)
  if (!line) return review
  return writeLine(review, line, field, value, line[field].value, now)
}

export function clearHeaderField(
  review: InvoiceReview | undefined,
  field: HeaderField,
  now: string,
): InvoiceReview | undefined {
  if (!review || review.status !== 'pending') return review
  if (!Object.hasOwn(review.overrides.header, field)) return review
  const header = { ...review.overrides.header }
  delete header[field]
  return seal(review, header, review.overrides.lines, now)
}

export function clearBankAccountOverride(
  review: InvoiceReview | undefined,
  index: number,
  now: string,
): InvoiceReview | undefined {
  if (!review || review.status !== 'pending') return review
  const accounts = review.overrides.header.bankAccounts
  const key = String(index)
  if (!accounts || !Object.hasOwn(accounts, key)) return review
  const nextAccounts = { ...accounts }
  delete nextAccounts[key]
  const header: HeaderOverrides = {
    ...review.overrides.header,
    bankAccounts: nextAccounts,
  }
  return seal(review, header, review.overrides.lines, now)
}

export function clearLineField(
  review: InvoiceReview | undefined,
  lineId: string,
  field: LineField,
  now: string,
): InvoiceReview | undefined {
  if (!review || review.status !== 'pending') return review
  const current = review.overrides.lines[lineId]
  if (!current || !Object.hasOwn(current, field)) return review
  const line = { ...current }
  delete line[field]
  const lines = { ...review.overrides.lines }
  if (Object.keys(line).length === 0) delete lines[lineId]
  else lines[lineId] = line
  return seal(review, review.overrides.header, lines, now)
}

function writeHeader(
  review: InvoiceReview | undefined,
  field: HeaderField,
  value: string | number | null,
  originalValue: string | number | null,
  now: string,
): InvoiceReview | undefined {
  if (review && review.status !== 'pending') return review
  const header: HeaderOverrides = { ...(review?.overrides.header ?? {}) }
  if (sameValue(value, originalValue)) {
    if (!Object.hasOwn(header, field)) return review
    delete header[field]
  } else {
    writeField(header, field, value)
  }
  return seal(review, header, review?.overrides.lines ?? {}, now)
}

function writeLine(
  review: InvoiceReview | undefined,
  line: OriginalLineItem,
  field: LineField,
  value: string | number | null,
  originalValue: string | number | null,
  now: string,
): InvoiceReview | undefined {
  if (review && review.status !== 'pending') return review
  const lines = { ...(review?.overrides.lines ?? {}) }
  const current: LineItemOverrides = { ...(lines[line.id] ?? {}) }
  if (sameValue(value, originalValue)) {
    if (!Object.hasOwn(current, field)) return review
    delete current[field]
  } else {
    writeField(current, field, value)
  }
  if (Object.keys(current).length === 0) delete lines[line.id]
  else lines[line.id] = current
  return seal(review, { ...(review?.overrides.header ?? {}) }, lines, now)
}

function seal(
  review: InvoiceReview | undefined,
  header: HeaderOverrides,
  lines: Readonly<Record<string, LineItemOverrides>>,
  now: string,
): InvoiceReview | undefined {
  let nextHeader = header
  if (header.bankAccounts && Object.keys(header.bankAccounts).length === 0) {
    nextHeader = { ...header }
    delete nextHeader.bankAccounts
  }

  const nextLines: Record<string, LineItemOverrides> = {}
  for (const [lineId, line] of Object.entries(lines)) {
    if (Object.keys(line).length > 0) nextLines[lineId] = line
  }

  const next: InvoiceReview = {
    status: review?.status ?? 'pending',
    ...(review?.setAsideReason
      ? { setAsideReason: review.setAsideReason }
      : {}),
    overrides: { header: nextHeader, lines: nextLines },
    updatedAt: now,
  }
  if (
    next.status === 'pending' &&
    !next.setAsideReason &&
    Object.keys(nextHeader).length === 0 &&
    Object.keys(nextLines).length === 0
  ) {
    return undefined
  }
  return next
}

function lineOnInvoice(
  original: OriginalInvoice,
  lineId: string,
): OriginalLineItem | undefined {
  return original.lineItems.find(
    (line) => line.id === lineId && line.invoiceId === original.id,
  )
}

function effectiveBankAccounts(
  original: OriginalInvoice,
  overrides: Readonly<Record<string, string>> | undefined,
): readonly string[] {
  return original.fields.bankAccounts.value.map((account, index) => {
    const key = String(index)
    if (overrides && Object.hasOwn(overrides, key))
      return overrides[key] ?? account
    return account
  })
}

function effectiveLine(
  line: OriginalLineItem,
  overrides: LineItemOverrides | undefined,
): EffectiveLineItem {
  return {
    id: line.id,
    invoiceId: line.invoiceId,
    index: line.index,
    description: overridden(overrides, 'description', line.description.value),
    quantity: overridden(overrides, 'quantity', line.quantity.value),
    unit: overridden(overrides, 'unit', line.unit.value),
    unitPrice: overridden(overrides, 'unitPrice', line.unitPrice.value),
    vatRate: overridden(overrides, 'vatRate', line.vatRate.value),
    lineTotal: overridden(overrides, 'lineTotal', line.lineTotal.value),
  }
}

function textValue(
  header: HeaderOverrides | undefined,
  field: TextHeaderField,
  original: string | null,
): string | null {
  return overridden(header, field, original)
}

function numberValue(
  header: HeaderOverrides | undefined,
  field: NumberHeaderField,
  original: number,
): number | null {
  return overridden(header, field, original)
}

function overridden<T>(
  overrides: object | undefined,
  field: string,
  original: T,
): T {
  if (overrides && Object.hasOwn(overrides, field)) {
    return (overrides as Record<string, T>)[field] as T
  }
  return original
}

function writeField(
  target: HeaderOverrides | LineItemOverrides,
  field: string,
  value: string | number | null,
) {
  ;(target as Record<string, string | number | null>)[field] = value
}

function sameValue(
  value: string | number | null,
  original: string | number | null,
): boolean {
  if (typeof value === 'number' && typeof original === 'number') {
    return Object.is(value, original)
  }
  return value === original
}
