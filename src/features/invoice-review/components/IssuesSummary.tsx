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
  const preview = previewItems(collapsed)
  const visible = expanded
    ? issues.map((issue) => ({
        key: issue.id,
        label: issue.message,
        severity: issue.severity,
        issue,
      }))
    : preview
  const individuallyVisible = expanded
    ? issues.length
    : visible.filter((item) => item.issue).length
  const showToggle = !expanded
    ? issues.length > individuallyVisible
    : collapsed.length < issues.length || issues.length > preview.length

  return (
    <section className={classes.issues} aria-label="Issues">
      {issues.length === 0 ? (
        <p className={classes.noIssues}>
          <svg
            className={classes.noIssuesIcon}
            width="14"
            height="14"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="6.25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M5.2 8.1 7.1 10l3.7-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          No detected issues
        </p>
      ) : (
        <>
          <p
            className={`${classes.issueSummary} ${toneClass(highestSeverity(issues))}`}
          >
            <span className={severityClass(highestSeverity(issues))}>
              {severityText(highestSeverity(issues))}
            </span>
            <span className={classes.issueSummaryCount}>
              {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
            </span>
          </p>
          <ul id="invoice-issue-list" className={classes.issueList}>
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
            {showToggle ? (
              <li>
                <button
                  type="button"
                  className={classes.viewAll}
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded
                    ? 'Show fewer'
                    : `View all (${issues.length} issues)`}
                </button>
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  )
}

function previewItems(collapsed: readonly SummaryItem[]): SummaryItem[] {
  const real = collapsed.filter(
    (item) => item.issue && item.issue.code !== 'low-confidence',
  )
  const confidence = collapsed.filter(
    (item) => !item.issue || item.issue.code === 'low-confidence',
  )
  const lead =
    real.find((item) => item.severity === 'blocking') ??
    real.find((item) => item.severity === 'warning') ??
    real[0]
  const rows: SummaryItem[] = []
  if (lead) rows.push(lead)
  for (const item of confidence) {
    if (rows.length >= 2) break
    if (rows.some((row) => row.key === item.key)) continue
    rows.push(item)
  }
  return rows
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

function highestSeverity(
  issues: readonly ReviewIssue[],
): ReviewIssue['severity'] {
  if (issues.some((issue) => issue.severity === 'blocking')) return 'blocking'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'info'
}

function severityText(severity: ReviewIssue['severity']): string {
  if (severity === 'blocking') return 'Blocking'
  if (severity === 'info') return 'Info'
  return 'Warning'
}

function toneClass(severity: ReviewIssue['severity']): string {
  if (severity === 'blocking') return classes.issueToneBlocking
  if (severity === 'info') return classes.issueToneInfo
  return classes.issueToneWarning
}

function severityClass(severity: ReviewIssue['severity']): string {
  if (severity === 'blocking') return classes.severityBlocking
  if (severity === 'info') return classes.severityInfo
  return classes.severityWarning
}
