import type {
  Client,
  ExtractedField,
  InvoiceChannel,
  NormalizedInvoiceDataset,
  OriginalInvoice,
  OriginalInvoiceFields,
  OriginalLineItem,
  SourceDocument,
} from './types.ts'

export class InvoiceDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceDataError'
  }
}

export const INVOICE_DOCUMENT_URL_PREFIX = '/invoices'

const INVOICE_KEYS = [
  'id',
  'client',
  'receivedAt',
  'channel',
  'originalFilename',
  'original',
  'fields',
  'lineItems',
] as const

const CLIENT_KEYS = ['id', 'name', 'taxId'] as const

const REQUIRED_DOCUMENT_KEYS = ['path', 'mimeType', 'pages'] as const
const OPTIONAL_DOCUMENT_KEYS = ['width', 'height'] as const

const LINE_ITEM_KEYS = [
  'description',
  'quantity',
  'unit',
  'unitPrice',
  'vatRate',
  'lineTotal',
] as const

const HEADER_FIELDS = {
  vendorName: 'string',
  vendorTaxId: 'nullable-string',
  vendorVatId: 'nullable-string',
  buyerName: 'string',
  buyerTaxId: 'string',
  invoiceNumber: 'nullable-string',
  issueDate: 'date',
  supplyDate: 'nullable-date',
  dueDate: 'nullable-date',
  currency: 'nullable-string',
  netAmount: 'number',
  vatAmount: 'number',
  totalAmount: 'number',
  paymentReference: 'nullable-string',
  bankAccounts: 'string-array',
} as const satisfies Record<keyof OriginalInvoiceFields, FieldKind>

type FieldKind =
  | 'string'
  | 'nullable-string'
  | 'date'
  | 'nullable-date'
  | 'number'
  | 'string-array'
type LineFieldKind = FieldKind | 'nullable-number'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RECEIVED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

const CHANNELS = ['mobile', 'email'] as const

export function createLineItemId(invoiceId: string, index: number): string {
  return `${invoiceId}:${index}`
}

export function resolveOriginalDocumentUrl(sourcePath: string): string {
  const fileName = fileNameFromPath(sourcePath)
  return `${INVOICE_DOCUMENT_URL_PREFIX}/${encodeURIComponent(fileName)}`
}

export function normalizeDataset(input: unknown): NormalizedInvoiceDataset {
  const root = asRecord(input, 'Invoice dataset')
  assertExactKeys(root, ['invoices'], 'Invoice dataset')
  if (!Array.isArray(root.invoices)) {
    throw new InvoiceDataError('Invoice dataset invoices must be an array.')
  }

  const invoices = root.invoices.map((entry, index) =>
    normalizeInvoice(entry, index),
  )
  const seenIds = new Set<string>()
  for (const invoice of invoices) {
    if (seenIds.has(invoice.id)) {
      throw new InvoiceDataError(`Duplicate invoice id "${invoice.id}".`)
    }
    seenIds.add(invoice.id)
  }

  const frozenInvoices = Object.freeze(invoices)
  return {
    invoices: frozenInvoices,
    clients: Object.freeze(collectClients(frozenInvoices)),
    byId: new Map(frozenInvoices.map((invoice) => [invoice.id, invoice])),
  }
}

export function normalizeInvoice(input: unknown, index = 0): OriginalInvoice {
  const record = asRecord(input, `Invoice at index ${index}`)
  assertExactKeys(record, INVOICE_KEYS, `Invoice at index ${index}`)

  const id = readNonEmptyString(record.id, `Invoice at index ${index} id`)
  if (id.includes(':')) {
    throw new InvoiceDataError(
      `${id}: invoice id cannot contain ":" because line identities use that separator.`,
    )
  }

  const client = readClient(record.client, id)
  const receivedAt = readNonEmptyString(record.receivedAt, `${id} receivedAt`)
  if (!RECEIVED_AT.test(receivedAt)) {
    throw new InvoiceDataError(
      `${id}: receivedAt must be an ISO date-time with a numeric offset.`,
    )
  }

  const channel = readChannel(record.channel, id)
  const originalFilename = readNonEmptyString(
    record.originalFilename,
    `${id} originalFilename`,
  )
  const document = readDocument(record.original, id)
  const fields = readHeaderFields(record.fields, id)
  const lineItems = readLineItems(record.lineItems, id)

  return freezeDeep({
    id,
    client,
    receivedAt,
    channel,
    originalFilename,
    document,
    fields,
    lineItems,
  })
}

