import { useState } from 'react'
import { Badge, Tabs, Text, Title } from '@mantine/core'
import type { OriginalInvoice } from '../model/types.ts'
import { formatInvoiceNumber, PENDING_STATUS } from './display.ts'
import { InvoiceDetails } from './InvoiceDetails.tsx'
import { LineItemsTable } from './LineItemsTable.tsx'
import classes from './workspace.module.css'

type ReviewPanelProps = {
  invoice: OriginalInvoice | null
}

export function ReviewPanel({ invoice }: ReviewPanelProps) {
  const [tab, setTab] = useState('details')

  return (
    <section className={classes.panel} aria-label="Invoice review">
      {invoice ? (
        <>
          <header className={classes.panelHeader}>
            <Title order={2} size="h4">
              {invoice.fields.vendorName.value}
            </Title>
            <Text className={classes.muted} mt={4}>
              {formatInvoiceNumber(invoice.fields.invoiceNumber.value)}
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
              <InvoiceDetails invoice={invoice} />
            </Tabs.Panel>
            <Tabs.Panel value="lines" style={{ overflow: 'auto' }}>
              <LineItemsTable invoice={invoice} />
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
