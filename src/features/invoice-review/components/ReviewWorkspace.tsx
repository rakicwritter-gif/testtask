import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import {
  AppShell,
  Button,
  Group,
  NativeSelect,
  Text,
  Title,
} from '@mantine/core'
import { clients, invoices } from '../data/invoices.ts'
import { getEffectiveInvoice } from '../model/corrections.ts'
import { nextPendingInvoiceId, reviewProgress } from '../model/decisions.ts'
import { issuesForInvoice } from '../model/selectors.ts'
import { useReviewStore } from '../model/review-store.ts'
import type { OriginalInvoice } from '../model/types.ts'
import { attentionLabel, getQueueGroup } from '../model/validation.ts'
import { reviewStatusLabel } from './display.ts'
import { DocumentViewer } from './DocumentViewer.tsx'
import { InvoiceQueue } from './InvoiceQueue.tsx'
import { ReviewPanel } from './ReviewPanel.tsx'
import classes from './workspace.module.css'

type QueuePreference = 'auto' | 'open' | 'closed'

export function ReviewWorkspace() {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [invoiceId, setInvoiceId] = useState<string | null>(
    invoices.find((invoice) => invoice.client.id === clients[0]?.id)?.id ??
      null,
  )
  const isNarrow = useMediaQuery('(max-width: 1200px)') ?? false
  const [queuePreference, setQueuePreference] =
    useState<QueuePreference>('auto')
  const [notice, setNotice] = useState<string | null>(null)
  const queueCollapsed =
    queuePreference === 'auto' ? isNarrow : queuePreference === 'closed'
  const reviews = useReviewStore((state) => state.reviews)
  const clientInvoices = invoices.filter(
    (invoice) => invoice.client.id === clientId,
  )
  const selected = selectedInvoice(clientInvoices, invoiceId)
  const queueInvoices = clientInvoices.map((invoice) => {
    const review = reviews[invoice.id]
    const effective = getEffectiveInvoice(invoice, review)
    const issues = issuesForInvoice(invoice.id, reviews)
    return {
      id: invoice.id,
      vendorName: effective.fields.vendorName,
      invoiceNumber: effective.fields.invoiceNumber,
      totalAmount: effective.fields.totalAmount,
      currency: effective.fields.currency,
      group: getQueueGroup(review, issues),
      attention: attentionLabel(issues),
      statusLabel: reviewStatusLabel(review?.status),
    }
  })
  const selectedIssues = selected ? issuesForInvoice(selected.id, reviews) : []
  const progress = reviewProgress(
    clientInvoices.map((invoice) => invoice.id),
    reviews,
  )

  function openInvoice(id: string) {
    const invoice = invoices.find((item) => item.id === id)
    if (!invoice) return
    setNotice(null)
    setClientId(invoice.client.id)
    setInvoiceId(id)
  }

  function finishDecision(invoiceId: string, summary: string) {
    const next = nextPendingInvoiceId(
      clientInvoices.map((invoice) => invoice.id),
      useReviewStore.getState().reviews,
      invoiceId,
    )
    if (next) {
      setInvoiceId(next)
      setNotice(`${summary} Opened the next pending invoice.`)
      return
    }
    setNotice(`${summary} No pending invoices remain for this client.`)
  }

  function selectClient(nextClientId: string) {
    const nextInvoices = invoices.filter(
      (invoice) => invoice.client.id === nextClientId,
    )
    setNotice(null)
    setClientId(nextClientId)
    setInvoiceId((current) => {
      if (current && nextInvoices.some((invoice) => invoice.id === current))
        return current
      return nextInvoices[0]?.id ?? null
    })
  }

  return (
    <AppShell
      className={classes.column}
      header={{ height: 56 }}
      navbar={{
        width: 264,
        breakpoint: 'xs',
        collapsed: { desktop: queueCollapsed, mobile: queueCollapsed },
      }}
      aside={{ width: 468, breakpoint: 'xs' }}
      padding={0}
      h="100%"
    >
      <AppShell.Header>
        <Group
          className={classes.headerGroup}
          px="md"
          justify="space-between"
          wrap="nowrap"
        >
          <Group gap="sm" wrap="nowrap">
            <Button
              size="compact-sm"
              variant="default"
              aria-expanded={!queueCollapsed}
              aria-controls="invoice-queue"
              onClick={() =>
                setQueuePreference(queueCollapsed ? 'open' : 'closed')
              }
            >
              {queueCollapsed ? 'Show queue' : 'Hide queue'}
            </Button>
            <Title order={1} size="h4">
              Invoice Review
            </Title>
            <Text size="xs" className={classes.progress}>
              Pending {progress.pending} · Set aside {progress.setAside} ·
              Confirmed {progress.confirmed}
            </Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text component="label" htmlFor="client-select" size="sm">
              Client
            </Text>
            <NativeSelect
              id="client-select"
              size="xs"
              w={260}
              value={clientId}
              data={clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
              onChange={(event) => selectClient(event.currentTarget.value)}
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        id="invoice-queue"
        className={classes.navbar}
        p={0}
        hidden={queueCollapsed}
      >
        <InvoiceQueue
          invoices={queueInvoices}
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            setNotice(null)
            setInvoiceId(id)
          }}
        />
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <DocumentViewer invoice={selected} />
      </AppShell.Main>

      <AppShell.Aside className={classes.aside} p={0}>
        <ReviewPanel
          invoice={selected}
          issues={selectedIssues}
          notice={notice}
          onOpenInvoice={openInvoice}
          onCompleted={(summary) => {
            if (selected) finishDecision(selected.id, summary)
          }}
          onNotice={setNotice}
        />
      </AppShell.Aside>
    </AppShell>
  )
}

function selectedInvoice(
  clientInvoices: readonly OriginalInvoice[],
  invoiceId: string | null,
): OriginalInvoice | null {
  return (
    clientInvoices.find((invoice) => invoice.id === invoiceId) ??
    clientInvoices[0] ??
    null
  )
}
