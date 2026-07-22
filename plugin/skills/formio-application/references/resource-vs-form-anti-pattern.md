# Using Resources within Forms — the right flow (and the anti-pattern to avoid)

This document is loaded by the parent `formio-application` skill. It is **not** a standalone skill — no frontmatter, no independent trigger. Read it whenever the user's request implies a bespoke form over a data-model record, before instructing the planner.

This is the highest-leverage thing to get right when an app has both a data model and bespoke forms. Hold it firmly and pass it to the planner.

## The anti-pattern: establishing a Resource record inside a Form submission

A common Form.io mistake is trying to solve two problems in one submission — **create the data-model record AND collect bespoke responses at the same moment**. The Job Application is the classic trap: a single "Job Application" form that both creates the `Applicant` record and captures the application answers, often by embedding the `Applicant` resource as a nested form so it is created inline.

Why this is wrong:

- The applicant's very first interaction should NOT be the Job Application form. Form.io forms are meant to be embedded inside an **application flow**, not to bootstrap a person's existence in the system.
- It conflates two separate concerns — _managing the Applicant record_ and _collecting one application_ — into a single brittle submission.
- It produces duplicate / throwaway Applicant records (one per application), defeating the whole point of a reusable data model, and it makes owner-based access and reporting messy.

**Do NOT use a nested `form` component to create a Resource record from inside a bespoke Form.** Nested-form-for-creation is the mechanism that enables this anti-pattern.

## The right flow: establish the Resource first, then reference it from the Form

Separate the two concerns into two steps of the flow:

1. **Establish the Resource record first**, as its own application concern — an onboarding / registration / profile step (e.g., the applicant onboards and an `Applicant` record is created). This is normal CRUD against the resource, managed by its own screens.
2. **Then the user fills the bespoke Form**, which _references_ the already-established record rather than creating it. Two ways to wire the reference:
   - **Disabled, pre-selected Select** — a `select` (dataSrc=resource) pointing at the resource, defaulted to the current user's record and set `disabled: true` so they cannot change it. The application is unambiguously linked to the right Applicant, and the user can't mis-select.
   - **Submission `owner`** — when the relationship is 1:1 with the authenticated user (the user IS the subject), rely on the submission's `owner` and owner-based access instead of an explicit reference field. No select needed.

Job Application, done right: the applicant onboards once (Applicant record created) → later opens the `JobApplication` form → the form shows their Applicant locked in a disabled Select (or simply owns the submission) plus the bespoke questions ("Why should we hire you?", "Earliest start date") → one clean submission = one application, linked to the existing Applicant.

## What to tell the planner

When the user's request implies a bespoke form over a data-model record, instruct the planner to:

- Model the data-model record as a **Resource** managed by its **own** flow (onboarding / profile / admin CRUD).
- Model the bespoke collection as a separate **Form** that **references** the established Resource via a disabled, pre-selected Select OR via the submission `owner` — never via a nested form that creates the record.
- Never attach a Save action that creates the referenced Resource from the bespoke Form.

See `formio-resource-planner` → "Resources vs. Forms — the core modeling decision" for the field-level shapes the planner emits.
