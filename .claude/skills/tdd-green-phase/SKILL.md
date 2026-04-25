---
name: tdd-green-phase
description: Use when working on Green phase tasks during OpenSpec apply. Guides writing the minimum implementation code to make failing tests pass — no more, no less.
---

# TDD Green Phase

Write the minimum code to make the failing test pass.

## When to Use

- Working on a `### Green` task in an OpenSpec tasks.md
- A corresponding Red phase test exists and is failing for the right reason
- You need to make a specific test pass without overbuilding

## Process

1. **Run the failing test.** Confirm it still fails and you understand what it expects. If the test is not failing, stop — you're not ready for Green.

2. **Write the simplest code that makes the test pass.** Hardcode values if that's sufficient. Return a literal if that satisfies the assertion. The goal is a passing test, not a complete solution.

3. **Run the test.** It must pass.

4. **Run the full test suite.** All tests must pass — not just the one you targeted. If an existing test broke, fix your implementation without changing the other tests.

## What "Minimum" Means

- If the test expects a function to return `true` for a specific input, a single `return true` is valid if no other test contradicts it.
- If two tests expect different return values for different inputs, add just enough branching to satisfy both.
- Let the tests drive the complexity. Each Green task adds only what its corresponding Red test demands.

## Rules

- **No code without a failing test.** If you see behavior that "should" exist but no test covers it, that's a future Red task. Don't write it now.
- **No refactoring.** Duplication is fine. Poor naming is fine. Ugly conditionals are fine. Refactor phase handles cleanup.
- **No abstractions.** Don't extract helpers, create base classes, or introduce patterns. If the test passes with inline code, inline code is the answer.
- **No future-proofing.** Don't add parameters "you'll need later," error handling for cases no test checks, or configuration for flexibility.
- **Don't change the tests.** If a test seems wrong, stop and raise it. Green phase never modifies Red phase tests.

## Completion

A Green task is complete when:

1. The targeted test passes
2. All other tests still pass
3. No code was written beyond what the tests require
