# Functional Spec

This spec is based on the attached PDF. Items marked "needs confirmation" must not be implemented as final policy until confirmed by the user.

## Global List Behavior

- Lists default to top 10 items.
- Page size options: 10, 20, 30.
- Names sort in Korean alphabetical order by default.
- Lists need name search or filtering.

## Core Attendance Rule

A student's lesson ticket is not deducted just because the student appears on a schedule. One ticket is deducted only when actual attendance is confirmed. Absence does not deduct a ticket. This rule is especially important for private lessons.

## Lesson Timetable

The lesson timetable has two modes:

- Academy piano lessons: group/regular academy lessons.
- Private lessons: one-to-one lessons.

### Academy Piano Lessons

- Pull base data from student and teacher management.
- Students registered for recurring academy lesson days appear automatically every week.
- A schedule item may be moved by drag-and-drop for that month only; the student's base recurring day does not change.
- Selecting a date shows expected attendees and allows deleting that day's schedule item with a reason.
- Daily attendance modal supports present/absent per student plus "all present" and "all absent".
- Absences are collected in an absence list for final makeup/pass processing.
- Monthly memo behaves like a sticky note: content persists per month; position/size resets on refresh; changed content shows an unread indicator.

### Absence, Makeup, Pass

- Absence list shows students marked absent for the selected date.
- Each student has confirm absence and cancel actions.
- Confirming opens a reason form with:
  - reason type: makeup or pass
  - makeup date required when makeup is selected
  - makeup time optional
  - memo optional
- Confirmed makeup creates a moved calendar schedule labeled `[makeup lesson]`.
- The monthly memo records student name, makeup date/time if present, original absence date, and reason.
- Confirmed absence is removed from the absence list.

### Private Lessons

- Date click opens a registration dialog.
- Registration flow: student -> instrument -> teacher -> time.
- Only instruments the student studies should be selectable.
- Warn and disable selecting a time already booked for the same teacher.
- Attendance confirmation deducts one matching lesson ticket.
- Student search shows remaining tickets and recent lesson status.
- Student schedule and teacher schedule can be copied as message-friendly text.
- Monthly memo matches academy lesson memo behavior.

## Lesson Tickets

- Private lessons use ticket/count-based billing, not monthly flat billing.
- New ticket fields: student, instrument, granted count, validity period, registration date.
- If an active ticket exists for the same student and instrument, new registration adds count and renews validity.
- List shows total granted count, remaining count, validity period, and expiration date.
- Count and validity can be manually corrected by authorized roles.
- Attendance confirmation deducts one count.
- Low remaining count or near expiration should be visually emphasized.

## Student, Teacher, Vendor Management

The section has five areas:

- Students
- Teachers
- Suspended students
- Withdrawn students
- Vendors

### Students

Student fields:

- name
- age
- grade
- school
- registration date
- instrument progress
- contacts including parent relationship
- one or more instruments

Per instrument settings:

- teacher
- lesson type: academy lesson or private lesson
- lesson days
- progress
- lesson fee
- discount
- final tuition

Student list supports sorting/search by name, teacher, instrument, and regular days. Students can be edited, suspended, or withdrawn.

### Pricing

The PDF contains fixed pricing tables for piano academy lessons, piano private lessons, violin, cello, flute, and discounts. Preserve those tables as seeded reference data during implementation. Do not change amounts without user confirmation.

Discounts:

- two children discount: -10000 monthly
- two instruments discount: -10000 monthly
- referral discount: -10000 for the referral month only

### Teachers

Teacher fields:

- name
- assigned part: piano, violin, cello, flute, owner
- contact
- registration date
- resident registration number
- salary type

Salary types:

- monthly fixed salary
- hourly fixed amount
- ratio-based salary

Ratio salary is based on lesson income for students taught by that teacher and the configured academy:teacher ratio. Withholding is 3.3% of base salary.

### Suspended And Withdrawn Students

- Student list actions move students to suspended or withdrawn lists.
- Suspended list can restore to active or move to withdrawn.
- Withdrawn list can restore to active.
- Withdrawn students remain for 30 days unless restored, then are automatically deleted.
- Suspension, withdrawal, and restore actions require confirmation dialogs.

### Vendors

Vendor fields:

- vendor name
- contact
- type
- note

Teachers cannot access vendor management.

## Book Management

Book flow:

`Registration -> Inventory -> Purchase List -> Release -> Payment Complete`

- Register books with title, price, quantity, and stock-in date.
- Inventory shows title, price, quantity, and stock-in date.
- Purchase list records student, book title, auto-filled price, and release date.
- Release reduces inventory quantity by one and waits for payment.
- Payment complete records payment date and moves the sale to final history.
- Payment complete records are permanent sales records and feed income management.
- Inventory records should remain visible even at zero quantity.

## Income Management

Income management is proposed as owner-only, with possible teacher access to own salary only.

Tabs:

- fixed academy income
- income/expense records
- book records
- teacher salary
- total income

Fixed income:

- uses student tuition settings
- records paid/unpaid by month
- monthly state resets to unpaid
- unpaid button adds to unpaid list
- monthly records must differ when enrollment changes
- month snapshot cutoff is the day before month change at 00:00

Income/expense:

- manual entries by owner or desk staff where allowed
- automatic entries from book payment completion and salary payment

Teacher salary:

- shows salary type, base amount, after-tax amount, payment state, and management actions
- payment action creates an expense entry

Total income:

- income/expense ledger is the source of truth
- graph supports yearly/monthly comparison for all instruments, individual instruments, academy income, and expenses

