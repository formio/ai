## Context

The review found 21 findings in total, and the adversarial triage reproduced each one before deciding:

- **H1 (action conditions)** was reproduced by running payloads through the zod schema. The portal's stored condition shape is in nirvana `apps/formio/src/actions/actions.js` ~476-660.
- **M1 (silently dropped arguments)** was reproduced in-process.
- **Deferred to 1.0.x:** twelve findings, all additive or description-only.
- **Dropped:** five.

## Decisions

### 1. The condition schema loosens to what Form.io stores; the operators stay

The condition becomes a loose object with every key optional and `null` allowed. `conjunction` gains `''`, `custom` is a string, and legacy keys pass through.

Row operators keep the 18-value enum, which matches the server's own list, so a misspelled operator is still caught. An empty portal row (`operator` unset) is allowed by making row keys optional.

### 2. Strict top-level arguments; document bodies stay open

Each registration's `inputSchema` becomes `z.strictObject({...})`, the form `project_set` already uses. The open document arguments keep their existing loose schemas inside the strict wrapper.

No skill passes an undeclared argument; the triage grepped every call. The refusal stays in the SDK's uncoded validation-error form, which the README documents for schema failures. Coding it is a separate 1.0.x item (M3).

*Trade-off:* an agent that adds a stray field now gets an error and retries, instead of being silently ignored. In return a misplaced `projectUrl` can never silently change which project is written. This direction is reversible after 1.0, and the other is not.

### 3. One annotation

`project_import` keeps `overwrites` except for `idempotentHint`, which becomes `false`.

## Risks / Trade-offs

- **[A test passes a stray argument]** → Those tests are fixed to pass only declared arguments.
- **[tools/list grows]** → About 850 bytes, from ~38.7k to ~39.5k, under the 42,000 budget.

## Verification

Full test suite, the tool-description budget, and the live suite on `https://form.test/sandbox` with a new case that round-trips a portal-shaped action condition.

## Open Questions

None.
