# Autonomous Agent Loop

The harness loop is:

`Discover -> Plan -> Red -> Green -> Refactor -> Verify -> Consolidate -> Evidence`

## Discover

- Read the relevant docs and inspect existing code.
- Check `docs/product/open-questions.md` for blockers.
- For Supabase work, check current Supabase docs/changelog before implementing.
- For PDF-derived requirements, use the PDF ingestion skill and compare text extraction with rendered page images.

## Plan

- Split work into small phases.
- Name the test files and scenarios before coding.
- Define the verification commands that will prove the work.
- Ask only when a decision cannot be safely inferred from docs or code.

## Red

- Write the smallest failing test that captures the requirement.
- Confirm the failure is meaningful, not caused by setup errors.
- Do not weaken existing tests to make progress.

## Green

- Implement only what the failing test requires.
- Keep domain rules outside presentational components when practical.
- Keep changes focused on the current phase.

## Refactor

- Improve names, boundaries, duplication, and data flow.
- Keep tests passing after each meaningful refactor.

## Verify

- Run the checks required by `docs/harness/verification-matrix.md`.
- For UI behavior, use browser verification when a page or flow changed.
- For Supabase behavior, validate policies and access per role.

## Consolidate

- Apply `docs/harness/quality-consolidation.md`.
- Convert development-only tests into maintainable regression tests.
- Remove accidental complexity and disposable scaffolding.

## Evidence

- Complete `docs/harness/evidence-template.md` for the task or include the same fields in the final response.
- Mention commands that could not be run and why.

