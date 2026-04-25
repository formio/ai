---
name: tdd-refactor-phase
description: Use when working on Refactor phase tasks during OpenSpec apply. Reviews Green phase code for code smells, naming, and conformance to CLAUDE.md software patterns and practices.
---

# TDD Refactor Phase

Review the code written during the Green phase. Clean up smells, fix naming, and ensure conformance to project standards — while keeping all tests green.

## When to Use

- Working on a `### Refactor` task in an OpenSpec tasks.md
- Green phase is complete and all tests pass
- You need to improve code quality without changing behavior

## Process

1. **Run the full test suite.** Confirm everything passes. This is your safety net — if tests fail before you start, stop and fix that first.

2. **Identify what changed.** Review the code written during the preceding Red and Green phases. Use `git diff` against the last commit before this task group started.

3. **Check CLAUDE.md conformance.** Read `CLAUDE.md` and verify the new code follows the project's Software Patterns and Practices section. Flag and fix violations.

4. **Scan for code smells** (see checklist below). Fix what you find.

5. **Check naming** (see checklist below). Rename what's unclear.

6. **Run the full test suite again.** All tests must still pass. If any test broke, your refactoring changed behavior — revert and try again.

## CLAUDE.md Conformance Checks

These are derived from the project's Software Patterns and Practices. Always re-read CLAUDE.md before refactoring — it may have been updated.

### TypeScript

- [ ] No `any` types — use `unknown` with type guards, generics, or explicit types
- [ ] `strict: true` is not circumvented by escape hatches (`@ts-ignore`, `@ts-expect-error` without justification)

### Functional Style

- [ ] Pure functions preferred over classes with mutable state
- [ ] `const` used; no unnecessary `let` or reassignment
- [ ] `map`/`filter`/`reduce` used where clearer than imperative loops
- [ ] Side effects pushed to edges — core logic is pure and testable

### Design Principles

- [ ] Single Responsibility — each function/module does one thing
- [ ] Open/Closed — new behavior added via new modules, not by modifying existing ones

## Code Smells

Check for and fix these:

### Duplication

- Identical or near-identical code blocks (extract a shared function)
- Repeated conditional patterns (consolidate logic)
- Copy-pasted structures with minor variations (parameterize)

### Long Functions

- Function does more than one thing (split by responsibility)
- Deeply nested conditionals (flatten with early returns or guard clauses)
- Function exceeds ~30 lines (look for extraction opportunities)

### Poor Abstractions

- God objects or functions that know too much (break apart)
- Feature envy — function uses another module's data more than its own (move it)
- Middle-man functions that only delegate (inline them)

### Primitive Obsession

- Raw strings or numbers used where a type or enum would be clearer
- Repeated string literals (extract to a constant or type)
- Boolean parameters that obscure intent (use options object or separate functions)

### Dead Code

- Unreachable branches
- Unused variables, imports, or parameters
- Commented-out code left behind from Green phase

### Coupling

- Concrete dependencies where an interface would allow extension
- Hardcoded values that should be configuration
- Functions that require knowledge of another module's internals

### Unclear Intent

- Magic numbers or strings without explanation
- Complex expressions that could be a named variable
- Conditional logic that hides the business rule

## Naming Checklist

- [ ] Functions describe what they do, not how: `getActiveUsers` not `filterArrayLoop`
- [ ] Booleans read as questions: `isValid`, `hasPermission`, `canRetry`
- [ ] Variables name the thing they hold, not the type: `users` not `userArray`
- [ ] No abbreviations unless universally understood (`id`, `url`, `config` are fine; `usr`, `mgr`, `proc` are not)
- [ ] Consistent vocabulary — don't mix `fetch`/`get`/`retrieve` for the same concept
- [ ] Test names describe the behavior: `"returns 401 for expired token"` not `"test auth error"`

## Rules

- **Never change behavior.** Refactoring means same inputs → same outputs. If you need different behavior, that's a new Red task.
- **Never change tests.** If a test is poorly written, note it but leave it. Test refactoring is a separate concern.
- **Small steps.** One refactoring at a time, re-run tests after each. Don't batch multiple refactorings into one untested change.
- **If in doubt, leave it.** Not every smell needs fixing. If the code is clear and tests pass, it may be fine as-is.

## Completion

A Refactor task is complete when:

1. All code smells found have been addressed or consciously accepted
2. New code conforms to CLAUDE.md Software Patterns and Practices
3. Naming is clear and consistent
4. All tests still pass
