import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById, invoices } from '../data/invoices.ts'
import type { InvoiceReview } from '../model/corrections.ts'
import { REVIEW_STORAGE_KEY, useReviewStore } from '../model/review-store.ts'
import { ReviewWorkspace } from './ReviewWorkspace.tsx'

const NOW = '2026-10-20T18:00:00.000Z'

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
}

describe('review decisions', () => {
  it('confirms a clear invoice, updates progress, and opens the next pending invoice', () => {
    renderWorkspace()

    expect(screen.getByText(/Pending 13/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))

    expect(screen.getByRole('button', { name: /inv-002/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByText(/Invoice confirmed/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmed 1/)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Confirmed' })).getByRole(
        'button',
        { name: /inv-001/ },
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /inv-001/ }))
    expect(screen.getByLabelText('Supplier')).toBeDisabled()
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Confirm invoice' }),
    ).not.toBeInTheDocument()
  })

  it('blocks confirmation in the UI and the store when the original or invoice number is missing', () => {
    renderWorkspace()
    showInvoice('inv-003')

    const actions = screen.getByRole('contentinfo', { name: 'Review actions' })
    expect(
      within(actions).getByRole('button', { name: 'Confirm invoice' }),
    ).toBeDisabled()
    expect(
      within(actions).getByText(/original document is unavailable/i),
    ).toBeInTheDocument()
    expect(useReviewStore.getState().confirmInvoice('inv-003')).toEqual({
      ok: false,
      code: 'source-unavailable',
    })
    expect(screen.getByRole('button', { name: /inv-003/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    showInvoice('inv-023')
    const blocked = screen.getByRole('contentinfo', { name: 'Review actions' })
    expect(
      within(blocked).getByRole('button', { name: 'Confirm invoice' }),
    ).toBeDisabled()
    expect(
      within(blocked).getByText(/Invoice number is required/),
    ).toBeInTheDocument()
  })

  it('confirms an invoice that only has warnings', () => {
    renderWorkspace()
    showInvoice('inv-006')

    expect(
      screen.getByRole('button', { name: 'Confirm invoice' }),
    ).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))

    expect(screen.getByRole('button', { name: /inv-007/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(
      within(screen.getByRole('region', { name: 'Confirmed' })).getByRole(
        'button',
        { name: /inv-006/ },
      ),
    ).toHaveTextContent('Confirmed')
  })

  it('sets an invoice aside with its correction, resumes it, and keeps the correction', async () => {
    renderWorkspace()
    showInvoice('inv-003')

    const supplier = screen.getByLabelText('Supplier')
    fireEvent.change(supplier, { target: { value: 'Checked supplier' } })
    fireEvent.blur(supplier)
    fireEvent.click(screen.getByRole('button', { name: 'Set aside' }))
    expect(screen.getByLabelText('Reason')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Save set aside' }))
    expect(
      screen.getByText(/Enter a reason before setting this invoice aside/),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: ' Waiting for the PDF ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save set aside' }))

    expect(screen.getByRole('button', { name: /inv-004/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByText(/Set aside 1/)).toBeInTheDocument()

    const saved = localStorage.getItem(REVIEW_STORAGE_KEY) ?? ''
    expect(saved).toContain('Waiting for the PDF')
    expect(saved).toContain('Checked supplier')
    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved)
    await act(() => useReviewStore.persist.rehydrate())

    showInvoice('inv-003')
    expect(
      screen.getByText('Set aside: Waiting for the PDF'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier')).toBeDisabled()
    expect(screen.getByLabelText('Supplier')).toHaveValue('Checked supplier')

    fireEvent.click(screen.getByRole('button', { name: 'Resume review' }))
    expect(screen.getByLabelText('Supplier')).toBeEnabled()
    expect(screen.getByLabelText('Supplier')).toHaveValue('Checked supplier')
    expect(
      screen.getByRole('button', { name: 'Confirm invoice' }),
    ).toBeDisabled()
  })

  it('stays on the current invoice when no pending invoice remains', () => {
    const reviews: Record<string, InvoiceReview> = {}
    for (const invoice of invoices) {
      if (invoice.client.id !== 'bili-brig' || invoice.id === 'inv-001')
        continue
      reviews[invoice.id] = {
        status: 'confirmed',
        overrides: { header: {}, lines: {} },
        confirmedAt: NOW,
        updatedAt: NOW,
      }
    }
    useReviewStore.setState({ reviews })
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))

    expect(screen.getByRole('button', { name: /inv-001/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(
      screen.getByText(/No pending invoices remain for this client/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Pending 0/)).toBeInTheDocument()
  })

  it('asks before resetting and leaves unrelated browser storage alone', () => {
    localStorage.setItem('other-app', 'keep')
    const originalName = getInvoiceById('inv-001')?.fields.vendorName.value
    renderWorkspace()

    const supplier = screen.getByLabelText('Supplier')
    fireEvent.change(supplier, { target: { value: 'Checked supplier' } })
    fireEvent.blur(supplier)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))
    fireEvent.click(screen.getByRole('button', { name: /inv-001/ }))
    expect(screen.getByLabelText('Supplier')).toBeDisabled()
    expect(screen.getByLabelText('Supplier')).toHaveValue('Checked supplier')

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    const dialog = screen.getByRole('dialog', { name: 'Reset the demo?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Supplier')).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Reset the demo?' })).getByRole(
        'button',
        { name: 'Reset' },
      ),
    )

    expect(screen.getByText(/Pending 13/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmed 0/)).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier')).toBeEnabled()
    expect(screen.getByLabelText('Supplier')).toHaveValue(originalName)
    expect(localStorage.getItem('other-app')).toBe('keep')
    expect(getInvoiceById('inv-001')?.fields.vendorName.value).toBe(
      originalName,
    )
  })
})
