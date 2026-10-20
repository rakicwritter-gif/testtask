import { fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById, invoices } from '../data/invoices.ts'
import { issuesForInvoice } from '../model/selectors.ts'
import { useReviewStore } from '../model/review-store.ts'
import { getQueueGroup } from '../model/validation.ts'
import { ReviewWorkspace } from './ReviewWorkspace.tsx'

function renderWorkspace() {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ReviewWorkspace />
    </MantineProvider>,
  )
}

function showInvoice(id: string) {
  const invoice = getInvoiceById(id)
  if (!invoice) throw new Error(`Missing ${id}`)
  fireEvent.change(screen.getByLabelText('Client'), {
    target: { value: invoice.client.id },
  })
  fireEvent.click(screen.getByRole('button', { name: new RegExp(id) }))
  return invoice
}

function correctionOf(id: string): HTMLElement {
  const input = document.getElementById(id)
  if (!input) throw new Error(`Missing ${id}`)
  const shell = input.closest('dd')
  if (!shell) throw new Error(`Missing field shell for ${id}`)
  return shell
}

function filterCount(label: string): number {
  const radio = screen.getByRole('radio', {
    name: new RegExp(`^${label}\\d+$`),
  })
  const match = radio.textContent?.match(/(\d+)$/)
  if (!match?.[1]) throw new Error(`Missing count for ${label}`)
  return Number(match[1])
}

function queueCounts(clientId: string) {
  const reviews = useReviewStore.getState().reviews
  const listed = invoices.filter((invoice) => invoice.client.id === clientId)
  const groups = listed.map((invoice) =>
    getQueueGroup(reviews[invoice.id], issuesForInvoice(invoice.id, reviews)),
  )
  return {
    all: listed.length,
    attention: groups.filter((group) => group === 'needs_attention').length,
    clear: groups.filter((group) => group === 'no_issues').length,
  }
}

