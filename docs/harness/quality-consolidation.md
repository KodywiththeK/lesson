# Quality Consolidation

Run this after implementation and verification, before calling the task complete. This is the final pass that turns "it works" into "it is maintainable."

## Production Code Review

Evaluate the changed code against these criteria:

- **Maintainability**: Domain rules are named and isolated enough to change safely.
- **Reusability**: Repeated forms, tables, filters, status badges, permission checks, and formatting rules have a clear shared home when repeated at least twice.
- **Readability**: Names match product language, conditionals are easy to scan, and side effects are explicit.
- **Simplicity**: Remove disposable scaffolding, unnecessary abstraction, stale comments, dead branches, and speculative options.
- **Boundaries**: UI components do not own business rules that belong in domain modules or server actions.

## Test Code Review

Convert tests from development aids into long-term regression coverage:

- Keep tests that express user-visible behavior or stable domain rules.
- Remove tests that only assert implementation details, temporary structure, or incidental class names.
- Prefer accessible roles, labels, and visible text for UI tests.
- Prefer deterministic fixtures over hidden global state.
- Make each test isolated enough to run independently.
- Rename tests so failure messages explain the broken requirement.

## Re-Verification

After consolidation:

- Run the impacted tests again.
- Run broader checks if shared code changed.
- Update evidence with the second verification pass.

## Completion Rule

A task is not done until consolidation is complete or explicitly documented as not applicable.

