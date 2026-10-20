# Engineering Working Agreement

This repository contains a senior frontend take-home: a focused invoice review workspace.

## Where to look

- **Original assignment and supplied dataset:** authoritative task and source records.
- [`docs/PROJECT.md`](docs/PROJECT.md): product rationale, architecture, trade-offs, and delivery overview.
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md): detailed interaction rules, domain contracts, dataset edge cases, **seven named slices**, and acceptance criteria.
- Existing implementation and tests: current behavior, not a replacement for the requirements.

Read the relevant slice in `docs/IMPLEMENTATION.md` and the surrounding code before making changes. If documents and actual source data conflict, report the discrepancy rather than guessing.

## Engineering principles

- Work on one slice at a time, in the documented order. Keep changes small and reviewable.
- Treat extracted invoice data as immutable. Persist typed corrections and review decisions; derive effective values, issues, and queue groups.
- Put money parsing, validation, and status-transition guards in testable domain code, not UI components.
- Respect real data: nullable currencies, multiple bank accounts, inconsistent units, multi-page PDFs, stable invoice-scoped line identities, and mixed line-total semantics.
- Support decimal commas and decimal points with field-specific precision; do not silently interpret thousands separators.
- Preserve keyboard access, visible focus, readable errors, and clear missing-document states.
- Avoid speculative abstractions, unrelated refactors, new dependencies without a concrete reason, and features outside the MVP.
- Ask a focused question only when an ambiguity blocks safe implementation.

## Implementer and Reviewer

Use separate, sequential Cursor chats against the same working tree:

- `/implement <slice>` implements the requested slice and its relevant tests.
- `/verify <slice>` independently checks behavior, edge cases, tests, and scope.

Before and after work, inspect Git status and untracked files. Never overwrite unrelated changes. The Reviewer is read-only unless explicitly authorized. **Neither agent commits, pushes, rebases, resets, or amends Git history.** The developer reviews and commits after verification.

Run applicable scripts that actually exist in `package.json` (lint, typecheck, tests, build, and E2E when relevant). Report exact commands, results, and any checks not run. Do not claim completion when acceptance criteria remain unmet.

## Scope boundary

No backend, authentication, OCR/LLM processing, uploads, bulk approval, accounting integration, production audit trail, or generic design system unless the developer deliberately changes the specification.
