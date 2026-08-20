# TDD Protocol

TDD is mandatory for application code and strongly preferred for scripts and domain utilities.

## Red

- Start with the user outcome, not the implementation.
- Write a failing test before the production change.
- Confirm the failure message points at the missing behavior.

## Green

- Add the smallest production change that makes the test pass.
- Prefer pure domain functions for rules involving:
  - lesson ticket deduction
  - attendance status transitions
  - makeup/pass handling
  - unpaid and paid state
  - book stock and settlement
  - salary and withholding calculations

## Refactor

- Refactor only under green tests.
- Preserve domain terms from the product spec.
- Extract shared utilities only when they clarify repeated behavior.

## Test Levels

- Unit tests: pure calculations, permission helpers, date logic, status transitions.
- Component tests: form validation, role-visible controls, table filtering, modal behavior.
- Integration tests: page-level workflows with mocked Supabase or local test data.
- E2E tests: critical user flows in a browser.

## Promotion Rules

- A bug fix must add or update a regression test.
- A brittle implementation-detail test must be rewritten before the task is done.
- A high-value workflow should be represented at the highest practical level, usually Playwright.

