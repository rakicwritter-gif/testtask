# Invoice Review Workspace

A desktop workspace for an accountant to check AI-extracted invoice data against the original document, correct mistakes, and record a review decision.

## Setup

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the local app |
| `npm run lint` | Lint |
| `npm run typecheck` | Typecheck |
| `npm run test:run` | Unit and component tests |
| `npm run test:e2e` | Two Playwright smoke tests (Chromium) |
| `npm run build` | Typecheck and production build |

The first end-to-end run needs the Playwright browser: `npx playwright install chromium`.

## What the workspace does

The accountant stays on one screen: an invoice queue, the original PDF or image, and the extracted invoice. Select a client, open an invoice, compare it with the source, correct header fields, amounts, bank accounts, and existing line items, then confirm it or set it aside with a reason. Progress is the count of those decisions for the current client.

Confirmation is an explicit action. It is allowed only when the original document is available and the invoice has no blocking issue. Warnings, including low confidence and a possible duplicate, do not confirm or reject an invoice by themselves. A confirmed invoice is read-only. A set-aside invoice stays in the queue and can be resumed with its corrections intact.

**Reset demo**, in the header, asks for confirmation and then clears only this app’s saved corrections and decisions. The supplied invoices are not changed.

The longer product rationale is in [docs/PROJECT.md](docs/PROJECT.md).

## Decisions

- Extracted values stay immutable. Corrections and review decisions are stored separately in this browser and applied when the screen is shown.
- Existing line items can be corrected. Adding, removing, or reordering rows is out of scope.
- A missing original blocks confirmation. Five sample invoices have no file; they can be set aside.
- Currency is never guessed. A missing currency stays missing until someone enters one.
- Line totals are not recalculated from quantity and unit price. That approach was considered and rejected because the sample does not use one net or gross meaning for line totals. An edit changes only the field that was edited.
- Bulk approval, uploads, OCR, accounting export, and collaboration are not part of this prototype.

## Open questions for an accountant

1. Which fields must be checked before confirmation, and does that differ by client?
2. Which amount differences are real errors, and which are rounding, discounts, or tax presentation?
3. How should a missing or unreadable original be resolved, and is currency always required?

## How to judge whether this helps

Useful signs would be time to review an invoice, confirmations later found to be wrong, how often invoices need corrections, how often warnings are false alarms, and how often invoices are set aside.

## Limitations

This is a single-user local prototype. Browser storage is not an audit trail and is not shared or secured for production. The validation rules are a small review aid, not a legal or accounting ruleset. Confidence scores are extraction signals, not proof that a value is right or wrong. The viewer can show the supplied PDF and image files; it cannot highlight a field inside the document because the data has no coordinates.

## Development

The workspace was implemented with assistance from Cursor. The review rules above were checked against the supplied invoices and the automated tests, including `inv-006` / `inv-007` for a possible duplicate and missing currency, `inv-003` for a missing original, and `inv-011` for a long multi-page invoice.
