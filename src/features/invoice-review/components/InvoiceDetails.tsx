import { useState, type ReactNode } from 'react'
import { Button } from '@mantine/core'
import type { OriginalInvoice } from '../model/types.ts'
import {
  CURRENCY_NOT_DETECTED,
  formatAmount,
  formatInvoiceNumber,
  formatOptionalText,
} from './display.ts'
import classes from './workspace.module.css'

type InvoiceDetailsProps = {
  invoice: OriginalInvoice
}

export function InvoiceDetails({ invoice }: InvoiceDetailsProps) {
  const [additionalOpen, setAdditionalOpen] = useState(true)
  const { fields } = invoice
  const currency = fields.currency.value

  return (
    <div>
      <h3 className={classes.sectionTitle}>Essential details</h3>
      <dl className={classes.fields}>
        <Field label="Supplier">{fields.vendorName.value}</Field>
        <Field label="Supplier tax ID">
          {formatOptionalText(fields.vendorTaxId.value)}
        </Field>
        <Field label="Supplier VAT ID">
          {formatOptionalText(fields.vendorVatId.value)}
        </Field>
        <Field label="Buyer">{fields.buyerName.value}</Field>
        <Field label="Buyer tax ID">{fields.buyerTaxId.value}</Field>
        <Field label="Invoice number">
          {formatInvoiceNumber(fields.invoiceNumber.value)}
        </Field>
        <Field label="Issue date">{fields.issueDate.value}</Field>
        <Field label="Supply date">
          {formatOptionalText(fields.supplyDate.value)}
        </Field>
        <Field label="Due date">
          {formatOptionalText(fields.dueDate.value)}
        </Field>
      </dl>

      <h3 className={classes.sectionTitle}>Amounts</h3>
      <dl className={classes.fields}>
        <Field label="Currency">{currency ?? CURRENCY_NOT_DETECTED}</Field>
        <Field label="Net">
          {formatAmount(fields.netAmount.value, currency)}
        </Field>
        <Field label="VAT">
          {formatAmount(fields.vatAmount.value, currency)}
        </Field>
        <Field label="Total">
          {formatAmount(fields.totalAmount.value, currency)}
        </Field>
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
          <Field label="Payment reference">
            {formatOptionalText(fields.paymentReference.value)}
          </Field>
          <Field label="Bank accounts">
            <BankAccounts accounts={fields.bankAccounts.value} />
          </Field>
          <Field label="Received">{invoice.receivedAt}</Field>
          <Field label="Channel">{formatChannel(invoice.channel)}</Field>
          <Field label="Original filename">{invoice.originalFilename}</Field>
        </dl>
      ) : null}
    </div>
  )
}

function BankAccounts({ accounts }: { accounts: readonly string[] }) {
  if (accounts.length === 0) return formatOptionalText(null)
  return (
    <ul className={classes.accounts} aria-label="Bank accounts">
      {accounts.map((account, index) => (
        <li key={`${account}-${index}`}>{account}</li>
      ))}
    </ul>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

function formatChannel(channel: OriginalInvoice['channel']): string {
  if (channel === 'mobile') return 'Mobile'
  return 'Email'
}
