import type { IssueTarget } from '../model/validation.ts'

export const DOCUMENT_REGION_ID = 'original-document'

export function headerFieldId(invoiceId: string, field: string): string {
  return `field-${invoiceId}-${field}`
}

export function bankFieldId(invoiceId: string, index: number): string {
  return `field-${invoiceId}-bank-${index}`
}

const LINE_FOCUS_FIELDS = [
  'description',
  'quantity',
  'unit',
  'unitPrice',
  'vatRate',
  'lineTotal',
] as const

export function lineFieldId(lineId: string, field: string): string {
  return `line-${lineId}-${field}`
}

export function lineIdFromFocusId(id: string): string | null {
  if (!id.startsWith('line-')) return null
  for (const field of LINE_FOCUS_FIELDS) {
    const suffix = `-${field}`
    if (id.endsWith(suffix)) return id.slice('line-'.length, -suffix.length)
  }
  return null
}

export function focusIdForTarget(
  invoiceId: string,
  target: IssueTarget,
): string | null {
  if (target.type === 'document') return DOCUMENT_REGION_ID
  if (target.type === 'invoice') return null
  if (target.type === 'field') {
    if (target.field === 'bankAccounts') return bankFieldId(invoiceId, 0)
    return headerFieldId(invoiceId, target.field)
  }
  return lineFieldId(target.lineId, target.field)
}
