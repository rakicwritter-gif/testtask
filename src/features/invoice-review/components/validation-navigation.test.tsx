import { fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById } from '../data/invoices.ts'
import { useReviewStore } from '../model/review-store.ts'
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

describe('validation navigation', () => {
  it('groups low-confidence fields, then updates the summary after a correction', () => {
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
    expect(within(summary).queryByText(/currency/i)).not.toBeInTheDocument()
    expect(within(summary).getAllByRole('button').length).toBeLessThan(6)
    expect(
      document.getElementById('field-inv-006-vendorName-attention'),
    ).toHaveTextContent('Needs a closer look')

    const buyer = screen.getByLabelText('Buyer')
    fireEvent.change(buyer, { target: { value: 'Checked buyer' } })
    fireEvent.blur(buyer)

    expect(
      within(screen.getByRole('region', { name: 'Issues' })).getByRole(
        'button',
        { name: /10 header fields need a closer look/ },
      ),
    ).toBeInTheDocument()
    expect(
      document.getElementById('field-inv-006-buyerName-attention'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Buyer')).toHaveValue('Checked buyer')
  })

  it('opens the related invoice from a duplicate and shows that invoice status', () => {
    useReviewStore.setState({
      reviews: {
        'inv-007': {
          status: 'set_aside',
          overrides: { header: {}, lines: {} },
          setAsideReason: 'Waiting on the source file',
          updatedAt: '2026-10-20T00:00:00.000Z',
        },
      },
    })
    renderWorkspace()
    showInvoice('inv-006')

    const setAside = screen.getByRole('region', { name: 'Set aside' })
    expect(
      within(setAside).getByRole('button', { name: /inv-007/ }),
    ).toHaveTextContent('Set aside')
    expect(
      within(
        screen.getByRole('region', { name: 'Needs attention' }),
      ).queryByRole('button', { name: /inv-007/ }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Possible duplicate of inv-007, currently Set aside/,
      }),
    )

    expect(screen.getByRole('button', { name: /inv-007/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'IVA KOLAČI',
    )
    expect(
      screen.getByRole('heading', { level: 2 }).parentElement,
    ).toHaveTextContent('Set aside')
  })

  it('focuses a line item, a required field, the document, and a bank account', () => {
    renderWorkspace()
    showInvoice('inv-007')
    fireEvent.click(
      screen.getByRole('button', {
        name: /Line 4 description needs a closer look/,
      }),
    )
    expect(document.getElementById('line-inv-007:3-description')).toHaveFocus()

    showInvoice('inv-023')
    const summary = screen.getByRole('region', { name: 'Issues' })
    const amount = within(summary).getByRole('button', {
      name: /does not match the total 139.18/,
    })
    expect(amount).toHaveTextContent('Warning')
    fireEvent.click(
      within(summary).getByRole('button', {
        name: /Invoice number is required/,
      }),
    )
    expect(document.getElementById('field-inv-023-invoiceNumber')).toHaveFocus()
    expect(
      document.getElementById('field-inv-023-invoiceNumber-attention'),
    ).toHaveTextContent('Required')

    showInvoice('inv-003')
    fireEvent.click(
      screen.getByRole('button', { name: /Original document is unavailable/ }),
    )
    const viewer = document.getElementById('original-document')
    expect(viewer).toHaveFocus()
    expect(
      within(viewer as HTMLElement).getByRole('heading', {
        name: 'Original document unavailable',
      }),
    ).toBeInTheDocument()

    showInvoice('inv-006')
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide additional details' }),
    )
    fireEvent.click(screen.getByRole('button', { name: /View all/ }))
    fireEvent.click(
      screen.getByRole('button', { name: /Bank accounts need a closer look/ }),
    )
    expect(document.getElementById('field-inv-006-bank-0')).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Hide additional details' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('places clean invoices apart from invoices that need attention', () => {
    renderWorkspace()

    const clear = screen.getByRole('region', { name: 'No detected issues' })
    expect(
      within(clear).getByRole('button', { name: /inv-001/ }),
    ).toBeInTheDocument()
    expect(
      within(clear).getByRole('button', { name: /inv-002/ }),
    ).toBeInTheDocument()

    const attention = screen.getByRole('region', { name: 'Needs attention' })
    const missing = within(attention).getByRole('button', { name: /inv-003/ })
    expect(missing).toHaveTextContent('Blocking')
    expect(missing).toHaveTextContent('Pending')
    expect(
      within(screen.getByRole('region', { name: 'Issues' })).getByText(
        'No detected issues',
      ),
    ).toBeInTheDocument()
  })
})
