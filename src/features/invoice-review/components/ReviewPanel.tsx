import { useState } from 'react'
import { Badge, Tabs, Text, Title } from '@mantine/core'
import { getEffectiveInvoice } from '../model/corrections.ts'
import { useReviewStore } from '../model/review-store.ts'
import type { OriginalInvoice } from '../model/types.ts'
import { formatInvoiceNumber, NOT_DETECTED, PENDING_STATUS } from './display.ts'
import { InvoiceDetails } from './InvoiceDetails.tsx'
import { LineItemsTable } from './LineItemsTable.tsx'
import classes from './workspace.module.css'

type ReviewPanelProps = {
  invoice: OriginalInvoice | null
}

export function ReviewPanel({ invoice }: ReviewPanelProps) {
  const [tab, setTab] = useState('details')
  const review = useReviewStore((state) =>
    invoice ? state.reviews[invoice.id] : undefined,
  )
  const effective = invoice ? getEffectiveInvoice(invoice, review) : null

  return (
    <section className={classes.panel} aria-label="Invoice review">
      {invoice && effective ? (
        <>
          <header className={classes.panelHeader}>
            <Title order={2} size="h4">
              {effective.fields.vendorName ?? NOT_DETECTED}
            </Title>
            <Text className={classes.muted} mt={4}>
              {formatInvoiceNumber(effective.fields.invoiceNumber)}
              {' · '}
              {invoice.id}
              {' · '}
              {invoice.client.name}
            </Text>
            <Badge mt={8} size="sm" variant="light" color="gray">
              {PENDING_STATUS}
            </Badge>
          </header>
          <Tabs
            value={tab}
            keepMounted={false}
            onChange={(value) => {
              if (value) setTab(value)
            }}
            classNames={{
              root: classes.tabs,
              list: classes.tabList,
              panel: classes.tabPanel,
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="lines">
                Line items ({invoice.lineItems.length})
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="details" style={{ overflow: 'auto' }}>
              <InvoiceDetails key={invoice.id} invoice={invoice} />
            </Tabs.Panel>
            <Tabs.Panel value="lines" style={{ overflow: 'auto' }}>
              <LineItemsTable key={invoice.id} invoice={invoice} />
            </Tabs.Panel>
          </Tabs>
        </>
      ) : (
        <div className={classes.missing}>
          <Title order={2} size="h4">
            No invoice selected
          </Title>
          <Text size="sm" mt={8}>
            Select an invoice from the queue to read its extracted details.
          </Text>
        </div>
      )}
    </section>
  )
}