function collectClients(invoices: readonly OriginalInvoice[]): Client[] {
  const clients: Client[] = []
  const seen = new Map<string, Client>()

  for (const invoice of invoices) {
    const existing = seen.get(invoice.client.id)
    if (!existing) {
      const client = freezeDeep({ ...invoice.client })
      seen.set(client.id, client)
      clients.push(client)
      continue
    }

    if (
      existing.name !== invoice.client.name ||
      existing.taxId !== invoice.client.taxId
    ) {
      throw new InvoiceDataError(
        `${invoice.id}: client "${invoice.client.id}" does not match an earlier record.`,
      )
    }
  }

  return clients
}

function readClient(input: unknown, invoiceId: string): Client {
  const record = asRecord(input, `${invoiceId} client`)
  assertExactKeys(record, CLIENT_KEYS, `${invoiceId} client`)
  return {
    id: readNonEmptyString(record.id, `${invoiceId} client.id`),
    name: readNonEmptyString(record.name, `${invoiceId} client.name`),
    taxId: readNonEmptyString(record.taxId, `${invoiceId} client.taxId`),
  }
}

function readChannel(input: unknown, invoiceId: string): InvoiceChannel {
  if (typeof input !== 'string' || !isChannel(input)) {
    throw new InvoiceDataError(`${invoiceId}: channel must be mobile or email.`)
  }
  return input
}

function isChannel(value: string): value is InvoiceChannel {
  return CHANNELS.some((channel) => channel === value)
}

function readDocument(
  input: unknown,
  invoiceId: string,
): SourceDocument | null {
  if (input === null) return null
  const record = asRecord(input, `${invoiceId} original`)
  assertAllowedKeys(
    record,
    REQUIRED_DOCUMENT_KEYS,
    OPTIONAL_DOCUMENT_KEYS,
    `${invoiceId} original`,
  )

  const sourcePath = readNonEmptyString(
    record.path,
    `${invoiceId} original.path`,
  )
  const fileName = fileNameFromPath(sourcePath)
  const mimeType = readNonEmptyString(
    record.mimeType,
    `${invoiceId} original.mimeType`,
  )
  const pages = readPositiveInteger(record.pages, `${invoiceId} original.pages`)

  return {
    url: resolveOriginalDocumentUrl(sourcePath),
    fileName,
    sourcePath,
    mimeType,
    pages,
    width: readOptionalDimension(record, 'width', invoiceId),
    height: readOptionalDimension(record, 'height', invoiceId),
  }
}

function readOptionalDimension(
  record: Record<string, unknown>,
  key: 'width' | 'height',
  invoiceId: string,
): number | null {
  if (!Object.hasOwn(record, key)) return null
  return readNullablePositiveNumber(record[key], `${invoiceId} original.${key}`)
}

