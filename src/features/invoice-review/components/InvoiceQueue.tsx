import { useState, type KeyboardEvent } from 'react'
import type { QueueGroup } from '../model/validation.ts'
import {
  CURRENCY_NOT_DETECTED,
  formatAmount,
  formatInvoiceNumber,
  NOT_DETECTED,
} from './display.ts'
import classes from './workspace.module.css'

export type QueueInvoice = {
  id: string
  vendorName: string | null
  invoiceNumber: string | null
  totalAmount: number | null
  currency: string | null
  group: QueueGroup
  attention: 'Blocking' | 'Warning' | null
  statusLabel: string
}

type InvoiceQueueProps = {
  invoices: readonly QueueInvoice[]
  selectedId: string | null
  onSelect: (invoiceId: string) => void
}

const GROUPS: readonly { id: QueueGroup; label: string }[] = [
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'no_issues', label: 'No detected issues' },
  { id: 'set_aside', label: 'Set aside' },
  { id: 'confirmed', label: 'Confirmed' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Attention' },
  { id: 'no_issues', label: 'No issues' },
] as const

type QueueFilter = (typeof FILTERS)[number]['id']

export function InvoiceQueue({
  invoices,
  selectedId,
  onSelect,
}: InvoiceQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>('all')
  const groups =
    filter === 'all' ? GROUPS : GROUPS.filter((group) => group.id === filter)
  const ordered = groups.flatMap((group) =>
    invoices.filter((invoice) => invoice.group === group.id),
  )

  function moveSelection(event: KeyboardEvent<HTMLElement>, invoiceId: string) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const index = ordered.findIndex((invoice) => invoice.id === invoiceId)
    const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1
    const next = ordered[nextIndex]
    if (!next) return
    onSelect(next.id)
    document.getElementById(queueItemId(next.id))?.focus()
  }

  function moveFilter(event: KeyboardEvent<HTMLDivElement>) {
    const index = FILTERS.findIndex((item) => item.id === filter)
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? FILTERS[(index + 1) % FILTERS.length]
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? FILTERS[(index - 1 + FILTERS.length) % FILTERS.length]
          : null
    if (!next) return
    event.preventDefault()
    setFilter(next.id)
  }

  return (
    <div className={classes.column}>
      <div
        className={classes.queueFilters}
        role="radiogroup"
        aria-label="Filter invoices"
        onKeyDown={moveFilter}
      >
        {FILTERS.map((item) => {
          const count =
            item.id === 'all'
              ? invoices.length
              : invoices.filter((invoice) => invoice.group === item.id).length
          return (
            <button
              key={item.id}
              type="button"
              className={classes.queueFilter}
              role="radio"
              aria-checked={filter === item.id}
              tabIndex={filter === item.id ? 0 : -1}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span className={classes.queueFilterCount}>{count}</span>
            </button>
          )
        })}
      </div>
      <div className={classes.scroll}>
        {invoices.length === 0 ? (
          <p className={classes.emptyQueue} role="status">
            No invoices for this client.
          </p>
        ) : ordered.length === 0 ? (
          <p className={classes.emptyQueue} role="status">
            No invoices in this view.
          </p>
        ) : (
          <nav aria-label="Invoices">
            {groups.map((group) => {
              const items = invoices.filter(
                (invoice) => invoice.group === group.id,
              )
              if (items.length === 0) return null
              return (
                <section
                  key={group.id}
                  className={classes.queueSection}
                  aria-labelledby={groupHeadingId(group.id)}
                >
                  <div className={classes.queueGroupRow}>
                    <h3
                      id={groupHeadingId(group.id)}
                      className={classes.queueGroup}
                    >
                      {group.label}
                    </h3>
                    <span className={classes.queueCount}>{items.length}</span>
                  </div>
                  {items.map((invoice) => {
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
                          <span className={classes.badges}>
                            {invoice.attention ? (
                              <span
                                className={
                                  invoice.attention === 'Blocking'
                                    ? classes.attentionBlocking
                                    : classes.attentionWarning
                                }
                              >
                                {invoice.attention}
                              </span>
                            ) : null}
                            <span
                              className={`${classes.statusPill} ${statusTone(invoice.statusLabel)}`}
                            >
                              {invoice.statusLabel}
                            </span>
                          </span>
                        </span>
                        {currency === null ? (
                          <span className={classes.muted}>
                            {CURRENCY_NOT_DETECTED}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}

function statusTone(label: string): string {
  if (label === 'Confirmed') return classes.statusConfirmed
  if (label === 'Set aside') return classes.statusAside
  return classes.statusPending
}

function queueItemId(invoiceId: string): string {
  return `invoice-queue-${invoiceId}`
}

function groupHeadingId(group: QueueGroup): string {
  return `queue-group-${group}`
}
