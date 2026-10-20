import { useLayoutEffect, useRef, useState } from 'react'
import { Badge, Tabs, Text, Title } from '@mantine/core'
import { getEffectiveInvoice } from '../model/corrections.ts'
import { useReviewStore } from '../model/review-store.ts'
import type { OriginalInvoice } from '../model/types.ts'
import type { ReviewIssue } from '../model/validation.ts'
import {
  formatInvoiceNumber,
  NOT_DETECTED,
  reviewStatusLabel,
} from './display.ts'
import { focusIdForTarget } from './field-ids.ts'
import { InvoiceDetails } from './InvoiceDetails.tsx'
import { IssuesSummary } from './IssuesSummary.tsx'
import { LineItemsTable } from './LineItemsTable.tsx'
import { ReviewActions } from './ReviewActions.tsx'
import classes from './workspace.module.css'

type ReviewPanelProps = {
  invoice: OriginalInvoice | null
  issues: readonly ReviewIssue[]
  notice: string | null
  onOpenInvoice: (invoiceId: string) => void
  onCompleted: (summary: string) => void
  onNotice: (summary: string) => void
}

type FocusRequest = {
  id: string
  nonce: number
}

export function ReviewPanel({
  invoice,
  issues,
  notice,
  onOpenInvoice,
  onCompleted,
  onNotice,
}: ReviewPanelProps) {
  const [tab, setTab] = useState('details')
  const [openAdditionalNonce, setOpenAdditionalNonce] = useState(0)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const focusNonce = useRef(0)
  const review = useReviewStore((state) =>
    invoice ? state.reviews[invoice.id] : undefined,
  )
  const effective = invoice ? getEffectiveInvoice(invoice, review) : null
  const locked = (review?.status ?? 'pending') !== 'pending'
  const detailCount = issues.filter(
    (issue) => issue.target.type === 'field',
  ).length
  const lineCount = issues.filter(
    (issue) => issue.target.type === 'line',
  ).length

  useLayoutEffect(() => {
    if (!focusRequest) return
    const node = document.getElementById(focusRequest.id)
    if (!node) return
    node.focus()
    node.scrollIntoView?.({ block: 'nearest' })
  }, [focusRequest, tab, openAdditionalNonce])

  function openIssue(issue: ReviewIssue) {
    if (!invoice) return
    if (issue.target.type === 'invoice') {
      onOpenInvoice(issue.target.invoiceId)
      return
    }
    if (issue.target.type === 'line') {
      setTab('lines')
    } else if (issue.target.type === 'field') {
      setTab('details')
      if (
        issue.target.field === 'paymentReference' ||
        issue.target.field === 'bankAccounts'
      ) {
        setOpenAdditionalNonce((nonce) => nonce + 1)
      }
    }
    const id = focusIdForTarget(invoice.id, issue.target)
    if (!id) return
    focusNonce.current += 1
    setFocusRequest({ id, nonce: focusNonce.current })
  }

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
              {reviewStatusLabel(review?.status)}
            </Badge>
          </header>
          <IssuesSummary
            invoiceId={invoice.id}
            issues={issues}
            onOpen={openIssue}
          />
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
              <Tabs.Tab value="details">
                Details
                {detailCount > 0 ? (
                  <span className={classes.tabCount}>
                    {detailCount} to review
                  </span>
                ) : null}
              </Tabs.Tab>
              <Tabs.Tab value="lines">
                Line items ({invoice.lineItems.length})
                {lineCount > 0 ? (
                  <span className={classes.tabCount}>
                    {lineCount} to review
                  </span>
                ) : null}
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="details" style={{ overflow: 'auto' }}>
              <InvoiceDetails
                key={invoice.id}
                invoice={invoice}
                issues={issues}
                openAdditionalNonce={openAdditionalNonce}
                locked={locked}
              />
            </Tabs.Panel>
            <Tabs.Panel value="lines" style={{ overflow: 'auto' }}>
              <LineItemsTable
                key={invoice.id}
                invoice={invoice}
                issues={issues}
                locked={locked}
              />
            </Tabs.Panel>
          </Tabs>
          <ReviewActions
            invoiceId={invoice.id}
            review={review}
            issues={issues}
            sourceAvailable={invoice.document !== null}
            notice={notice}
            onCompleted={onCompleted}
            onNotice={onNotice}
          />
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
