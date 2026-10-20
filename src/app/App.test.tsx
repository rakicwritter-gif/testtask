import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { theme } from './theme'

describe('App', () => {
  it('renders the invoice review shell', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <App />
      </MantineProvider>,
    )

    expect(
      screen.getByRole('heading', { name: 'Invoice Review' }),
    ).toBeInTheDocument()
  })
})
