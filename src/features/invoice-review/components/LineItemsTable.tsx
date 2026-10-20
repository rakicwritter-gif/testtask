import { Table, Text } from '@mantine/core'
import type { OriginalInvoice } from '../model/types.ts'
import {
  CURRENCY_NOT_DETECTED,
  formatNumber,
  formatOptionalText,
  formatPercent,
} from './display.ts'
import classes from './workspace.module.css'

type LineItemsTableProps = {
  invoice: OriginalInvoice
}

export function LineItemsTable({ invoice }: LineItemsTableProps) {
  const currency = invoice.fields.currency.value

  return (
    <div>
      <Text size="xs" c="dimmed" mb={8}>
        {currency
          ? `Amounts in ${currency}. Line totals are shown as extracted.`
          : `${CURRENCY_NOT_DETECTED}. Line totals are shown as extracted.`}
      </Text>
      <Table
        aria-label="Line items"
        stickyHeader
        verticalSpacing={4}
        horizontalSpacing="xs"
        fz="xs"
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
          {invoice.lineItems.map((line) => (
            <Table.Tr key={line.id}>
              <Table.Td className={classes.lineDescription}>
                {line.description.value}
              </Table.Td>
              <Table.Td className={classes.numeric}>
                {formatNumber(line.quantity.value)}
              </Table.Td>
              <Table.Td>{formatOptionalText(line.unit.value)}</Table.Td>
              <Table.Td className={classes.numeric}>
                {line.unitPrice.value === null
                  ? formatOptionalText(null)
                  : formatNumber(line.unitPrice.value)}
              </Table.Td>
              <Table.Td className={classes.numeric}>
                {formatPercent(line.vatRate.value)}
              </Table.Td>
              <Table.Td className={classes.numeric}>
                {formatNumber(line.lineTotal.value)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  )
}
