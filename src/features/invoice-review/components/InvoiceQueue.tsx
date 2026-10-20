import type { KeyboardEvent } from 'react'
import { Badge, Text } from '@mantine/core'
import {
  CURRENCY_NOT_DETECTED,
  formatAmount,
  formatInvoiceNumber,
  NOT_DETECTED,
  PENDING_STATUS,
} from './display.ts'

export type QueueInvoice = {
  id: string
  vendorName: string | null
  invoiceNumber: string | null
  totalAmount: number | null
  currency: string | null
}
import classes from './workspace.module.css'

type InvoiceQueueProps = {
  invoices: readonly QueueInvoice[]
  selectedId: string | null
  onSelect: (invoiceId: string) => void
}

export function InvoiceQueue({
  invoices,
  selectedId,
  onSelect,
}: InvoiceQueueProps) {
  function moveSelection(event: KeyboardEvent<HTMLElement>, invoiceId: string) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const index = invoices.findIndex((invoice) => invoice.id === invoiceId)
    const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1
    const next = invoices[nextIndex]
    if (!next) return
    onSelect(next.id)
    document.getElementById(queueItemId(next.id))?.focus()
  }

  return (
    <div className={classes.column}>
      <div className={classes.scroll}>
        {invoices.length === 0 ? (
          <Text className={classes.missing} size="sm" c="dimmed">
            No invoices for this client.
          </Text>
        ) : (
          <nav aria-label="Invoices">
            {invoices.map((invoice) => {
              const selected = invoice.id === selectedId
              const currency = invoice.currency
              return (
                <button
                  key={invoice.id}
                  id={queueItemId(invoice.id)}
                  type="button"
                  className={classes.queueItem}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(invoice.id)}
                  onKeyDown={(event) => moveSelection(event, invoice.id)}
                >
                  <span className={classes.vendor}>
                    {invoice.vendorName ?? NOT_DETECTED}
                  </span>
                  <span className={classes.muted}>
                    {formatInvoiceNumber(invoice.invoiceNumber)}
                    {' · '}
                    {invoice.id}
                  </span>
                  <span className={classes.amountRow}>
                    <span className={classes.amount}>
                      {invoice.totalAmount === null
                        ? NOT_DETECTED
                        : formatAmount(invoice.totalAmount, currency)}
                    </span>
                    <Badge size="xs" variant="light" color="gray">
                      {PENDING_STATUS}
                    </Badge>
                  </span>
                  {currency === null ? (
                    <span className={classes.muted}>
                      {CURRENCY_NOT_DETECTED}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}

function queueItemId(invoiceId: string): string {
  return `invoice-queue-${invoiceId}`
}
