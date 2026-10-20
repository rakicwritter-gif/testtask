import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { useReviewStore } from '../features/invoice-review/model/review-store.ts'

beforeEach(() => {
  localStorage.clear()
  useReviewStore.setState({ reviews: {} })
})

afterEach(() => {
  cleanup()
})

Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
