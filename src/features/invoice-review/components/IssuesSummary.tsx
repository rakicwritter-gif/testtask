import { useState } from 'react'
import type { ReviewIssue } from '../model/validation.ts'
import classes from './workspace.module.css'

type IssuesSummaryProps = {
  invoiceId: string
  issues: readonly ReviewIssue[]
  onOpen: (issue: ReviewIssue) => void
}

type SummaryItem = {
  key: string
  label: string
  severity: ReviewIssue['severity']
  issue?: ReviewIssue
}

export function IssuesSummary({
  invoiceId,
  issues,
  onOpen,
}: IssuesSummaryProps) {
  const [expanded, setExpanded] = useState(false)
  const [seenId, setSeenId] = useState(invoiceId)
  if (invoiceId !== seenId) {
    setSeenId(invoiceId)
    setExpanded(false)
  }

  const collapsed = collapsedItems(issues)
  const visible = expanded
    ? issues.map((issue) => ({
        key: issue.id,
        label: issue.message,
        severity: issue.severity,
        issue,
      }))
    : collapsed.slice(0, 2)
  const individuallyVisible = expanded
    ? issues.length
    : visible.filter((item) => item.issue).length
  const showToggle = !expanded
    ? issues.length > individuallyVisible
    : collapsed.length < issues.length || issues.length > 2

  return (
    <section className={classes.issues} aria-label="Issues">
      {issues.length === 0 ? (
        <p className={classes.noIssues}>No detected issues</p>
      ) : (
        <>
          <ul className={classes.issueList}>
            {visible.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={classes.issueButton}
                  onClick={() => {
                    if (item.issue) onOpen(item.issue)
                    else setExpanded(true)
                  }}
                >
                  <span className={severityClass(item.severity)}>
                    {severityText(item.severity)}
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          {showToggle ? (
            <button
              type="button"
              className={classes.viewAll}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Show fewer' : `View all (${issues.length} issues)`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

function collapsedItems(issues: readonly ReviewIssue[]): SummaryItem[] {
  const headerConfidence = issues.filter(
    (issue) => issue.code === 'low-confidence' && issue.target.type === 'field',
  )
  const lineConfidence = issues.filter(
    (issue) => issue.code === 'low-confidence' && issue.target.type === 'line',
  )
  const prominent = issues.filter((issue) => issue.code !== 'low-confidence')

  return [
    ...prominent.map(toItem),
    ...confidenceGroup(
      headerConfidence,
      'header-confidence',
      'header fields need a closer look',
    ),
    ...confidenceGroup(
      lineConfidence,
      'line-confidence',
      'line fields need a closer look',
    ),
  ]
}

function confidenceGroup(
  issues: readonly ReviewIssue[],
  key: string,
  label: string,
): SummaryItem[] {
  if (issues.length === 0) return []
  const only = issues[0]
  if (issues.length === 1 && only) return [toItem(only)]
  return [
    {
      key,
      label: `${issues.length} ${label}`,
      severity: 'warning',
    },
  ]
}

function toItem(issue: ReviewIssue): SummaryItem {
  return {
    key: issue.id,
    label: issue.message,
    severity: issue.severity,
    issue,
  }
}

function severityText(severity: ReviewIssue['severity']): string {
  if (severity === 'blocking') return 'Blocking'
  if (severity === 'info') return 'Info'
  return 'Warning'
}

function severityClass(severity: ReviewIssue['severity']): string {
  if (severity === 'blocking') return classes.severityBlocking
  if (severity === 'info') return classes.severityInfo
  return classes.severityWarning
}
