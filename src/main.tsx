import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@fontsource-variable/inter'
import '@mantine/core/styles.css'
import { App } from './app/App.tsx'
import { theme } from './app/theme.ts'
import { useReviewStore } from './features/invoice-review/model/review-store.ts'
import './index.css'

void useReviewStore.persist.rehydrate()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
)
