# Testing Strategy

## Test Pyramid

- Unit: domain rules and pure utilities.
- Component: forms, tables, filters, dialogs, visible states.
- Integration: page workflows and server action boundaries.
- E2E: critical user journeys in a browser.

## Tools

- Vitest for unit and integration tests.
- React Testing Library for React component behavior.
- Playwright for E2E and browser verification.

## Principles

- Tests should resemble user behavior where possible.
- Prefer accessible roles, labels, and visible text.
- Use `user-event` for component interaction.
- Use Playwright locators such as `getByRole`, `getByLabel`, and `getByText`.
- Avoid CSS selectors for behavior tests.
- Avoid snapshots except for narrow, stable serialization output.

## Fixtures

- Use deterministic seed data for students, teachers, tickets, lessons, books, and ledger entries.
- Keep tests isolated. Each E2E test should control its own data setup and cleanup.
- Prefer local Supabase or mocked server boundaries for fast feedback until a real test project is configured.

## Core Regression Areas

- Ticket deduction only on attendance confirmation.
- Absence does not deduct tickets.
- Makeup/pass resolution and memo generation.
- Private lesson teacher/time conflict.
- Student registration feeding schedules and fixed income.
- Book payment feeding ledger.
- Salary calculation and payment ledger entry.
- Role-based visibility and RLS.

## Quality Consolidation For Tests

Before completion:

- Delete temporary tests that only helped development.
- Rename scenarios to business language.
- Strengthen tests that overfit implementation details.
- Keep regression tests focused enough to diagnose failures.

