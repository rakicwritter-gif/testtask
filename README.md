# Invoice Review Workspace

A desk for an accountant who checks invoices that have already been read by OCR. She compares each one with the original, fixes mistakes, and decides whether it can be booked.

## Run

Node.js 20+ and npm.

```bash
npm install && npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. No backend and no setup file. The invoices and scans are already in the project.

## Who it is for

I pictured one accountant with a pile of supplier invoices for two small companies, Bili Brig and Call Ero. Her morning is not data entry. The scan is already read. Her job is to see whether the reading matches the paper, fix what does not, and say either "book this" or "not yet."

She works one invoice at a time. The queue is on the left, the original in the middle, the extracted values on the right. She should not have to remember a number while switching screens.

## Decisions

1. **The extraction is never overwritten.** A correction sits in a separate layer in this browser. She can see what the model said and restore it. If a booking is wrong later, it is clear whether the model or the person changed the value.

2. **Confirmation is her click.** A missing original, a missing invoice number, or a missing total blocks it. Low confidence, a possible duplicate, and a net-plus-VAT mismatch are warnings. They do not approve or reject the invoice. A quiet invoice still waits for her. High confidence is not proof.

3. **A duplicate is the same client, supplier, and invoice number.** The same amount is not enough. `inv-006` and `inv-007` are the same invoice received twice. `inv-001` and `inv-012` share a total and are two real invoices. Matching on amount would flag every repeat supplier.

4. **A line total is not recalculated from quantity and price.** I wanted that formula. This set does not support it. On `inv-001` the line is gross. On `inv-002` it is net, and it includes a discount. An edit changes only the field she touched.

5. **I deliberately left out bulk approval.** One click would book a pile she had not looked at. I also left out uploads, new OCR, and sending invoices into an accounting system. This version is only the review itself.

## Before production

1. Which fields must be filled before she can confirm, and is that list the same for every client?
2. Which amount differences are real errors, and which are rounding, a discount, or another way of showing tax?
3. When the original file is missing, who gets it, and can she confirm without it?

## How I would know it works

I would time the same invoices the old way, document in one window and a spreadsheet in another, and this way, on one screen. Separately for clean invoices and invoices with warnings.

I would measure time per invoice, confirmations later found to be wrong, how often a warning was a false alarm, and how often she had to correct or set an invoice aside.

Faster is not better if more errors get through. The result I would want is less time per invoice and no rise in wrong confirmations.

## AI

I used Cursor. There was a lot of back and forth.

## Not finished

I did not get the PDFs into a state I trust. `inv-011` and `inv-022` open in the browser's own viewer, and I ran out of time to make that solid. Photos zoom in the app. PDFs do not.

A confirmed invoice cannot be opened again. I would want a way to undo that before anyone used this for real.