describe('right-panel presentation', () => {
  it('shows provenance below 0.80, hides it at 0.80, and restores a high-confidence edit', () => {
    const invoice = getInvoiceById('inv-013')
    if (!invoice) throw new Error('Missing inv-013')
    expect(invoice.fields.supplyDate.confidence).toBe(0.79)
    expect(invoice.fields.supplyDate.value).toBe('2022-01-18')
    expect(invoice.fields.invoiceNumber.confidence).toBe(0.8)
    expect(invoice.fields.invoiceNumber.value).toBe('001-05117/2022')
    expect(invoice.fields.totalAmount.confidence).toBe(0.8)

    renderWorkspace()
    showInvoice('inv-013')

    expect(correctionOf('field-inv-013-supplyDate')).toHaveTextContent(
      '79% · Original: 2022-01-18',
    )
    const invoiceNumber = correctionOf('field-inv-013-invoiceNumber')
    expect(screen.getByLabelText('Invoice number')).toHaveValue(
      '001-05117/2022',
    )
    expect(invoiceNumber).not.toHaveTextContent('80%')
    expect(invoiceNumber).not.toHaveTextContent('Original:')
    expect(correctionOf('field-inv-013-totalAmount')).not.toHaveTextContent(
      '80%',
    )

    fireEvent.change(screen.getByLabelText('Invoice number'), {
      target: { value: 'INV-13-CHECKED' },
    })
    fireEvent.blur(screen.getByLabelText('Invoice number'))

    expect(screen.getByLabelText('Invoice number')).toHaveValue(
      'INV-13-CHECKED',
    )
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(
      document.getElementById('field-inv-013-invoiceNumber-original'),
    ).toHaveTextContent('Original: 001-05117/2022. Confidence 80%.')
    expect(invoice.fields.invoiceNumber.value).toBe('001-05117/2022')

    fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))

    expect(screen.getByLabelText('Invoice number')).toHaveValue(
      '001-05117/2022',
    )
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()
    expect(
      document.getElementById('field-inv-013-invoiceNumber-original'),
    ).not.toBeInTheDocument()
    expect(correctionOf('field-inv-013-invoiceNumber')).not.toHaveTextContent(
      '80%',
    )
    expect(invoice.fields.invoiceNumber.value).toBe('001-05117/2022')
  })

  it('collapses additional details until a bank-account issue opens and focuses the field', () => {
    renderWorkspace()

    expect(
      screen.getByRole('button', { name: 'Show additional details' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Payment reference')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bank account 1')).not.toBeInTheDocument()

    showInvoice('inv-006')

    expect(
      screen.getByRole('button', { name: 'Hide additional details' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Bank account 1')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Hide additional details' }),
    )
    expect(screen.queryByLabelText('Bank account 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /View all/ }))
    fireEvent.click(
      screen.getByRole('button', { name: /Bank accounts need a closer look/ }),
    )

    expect(document.getElementById('field-inv-006-bank-0')).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Hide additional details' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Bank account 1')).toBeInTheDocument()
  })

  it('previews inv-006 as a duplicate plus grouped confidence, then expands and collapses', () => {
    renderWorkspace()
    showInvoice('inv-006')

    const summary = screen.getByRole('region', { name: 'Issues' })
    expect(
      within(summary).getByRole('button', {
        name: /Possible duplicate of inv-007, currently Pending/,
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', {
        name: /11 header fields need a closer look/,
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).queryByRole('button', {
        name: /Supplier needs a closer look/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(summary).queryByRole('button', {
        name: /Line \d+ description needs a closer look/,
      }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('button', { name: /View all/ }))

    expect(
      within(summary).getByRole('button', {
        name: /Supplier needs a closer look/,
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: 'Show fewer' }),
    ).toBeInTheDocument()
    expect(
      within(summary).queryByRole('button', { name: /View all/ }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('button', { name: 'Show fewer' }))

    expect(
      within(summary).queryByRole('button', {
        name: /Supplier needs a closer look/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(summary).getByRole('button', {
        name: /11 header fields need a closer look/,
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: /View all/ }),
    ).toBeInTheDocument()
  })

  it('keeps confidence-only inv-013 out of the clear state and toggles the full list', () => {
    const issues = issuesForInvoice('inv-013', {})
    const headerCount = issues.filter(
      (issue) => issue.target.type === 'field',
    ).length
    const lineCount = issues.filter(
      (issue) => issue.target.type === 'line',
    ).length
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every((issue) => issue.code === 'low-confidence')).toBe(true)
    expect(headerCount).toBeGreaterThan(1)
    expect(lineCount).toBeGreaterThan(1)

    renderWorkspace()
    showInvoice('inv-013')

    const summary = screen.getByRole('region', { name: 'Issues' })
    expect(
      within(summary).queryByText('No detected issues'),
    ).not.toBeInTheDocument()
    expect(
      within(summary).getByText(`${issues.length} issues`),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', {
        name: new RegExp(`${headerCount} header fields need a closer look`),
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', {
        name: new RegExp(`${lineCount} line fields need a closer look`),
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).queryByRole('button', {
        name: /Supply date needs a closer look/,
      }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(summary).getByRole('button', {
        name: new RegExp(`View all \\(${issues.length} issues\\)`),
      }),
    )
    expect(
      within(summary).getByRole('button', {
        name: /Supply date needs a closer look/,
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).queryByText('No detected issues'),
    ).not.toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('button', { name: 'Show fewer' }))
    expect(
      within(summary).queryByRole('button', {
        name: /Supply date needs a closer look/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(summary).getByRole('button', {
        name: new RegExp(`${headerCount} header fields need a closer look`),
      }),
    ).toBeInTheDocument()
    expect(
      within(summary).queryByText('No detected issues'),
    ).not.toBeInTheDocument()
  })

  it('updates filter counts after confirmation without changing invoice data', () => {
    renderWorkspace()
    const before = queueCounts('bili-brig')
    expect(filterCount('All')).toBe(before.all)
    expect(filterCount('Attention')).toBe(before.attention)
    expect(filterCount('No issues')).toBe(before.clear)

    const source = showInvoice('inv-006')
    const extractedVendor = source.fields.vendorName.value
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))

    const after = queueCounts('bili-brig')
    expect(after.all).toBe(before.all)
    expect(after.attention).toBe(before.attention - 1)
    expect(after.clear).toBe(before.clear)
    expect(filterCount('All')).toBe(after.all)
    expect(filterCount('Attention')).toBe(after.attention)
    expect(filterCount('No issues')).toBe(after.clear)
    expect(
      within(screen.getByRole('region', { name: 'Confirmed' })).getByRole(
        'button',
        { name: /inv-006/ },
      ),
    ).toBeInTheDocument()
    expect(getInvoiceById('inv-006')?.fields.vendorName.value).toBe(
      extractedVendor,
    )

    const invoicesBefore = JSON.stringify(invoices)
    const reviewsBefore = JSON.stringify(useReviewStore.getState().reviews)
    const supplier = screen.getByLabelText('Supplier')
    if (!(supplier instanceof HTMLInputElement)) {
      throw new Error('Expected the supplier field')
    }
    const openVendor = supplier.value

    fireEvent.click(screen.getByRole('radio', { name: /^Attention\d+$/ }))

    expect(JSON.stringify(invoices)).toBe(invoicesBefore)
    expect(JSON.stringify(useReviewStore.getState().reviews)).toBe(
      reviewsBefore,
    )
    expect(screen.getByLabelText('Supplier')).toHaveValue(openVendor)
    expect(screen.getByRole('button', { name: /inv-007/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(
      screen.queryByRole('button', { name: /inv-001/ }),
    ).not.toBeInTheDocument()
    expect(useReviewStore.getState().reviews['inv-006']?.status).toBe(
      'confirmed',
    )
    expect(getInvoiceById('inv-006')?.fields.vendorName.value).toBe(
      extractedVendor,
    )
  })
})
