import { useState, type ReactNode } from 'react'
import type { OriginalInvoice } from '../model/types.ts'
import {
  getEffectiveInvoice,
  hasBankOverride,
  hasHeaderOverride,
  type NumberHeaderField,
  type TextHeaderField,
} from '../model/corrections.ts'
import {
  parseCurrencyCode,
  parseIsoDate,
  parseOptionalText,
} from '../model/input.ts'
import { useReviewStore } from '../model/review-store.ts'
import { parseDecimal, DECIMAL_SCALE } from '../utils/money.ts'
import { CorrectionField } from './CorrectionField.tsx'
import {
  CURRENCY_NOT_DETECTED,
  formatNumber,
  NOT_DETECTED,
  NO_INVOICE_NUMBER,
} from './display.ts'
import classes from './workspace.module.css'
import { Button } from '@mantine/core'

type InvoiceDetailsProps = {
  invoice: OriginalInvoice
}

const ESSENTIAL_FIELDS: readonly EssentialField[] = [
  {
    field: 'vendorName',
    label: 'Supplier',
    kind: 'text',
    emptyText: NOT_DETECTED,
  },
  {
    field: 'vendorTaxId',
    label: 'Supplier tax ID',
    kind: 'text',
    emptyText: NOT_DETECTED,
  },
  {
    field: 'vendorVatId',
    label: 'Supplier VAT ID',
    kind: 'text',
    emptyText: NOT_DETECTED,
  },
  { field: 'buyerName', label: 'Buyer', kind: 'text', emptyText: NOT_DETECTED },
  {
    field: 'buyerTaxId',
    label: 'Buyer tax ID',
    kind: 'text',
    emptyText: NOT_DETECTED,
  },
  {
    field: 'invoiceNumber',
    label: 'Invoice number',
    kind: 'text',
    emptyText: NO_INVOICE_NUMBER,
  },
  {
    field: 'issueDate',
    label: 'Issue date',
    kind: 'date',
    emptyText: NOT_DETECTED,
  },
  {
    field: 'supplyDate',
    label: 'Supply date',
    kind: 'date',
    emptyText: NOT_DETECTED,
  },
  {
    field: 'dueDate',
    label: 'Due date',
    kind: 'date',
    emptyText: NOT_DETECTED,
  },
]

type EssentialField = {
  field: TextHeaderField
  label: string
  kind: 'text' | 'date'
  emptyText: string
}

const AMOUNT_FIELDS: readonly {
  field: NumberHeaderField
  label: string
}[] = [
  { field: 'netAmount', label: 'Net' },
  { field: 'vatAmount', label: 'VAT' },
  { field: 'totalAmount', label: 'Total' },
]

