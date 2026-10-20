import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Group } from '@mantine/core'
import type { OriginalInvoice, OriginalLineItem } from '../model/types.ts'
import {
  getEffectiveInvoice,
  hasLineOverride,
  type InvoiceReview,
  type LineNumberField,
  type LineTextField,
} from '../model/corrections.ts'
import { parseOptionalText } from '../model/input.ts'
import { useReviewStore } from '../model/review-store.ts'
import { lineCue, type ReviewIssue } from '../model/validation.ts'
import { DECIMAL_SCALE, parseDecimal } from '../utils/money.ts'
import { CorrectionField } from './CorrectionField.tsx'
import { CURRENCY_NOT_DETECTED, formatNumber, NOT_DETECTED } from './display.ts'
import classes from './workspace.module.css'

type LineItemsTableProps = {
  invoice: OriginalInvoice
  issues: readonly ReviewIssue[]
  locked: boolean
  revealLineId?: string | null
}

type LineValues = {
  description: string | null
  unit: string | null
  quantity: number | null
  unitPrice: number | null
  vatRate: number | null
  lineTotal: number | null
}

const NUMBER_FIELDS: readonly {
  field: LineNumberField
  label: string
  scale: number
  suffix?: string
}[] = [
  { field: 'quantity', label: 'Quantity', scale: DECIMAL_SCALE.quantity },
  { field: 'unitPrice', label: 'Unit price', scale: DECIMAL_SCALE.unitPrice },
  {
    field: 'vatRate',
    label: 'VAT',
    scale: DECIMAL_SCALE.vatRate,
    suffix: '%',
  },
  { field: 'lineTotal', label: 'Line total', scale: DECIMAL_SCALE.money },
]

