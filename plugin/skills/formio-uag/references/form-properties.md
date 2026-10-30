# Form properties

Every form-level setting and custom component property UAG 2.0 reads. Custom properties live in Form JSON under `properties` (the builder's **API → Custom Properties**), and every value is a string: `"true"`, `"0.6"`. [tasks.md](./tasks.md) explains how they fit together.

## Contents

- [Summary](#summary)
- [Form-level settings](#form-level-settings)
- [Task structure](#task-structure)
- [Task settings (on the criteria component)](#task-settings-on-the-criteria-component)
- [Decision field settings](#decision-field-settings)
- [Related settings outside the form](#related-settings-outside-the-form)

## Summary

| Property | Goes on | Default | Purpose |
| --- | --- | --- | --- |
| `tags: ["uag"]` | The form or resource | not tagged | Registers the form with the UAG. Untagged forms are invisible to agents. |
| `properties.description` | The form | "A form to submit new <title> records." | What `get_forms` shows; agents pick a form by it. |
| `uagAnonymous` | The form's `properties` | off | Lets visitors with no credential use the form's agent operations and chat. |
| `uagChat` | The form's `properties` | on | `"false"` turns the form's chat (`{form}/agent/chat`) off. |
| `uagChatInstructions` | The form's `properties` | none | Instructions of your own added to every chat turn. |
| `uag` | Any component | none | The task the component belongs to. |
| `uagField` | A component that has `uag` | none (an agent field) | `criteria` or `input`. |
| `uagContext` | The criteria | none | Extra data paths sent to engines. |
| `uagTools` | The criteria | none | Read-only MCP tools an agent engine may research with. |
| `uagEngine` | A target field, or the criteria | `config.routing` | Which engine instances answer. |
| `uagThreshold` | A choice or score decision field | `0.5` | Confidence needed for `confident`. |
| `uagUncertainBand` | A decision field | `0.2-0.8` | The unsure range, for yes/no answers and mention checks. |
| `uagOptionDescriptions` | A radio, select or survey | none | What each option means. |
| `uagScale` | A radio or select | off | Ask an ordered field as a scale. |
| `uagOrderCheck` | A radio, select, survey or resource select | on | Ask again with the options reversed. |
| `uagConfidenceField` | A decision field | none | A field that receives the decision's confidence. |
| `uagAuthoritative` | A decision or value field a task fills | off | Only the task sets it: clients' values are removed, and the server's reconciliation wins. |
| `uagAgentDecides` | A decision field | off | Reconciliation also saves an agent engine's uncalibrated answer. |

## Form-level settings

### The `uag` tag

```json
{ "title": "Customer", "name": "customer", "type": "resource", "tags": ["uag"] }
```

Read whenever the project refreshes. Adding or removing it takes effect within `PROJECT_TTL` seconds.

The tag does four things at once. A form tagged `uag` is visible to agents over MCP; can use the Agent API and "Agent: Run task"; is saved through the UAG by applications that register `@formio/uag-js`; and can be rendered as a chat unless it sets `uagChat: "false"`.

### `properties.description`

```json
"properties": { "description": "Report a fault with a home internet or TV service." }
```

### `uagAnonymous`

`"true"` lets a visitor who is not signed in call the form's agent operations (Agent Input, the chat), without a backend relay. It applies only when the form also lets the Anonymous role create submissions; otherwise anonymous requests answer `403`. Anonymous use is rate-limited per client address (`AGENT_ANONYMOUS_RATE_LIMIT`, default 10 a minute) and in total (`AGENT_ANONYMOUS_TOTAL_RATE_LIMIT`, default 100 a minute), per UAG process; over a limit the answer is `429` with `Retry-After`, before any engine is called. Every anonymous request may call a model at the owner's expense.

```json
"properties": { "uagAnonymous": "true" }
```

### `uagChat`

`"false"` turns the form's chat off: its turns answer `403` before any engine is called. Its other agent operations, MCP tools and submissions are unaffected.

```json
"properties": { "uagChat": "false" }
```

### `uagChatInstructions`

Text added to the chat's instructions under a heading of its own: the order to ask in, the tone, what to say about a field. It cannot widen what the chat may do; the fields it may set and the values the form accepts are fixed by the form.

```json
"properties": { "uagChatInstructions": "Always ask for the account number first. Keep replies to one sentence." }
```

## Task structure

### `uag`

The task's name, such as `triage`. Every component with the same value belongs to the same task. On a Panel, Fieldset, Well or Container, every input inside it belongs to the task, which is the usual way to give a task a whole "For office use only" section. Fields inside a Data Grid or Edit Grid are not filled.

```json
{ "type": "panel", "key": "officeUse", "title": "For office use only", "properties": { "uag": "admissions" },
  "components": [ { "type": "number", "key": "essayScore", "label": "Essay score", "input": true } ] }
```

### `uagField`

- `criteria` on a **content** component makes its HTML, converted to Markdown, the task's instructions; its other custom properties are the task's settings.
- `input` on a field or container makes its value the task's source text. A task can have several inputs.

A component with `uag` and no `uagField` is an agent field.

```json
{ "type": "content", "key": "criteria", "html": "<p>Add A and B and write the result to Sum.</p>",
  "properties": { "uag": "agent", "uagField": "criteria" } }
{ "type": "textarea", "key": "lossDescription", "label": "What happened?",
  "properties": { "uag": "triage", "uagField": "input" } }
```

## Task settings (on the criteria component)

### `uagContext`

Comma-separated data paths whose values (or the values inside them, for a container) are sent to engines under `context`, keyed by label. Paths inside the task's input are not repeated.

```json
"properties": { "uag": "triage", "uagField": "criteria", "uagContext": "policyNumber, customer.tier" }
```

### `uagTools`

Comma-separated read-only MCP tools an agent engine may call to research the task's **value** fields before it answers, in `{form}/agent/generate` and in a Run task that answers the whole task. Extract, decide and decisions-only runs never research. The tools run as the caller (for Run task, the user who submitted, never the action's agent role); a caller with a server key researches as administrator.

Qualifying tools are those annotated read-only: `get_forms`, `get_form_fields`, `get_field_info`, `collect_field_data`, `confirm_form_submission`, `find_submissions`, `agent_provide`, `agent_decide`, `fetch_external_data`, and custom tools with `readOnlyHint: true`. A tool that may write, or does not exist, makes `generate` answer `400` and a Run task run fail. Agent engines without tool use are passed over for such a task.

```json
"properties": { "uag": "admissions", "uagField": "criteria", "uagTools": "find_submissions" }
```

### `uagEngine`

On a target field, or on the criteria for the whole task (a field's value wins). An engine instance name from `UAG_ENGINES`, `decision` (every decision engine), `agent` (every agent engine; `llm` also works), or a comma-separated list of these tried in order. Names of engines that are not enabled are skipped, so one form works across deployments. A value field is only ever answered by agent engines.

```json
"properties": { "uag": "triage", "uagEngine": "deep, agent" }
```

## Decision field settings

Decision fields are radio and select with static values, checkbox, select boxes, survey, and resource selects small enough to decide.

### `uagThreshold`

A number between 0 and 1 (default `agentApi.threshold`, `0.5`): the normalized confidence a choice or score answer needs to be `confident`. Below it the field is `uncertain`, with alternatives. Yes/no fields use `uagUncertainBand`.

```json
"properties": { "uag": "triage", "uagThreshold": "0.6" }
```

### `uagUncertainBand`

`low-high` (default `0.2-0.8`). For yes/no answers, true needs the affirmation above `high` and the denial below `low`; false the reverse; both below `low` is "not mentioned"; anything else is `uncertain`. For mention checks, below `low` the field is left empty, up to `high` it is `uncertain`. A wide, low band such as `0.1-0.5` accepts weak evidence, for a flag that should err toward being raised.

```json
"properties": { "uag": "triage", "uagUncertainBand": "0.1-0.5", "uagAuthoritative": "true" }
```

### `uagOptionDescriptions`

A JSON object (as a string) mapping each option value to the situation it covers. Added to the option labels in choice questions; required for `uagScale`. Invalid JSON is treated as absent.

```json
"properties": {
  "uag": "triage",
  "uagScale": "true",
  "uagOptionDescriptions": "{\"minor\": \"Cosmetic damage only; the item still works.\", \"moderate\": \"Damaged and needs repair, but usable.\", \"severe\": \"Unusable or unsafe until repaired.\"}"
}
```

### `uagScale`

`"true"` asks an ordered radio or select as a score over its levels. Takes effect only with 2 to 10 options, every one described in `uagOptionDescriptions`; otherwise the field is asked as a choice. A survey whose answer columns are all described is asked as a scale automatically.

### `uagOrderCheck`

On by default: every choice is asked again with its options reversed, because decision models favour the first option they see; a changed answer makes the field `uncertain`. `"false"` drops the reversed question (two questions instead of three, with the mention check) for a field whose options are unambiguous.

### `uagConfidenceField`

The data path of another field, usually a hidden number, that receives the decision's confidence, so ordinary conditionals and action conditions can act on it. In stateless results an `uncertain` decision's confidence is written just below the field's threshold, so a "less than the threshold" condition matches every uncertain decision. In Run task reconciliation it is written with a confident decision and cleared with an authoritative field the server could not confirm; a change in confidence alone never causes a save. Flag the companion with the task too; it is then excluded from answering.

```json
{ "type": "radio", "key": "claimType", "properties": { "uag": "triage", "uagThreshold": "0.6", "uagConfidenceField": "claimTypeConfidence" } }
{ "type": "hidden", "key": "claimTypeConfidence", "properties": { "uag": "triage" } }
```

A wizard page conditioned on `claimTypeConfidence` below `0.6` then appears only when triage is unsure.

### `uagAuthoritative`

`"true"` on a decision or value field a task fills: only the task sets it.

- **Clients cannot set it.** When the form has a Run task action for the field's task, the UAG removes the value a client sends for the field and its `uagConfidenceField`, on every create and update, before any action runs, whatever the action's method, conditions or timing. On a create the field starts empty; on an update it keeps its stored value. A generated value field keeps its value and is never generated again.
- **The server's decision wins.** In reconciliation a confident decision is written; any other answered result clears the field so a person decides. An engine outage clears nothing: a decisions-only run before the save refuses the save with `503` (or `429`), and any other run leaves the field as it was.

It protects requests sent to the UAG only. To keep users off the field at Form.io too, act with an agent role ([workflows.md](./workflows.md)).

```json
{ "type": "number", "key": "overallScore", "label": "Overall score", "properties": { "uag": "admissions", "uagAuthoritative": "true" } }
```

### `uagAgentDecides`

`"true"` makes reconciliation write an agent engine's `suggested` answer as if it were confident. For workflows that run with an agent engine and no decision engine, which otherwise never save closed-set fields. Each run asks the agent again and may overwrite a person's change, so combine it with `uagAuthoritative`.

```json
{ "type": "select", "key": "decision", "label": "Decision", "properties": { "uag": "admissions", "uagAgentDecides": "true", "uagAuthoritative": "true" } }
```

## Related settings outside the form

| Setting | Where | Default | Meaning |
| --- | --- | --- | --- |
| `agentApi.threshold` | UAG configuration | `0.5` | Default `uagThreshold`. |
| `agentApi.uncertainBand` | UAG configuration | `[0.2, 0.8]` | Default `uagUncertainBand`. |
| `routing.decision`, `routing.value` | UAG configuration | `['decision', 'agent']`, `['agent']` | Default engine lists that `uagEngine` overrides. |
| `settings.task`, `settings.answer`, `settings.when` | The "Agent: Run task" action | none, `task`, `after` | See [workflows.md](./workflows.md). |
| `clearOnHide` | Each decision field | `true` | Set `false` on decision fields conditionals can hide. |
