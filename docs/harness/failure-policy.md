# Failure Policy

Failures are expected during TDD. Repeating the same failure without new information is not.

## Retry Limit

- After one failure, inspect the error carefully and make the smallest correction.
- After two similar failures, broaden diagnosis: read docs, inspect configs, isolate the failing path.
- After three similar failures, stop retrying the same approach. Write a short cause note and choose a new strategy or ask the user if the decision is product-related.

## Do Not

- Delete or weaken tests to make them pass.
- Ignore TypeScript, lint, build, or browser failures that touch changed behavior.
- Mask Supabase permission errors with service-role code in user-facing paths.
- Turn flaky E2E into sleeps instead of using web-first assertions or deterministic fixtures.

## Ask The User When

- Requirements conflict.
- Product policy is missing.
- Sensitive access or financial calculation is ambiguous.
- A migration or data operation could affect real data.
- A new dependency or stack change would alter the agreed architecture.

