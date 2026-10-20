import { act, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById } from '../data/invoices.ts'
import { REVIEW_STORAGE_KEY, useReviewStore } from '../model/review-store.ts'
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

describe('invoice correction editing', () => {
  it('edits a header field, keeps the extraction, and restores it', () => {
    renderWorkspace()
    const invoice = getInvoiceById('inv-001')
    if (!invoice) throw new Error('Missing inv-001')
    const extracted = invoice.fields.vendorName.value

    const supplier = screen.getByLabelText('Supplier')
    fireEvent.change(supplier, { target: { value: 'Corrected supplier' } })
    fireEvent.blur(supplier)

    expect(screen.getByLabelText('Supplier')).toHaveValue('Corrected supplier')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Corrected supplier',
    )
    expect(screen.getByRole('button', { name: /inv-001/ })).toHaveTextContent(
      'Corrected supplier',
    )
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(
      document.getElementById('field-inv-001-vendorName-original'),
    ).toHaveTextContent(extracted)
    expect(invoice.fields.vendorName.value).toBe(extracted)

    fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))
    expect(screen.getByLabelText('Supplier')).toHaveValue(extracted)
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()
  })

  it('keeps the correction when switching invoices and after reload', async () => {
    renderWorkspace()
    const supplier = screen.getByLabelText('Supplier')
    fireEvent.change(supplier, { target: { value: 'Corrected supplier' } })
    fireEvent.blur(supplier)

    showInvoice('inv-002')
    expect(screen.getByLabelText('Supplier')).toHaveValue(
      'Franck d.o.o. Sarajevo',
    )
    showInvoice('inv-001')
    expect(screen.getByLabelText('Supplier')).toHaveValue('Corrected supplier')

    const saved = localStorage.getItem(REVIEW_STORAGE_KEY)
    expect(saved).toContain('Corrected supplier')
    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved ?? '')
    await act(async () => {
      await useReviewStore.persist.rehydrate()
    })

    expect(screen.getByLabelText('Supplier')).toHaveValue('Corrected supplier')
  })

  it('parses decimal commas and rejects excess precision without changing other amounts', () => {
    renderWorkspace()
    const invoice = getInvoiceById('inv-001')
    if (!invoice) throw new Error('Missing inv-001')

    const total = screen.getByLabelText('Total')
    fireEvent.change(total, { target: { value: '359,99' } })
    fireEvent.blur(total)
    expect(screen.getByLabelText('Total')).toHaveValue('359.99')
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Net'), {
      target: { value: '139,18' },
    })
    fireEvent.blur(screen.getByLabelText('Net'))
    expect(screen.getByLabelText('Net')).toHaveValue('139.18')
    expect(screen.getByLabelText('Total')).toHaveValue(
      String(invoice.fields.totalAmount.value),
    )
    expect(screen.getByLabelText('VAT')).toHaveValue(
      String(invoice.fields.vatAmount.value),
    )

    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '1.234' },
    })
    fireEvent.blur(screen.getByLabelText('Total'))
    expect(screen.getByText(/at most 2 decimal places/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Total')).toHaveValue('1.234')
    expect(
      useReviewStore.getState().reviews['inv-001']?.overrides.header
        .totalAmount,
    ).toBeUndefined()
    expect(invoice.fields.totalAmount.value).toBe(359.99)
  })

  it('edits one bank account without reordering the others', () => {
    renderWorkspace()
    const invoice = showInvoice('inv-003')
    const source = invoice.fields.bankAccounts.value
    fireEvent.click(
      screen.getByRole('button', { name: 'Show additional details' }),
    )

    fireEvent.change(screen.getByLabelText('Bank account 2'), {
      target: { value: 'CHANGED' },
    })
    fireEvent.blur(screen.getByLabelText('Bank account 2'))

    expect(screen.getByLabelText('Bank account 1')).toHaveValue(source[0])
    expect(screen.getByLabelText('Bank account 2')).toHaveValue('CHANGED')
    expect(screen.getByLabelText('Bank account 7')).toHaveValue(source[6])
    expect(invoice.fields.bankAccounts.value[1]).toBe(source[1])
  })

  it('edits one line item without changing its line total or another row', () => {
    renderWorkspace()
    const invoice = showInvoice('inv-003')
    const first = invoice.lineItems[0]
    const second = invoice.lineItems[1]
    if (!first || !second) throw new Error('Expected two lines')
    fireEvent.click(screen.getByRole('tab', { name: /Line items/ }))
    fireEvent.click(screen.getByRole('button', { name: /Edit line 1/ }))

    const quantity = screen.getByLabelText('Quantity, line 1')
    fireEvent.change(quantity, { target: { value: '2,5' } })
    fireEvent.blur(quantity)

    expect(screen.getByLabelText('Quantity, line 1')).toHaveValue('2.5')
    expect(
      screen.getByRole('button', { name: /Edit line 2/ }).closest('tr'),
    ).toHaveTextContent(String(second.quantity.value))
    expect(screen.getByLabelText('Line total, line 1')).toHaveValue(
      String(first.lineTotal.value),
    )
    expect(screen.getByLabelText('Unit price, line 1')).toHaveValue(
      String(first.unitPrice.value),
    )
    expect(first.quantity.value).not.toBe(2.5)
    expect(
      useReviewStore.getState().reviews['inv-003']?.overrides.lines[first.id]
        ?.lineTotal,
    ).toBeUndefined()
  })
})
