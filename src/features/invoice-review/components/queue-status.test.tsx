import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { theme } from '../../../app/theme.ts'
import { getInvoiceById } from '../data/invoices.ts'
import { REVIEW_STORAGE_KEY, useReviewStore } from '../model/review-store.ts'
import { ReviewWorkspace } from './ReviewWorkspace.tsx'
import classes from './workspace.module.css'

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

function reviewRegion() {
  return screen.getByRole('region', { name: 'Invoice review' })
}

describe('queue status and set-aside reason', () => {
  it('keeps a severity accent visible when a row is selected', () => {
    renderWorkspace()

    const clean = screen.getByRole('button', { name: /inv-001/ })
    const warning = screen.getByRole('button', { name: /inv-006/ })
    const blocking = screen.getByRole('button', { name: /inv-003/ })

    expect(clean).toHaveClass(classes.queueAccentNeutral)
    expect(clean).toHaveAttribute('aria-current', 'true')
    expect(warning).toHaveClass(classes.queueAccentWarning)
    expect(warning).not.toHaveAttribute('aria-current')
    expect(blocking).toHaveClass(classes.queueAccentBlocking)

    fireEvent.click(blocking)

    expect(blocking).toHaveAttribute('aria-current', 'true')
    expect(blocking).toHaveClass(classes.queueAccentBlocking)
    expect(blocking).not.toHaveClass(classes.queueAccentNeutral)
    expect(clean).toHaveClass(classes.queueAccentNeutral)
    expect(clean).not.toHaveAttribute('aria-current')

    showInvoice('inv-001')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm invoice' }))
    const confirmed = within(
      screen.getByRole('region', { name: 'Confirmed' }),
    ).getByRole('button', { name: /inv-001/ })
    expect(confirmed).toHaveClass(classes.queueAccentConfirmed)
    expect(confirmed).not.toHaveClass(classes.queueAccentNeutral)
    fireEvent.click(confirmed)
    expect(confirmed).toHaveAttribute('aria-current', 'true')
    expect(confirmed).toHaveClass(classes.queueAccentConfirmed)
    expect(
      within(reviewRegion()).queryByText('Set aside reason'),
    ).not.toBeInTheDocument()

    showInvoice('inv-003')
    fireEvent.click(screen.getByRole('button', { name: 'Set aside' }))
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Need the original' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save set aside' }))

    const aside = within(
      screen.getByRole('region', { name: 'Set aside' }),
    ).getByRole('button', { name: /inv-003/ })
    expect(aside).toHaveClass(classes.queueAccentAside)
    expect(aside).not.toHaveClass(classes.queueAccentBlocking)
    fireEvent.click(aside)
    expect(aside).toHaveAttribute('aria-current', 'true')
    expect(aside).toHaveClass(classes.queueAccentAside)
    expect(within(reviewRegion()).getByText('Set aside')).toBeInTheDocument()
    expect(
      within(reviewRegion()).getByText('Set aside reason'),
    ).toBeInTheDocument()
    expect(
      within(reviewRegion()).getByText('Need the original'),
    ).toBeInTheDocument()
  })

  it('shows a saved set-aside reason after reload and removes it on resume', async () => {
    renderWorkspace()
    showInvoice('inv-004')
    expect(
      within(reviewRegion()).queryByText('Set aside reason'),
    ).not.toBeInTheDocument()

    showInvoice('inv-003')
    fireEvent.click(screen.getByRole('button', { name: 'Set aside' }))
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Waiting for the PDF' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save set aside' }))

    showInvoice('inv-003')
    expect(
      within(reviewRegion()).getByText('Set aside reason'),
    ).toBeInTheDocument()
    expect(
      within(reviewRegion()).getByText('Waiting for the PDF'),
    ).toBeInTheDocument()
    expect(within(reviewRegion()).getByText('Set aside')).toBeInTheDocument()

    const saved = localStorage.getItem(REVIEW_STORAGE_KEY) ?? ''
    expect(saved).toContain('Waiting for the PDF')
    useReviewStore.setState({ reviews: {} })
    localStorage.setItem(REVIEW_STORAGE_KEY, saved)
    await act(() => useReviewStore.persist.rehydrate())

    showInvoice('inv-003')
    expect(
      within(reviewRegion()).getByText('Set aside reason'),
    ).toBeInTheDocument()
    expect(
      within(reviewRegion()).getByText('Waiting for the PDF'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resume review' }))

    expect(
      within(reviewRegion()).queryByText('Set aside reason'),
    ).not.toBeInTheDocument()
    expect(
      within(reviewRegion()).queryByText('Waiting for the PDF'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Set aside' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /inv-003/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
