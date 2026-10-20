# Invoice Review Workspace

A desktop-first application for accountants to review AI-extracted invoice data against original documents.

## Overview

The goal is to make invoice verification easier by keeping the invoice queue, original document, and extracted data in one workspace.

The planned review flow is straightforward: select an invoice, compare the extracted values with the original, correct mistakes, and confirm the invoice or set it aside for later.

For the reasoning behind the product and architecture, see [Project decisions](docs/PROJECT.md).

## Getting started

Requires Node.js 20+ and npm.

```bash
npm install && npm run dev
```

Open the local URL displayed in the terminal (usually `http://localhost:5173`).

## Technical approach

- React, TypeScript, Vite, and Mantine.
- Local invoice dataset and original PDF/JPG documents.
- Original extraction kept separate from user corrections.
- Validation used to support human review, not replace it.
- Browser-based persistence for review progress.

The project is a client-side prototype and does not require a backend.

## Scope

The focus is the invoice review workflow rather than OCR processing or a complete accounting system. Document uploads, accounting integrations, collaboration, and bulk approval are outside the planned MVP.