function readHeaderFields(
  input: unknown,
  invoiceId: string,
): OriginalInvoiceFields {
  const record = asRecord(input, `${invoiceId} fields`)
  assertExactKeys(record, Object.keys(HEADER_FIELDS), `${invoiceId} fields`)

  const label = `${invoiceId} fields`
  return {
    vendorName: readExtractedField(
      record.vendorName,
      'string',
      `${label}.vendorName`,
    ),
    vendorTaxId: readExtractedField(
      record.vendorTaxId,
      'nullable-string',
      `${label}.vendorTaxId`,
    ),
    vendorVatId: readExtractedField(
      record.vendorVatId,
      'nullable-string',
      `${label}.vendorVatId`,
    ),
    buyerName: readExtractedField(
      record.buyerName,
      'string',
      `${label}.buyerName`,
    ),
    buyerTaxId: readExtractedField(
      record.buyerTaxId,
      'string',
      `${label}.buyerTaxId`,
    ),
    invoiceNumber: readExtractedField(
      record.invoiceNumber,
      'nullable-string',
      `${label}.invoiceNumber`,
    ),
    issueDate: readExtractedField(
      record.issueDate,
      'date',
      `${label}.issueDate`,
    ),
    supplyDate: readExtractedField(
      record.supplyDate,
      'nullable-date',
      `${label}.supplyDate`,
    ),
    dueDate: readExtractedField(
      record.dueDate,
      'nullable-date',
      `${label}.dueDate`,
    ),
    currency: readExtractedField(
      record.currency,
      'nullable-string',
      `${label}.currency`,
    ),
    netAmount: readExtractedField(
      record.netAmount,
      'number',
      `${label}.netAmount`,
    ),
    vatAmount: readExtractedField(
      record.vatAmount,
      'number',
      `${label}.vatAmount`,
    ),
    totalAmount: readExtractedField(
      record.totalAmount,
      'number',
      `${label}.totalAmount`,
    ),
    paymentReference: readExtractedField(
      record.paymentReference,
      'nullable-string',
      `${label}.paymentReference`,
    ),
    bankAccounts: readExtractedField(
      record.bankAccounts,
      'string-array',
      `${label}.bankAccounts`,
    ),
  }
}

function readLineItems(
  input: unknown,
  invoiceId: string,
): readonly OriginalLineItem[] {
  if (!Array.isArray(input)) {
    throw new InvoiceDataError(`${invoiceId}: lineItems must be an array.`)
  }

  return input.map((entry, index) => {
    const record = asRecord(entry, `${invoiceId} lineItems[${index}]`)
    assertExactKeys(record, LINE_ITEM_KEYS, `${invoiceId} lineItems[${index}]`)
    return {
      id: createLineItemId(invoiceId, index),
      invoiceId,
      index,
      description: readExtractedField(
        record.description,
        'string',
        `${invoiceId} lineItems[${index}].description`,
      ),
      quantity: readExtractedField(
        record.quantity,
        'number',
        `${invoiceId} lineItems[${index}].quantity`,
      ),
      unit: readExtractedField(
        record.unit,
        'nullable-string',
        `${invoiceId} lineItems[${index}].unit`,
      ),
      unitPrice: readExtractedField(
        record.unitPrice,
        'nullable-number',
        `${invoiceId} lineItems[${index}].unitPrice`,
      ),
      vatRate: readExtractedField(
        record.vatRate,
        'nullable-number',
        `${invoiceId} lineItems[${index}].vatRate`,
      ),
      lineTotal: readExtractedField(
        record.lineTotal,
        'number',
        `${invoiceId} lineItems[${index}].lineTotal`,
      ),
    }
  })
}

function readExtractedField(
  input: unknown,
  kind: 'string' | 'date',
  label: string,
): ExtractedField<string>
function readExtractedField(
  input: unknown,
  kind: 'nullable-string' | 'nullable-date',
  label: string,
): ExtractedField<string | null>
function readExtractedField(
  input: unknown,
  kind: 'number',
  label: string,
): ExtractedField<number>
function readExtractedField(
  input: unknown,
  kind: 'nullable-number',
  label: string,
): ExtractedField<number | null>
function readExtractedField(
  input: unknown,
  kind: 'string-array',
  label: string,
): ExtractedField<string[]>
function readExtractedField(
  input: unknown,
  kind: LineFieldKind,
  label: string,
): ExtractedField<string | number | readonly string[] | null> {
  const record = asRecord(input, label)
  assertExactKeys(record, ['value', 'confidence'], label)
  return {
    value: readFieldValue(record.value, kind, label),
    confidence: readConfidence(record.confidence, label),
  }
}

