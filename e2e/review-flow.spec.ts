import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('corrects a warning, confirms the invoice, and keeps that decision after reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: /inv-006/ }).click()
  await expect(
    page.getByRole('tabpanel').getByText('Currency not detected'),
  ).toBeVisible()

  const currency = page.getByRole('textbox', { name: 'Currency', exact: true })
  await currency.fill('BAM')
  await currency.blur()
  await expect(page.getByText('Edited')).toBeVisible()

  await page.getByRole('button', { name: 'Confirm invoice' }).click()
  await expect(page.getByRole('button', { name: /inv-007/ })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(page.getByText(/Confirmed 1/)).toBeVisible()

  await page.reload()
  const confirmed = page.getByRole('button', { name: /inv-006/ })
  await expect(confirmed).toContainText('Confirmed')
  await confirmed.click()
  const savedCurrency = page.getByRole('textbox', {
    name: 'Currency',
    exact: true,
  })
  await expect(savedCurrency).toHaveValue('BAM')
  await expect(savedCurrency).toBeDisabled()
  await expect(page.getByText(/read-only/i)).toBeVisible()
})

test('sets a missing original aside, resumes the correction, and resets only this demo', async ({
  page,
}) => {
  await page.getByRole('button', { name: /inv-003/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Original document unavailable' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirm invoice' }),
  ).toBeDisabled()

  const supplier = page.getByRole('textbox', { name: 'Supplier', exact: true })
  await supplier.fill('Checked supplier')
  await supplier.blur()
  await page.getByRole('button', { name: 'Set aside' }).click()
  await page.getByLabel('Reason').fill('Waiting for the PDF')
  await page.getByRole('button', { name: 'Save set aside' }).click()
  await expect(page.getByText(/Set aside 1/)).toBeVisible()

  await page.getByRole('button', { name: /inv-003/ }).click()
  await expect(page.getByText('Set aside: Waiting for the PDF')).toBeVisible()
  const setAsideSupplier = page.getByRole('textbox', {
    name: 'Supplier',
    exact: true,
  })
  await expect(setAsideSupplier).toHaveValue('Checked supplier')
  await expect(setAsideSupplier).toBeDisabled()

  await page.getByRole('button', { name: 'Resume review' }).click()
  const resumedSupplier = page.getByRole('textbox', {
    name: 'Supplier',
    exact: true,
  })
  await expect(resumedSupplier).toBeEnabled()
  await expect(resumedSupplier).toHaveValue('Checked supplier')

  await page.evaluate(() => localStorage.setItem('other-app', 'keep'))
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await page
    .getByRole('dialog', { name: 'Reset the demo?' })
    .getByRole('button', { name: 'Reset' })
    .click()

  await expect(page.getByText(/Pending 13/)).toBeVisible()
  await expect(page.getByText(/Set aside 0/)).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Supplier', exact: true }),
  ).toHaveValue('"EDO-SLAD" d.o.o.')
  await expect(
    page.evaluate(() => localStorage.getItem('other-app')),
  ).resolves.toBe('keep')
  await expect(
    page.evaluate(() => localStorage.getItem('invoice-review.corrections.v1')),
  ).resolves.not.toContain('Checked supplier')
})
