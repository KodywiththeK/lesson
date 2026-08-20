# Security And Privacy

This app handles minors, family contact data, payment status, salary information, and potentially resident registration numbers. Security defaults must be conservative.

## Defaults

- Owner-only access for finance and salary data unless explicitly expanded.
- No anonymous access to app data.
- RLS enabled on all exposed Supabase tables.
- No service-role keys in browser code or public environment variables.
- Sensitive fields masked in UI unless the active role has a documented need.

## Personal Data

- Student contact data should be visible only to owner and approved desk staff by default.
- Teacher resident registration numbers require explicit confirmation before storage.
- If resident registration numbers are stored, document masking, access, retention, and audit behavior first.

## Audit Candidates

Audit these actions when implemented:

- manual ticket correction
- attendance confirmation that deducts a ticket
- absence confirmation and makeup/pass resolution
- student suspension, withdrawal, restore, and deletion
- salary calculation and payment
- manual ledger entry create/update/delete
- book payment completion

## Supabase Checks

- Test anonymous, owner, desk, and teacher roles.
- Confirm teachers can only access assigned lesson/student data.
- Confirm finance and salary tables reject unauthorized reads and writes.
- Confirm update policies include both row visibility and write constraints.

