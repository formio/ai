## MODIFIED Requirements

### Requirement: INTENT runs a single batched interview capturing form type and embed intent

`INTENT.md` SHALL script a single batched interview — one question round, using the client's structured question mechanism, mirroring `formio-application`'s INTENT step — that captures:

1. **Form type** — `webform` (single-page form), `wizard` (multi-page form), or `pdf` form. The script SHALL instruct the agent to infer the type from phrasing when unambiguous (e.g., "multi-page form" ⇒ wizard, "pdf form" ⇒ pdf) and present the inference as the recommended option to confirm, and to ask openly when ambiguous. The distinguishing signals SHALL be sourced from `FORM_TYPES.md`, referenced by file path.
2. **Embed intent** — whether the user wants the form embedded in an application afterward, or only created in their Form.io project. The EMBED step SHALL fire ONLY on an explicit yes; any other answer ends the flow at SAVE.

`INTENT.md` MAY name a client's question tool as a parenthetical example of the mechanism, never as the mechanism itself.

#### Scenario: One batched question, two intents

- **WHEN** `INTENT.md` is inspected
- **THEN** it scripts a single question round capturing both the form type and the embed intent
- **AND** it instructs inferring the form type from unambiguous phrasing and confirming, asking only when ambiguous
- **AND** any client tool name appears only as a parenthetical example

#### Scenario: Standalone request stays fast

- **WHEN** the user asks "make me a survey" and answers that no embedding is wanted
- **THEN** the flow runs INTENT → SCHEMA → SAVE and ends after confirming the saved form URL
- **AND** the EMBED step does not run

#### Scenario: Embed fires only on explicit yes

- **WHEN** the user's embed answer is anything other than an explicit yes
- **THEN** the EMBED handoff does not fire
