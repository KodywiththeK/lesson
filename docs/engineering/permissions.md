# Permissions

Permission behavior must be tested at both UI and Supabase RLS layers.

## Roles

- `owner`: full access.
- `desk`: day-to-day operations; finance access is unconfirmed.
- `teacher`: assigned lesson visibility, allowed attendance actions where confirmed, own salary view.

## Proposed Access Matrix

| Area | Owner | Desk | Teacher |
| --- | --- | --- | --- |
| Academy lesson timetable | Full management | Full management | Assigned lessons only; attendance needs confirmation |
| Private lesson timetable | Full management | Full management | Own lessons only; registration needs confirmation |
| Lesson tickets | Issue/edit | Issue/edit | Own students' remaining count only; needs confirmation |
| Students | Full management | Full management | Assigned basic info only; contact visibility needs confirmation |
| Teachers | Full management | Needs confirmation | Own info only |
| Vendors | Full management | Full management | No access |
| Books | Full management | Full management | No access |
| Income management | Full management | Needs confirmation | Own salary only |

## RLS Rules

- Owner policies are scoped to academy membership with owner role.
- Desk policies are scoped to academy membership with desk role and allowed tables.
- Teacher policies are scoped to assigned lessons/students and own salary rows.
- Anonymous users should have no app data access.
- UPDATE policies need both `USING` and `WITH CHECK`.
- Views exposed through APIs should use security-invoker behavior where supported.

## Sensitive Data

- Resident registration numbers require explicit confirmation before implementation.
- Salary and payment records require owner-only defaults.
- Contacts are not visible to teachers unless the user confirms.
- Service-role access is never used in browser code.

