# Invoice Review Workspace

## Overview

The task is to help an accountant review invoice data that has already been extracted by OCR/AI. The extracted values may look correct but still contain mistakes, so the accountant needs a quick way to compare them with the original document, make corrections, and decide what to do with each invoice.

I'm keeping the scope focused on that review process. This is not an OCR tool or a full accounting system.

## The workspace

I chose a three-column layout:

- **Invoice queue** on the left, for moving between invoices and seeing their review status.
- **Original document** in the middle, for checking the extracted values against the PDF or image.
- **Review panel** on the right, for invoice details, line items, issues, and review actions.

The main reason is to avoid making the accountant switch between screens while comparing data. The queue can collapse when more space is needed for the document and form. The review panel separates invoice details from line items, which can be quite long.

The basic flow is: **select an invoice → check the original → correct any mistakes → confirm or set aside**.

## Product decisions

### Keep the accountant in control

The app can highlight potential problems, but it should not approve invoices automatically. Confirmation is an explicit action. I'm also leaving out bulk approval because the purpose of this exercise is to make individual reviews reliable first.

Each invoice starts as **Pending**. It can be **Confirmed** when the required checks pass, or **Set aside** with a reason. A set-aside invoice can be resumed without losing corrections. Confirmed invoices are read-only.

### Keep the original extraction unchanged

I don't want edits to overwrite what the extraction originally returned. The source data stays unchanged, while user corrections are stored separately. The UI shows the current values after applying those corrections.

This keeps the data flow predictable and makes it possible to distinguish extracted values from reviewed values.

### Allow line-item corrections

Checking only the invoice header would leave out important mistakes. The accountant should also be able to correct existing line items, including descriptions, quantities, prices, tax rates, and amounts.

Adding, removing, or reordering rows is outside this MVP. That would introduce a broader invoice-editing workflow rather than just correcting extracted data.

### Treat warnings as guidance, not conclusions

A low confidence score means a field is worth checking; it does not prove the value is wrong. High confidence does not remove the need to review it either.

The sample data also has inconsistent amount and line-total conventions. I don't want to invent accounting rules or automatically recalculate values based on assumptions the dataset doesn't support. Validation should be conservative, with a clear distinction between blocking problems and warnings.

Possible duplicates are checked within the same client using the supplier and invoice number. They should be shown as possible matches, with a way to inspect the related invoice, rather than automatically rejected.

### Don't confirm an invoice without its source

Some invoices have no original PDF or image. In this MVP, confirmation means the extracted information could be checked against the source document, so a missing original blocks confirmation. The accountant can set the invoice aside with a reason instead.

This is a deliberate rule for this prototype, not a claim that every real accounting workflow must work this way.

## Dataset considerations

The provided dataset contains **25 invoices across two clients**, including **five without original documents**. It also has long line-item lists, multi-page PDFs, missing currency values, multiple bank accounts, and inconsistent unit labels.

A few cases are particularly useful for testing the workflow:

- `inv-006` and `inv-007`: possible duplicate invoices and missing currency values.
- `inv-006`: several low-confidence fields that should be summarized without hiding individual warnings.
- `inv-019` and `inv-023`: amount differences that need cautious validation.
- `inv-011` and `inv-022`: multi-page PDF originals.

Missing values should remain visible as missing rather than being filled with guesses. The dataset has no OCR coordinates, so the app should not pretend it can highlight exact text positions in the original document.

## Technical approach

The app uses **React, TypeScript, Vite, Mantine, and Zustand**, with **Vitest and React Testing Library** for testing. The supplied JSON and original documents are local, so there's no need for a backend, authentication, or OCR integration in this exercise.

The data flow is:

```text
Original invoice + user corrections
                 ↓
          Effective invoice
                 ↓
        Validation and issues
                 ↓
       Review state and UI
```

Only corrections and review decisions need to be saved in browser storage. Effective invoice values, warnings, and queue groupings can be derived from that state.

I want validation and review rules outside the React components, so the same rules apply regardless of how an action is triggered and can be tested independently.

## Scope

This is a single-user, local-first prototype. Browser persistence is useful for the demo, but it isn't a production audit trail.

I'm intentionally not building uploads, OCR processing, accounting integrations, exports, or collaboration. The priority is a clear, dependable review flow rather than a larger feature set.
