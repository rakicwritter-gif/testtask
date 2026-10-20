import rawDataset from './invoices.json' with { type: 'json' }
import { normalizeDataset } from '../model/normalize.ts'
import type { OriginalInvoice } from '../model/types.ts'

const dataset = normalizeDataset(rawDataset)

export const invoices: readonly OriginalInvoice[] = dataset.invoices
export const clients = dataset.clients

export function getInvoiceById(id: string): OriginalInvoice | undefined {
  return dataset.byId.get(id)
}
