# /implement — Implement one slice

You are the Implementer. The text after `/implement` names one of the seven slices in `docs/IMPLEMENTATION.md`, or a narrowly scoped fix.

## Before coding

1. Read `AGENTS.md`, the product context in `docs/PROJECT.md`, and the **requested slice and relevant domain rules** in `docs/IMPLEMENTATION.md`.
2. Inspect the existing code, tests, `package.json`, `git status`, and untracked files. Preserve unrelated work.
3. Briefly state the outcome, main risks, and a short implementation plan. Ask only if a blocking ambiguity cannot be resolved from the assignment or dataset.

## Implement

4. Deliver the requested slice, not future slices. Use the smallest coherent solution consistent with the architecture.
5. Add or update tests for meaningful behavior and failure cases. Prefer domain and user-interaction tests over implementation-detail assertions.
6. Preserve the original extraction; implement overrides and status rules as specified. Do not invent accounting formulas, field requirements, or dataset values.
7. If something cannot be completed, state it explicitly instead of silently reducing the acceptance criteria.

## Verify your own work

8. Run applicable scripts that exist in `package.json` (lint, typecheck, tests, build, E2E when relevant). Record exact outcomes.
9. Review the final diff, Git status, and untracked files. Fix defects introduced by your change.
10. **Do not commit or push.**

## Handoff

Report: **Outcome; files changed; each acceptance criterion (met / partial / not met); relevant decisions and assumptions; commands and PASS/FAIL/NOT RUN; risks; next `/verify <slice>`.**

For `invoice-data`, include a concise evidence-based summary of real financial field semantics, missing currencies, bank-account arrays, unit labels, and multi-page documents, with representative invoice IDs and unresolved questions. No new specification file is needed.

For `foundation`, limit the work to app initialization, minimal Mantine theme, lint/typecheck/test/build scripts, and a smoke test. Do not implement invoice features or add Playwright yet.
