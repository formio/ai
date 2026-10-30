# Designing tasks

Everything the UAG does comes from Form JSON. A form tagged `uag` is all a conversation form needs; a **task** is what Agentic Formflow and "Agent: Run task" run. This page is how to design one. Every property it names is in [form-properties.md](./form-properties.md) with its default.

Custom properties are set in the form builder under a component's **API → Custom Properties**, and stored in Form JSON under the component's `properties` (or the form's `properties` for form-level settings). The builder stores every value as a string, so booleans are `"true"` / `"false"` and numbers are their text. Write them as strings in JSON too.

## Contents

- [Make the form visible](#make-the-form-visible)
- [The parts of a task](#the-parts-of-a-task)
- [Decision fields and value fields](#decision-fields-and-value-fields)
- [What is excluded](#what-is-excluded)
- [Several tasks on one form](#several-tasks-on-one-form)
- [Reconciliation and provenance](#reconciliation-and-provenance)
- [A complete example](#a-complete-example)
- [Checklist before saving a form](#checklist-before-saving-a-form)

## Make the form visible

Only forms and resources tagged `uag` are registered:

```json
{ "title": "Support Request", "name": "supportRequest", "path": "supportrequest", "type": "form", "tags": ["uag"] }
```

A form that is not tagged `uag` is invisible to `get_forms`, to every other MCP tool, and to its agent operations, which answer `404` "does not exist or is not tagged". The UAG reads the tag on its next project refresh (`PROJECT_TTL`, default 900 seconds), or at once on a restart.

For a conversation form, the tag is the whole job, plus words written for a model:

- **`properties.description`** on the form is what `get_forms` shows, and what an agent picks the form by. Without it, the description is "A form to submit new <title> records."
- **Field descriptions are agent context.** "The 8-digit account number printed on the invoice" changes how an agent asks for and checks a value. State units, formats and what each option means.
- **Validation is the agent's rulebook.** `required`, patterns, min/max and option lists are what the UAG checks every value against.

## The parts of a task

A task is the set of components that carry the same value in their `uag` property. That value is the task's name.

| Role | How it is flagged | Required |
| --- | --- | --- |
| **Criteria** | A content component with `uag: "<task>"` and `uagField: "criteria"`. Its HTML, converted to Markdown, is the task's instructions. | Always add one. The `agent_provide` MCP tool refuses a task without it, and the Agent API runs one with no instructions. |
| **Agent fields** | Any input component with `uag: "<task>"` and no `uagField`; or a Panel, Fieldset, Well or Container with `uag: "<task>"`, which makes every input inside it an agent field. | Yes |
| **Input** | A field or container with `uag: "<task>"` and `uagField: "input"`. Its value is the text the task reads. | No. Without one, the task reads every filled value in the submission except the fields being answered in this run, and `extract` needs a `text` in the request. |

Fields inside a Data Grid or Edit Grid are never answered (`excluded`: `inside repeating rows`). `uag` on a Panel, Fieldset, Well, Tabs, Columns, Table or Container makes every input inside it one of the task's fields.

Write every `uag*` value as a **string**, as the portal saves custom properties: `"true"`, `"false"`, `"0.7"`. The switches (`uagAuthoritative`, `uagAgentDecides`, `uagScale`, `uagOrderCheck`, `uagAnonymous`, `uagChat`) also accept JSON booleans in 2.0.0.

A task fills only its own fields: values an engine returns for any other path are discarded. That is the guard that keeps text in a submission from making a model write somewhere else.

### Writing the criteria

The criteria is the model's whole briefing; a vague one is the most common reason an agent writes values the form rejects. Write it like a brief for a new employee:

- **Who it acts as**: "You are an admissions reviewer for the college." The criteria is the only place a model learns its role.
- **What the submission is** and what each field it fills means.
- **How to judge**: the rubric, the thresholds, what counts as evidence.
- **The exact allowed values** for closed-set fields (the option values, not only the labels), and units and formats for open values ("an amount in US dollars, no currency symbol"; "a date as YYYY-MM-DD").
- **Field keys verbatim** where it helps.

```json
{ "type": "content", "key": "triageCriteria", "input": false,
  "html": "<p>You triage support requests. Choose the category (billing, outage or other) and whether the request is urgent from the description. Write a one-sentence summary.</p>",
  "properties": { "uag": "triage", "uagField": "criteria", "uagContext": "accountNumber" } }
```

Any custom property on the criteria component other than `uag` and `uagField` is a task setting: `uagContext`, `uagTools` and `uagEngine` are read from there.

In production set `hidden: true` on the criteria and on panels of agent fields a person should not see. The agent still reads them, and hiding affects rendering only: anyone who can read the form definition can read the criteria, so never put secrets in it.

### What engines receive

Engines are deliberately given little, because unrelated detail lowers decision accuracy. For each task they get exactly:

| Key | Content |
| --- | --- |
| `instructions` | The criteria, as Markdown. |
| `input` | The input fields' values keyed by label (or the request's `text`, under the label `Input`). Without an input: every filled value except the fields being answered. |
| `context` | The values at the paths listed in the criteria's `uagContext`, keyed by label. |
| `today` | Today's date, such as `Friday, October 23, 2026 (2026-10-23)`. |

Agent engines also receive each target field's path, label, type, description, rule, format and options, and a JSON schema for the answer. The rule states the field's validation: lengths, word counts, the pattern, the range, the input mask and fixed date limits. It leaves out `required` (so an engine is not pushed to invent a value) and custom or JSONLogic validation, which cannot be stated; put a rule like that in the field's `description` or the criteria. The form still validates every answer: the Agent API keeps a failing suggestion with `reason: "failed validation: ..."`, and Run task leaves it out ([workflows.md](./workflows.md#before-or-after-the-save)). Use `uagContext` for the one or two facts a decision depends on that are not in the input, such as a policy number or a customer tier.

## Decision fields and value fields

The UAG sorts every target field into one of two kinds and sends each kind to a different type of engine:

| Kind | Components | Answered by | Statuses |
| --- | --- | --- | --- |
| **Decision** | Radio and select with static values, single or multiple (a multi-value select is asked as one yes/no pair per option and answered as an array); checkbox; select boxes; survey; single-value resource selects whose whole resource fits the decision engine's option limit (255 for Jev) | A decision engine (`jev`, or `openai` with `kind: decision`), with a calibrated confidence. If none answers, an agent engine as an uncalibrated fallback. | `confident`, `uncertain`, `missing` (`suggested` from the fallback) |
| **Value** | Everything else: text, text areas, dates, numbers, currency, email, multi-value resource selects, selects fed by a URL, resource selects too large to decide, and radios or selects with more options than the decision engine's limit | An agent engine (`claude`, `openai`, `grok`, `gemini`) | `suggested`, `missing` |

`uagEngine` on a field, or on the criteria for the whole task, overrides the routing.

| Status | Meaning |
| --- | --- |
| `confident` | A decision engine answered at or above the field's threshold, and every consistency check agreed. Never given to a value that fails the form's validation. |
| `uncertain` | A decision engine answered below the threshold, the answer changed when the options were reversed, or it was unclear whether the input addresses the field. Up to three `alternatives` come with it. |
| `suggested` | An agent engine wrote the value. Agent engines are not calibrated, so these are always suggestions for a person or a rule to confirm. |
| `missing` | No answer: not mentioned, nothing usable came back, or no engine could answer. `reason` says which. |

### How decisions are asked

Decision engines are asked closed questions compiled from the component, with checks against the failure modes of decision models:

- **Choice** (radio, select, a survey row): one question over the option labels, asked again with the options reversed; a changed answer makes the field `uncertain`. `uagOrderCheck: "false"` drops the second question.
- **Score** (an ordered radio or select with `uagScale: "true"` and a description for every option in `uagOptionDescriptions`, 2 to 10 levels): one question over the described levels.
- **Mention check**: every choice and score is paired with "does the input address this at all?". Below the uncertain band the field is left empty, inside it the field is `uncertain`. This is how "nobody was hurt" is told apart from not mentioning injuries.
- **Yes/no** (a checkbox, each select-box option, each option of a multi-value select): "does the input affirm this?" and "does it deny it?". True needs a clear affirmation and no denial, false the reverse.
- **Resource match** (a resource select): a choice over every record. A record named in the input but not on file gives `missing` with `noMatch: true`, and `newRecordName` when an agent engine is enabled.

Thresholds: `uagThreshold` (choice and score, default `0.5`) and `uagUncertainBand` (yes/no and mention checks, default `0.2-0.8`). Measure them with `uag-eval` on labelled examples of the user's own data before relying on the defaults.

Option labels matter: an ambiguous pair of labels shows up as an answer that flips when the options are reversed. Prefer distinct labels, add `uagOptionDescriptions` for options a model could confuse, and route an unsure decision to a person with `uagConfidenceField` and a conditional on it.

### Fields that can be hidden by conditionals

When a decision field's value turns pages or panels on and off, set `clearOnHide: false` **on the decision field itself**. Otherwise hiding a page wipes the value that decided it. The setting on a surrounding panel or page does not protect the field.

## What is excluded

Every result lists the target fields it did not answer, with a reason:

| Reason | Why |
| --- | --- |
| `already has a value` | Filled, and `overwrite` is not set (stateless operations), or a value field in a Run task run. |
| `hidden by the form's conditionals` | Conditionally hidden for this data. Server-side reconciliation still re-decides hidden decision fields. |
| `inside repeating rows` | Inside a Data Grid or Edit Grid. |
| `not requested` | `decide` asked for decision fields only, or `generate` for value fields only. |
| `holds the confidence of another field` | Another field's `uagConfidenceField`. |

## Several tasks on one form

A form can define any number of tasks, each with its own criteria and fields, which is how a staged process is modelled. In a college application, `admissions` decides and `finance` assesses aid for admitted applicants:

```json
{ "key": "admissionsCriteria", "type": "content", "properties": { "uag": "admissions", "uagField": "criteria" } }
{ "key": "financeCriteria",    "type": "content", "properties": { "uag": "finance",    "uagField": "criteria" } }
{ "key": "status",     "type": "select", "properties": { "uag": "admissions" } }
{ "key": "awardLevel", "type": "select", "properties": { "uag": "finance" } }
```

When a request names no task, `decide` and `generate` run every task, `extract` runs every task with an input (or every task when `text` is given), and the MCP tools take the form's first task. A Run task action always names its task. Check that no task's criteria tells it to set a field flagged for another task: it cannot, and the instruction only confuses it.

## Reconciliation and provenance

Stateless operations (`extract`, `decide`, `generate`) return values and save nothing. "Agent: Run task" reconciles the answers with what the submission holds:

- **Decision fields** take a `confident` answer; otherwise they keep their stored value, which a person may have confirmed. A field marked `uagAuthoritative: "true"` is cleared instead when the answer is not confident, so a person decides. A field marked `uagAgentDecides: "true"` also takes an agent engine's `suggested` answer, for deployments with no decision engine.
- **Value fields** take a generated value only while they are empty and visible, so running a task again on its own output changes nothing.
- **Fields a task owns** (`uagAuthoritative`) are removed from what a client sends, on every create and update to the UAG, for every task one of the form's Run task actions runs.

Each reconciled value is recorded in the submission's `metadata.uag`: `decisions[path]` with the engine, model, probabilities, confidence, status, `source` (`server`, `client`, `cleared` or `none`) and `serverValue`; and `generated[path]` with the engine and model that wrote a value field.

## A complete example

One task, `triage`, with an input, a criteria that adds one context value, two decision fields (one writing its confidence to a companion) and one value field:

```json
{
  "title": "Support Request",
  "name": "supportRequest",
  "path": "supportrequest",
  "type": "form",
  "display": "form",
  "tags": ["uag"],
  "properties": { "description": "Report a problem with a home internet or TV service." },
  "components": [
    { "type": "textarea", "key": "description", "label": "What happened?", "input": true,
      "validate": { "required": true },
      "properties": { "uag": "triage", "uagField": "input" } },
    { "type": "textfield", "key": "accountNumber", "label": "Account number", "input": true,
      "description": "The 8-digit account number printed on the invoice." },
    { "type": "content", "key": "triageCriteria", "input": false, "hidden": true,
      "html": "<p>You triage support requests. Choose the category (billing, outage or other) and whether the request is urgent from the description. Write a one-sentence summary.</p>",
      "properties": { "uag": "triage", "uagField": "criteria", "uagContext": "accountNumber" } },
    { "type": "radio", "key": "category", "label": "Category", "input": true, "clearOnHide": false,
      "values": [
        { "label": "Billing", "value": "billing" },
        { "label": "Outage", "value": "outage" },
        { "label": "Other", "value": "other" }
      ],
      "properties": { "uag": "triage", "uagThreshold": "0.6", "uagConfidenceField": "categoryConfidence" } },
    { "type": "hidden", "key": "categoryConfidence", "input": true, "properties": { "uag": "triage" } },
    { "type": "checkbox", "key": "urgent", "label": "Urgent", "input": true, "properties": { "uag": "triage" } },
    { "type": "textfield", "key": "summary", "label": "Summary", "input": true, "properties": { "uag": "triage" } },
    { "type": "button", "key": "submit", "label": "Submit", "input": true, "action": "submit" }
  ]
}
```

| Path | Kind | Notes |
| --- | --- | --- |
| `description` | Input | Sent to engines under its label, "What happened?". |
| `accountNumber` | Context | Sent under `context` because the criteria lists it. Not a target. |
| `category` | Decision (choice) | Confident at 0.6 or above; its confidence goes to `categoryConfidence`. |
| `categoryConfidence` | Excluded | Holds another field's confidence. |
| `urgent` | Decision (yes/no) | Affirm and deny questions, judged against the uncertain band. |
| `summary` | Value | Written by an agent engine, as `suggested`. |

## Checklist before saving a form

- The form is tagged `uag`, and has a `properties.description`.
- Each task has exactly one criteria, and every field it should fill carries the task's exact `uag` value (directly or from a container).
- Extract and Agent Input have an input field (`uagField: "input"`), or the caller sends `text`.
- Decision fields that conditionals can hide have `clearOnHide: false`.
- Fields that drive routing, scores or approvals are `uagAuthoritative: "true"`, and a Run task action runs their task ([workflows.md](./workflows.md)).
- With an agent engine and no decision engine, closed-set fields a workflow must save carry `uagAgentDecides: "true"` together with `uagAuthoritative: "true"`.
- `uagTools` lists only the read-only tools a task needs, or nothing.
- The criteria contains no secrets, and is `hidden: true` if users should not see the rubric.
