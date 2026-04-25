---
name: tdd-red-phase
description: Use when working on Red phase tasks during OpenSpec apply. Guides writing focused failing tests that fail for the right reason — not syntax errors, missing imports, or wrong setup.
---

# TDD Red Phase

Write a failing test that proves the behavior doesn't exist yet.

## When to Use

- Working on a `### Red` task in an OpenSpec tasks.md
- Writing the first test for a new spec scenario
- Any time you need to establish a failing test before implementation

## Process

1. **Read the spec scenario** the task references. Identify the WHEN/THEN contract — that's your test boundary.

2. **Write one test per task.** The test should assert the THEN condition given the WHEN setup. Nothing more.

3. **Run the test.** It must fail.

4. **Verify the failure reason.** This is the critical step. The test must fail because the behavior is not implemented — not for any other reason.

## Acceptable Failures

- Function/method does not exist yet
- Function exists but returns wrong value (default/zero/null)
- Expected endpoint returns 404 (route not registered)
- Expected event is never emitted
- Expected state change doesn't happen

## Unacceptable Failures

These mean your test is broken, not that the behavior is missing:

- **Import/module not found** — create the empty module or stub first
- **Syntax error** in test code — fix the test
- **TypeError** from wrong setup — fix the test setup
- **Missing test dependency** — install it before proceeding
- **Wrong assertion API** — you're testing the test framework, not the behavior
- **Timeout** with no clear cause — your setup is wrong

If the test fails for an unacceptable reason, fix the test infrastructure and re-run. Do not mark the Red task complete until the failure clearly points to missing behavior.

## Keeping Focus Tight

- **One behavior per test.** If the spec scenario has multiple THEN conditions, split into separate tests only if they test genuinely different behaviors.
- **Minimal setup.** Only arrange what the WHEN clause requires. Extra setup means extra coupling.
- **No implementation leaking in.** Don't write helper functions, utilities, or abstractions "you'll need later." That's Green phase work.
- **Name the test after the behavior**, not the implementation: `"returns session token for valid credentials"` not `"calls authService.login"`.

## Stubs and Empty Modules

It is acceptable to create empty modules, classes, or function signatures to make the test importable — as long as they contain no logic. The goal is a clean path from test file to the thing being tested, with the test failing because the logic is absent.

```
// ✅ OK — empty module so the import resolves
export function login() {}

// ❌ NOT OK — this is implementation
export function login(user, pass) {
  return db.query(...)
}
```

## Completion

A Red task is complete when:

1. The test exists and runs
2. It fails
3. The failure message clearly indicates the missing behavior
4. No other test is broken by the new test
