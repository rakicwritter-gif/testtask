import { fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById, invoices } from '../data/invoices.ts'
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

describe('ReviewWorkspace', () => {
  it('updates the queue, document, and review panel when an invoice is selected', () => {
    renderWorkspace()

    expect(
      screen.getByRole('heading', { name: 'Invoice Review' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /inv-001/ })).toHaveAttribute(
      'src',
      '/invoices/inv-001.jpg',
    )
    expect(
      screen.getByRole('region', { name: 'Invoice review' }),
    ).toHaveTextContent('FARMA KOKA')

    const current = screen.getByRole('button', { name: /inv-001/ })
    current.focus()
    fireEvent.keyDown(current, { key: 'ArrowDown' })

    expect(screen.getByRole('button', { name: /inv-002/ })).toHaveFocus()
    expect(screen.getByRole('img', { name: /inv-002/ })).toHaveAttribute(
      'src',
      '/invoices/inv-002.jpg',
    )
    expect(
      screen.getByRole('region', { name: 'Invoice review' }),
    ).toHaveTextContent('Franck')
  })

  it('filters the queue by client', () => {
    renderWorkspace()
    const callEro = invoices.filter(
      (invoice) => invoice.client.id === 'call-ero',
    )
    const first = callEro[0]
    if (!first) throw new Error('Expected a call-ero invoice')

    fireEvent.change(screen.getByLabelText('Client'), {
      target: { value: 'call-ero' },
    })

    expect(
      screen.getByRole('button', { name: new RegExp(first.id) }),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      screen.queryByRole('button', { name: /inv-001/ }),
    ).not.toBeInTheDocument()
  })

  it('collapses the queue', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: 'Hide queue' }))

    expect(screen.getByRole('button', { name: 'Show queue' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(
      screen.queryByRole('navigation', { name: 'Invoices' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show queue' }))
    expect(
      screen.getByRole('navigation', { name: 'Invoices' }),
    ).toBeInTheDocument()
  })

  it('zooms images and embeds multi-page PDFs with native zoom', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('125%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /inv-001/ })).toHaveStyle({
      width: '125%',
    })

    showInvoice('inv-011')
    const frame = screen.getByTitle('Original PDF inv-011')
    expect(frame).toHaveAttribute('src', '/invoices/inv-011.pdf')
    expect(frame.tagName).toBe('IFRAME')
    expect(screen.getByText(/2 pages/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Zoom in' }),
    ).not.toBeInTheDocument()

    showInvoice('inv-022')
    expect(screen.getByTitle('Original PDF inv-022')).toHaveAttribute(
      'src',
      '/invoices/inv-022.pdf',
    )
    expect(screen.getByText(/2 pages/)).toBeInTheDocument()
  })

  it('shows a missing original without inventing a document', () => {
    renderWorkspace()
    const invoice = showInvoice('inv-003')

    const viewer = screen.getByRole('region', { name: 'Original document' })
    expect(
      within(viewer).getByRole('heading', {
        name: 'Original document unavailable',
      }),
    ).toBeInTheDocument()
    expect(
      within(viewer).getByText(new RegExp(invoice.originalFilename)),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/Original PDF/)).not.toBeInTheDocument()
  })

  it('shows a missing currency and every bank account', () => {
    renderWorkspace()
    showInvoice('inv-006')
    const panel = screen.getByRole('region', { name: 'Invoice review' })

    expect(
      within(panel).getAllByText('Currency not detected').length,
    ).toBeGreaterThan(0)
    expect(within(panel).queryByText(/BAM/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /inv-006/ }),
    ).not.toHaveTextContent('BAM')

    const missingOriginal = showInvoice('inv-003')
    fireEvent.click(
      screen.getByRole('button', { name: 'Show additional details' }),
    )
    const accounts = within(
      screen.getByRole('region', { name: 'Invoice review' }),
    ).getByRole('list', { name: 'Bank accounts' })
    const accountInputs = within(accounts).getAllByRole('textbox')
    expect(accountInputs).toHaveLength(
      missingOriginal.fields.bankAccounts.value.length,
    )
    expect(missingOriginal.fields.bankAccounts.value).toHaveLength(7)
    expect(
      accountInputs.map((input) => (input as HTMLInputElement).value),
    ).toEqual([...missingOriginal.fields.bankAccounts.value])
  })

  it('renders a scrollable line-item table with source units and precision', () => {
    renderWorkspace()
    showInvoice('inv-011')
    fireEvent.click(screen.getByRole('tab', { name: /Line items \(45\)/ }))

    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveStyle({ overflow: 'auto' })
    expect(within(panel).getAllByRole('row')).toHaveLength(46)

    showInvoice('inv-022')
    fireEvent.click(screen.getByRole('tab', { name: /Line items/ }))
    expect(screen.getByText('0.2566')).toBeInTheDocument()
    expect(screen.getByText('0.0042')).toBeInTheDocument()

    showInvoice('inv-004')
    fireEvent.click(screen.getByRole('tab', { name: /Line items/ }))
    const invoice = getInvoiceById('inv-004')
    const unit = invoice?.lineItems.find((line) => line.unit.value === 'KO')
      ?.unit.value
    expect(unit).toBe('KO')
    expect(screen.getAllByText(/KO/).length).toBeGreaterThan(0)

    showInvoice('inv-023')
    expect(screen.getByRole('button', { name: /inv-023/ })).toHaveTextContent(
      'No invoice number',
    )
    fireEvent.click(screen.getByRole('tab', { name: /^Details/ }))
    expect(
      within(
        screen.getByRole('region', { name: 'Invoice review' }),
      ).getAllByText('No invoice number').length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: /Line items/ }))
    expect(screen.getAllByText('Not detected').length).toBeGreaterThan(0)
  })
})
