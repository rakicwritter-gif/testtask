import { useLayoutEffect, useRef, useState } from 'react'
import { Badge, Tabs, Text, Title } from '@mantine/core'
import { getEffectiveInvoice } from '../model/corrections.ts'
import { useReviewStore } from '../model/review-store.ts'
import type { OriginalInvoice } from '../model/types.ts'
import type { ReviewIssue } from '../model/validation.ts'
import {
  formatAmount,
  formatInvoiceNumber,
  NOT_DETECTED,
  reviewStatusLabel,
} from './display.ts'
import { focusIdForTarget, lineIdFromFocusId } from './field-ids.ts'
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
  formSession: number
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
  formSession,
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
            <div className={classes.panelTitleRow}>
              <div>
                <Title order={2} className={classes.supplierName}>
                  {effective.fields.vendorName ?? NOT_DETECTED}
                </Title>
                <p className={classes.panelMeta}>
                  <span className={classes.panelInvoice}>
                    {formatInvoiceNumber(effective.fields.invoiceNumber)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{invoice.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{invoice.client.name}</span>
                </p>
              </div>
              <Badge
                size="sm"
                variant="light"
                color={statusColor(review?.status)}
              >
                {reviewStatusLabel(review?.status)}
              </Badge>
            </div>
            <p className={classes.panelAmount}>
              {effective.fields.totalAmount === null
                ? NOT_DETECTED
                : formatAmount(
                    effective.fields.totalAmount,
                    effective.fields.currency,
                  )}
            </p>
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
                key={`${invoice.id}-${formSession}`}
                invoice={invoice}
                issues={issues}
                openAdditionalNonce={openAdditionalNonce}
                locked={locked}
              />
            </Tabs.Panel>
            <Tabs.Panel value="lines" style={{ overflow: 'auto' }}>
              <LineItemsTable
                key={`${invoice.id}-${formSession}`}
                invoice={invoice}
                issues={issues}
                locked={locked}
                revealLineId={
                  focusRequest ? lineIdFromFocusId(focusRequest.id) : null
                }
              />
            </Tabs.Panel>
          </Tabs>
          <ReviewActions
            key={`${invoice.id}-${formSession}`}
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
        <div className={classes.statusCard} role="status">
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

function statusColor(status: string | undefined): string {
  if (status === 'confirmed') return 'green'
  if (status === 'set_aside') return 'orange'
  return 'gray'
}
