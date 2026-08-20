# Acceptance Scenarios

Use these scenarios as the starting point for TDD.

## Lesson Ticket Deduction

Given a private lesson student has 4 remaining piano tickets  
When the student's lesson attendance is confirmed  
Then the remaining ticket count becomes 3  
And the deduction is recorded with the lesson date and instrument.

Given a private lesson student is marked absent  
When absence is saved  
Then the remaining ticket count does not change.

## Private Lesson Registration

Given a student studies piano only  
When the private lesson registration dialog opens for that student  
Then piano is selectable  
And violin, cello, and flute are not selectable.

Given a teacher already has a lesson at a selected time  
When another lesson is registered for the same teacher and time  
Then the app warns about the conflict  
And the conflicting time cannot be selected.

## Academy Lesson Makeup

Given a student is absent from an academy lesson  
When the absence is confirmed as makeup with a makeup date  
Then a new calendar item is created on the makeup date  
And the item is labeled `[makeup lesson]`  
And the monthly memo records the student, makeup date, original absence date, and reason.

## Student Registration

Given a new student is registered with an instrument, teacher, lesson type, lesson days, fee, and discount  
When the student is saved  
Then the student appears in the student list  
And recurring lesson schedule data is prepared  
And fixed academy income includes the final tuition.

## Book Sale

Given a book has quantity 2  
When one copy is released to a student  
Then inventory quantity becomes 1  
And the sale waits for payment confirmation.

Given released book payment is confirmed  
When the payment date is saved  
Then the sale appears in payment-complete history  
And an income ledger entry is created for the payment date.

## Salary Payment

Given a ratio teacher taught completed lessons this month  
When salary is calculated  
Then base salary uses lesson price per session and teacher ratio  
And after-tax salary subtracts 3.3%.

Given salary payment is confirmed  
When the salary is marked paid  
Then an expense entry is created in the income/expense ledger.