function readFieldValue(
  value: unknown,
  kind: LineFieldKind,
  label: string,
): string | number | string[] | null {
  switch (kind) {
    case 'string':
      return readString(value, label)
    case 'nullable-string':
      return value === null ? null : readString(value, label)
    case 'date':
      return readDate(value, label)
    case 'nullable-date':
      return value === null ? null : readDate(value, label)
    case 'number':
      return readNumber(value, label)
    case 'nullable-number':
      return value === null ? null : readNumber(value, label)
    case 'string-array':
      return readStringArray(value, label)
  }
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new InvoiceDataError(`${label} value must be an array of strings.`)
  }
  return value.map((entry, index) =>
    readString(entry, `${label} value[${index}]`),
  )
}

function readDate(value: unknown, label: string): string {
  const date = readString(value, label)
  if (!ISO_DATE.test(date)) {
    throw new InvoiceDataError(`${label} value must be an ISO date.`)
  }
  return date
}

function readConfidence(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvoiceDataError(`${label} confidence must be a finite number.`)
  }
  return value
}

function readNullablePositiveNumber(
  value: unknown,
  label: string,
): number | null {
  if (value === null) return null
  const number = readNumber(value, label)
  if (number <= 0) {
    throw new InvoiceDataError(`${label} must be positive when present.`)
  }
  return number
}

function readPositiveInteger(value: unknown, label: string): number {
  const number = readNumber(value, label)
  if (!Number.isInteger(number) || number < 1) {
    throw new InvoiceDataError(`${label} must be a positive integer.`)
  }
  return number
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvoiceDataError(`${label} must be a finite number.`)
  }
  return value
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new InvoiceDataError(`${label} must be a string.`)
  }
  return value
}

function readNonEmptyString(value: unknown, label: string): string {
  const text = readString(value, label)
  if (text.trim() === '') {
    throw new InvoiceDataError(`${label} must not be empty.`)
  }
  return text
}

function fileNameFromPath(sourcePath: string): string {
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    throw new InvoiceDataError(
      'Original document path must be a non-empty string.',
    )
  }
  if (sourcePath.includes('..')) {
    throw new InvoiceDataError(
      `Original document path "${sourcePath}" cannot contain "..".`,
    )
  }
  const fileName = sourcePath.split(/[/\\]/).pop()
  if (!fileName || fileName === '.' || fileName.includes('..')) {
    throw new InvoiceDataError(
      `Original document path "${sourcePath}" does not include a file name.`,
    )
  }
  return fileName
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional])
  const missing = required.filter((key) => !Object.hasOwn(record, key))
  const unexpected = Object.keys(record).filter((key) => !allowed.has(key))
  if (missing.length === 0 && unexpected.length === 0) return

  const details = [
    missing.length > 0 ? `missing ${missing.join(', ')}` : null,
    unexpected.length > 0 ? `unexpected ${unexpected.join(', ')}` : null,
  ]
    .filter((part) => part !== null)
    .join('; ')
  throw new InvoiceDataError(`${label} has ${details}.`)
}

function assertExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(record)
  const expected = new Set(keys)
  const missing = keys.filter((key) => !Object.hasOwn(record, key))
  const unexpected = actual.filter((key) => !expected.has(key))
  if (missing.length === 0 && unexpected.length === 0) return

  const details = [
    missing.length > 0 ? `missing ${missing.join(', ')}` : null,
    unexpected.length > 0 ? `unexpected ${unexpected.join(', ')}` : null,
  ]
    .filter((part) => part !== null)
    .join('; ')
  throw new InvoiceDataError(`${label} has ${details}.`)
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }

  for (const child of Object.values(value)) {
    freezeDeep(child)
  }
  return Object.freeze(value)
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvoiceDataError(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}
