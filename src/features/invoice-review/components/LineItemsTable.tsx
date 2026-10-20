import { Table, Text } from '@mantine/core'
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

  return (
    <div>
      <Text size="xs" c="dimmed" mb={8}>
        {currency
          ? `Amounts in ${currency}. Editing one value does not change the others.`
          : `${CURRENCY_NOT_DETECTED}. Editing one value does not change the others.`}
      </Text>
      <Table
        aria-label="Line items"
        stickyHeader
        verticalSpacing={4}
        horizontalSpacing="xs"
        fz="xs"
        className={classes.lineTable}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Description</Table.Th>
            <Table.Th className={classes.numeric}>Qty</Table.Th>
            <Table.Th>Unit</Table.Th>
            <Table.Th className={classes.numeric}>Unit price</Table.Th>
            <Table.Th className={classes.numeric}>VAT</Table.Th>
            <Table.Th className={classes.numeric}>Line total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invoice.lineItems.map((line, index) => {
            const current = effective.lineItems[index]
            if (!current) return null
            return (
              <Table.Tr key={line.id}>
                <Table.Td className={classes.lineDescription}>
                  <LineTextCell
                    line={line}
                    field="description"
                    label="Description"
                    value={current.description}
                    multiline
                    locked={locked}
                    attention={lineCue(issues, line.id, 'description')}
                    review={review}
                    onCommit={(raw) => commitText(line, 'description', raw)}
                    onRestore={() =>
                      clearLineOverride(invoice.id, line.id, 'description')
                    }
                  />
                </Table.Td>
                <Table.Td className={classes.numeric}>
                  <LineNumberCell
                    line={line}
                    field="quantity"
                    label="Quantity"
                    value={current.quantity}
                    locked={locked}
                    attention={lineCue(issues, line.id, 'quantity')}
                    review={review}
                    onCommit={(raw) =>
                      commitNumber(
                        line,
                        'quantity',
                        DECIMAL_SCALE.quantity,
                        raw,
                      )
                    }
                    onRestore={() =>
                      clearLineOverride(invoice.id, line.id, 'quantity')
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <LineTextCell
                    line={line}
                    field="unit"
                    label="Unit"
                    value={current.unit}
                    locked={locked}
                    attention={lineCue(issues, line.id, 'unit')}
                    review={review}
                    onCommit={(raw) => commitText(line, 'unit', raw)}
                    onRestore={() =>
                      clearLineOverride(invoice.id, line.id, 'unit')
                    }
                  />
                </Table.Td>
                {NUMBER_FIELDS.filter((item) => item.field !== 'quantity').map(
                  (item) => (
                    <Table.Td key={item.field} className={classes.numeric}>
                      <LineNumberCell
                        line={line}
                        field={item.field}
                        label={item.label}
                        value={current[item.field]}
                        suffix={item.suffix}
                        locked={locked}
                        attention={lineCue(issues, line.id, item.field)}
                        review={review}
                        onCommit={(raw) =>
                          commitNumber(line, item.field, item.scale, raw)
                        }
                        onRestore={() =>
                          clearLineOverride(invoice.id, line.id, item.field)
                        }
                      />
                    </Table.Td>
                  ),
                )}
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </div>
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
  )
}

function formatInputNumber(value: number | null): string {
  if (value === null) return ''
  return formatNumber(value)
}
