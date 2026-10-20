import { useState } from 'react'
import { Button, Group, Text, Textarea } from '@mantine/core'
import type { InvoiceReview } from '../model/corrections.ts'
import { useReviewStore } from '../model/review-store.ts'
import type { ReviewIssue } from '../model/validation.ts'
import { formatReviewTimestamp } from './display.ts'
import classes from './workspace.module.css'

type ReviewActionsProps = {
  invoiceId: string
  review: InvoiceReview | undefined
  issues: readonly ReviewIssue[]
  sourceAvailable: boolean
  notice: string | null
  onCompleted: (summary: string) => void
  onNotice: (summary: string) => void
}

export function ReviewActions({
  invoiceId,
  review,
  issues,
  sourceAvailable,
  notice,
  onCompleted,
  onNotice,
}: ReviewActionsProps) {
  const confirmInvoice = useReviewStore((state) => state.confirmInvoice)
  const setAsideInvoice = useReviewStore((state) => state.setAsideInvoice)
  const resumeInvoice = useReviewStore((state) => state.resumeInvoice)
  const [settingAside, setSettingAside] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [seenId, setSeenId] = useState(invoiceId)
  if (invoiceId !== seenId) {
    setSeenId(invoiceId)
    setSettingAside(false)
    setReason('')
    setReasonError(null)
  }

  const status = review?.status ?? 'pending'
  const blocking = issues.filter((issue) => issue.severity === 'blocking')
  const blocked = !sourceAvailable || blocking.length > 0
  const blockMessage = !sourceAvailable
    ? 'The original document is unavailable, so this invoice cannot be confirmed.'
    : blocking.map((issue) => issue.message).join(' ')

  function confirm() {
    const result = confirmInvoice(invoiceId)
    if (!result.ok) return
    onCompleted('Invoice confirmed.')
  }

  function saveSetAside() {
    const result = setAsideInvoice(invoiceId, reason)
    if (!result.ok) {
      setReasonError('Enter a reason before setting this invoice aside.')
      return
    }
    setSettingAside(false)
    setReason('')
    setReasonError(null)
    onCompleted('Invoice set aside.')
  }

  function resume() {
    const result = resumeInvoice(invoiceId)
    if (!result.ok) return
    onNotice('Review resumed. Corrections are unchanged.')
  }

  return (
    <footer className={classes.actions} aria-label="Review actions">
      {notice ? (
        <p className={classes.notice} aria-live="polite">
          {notice}
        </p>
      ) : null}
      {status === 'confirmed' ? (
        <Text size="sm">
          {`Confirmed ${formatReviewTimestamp(review?.confirmedAt ?? review?.updatedAt ?? '')}. This invoice is read-only.`}
        </Text>
      ) : null}
      {status === 'set_aside' ? (
        <>
          <Text size="sm">Set aside: {review?.setAsideReason}</Text>
          <Button mt={8} size="compact-sm" variant="default" onClick={resume}>
            Resume review
          </Button>
        </>
      ) : null}
      {status === 'pending' ? (
        <>
          {blocked ? (
            <p id="confirm-blocked" className={classes.blockMessage}>
              {blockMessage}
            </p>
          ) : null}
          {settingAside ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                saveSetAside()
              }}
            >
              <Textarea
                id="set-aside-reason"
                label="Reason"
                size="xs"
                autosize
                minRows={2}
                maxRows={4}
                value={reason}
                error={reasonError}
                onChange={(event) => {
                  setReason(event.currentTarget.value)
                  setReasonError(null)
                }}
              />
              <Group gap="xs" mt={8}>
                <Button type="submit" size="compact-sm">
                  Save set aside
                </Button>
                <Button
                  type="button"
                  size="compact-sm"
                  variant="default"
                  onClick={() => {
                    setSettingAside(false)
                    setReason('')
                    setReasonError(null)
                  }}
                >
                  Cancel
                </Button>
              </Group>
            </form>
          ) : (
            <Group gap="xs">
              <Button
                size="compact-sm"
                variant="default"
                onClick={() => setSettingAside(true)}
              >
                Set aside
              </Button>
              <Button
                size="compact-sm"
                disabled={blocked}
                aria-describedby={blocked ? 'confirm-blocked' : undefined}
                onClick={confirm}
              >
                Confirm invoice
              </Button>
            </Group>
          )}
        </>
      ) : null}
    </footer>
  )
}