export function LineItemsTable({
  invoice,
  issues,
  locked,
  revealLineId = null,
}: LineItemsTableProps) {
  const review = useReviewStore((state) => state.reviews[invoice.id])
  const setLineTextOverride = useReviewStore(
    (state) => state.setLineTextOverride,
  )
  const setLineNumberOverride = useReviewStore(
    (state) => state.setLineNumberOverride,
  )
  const clearLineOverride = useReviewStore((state) => state.clearLineOverride)
  const effective = getEffectiveInvoice(invoice, review)
  const currency = effective.fields.currency
  const snapshots = useRef(new Map<string, LineValues>())
  const [openLineId, setOpenLineId] = useState<string | null>(revealLineId)
  const [seenReveal, setSeenReveal] = useState(revealLineId)
  if (revealLineId !== seenReveal) {
    setSeenReveal(revealLineId)
    if (revealLineId) setOpenLineId(revealLineId)
  }

  function commitText(
    line: OriginalLineItem,
    field: LineTextField,
    raw: string,
  ): string | null {
    const parsed = parseOptionalText(raw)
    setLineTextOverride(
      invoice.id,
      line.id,
      field,
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  function commitNumber(
    line: OriginalLineItem,
    field: LineNumberField,
    scale: number,
    raw: string,
  ): string | null {
    const parsed = parseDecimal(raw, scale)
    if (parsed.status === 'invalid') return parsed.message
    setLineNumberOverride(
      invoice.id,
      line.id,
      field,
      parsed.status === 'empty' ? null : parsed.value,
    )
    return null
  }

  function openLine(lineId: string, values: LineValues) {
    snapshots.current.set(lineId, values)
    setOpenLineId(lineId)
  }

  function cancelLine(line: OriginalLineItem) {
    const snapshot = snapshots.current.get(line.id)
    if (snapshot) {
      setLineTextOverride(
        invoice.id,
        line.id,
        'description',
        snapshot.description,
      )
      setLineTextOverride(invoice.id, line.id, 'unit', snapshot.unit)
      setLineNumberOverride(invoice.id, line.id, 'quantity', snapshot.quantity)
      setLineNumberOverride(
        invoice.id,
        line.id,
        'unitPrice',
        snapshot.unitPrice,
      )
      setLineNumberOverride(invoice.id, line.id, 'vatRate', snapshot.vatRate)
      setLineNumberOverride(
        invoice.id,
        line.id,
        'lineTotal',
        snapshot.lineTotal,
      )
    }
    setOpenLineId(null)
  }

  return (
    <div>
      <p className={classes.lineNote}>
        {currency
          ? `Amounts in ${currency}. Editing one value does not change the others.`
          : `${CURRENCY_NOT_DETECTED}. Editing one value does not change the others.`}
      </p>
      <table className={classes.lineTable} aria-label="Line items">
        <thead>
          <tr>
            <th className={classes.lineIndex}>#</th>
            <th>Description</th>
            <th className={classes.numeric}>Qty</th>
            <th className={classes.lineUnit}>Unit</th>
            <th className={classes.numeric}>Unit price</th>
            <th className={classes.numeric}>Total</th>
            <th className={classes.lineChevronHead}>
              <span className={classes.srOnly}>Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((line, index) => {
            const current = effective.lineItems[index]
            if (!current) return null
            const values: LineValues = {
              description: current.description,
              unit: current.unit,
              quantity: current.quantity,
              unitPrice: current.unitPrice,
              vatRate: current.vatRate,
              lineTotal: current.lineTotal,
            }
            const open = openLineId === line.id
            const edited =
              NUMBER_FIELDS.some((item) =>
                hasLineOverride(review, line.id, item.field),
              ) ||
              hasLineOverride(review, line.id, 'description') ||
              hasLineOverride(review, line.id, 'unit')
            return (
              <LineRow
                key={line.id}
                line={line}
                values={values}
                open={open}
                edited={edited}
                locked={locked}
                issues={issues}
                review={review}
                onOpen={() => openLine(line.id, values)}
                onSave={() => setOpenLineId(null)}
                onCancel={() => cancelLine(line)}
                onCommitText={(field, raw) => commitText(line, field, raw)}
                onCommitNumber={(field, scale, raw) =>
                  commitNumber(line, field, scale, raw)
                }
                onRestore={(field) =>
                  clearLineOverride(invoice.id, line.id, field)
                }
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LineRow({
  line,
  values,
  open,
  edited,
  locked,
  issues,
  review,
  onOpen,
  onSave,
  onCancel,
  onCommitText,
  onCommitNumber,
  onRestore,
}: {
  line: OriginalLineItem
  values: LineValues
  open: boolean
  edited: boolean
  locked: boolean
  issues: readonly ReviewIssue[]
  review: InvoiceReview | undefined
  onOpen: () => void
  onSave: () => void
  onCancel: () => void
  onCommitText: (field: LineTextField, raw: string) => string | null
  onCommitNumber: (
    field: LineNumberField,
    scale: number,
    raw: string,
  ) => string | null
  onRestore: (field: LineTextField | LineNumberField) => void
}) {
  const number = line.index + 1
  const editorRef = useRef<HTMLTableCellElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    editorRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])
  function toggle() {
    if (open) onSave()
    else onOpen()
  }
  return (
    <>
      <tr
        className={open ? classes.lineRowOpen : classes.lineRow}
        onClick={toggle}
      >
        <td className={classes.lineIndex}>{number}</td>
        <td>
          <button
            type="button"
            className={classes.lineOpen}
            aria-expanded={open}
            aria-label={`Edit line ${number}, ${values.description ?? NOT_DETECTED}`}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
          >
            <span>{values.description ?? NOT_DETECTED}</span>
            {edited ? <span className={classes.editedMark}>Edited</span> : null}
          </button>
        </td>
        <td className={classes.numeric}>
          <span>{formatCell(values.quantity)}</span>
        </td>
        <td className={classes.lineUnit}>
          <span>{values.unit ?? NOT_DETECTED}</span>
        </td>
        <td className={classes.numeric}>{formatCell(values.unitPrice)}</td>
        <td className={classes.numeric}>{formatCell(values.lineTotal)}</td>
        <td className={classes.lineChevron} aria-hidden="true">
          <Chevron open={open} />
        </td>
      </tr>
      {open ? (
        <tr>
          <td ref={editorRef} className={classes.lineEditor} colSpan={7}>
            <div className={classes.lineEditorGrid}>
              <LineTextCell
                line={line}
                field="description"
                label="Description"
                value={values.description}
                multiline
                locked={locked}
                attention={lineCue(issues, line.id, 'description')}
                review={review}
                onCommit={(raw) => onCommitText('description', raw)}
                onRestore={() => onRestore('description')}
              />
              <LineNumberCell
                line={line}
                field="quantity"
                label="Quantity"
                value={values.quantity}
                locked={locked}
                attention={lineCue(issues, line.id, 'quantity')}
                review={review}
                onCommit={(raw) =>
                  onCommitNumber('quantity', DECIMAL_SCALE.quantity, raw)
                }
                onRestore={() => onRestore('quantity')}
              />
              <LineTextCell
                line={line}
                field="unit"
                label="Unit"
                value={values.unit}
                locked={locked}
                attention={lineCue(issues, line.id, 'unit')}
                review={review}
                onCommit={(raw) => onCommitText('unit', raw)}
                onRestore={() => onRestore('unit')}
              />
              {NUMBER_FIELDS.filter((item) => item.field !== 'quantity').map(
                (item) => (
                  <LineNumberCell
                    key={item.field}
                    line={line}
                    field={item.field}
                    label={item.label}
                    value={values[item.field]}
                    suffix={item.suffix}
                    locked={locked}
                    attention={lineCue(issues, line.id, item.field)}
                    review={review}
                    onCommit={(raw) =>
                      onCommitNumber(item.field, item.scale, raw)
                    }
                    onRestore={() => onRestore(item.field)}
                  />
                ),
              )}
            </div>
            <Group gap="xs" mt={8} justify="flex-end">
              <Button
                type="button"
                size="sm"
                variant="default"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={onSave}>
                Save
              </Button>
            </Group>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? classes.chevronOpen : classes.chevron}
      width="14"
      height="14"
      viewBox="0 0 16 16"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LineTextCell({
  line,
  field,
  label,
  value,
  attention,
  locked,
  review,
  multiline = false,
  onCommit,
  onRestore,
}: {
  line: OriginalLineItem
  field: LineTextField
  label: string
  value: string | null
  attention: ReturnType<typeof lineCue>
  locked: boolean
  review: InvoiceReview | undefined
  multiline?: boolean
  onCommit: (raw: string) => string | null
  onRestore: () => void
}) {
  const original = line[field].value
  return (
    <div className={classes.editorField}>
      <span>{label}</span>
      <CorrectionField
        disabled={locked}
        id={`line-${line.id}-${field}`}
        ariaLabel={`${label}, line ${line.index + 1}`}
        value={value ?? ''}
        edited={hasLineOverride(review, line.id, field)}
        originalText={
          original === null || original.trim() === '' ? NOT_DETECTED : original
        }
        confidence={line[field].confidence}
        emptyText={NOT_DETECTED}
        attention={attention}
        multiline={multiline}
        onCommit={onCommit}
        onRestore={onRestore}
      />
    </div>
  )
}

function LineNumberCell({
  line,
  field,
  label,
  value,
  suffix,
  attention,
  locked,
  review,
  onCommit,
  onRestore,
}: {
  line: OriginalLineItem
  field: LineNumberField
  label: string
  value: number | null
  suffix?: string
  attention: ReturnType<typeof lineCue>
  locked: boolean
  review: InvoiceReview | undefined
  onCommit: (raw: string) => string | null
  onRestore: () => void
}) {
  return (
    <div className={classes.editorField}>
      <span>{label}</span>
      <CorrectionField
        disabled={locked}
        id={`line-${line.id}-${field}`}
        ariaLabel={`${label}, line ${line.index + 1}`}
        value={formatInputNumber(value)}
        edited={hasLineOverride(review, line.id, field)}
        originalText={
          line[field].value === null
            ? NOT_DETECTED
            : formatInputNumber(line[field].value)
        }
        confidence={line[field].confidence}
        emptyText={NOT_DETECTED}
        attention={attention}
        numeric
        suffix={suffix && value !== null ? suffix : undefined}
        onCommit={onCommit}
        onRestore={onRestore}
      />
    </div>
  )
}

function formatCell(value: number | null): string {
  if (value === null) return NOT_DETECTED
  return formatNumber(value)
}

function formatInputNumber(value: number | null): string {
  if (value === null) return ''
  return formatNumber(value)
}