export function InvoiceDetails({ invoice }: InvoiceDetailsProps) {
  const [additionalOpen, setAdditionalOpen] = useState(true)
  const review = useReviewStore((state) => state.reviews[invoice.id])
  const setTextOverride = useReviewStore((state) => state.setTextOverride)
  const setNumberOverride = useReviewStore((state) => state.setNumberOverride)
  const clearHeaderOverride = useReviewStore(
    (state) => state.clearHeaderOverride,
  )
  const setBankAccountOverride = useReviewStore(
    (state) => state.setBankAccountOverride,
  )
  const clearBankOverride = useReviewStore(
    (state) => state.clearBankAccountOverride,
  )
  const effective = getEffectiveInvoice(invoice, review)

  function commitText(field: TextHeaderField, raw: string): string | null {
    const parsed = parseOptionalText(raw)
    setTextOverride(
      invoice.id,
      field,
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  function commitDate(field: TextHeaderField, raw: string): string | null {
    const parsed = parseIsoDate(raw)
    if (parsed.status === 'invalid') return parsed.message
    setTextOverride(
      invoice.id,
      field,
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  function commitCurrency(raw: string): string | null {
    const parsed = parseCurrencyCode(raw)
    if (parsed.status === 'invalid') return parsed.message
    setTextOverride(
      invoice.id,
      'currency',
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  function commitAmount(field: NumberHeaderField, raw: string): string | null {
    const parsed = parseDecimal(raw, DECIMAL_SCALE.money)
    if (parsed.status === 'invalid') return parsed.message
    setNumberOverride(
      invoice.id,
      field,
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  return (
    <div>
      <h3 className={classes.sectionTitle}>Essential details</h3>
      <dl className={classes.fields}>
        {ESSENTIAL_FIELDS.map((item) => (
          <Field
            key={item.field}
            label={item.label}
            inputId={fieldId(invoice.id, item.field)}
          >
            <CorrectionField
              id={fieldId(invoice.id, item.field)}
              value={effective.fields[item.field] ?? ''}
              edited={hasHeaderOverride(review, item.field)}
              originalText={originalText(
                invoice.fields[item.field].value,
                item.emptyText,
              )}
              confidence={invoice.fields[item.field].confidence}
              emptyText={item.emptyText}
              onCommit={(raw) =>
                item.kind === 'date'
                  ? commitDate(item.field, raw)
                  : commitText(item.field, raw)
              }
              onRestore={() => clearHeaderOverride(invoice.id, item.field)}
            />
          </Field>
        ))}
      </dl>

      <h3 className={classes.sectionTitle}>Amounts</h3>
      <dl className={classes.fields}>
        <Field label="Currency" inputId={fieldId(invoice.id, 'currency')}>
          <CorrectionField
            id={fieldId(invoice.id, 'currency')}
            value={effective.fields.currency ?? ''}
            edited={hasHeaderOverride(review, 'currency')}
            originalText={originalText(
              invoice.fields.currency.value,
              CURRENCY_NOT_DETECTED,
            )}
            confidence={invoice.fields.currency.confidence}
            emptyText={CURRENCY_NOT_DETECTED}
            onCommit={commitCurrency}
            onRestore={() => clearHeaderOverride(invoice.id, 'currency')}
          />
        </Field>
        {AMOUNT_FIELDS.map((item) => (
          <Field
            key={item.field}
            label={item.label}
            inputId={fieldId(invoice.id, item.field)}
          >
            <CorrectionField
              id={fieldId(invoice.id, item.field)}
              value={formatInputNumber(effective.fields[item.field])}
              edited={hasHeaderOverride(review, item.field)}
              originalText={formatInputNumber(invoice.fields[item.field].value)}
              confidence={invoice.fields[item.field].confidence}
              emptyText={NOT_DETECTED}
              numeric
              onCommit={(raw) => commitAmount(item.field, raw)}
              onRestore={() => clearHeaderOverride(invoice.id, item.field)}
            />
          </Field>
        ))}
      </dl>

      <h3 className={classes.sectionTitle}>Additional details</h3>
      <Button
        size="compact-xs"
        variant="subtle"
        mb={8}
        aria-expanded={additionalOpen}
        onClick={() => setAdditionalOpen((open) => !open)}
      >
        {additionalOpen ? 'Hide additional details' : 'Show additional details'}
      </Button>
      {additionalOpen ? (
        <dl className={classes.fields}>
          <Field
            label="Payment reference"
            inputId={fieldId(invoice.id, 'paymentReference')}
          >
            <CorrectionField
              id={fieldId(invoice.id, 'paymentReference')}
              value={effective.fields.paymentReference ?? ''}
              edited={hasHeaderOverride(review, 'paymentReference')}
              originalText={originalText(
                invoice.fields.paymentReference.value,
                NOT_DETECTED,
              )}
              confidence={invoice.fields.paymentReference.confidence}
              emptyText={NOT_DETECTED}
              onCommit={(raw) => commitText('paymentReference', raw)}
              onRestore={() =>
                clearHeaderOverride(invoice.id, 'paymentReference')
              }
            />
          </Field>
          <Field label="Bank accounts">
            <BankAccounts
              invoice={invoice}
              accounts={effective.fields.bankAccounts}
              editedIndex={(index) => hasBankOverride(review, index)}
              onCommit={(index, raw) => {
                setBankAccountOverride(invoice.id, index, raw.trim())
                return null
              }}
              onRestore={(index) => clearBankOverride(invoice.id, index)}
            />
          </Field>
          <ReadonlyField label="Received">{invoice.receivedAt}</ReadonlyField>
          <ReadonlyField label="Channel">
            {invoice.channel === 'mobile' ? 'Mobile' : 'Email'}
          </ReadonlyField>
          <ReadonlyField label="Original filename">
            {invoice.originalFilename}
          </ReadonlyField>
        </dl>
      ) : null}
    </div>
  )
}

function BankAccounts({
  invoice,
  accounts,
  editedIndex,
  onCommit,
  onRestore,
}: {
  invoice: OriginalInvoice
  accounts: readonly string[]
  editedIndex: (index: number) => boolean
  onCommit: (index: number, raw: string) => string | null
  onRestore: (index: number) => void
}) {
  if (accounts.length === 0) return NOT_DETECTED
  return (
    <ul className={classes.accounts} aria-label="Bank accounts">
      {accounts.map((account, index) => {
        const original = invoice.fields.bankAccounts.value[index] ?? ''
        return (
          <li key={index}>
            <CorrectionField
              id={bankId(invoice.id, index)}
              ariaLabel={`Bank account ${index + 1}`}
              value={account}
              edited={editedIndex(index)}
              originalText={original === '' ? NOT_DETECTED : original}
              confidence={invoice.fields.bankAccounts.confidence}
              onCommit={(raw) => onCommit(index, raw)}
              onRestore={() => onRestore(index)}
            />
          </li>
        )
      })}
    </ul>
  )
}

function Field({
  label,
  inputId,
  children,
}: {
  label: string
  inputId?: string
  children: ReactNode
}) {
  return (
    <>
      <dt>{inputId ? <label htmlFor={inputId}>{label}</label> : label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function ReadonlyField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function fieldId(invoiceId: string, field: string): string {
  return `field-${invoiceId}-${field}`
}

function bankId(invoiceId: string, index: number): string {
  return `field-${invoiceId}-bank-${index}`
}

function originalText(value: string | null, emptyText: string): string {
  if (value === null || value.trim() === '') return emptyText
  return value
}

function formatInputNumber(value: number | null): string {
  if (value === null) return ''
  return formatNumber(value)
}
