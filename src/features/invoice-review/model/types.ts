export type ExtractedField<T> = {
  value: T
  confidence: number
}

export type Client = {
  id: string
  name: string
  taxId: string
}

export type InvoiceChannel = 'mobile' | 'email'

/** A supplied original that exists as a static file. Missing originals are null on the invoice. */
export type SourceDocument = {
  url: string
  fileName: string
  sourcePath: string
  mimeType: string
  pages: number
  width: number | null
  height: number | null
}

export type OriginalLineItem = {
  /** Stable identity: invoice id plus the zero-based index in the source array. */
  id: string
  invoiceId: string
  index: number
  description: ExtractedField<string>
  quantity: ExtractedField<number>
  unit: ExtractedField<string | null>
  unitPrice: ExtractedField<number | null>
  vatRate: ExtractedField<number | null>
  lineTotal: ExtractedField<number>
}

export type OriginalInvoiceFields = {
  vendorName: ExtractedField<string>
  vendorTaxId: ExtractedField<string | null>
  vendorVatId: ExtractedField<string | null>
  buyerName: ExtractedField<string>
  buyerTaxId: ExtractedField<string>
  invoiceNumber: ExtractedField<string | null>
  issueDate: ExtractedField<string>
  supplyDate: ExtractedField<string | null>
  dueDate: ExtractedField<string | null>
  currency: ExtractedField<string | null>
  netAmount: ExtractedField<number>
  vatAmount: ExtractedField<number>
  totalAmount: ExtractedField<number>
  paymentReference: ExtractedField<string | null>
  bankAccounts: ExtractedField<readonly string[]>
}

export type OriginalInvoice = {
  id: string
  client: Client
  receivedAt: string
  channel: InvoiceChannel
  originalFilename: string
  document: SourceDocument | null
  fields: OriginalInvoiceFields
  lineItems: readonly OriginalLineItem[]
}

export type NormalizedInvoiceDataset = {
  invoices: readonly OriginalInvoice[]
  clients: readonly Client[]
  byId: ReadonlyMap<string, OriginalInvoice>
}
