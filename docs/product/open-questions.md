# Open Questions

Do not implement final policy for these items until confirmed by the user.

## Organization And Roles

- Does the academy currently have desk staff, or does the owner handle desk work?
- How many teachers use the system?
- Should teachers access from phone, PC, or both?
- Can teachers check attendance for academy piano lessons, or only view assigned lessons?
- Can teachers register private lessons, or only owner/desk staff?
- Should teachers see student contact information?

## Permissions

- Should desk staff access any finance screens?
- Should teachers see only after-tax salary or both base and after-tax amounts?
- Should resident registration numbers be stored in v1, and if yes, who can view them?

## Lessons

- Which weekdays are valid for academy piano lessons? PDF mentions Monday through Friday for counts but Saturday appears in student settings.
- How should Korean holidays or academy closure dates affect recurring schedules?
- Should makeup lessons support time conflicts, or can makeup visits be random/no-time?
- Should passes reduce future expected lessons, create a note only, or affect income?

## Payments And Finance

- What exact month boundary should be used for fixed income snapshots? PDF says the day before month change at 00:00, which needs confirmation.
- Should unpaid status reset automatically on the first day of the month?
- Who can manually edit income/expense records?
- Are salary and resident registration data subject to special retention or masking rules?

## Data Retention

- Should withdrawn students be hard-deleted after 30 days or archived/soft-deleted?
- Should payment-complete book records be deletable only by owner or never deleted?
- Should audit logs be visible to the owner?

## Product Scope

- Is notice/event sharing part of a later phase only?
- Is multi-academy SaaS expansion only architectural consideration for v1?

