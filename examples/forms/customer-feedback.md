# Customer feedback form

A single-page form with conditional follow-ups and an email side effect. Exercises `formio-form-builder`'s webform path plus conditional field logic and an Email Action — a quick, low-stakes smoke test for the form pipeline.

## Prompt

```
/formio-form-builder Create a customer feedback form for our product. It should ask for an overall rating from 1 to 5, what the customer liked, and what we could improve. If the rating is 1 or 2, show a required follow-up field asking what went wrong and whether they want someone to contact them — and if they do, collect their email and phone. When a feedback submission with a rating of 1 or 2 comes in, email our customer-success inbox.
```

## What to look for

- The low-rating follow-ups should be conditional components (shown when rating ≤ 2), with the contact fields further conditional on the "contact me" answer.
- "email our customer-success inbox" should become an Email Action with a condition on the rating value — not an unconditional email on every submission.
- The form should classify as a bespoke Form (anonymous submit / survey-like), not a Resource.
