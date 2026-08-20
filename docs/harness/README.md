# Harness Overview

This harness lets Codex take a goal and drive it to a verified result with minimal human intervention. It is intentionally document-first: the documents define the loop, gates, evidence, and escalation rules that future implementation work must follow.

## Standard Flow

1. **Discover**: Read the relevant product, engineering, and harness docs. Inspect existing code before making assumptions.
2. **Plan**: Convert the goal into phases with success criteria and verification commands.
3. **Red**: Write tests that express the intended behavior and confirm they fail for the expected reason.
4. **Green**: Implement the smallest change that satisfies the test.
5. **Refactor**: Improve structure while keeping tests green.
6. **Verify**: Run the required verification matrix for the changed surface.
7. **Consolidate**: Review production code and tests for long-term maintainability.
8. **Evidence**: Record commands, results, screenshots, database checks, and residual risks.

## Default Reading Order

1. `AGENTS.md`
2. `docs/harness/goal-intake.md`
3. `docs/product/product-brief.md`
4. `docs/product/functional-spec.md`
5. `docs/product/open-questions.md`
6. Relevant files in `docs/engineering/`
7. Relevant code and tests

## Working Artifacts

- Use `docs/harness/phase-template.md` when a goal needs multiple implementation phases.
- Record durable technical decisions in `docs/harness/decision-log.md`.
- Keep final task evidence in the final response or in a task-specific evidence note when the task is long-running.

## Human Input Boundary

Codex should decide ordinary implementation details within the documented architecture. Codex must ask before deciding product policy, sensitive access, salary/payment interpretation, destructive data actions, schema migrations against a real database, or any stack change.
