# Agentic workflows: "Agent: Run task"

An agentic workflow runs a form's task on a submission with no person in the loop. The application sends its submissions to the UAG; an **"Agent: Run task"** action on the form runs one of the form's tasks, before the save or after it, and the UAG saves the answers. A task's save after the save is an update, and an update can start the next task. Run task is Agentic Formflow: it needs a license that includes the UAG, or a project on Form.io's hosted service ([patterns-and-licensing.md](./patterns-and-licensing.md)), and an engine enabled in `UAG_ENGINES`.

## Contents

- [What has to be true](#what-has-to-be-true)
- [How a submission flows through the UAG](#how-a-submission-flows-through-the-uag)
- [The action](#the-action)
- [Adding the action](#adding-the-action)
- [Before or after the save](#before-or-after-the-save)
- [Chaining tasks](#chaining-tasks)
- [Closed-set fields with only an agent engine](#closed-set-fields-with-only-an-agent-engine)
- [Re-deciding on the server](#re-deciding-on-the-server)
- [Who a run acts as](#who-a-run-acts-as)
- [Letting a task research](#letting-a-task-research)
- [Seeing what a run did](#seeing-what-a-run-did)
- [Taking a workflow to production](#taking-a-workflow-to-production)

## What has to be true

| Requirement | Why |
| --- | --- |
| A form tagged `uag` with at least one task | The criteria, and the fields the task fills ([tasks.md](./tasks.md)). |
| An engine on the UAG | For example `UAG_ENGINES=claude` with `CLAUDE_API_KEY` ([deployment.md](./deployment.md)). |
| A license, or a hosted project | Without one, a run before the save refuses the submission with `403` (`code: "license_required"`) and a run after the save fails and is logged. |
| Submissions sent to the UAG | Run task runs only for submissions the UAG receives: through its submission API, its MCP tools, or `@formio/uag-js`. A submission sent straight to Form.io runs no task. |

## How a submission flows through the UAG

For each create or update it receives, the UAG runs, in order:

1. Authentication: a Form.io user token (`x-jwt-token`), forwarded unchanged; a portal team member's remote token (`x-remote-token`); or a server key (`x-token` / `x-admin-key`).
2. The form's Run task actions set to run **before the save**.
3. The forward to Form.io — a fixed step, not an action. Form.io validates, stores, and runs its own actions.
4. The form's Run task actions set to run **after the save**, in the background.
5. The response, which is Form.io's. When Form.io refuses the forward, the caller gets Form.io's error and no "after" action runs.

## The action

```json
{
  "title": "Agent: Run task (admissions)",
  "name": "agentRunTask",
  "form": "application",
  "priority": 20,
  "handler": ["before", "after"],
  "method": ["create"],
  "settings": { "task": "admissions", "answer": "task", "when": "after" }
}
```

| Setting | Values | Meaning |
| --- | --- | --- |
| `settings.task` (**Task**) | One of the form's tasks | The task to run. Required: a saving operation never guesses which stage to run. |
| `settings.answer` (**Answer**) | `task` (default), `decisions` | `task`: its decision fields, and its empty, visible value fields, researching with `uagTools` when the task lists any. `decisions`: re-decide its decision fields only, filled and hidden ones too. |
| `settings.when` (**When**) | `after` (default), `before` | After the save, in the background; or before the save, while the submitter waits. |
| `settings.agentRole` (**Agent role**) | A project role that is not an admin role | Optional, self-hosted Enterprise only. Act at Form.io with this role, on the caller's behalf. See [Who a run acts as](#who-a-run-acts-as). |
| `settings.submitterRoles` (**Submitter roles**) | Project role ids | With an agent role: who may submit through the agent when the form does not let their roles create submissions. |
| `method` | `create`, `update` | Form.io's standard methods. |
| `condition` | Form.io's action conditions | Including condition lists joined by `all` or `any`, custom JavaScript or JSONLogic. |

The handler is fixed: always write `"handler": ["before", "after"]` and choose the timing with `settings.when`. In a template, actions are keyed `<formName>:<actionKey>` and name their form in `form`.

## Adding the action

The UAG's action is called `agentRunTask`, and Form.io itself does not know it. That decides how it can be added:

- **Not with `action_create`, which refuses it.** That MCP tool checks the action name against the catalog Form.io serves for the form (`form/{formId}/actions`), which lists only Form.io's own actions, and answers `agentRunTask` with an unknown-action error. Do not call it for this action. `action_list` and `action_get` do read an existing one, so use them to check what a form already has.
- **In a first build's template.** When the project is being built from a template (the `formio-application` pipeline, or a template the user approves), add the task properties to the form's components and the `agentRunTask` entries to the template's `actions` before it is imported with `project_import`. Form.io's importer installs the actions a template lists, the UAG's included; the UAG's own demo project ships its Run task actions this way. `project_import` updates every form the template names in place (keeping its submissions), deletes that form's actions and recreates them from the template, and replaces the project's `access`, so it is for a first build only, never for adding one action to a project that already has data and actions.
- **In a Form.io Enterprise portal stage connected to the UAG.** The user sets `PORTAL_SECRET` on the UAG and connects a stage to it as an on-premise environment ([deployment.md](./deployment.md)); in that stage the portal lists "Agent: Run task" beside Form.io's actions and opens its settings form from the UAG. Give the user the settings to enter: Task, Answer, When, Agent role, Submitter roles, methods and conditions. On a stage that is not connected, Run task opens as a blank page.
- **In a UAG module's project template.** A module's `config.template` installs actions the project lacks on forms it already has, matched by key, at startup (`TEMPLATE_SYNC=boot`). Write a module whose template's `actions` holds the `agentRunTask` entries (with `forms` and `resources` as empty objects when the module brings none), and mount it at `/app/module`. It never updates an action the project already has: change those in the portal. See [deployment.md](./deployment.md#modules).
- **With Form.io's action API, run by the user.** Form.io's own documented route is `POST {projectUrl}/form/{formId}/action` with the action under `data`, authenticated with the admin key (`x-admin-key`) on Open Source, or a project API key (`x-token`) on Enterprise and the hosted service. This is a write to the live project, so it is the user's to run: give them the request with the key as a placeholder they fill in, and do not send it from this session.

```http
POST /form/{formId}/action HTTP/1.1
Host: forms.example.com
x-admin-key: <ADMIN_KEY>
Content-Type: application/json

{ "data": { "title": "Agent: Run task (triage)", "name": "agentRunTask", "priority": 20,
            "handler": ["before", "after"], "method": ["create", "update"],
            "settings": { "task": "triage", "answer": "decisions", "when": "before" } } }
```

The UAG reads actions when it loads the project, so a new action takes effect after the next `PROJECT_TTL` refresh or a restart.

## Before or after the save

| | Before the save | After the save |
| --- | --- | --- |
| The submitter | Waits for the engines | Gets Form.io's response at once |
| The task reads | The submitted data, with owned fields as stored (empty on a create) | The submission as Form.io stored it |
| Its results | Merged into the data and forwarded as the one save | Saved as an update through the UAG, which runs the form's update actions |
| Use it for | Triage a submission must carry when it is stored, such as routing fields | Slower work: reviews, scoring, research, chains of tasks |

Failures:

| When | What could not be answered | Result |
| --- | --- | --- |
| Before, decisions only | Some decision fields (every engine failed, timed out, was over its rate limit, or none is enabled) | The submission is refused with `503` (`429` when every engine was over its limit) and nothing is stored. An outage fails closed. |
| Before, whole task | Some field groups | The save is forwarded without those answers. |
| After | Anything | The submitter's response is unaffected. A whole-task run saves what it obtained; a decisions-only run saves nothing. The failure is logged as `[formio-uag] Run task "<task>" failed for submission <id> of "<form>": ...`, and recorded with the database. |

A run after the save loads the stored submission, runs the task, saves nothing if nothing changed (a changed confidence alone does not count), and otherwise saves only the task's fields and their provenance as an update. If a person saved the submission meanwhile, the run starts once more on the new version; a second change fails it with `409`. Each UAG instance runs up to four runs at a time.

## Chaining tasks

A second task is started by the first task's save. The demo's finance task runs on update, only for the applicants admissions put on the scholarship track:

```json
{
  "title": "Agent: Run task (finance)",
  "name": "agentRunTask",
  "form": "application",
  "priority": 20,
  "handler": ["before", "after"],
  "method": ["update"],
  "condition": {
    "conjunction": "all",
    "conditions": [
      { "component": "status", "operator": "isEqual", "value": "scholarshipEvaluation" },
      { "component": "awardLevel", "operator": "isEmpty" }
    ],
    "custom": ""
  },
  "settings": { "task": "finance", "answer": "task", "when": "after" }
}
```

Each task fills only its own fields, so `finance` cannot change `status`, which belongs to `admissions`. A chained run acts for the same user as the run that started it and carries the same `X-Request-Id`.

### Avoiding loops

Every save after the save is an update, so it runs the update actions again. Three things stop a chain, and the first is the one to rely on:

1. **The condition tests the task's own output.** `awardLevel` must be empty and the finance task fills it, so after its save the condition no longer holds. Every Run task on update needs such a condition.
2. **A run that changes nothing saves nothing.** Value fields are generated only while empty.
3. **Confidence changes are not saves.**

As a last guard the UAG stops a chain after 5 runs in a row that were each started by the save of the one before. Check condition operators: a clause with an operator the UAG does not know always holds. "An agent that runs continuously and burns credits" is almost always a Run task on update whose condition stays true, often with `uagAgentDecides` on a field the agent answers differently each time.

## Closed-set fields with only an agent engine

On a save, a decision field is written only when a calibrated decision engine is confident. With only an agent engine (Claude, say), closed-set fields come back `suggested` and are never saved, unless they carry `uagAgentDecides: "true"`:

| Engines enabled | Closed-set fields | Set on the fields |
| --- | --- | --- |
| A decision engine (`jev`) and an agent engine | Decided with a confidence, written when confident | Nothing; tune `uagThreshold` |
| An agent engine only | `suggested`; not written by default | `uagAgentDecides: "true"` with `uagAuthoritative: "true"` |

## Re-deciding on the server

Values decided in the browser by Agent Input can be changed by the user before submitting. When a field drives routing, decide it again on the server, before the save, decisions only:

```json
{
  "title": "Agent: Run task (triage)",
  "name": "agentRunTask",
  "form": "claim",
  "priority": 20,
  "handler": ["before", "after"],
  "method": ["create", "update"],
  "settings": { "task": "triage", "answer": "decisions", "when": "before" }
}
```

Mark those fields `uagAuthoritative: "true"`: confident answers are written, fields the server cannot confirm are cleared for a person, and an engine outage refuses the save rather than clearing them.

## Who a run acts as

| | No agent role | With an agent role |
| --- | --- | --- |
| Acts at Form.io as | The caller, with the credential the submission arrived with | The agent role, on the caller's behalf, with a 5-minute token the UAG signs |
| The caller must be allowed to | Create the submission, and update it for a run after the save | Create the submission, or hold one of the action's submitter roles |
| Keeps users off the agent's fields | Only for requests sent to the UAG | Everywhere, including requests straight to Form.io |
| A run after the save | Keeps the caller's token in memory only; fails if it expires or the user logs out first | Survives a restart, with the UAG's database |
| Available on | Every edition | Self-hosted Form.io Enterprise, with the UAG's `JWT_SECRET` equal to Form.io's |

Either way a run never uses the UAG's own project key, and engines research as the user who submitted, never as the agent role. A caller that submits with a server key has its tasks run as administrator.

### Setting up an agent role (self-hosted Enterprise)

Use one whenever the agent's answer must not come from the person being judged. Hand the role and permission changes to `formio-auth`, with this plan:

1. **Create a role**, for example `Agent`, with **Admin** off (the UAG refuses to act with an admin role). Assign it to no user.
2. **Set the form's submission access:** the agent role gets Create All, Read All and Update All; users who submit get Read Own only (no create or update at Form.io); reviewers get Read All, and update as needed. Users then cannot set an agent's field even by calling Form.io directly, and still submit through the UAG, which creates the submission for them, owned by them.
3. **Mark every field a task writes `uagAuthoritative: "true"`.**
4. **Add the Run task actions** with the agent role and the submitter roles (`Anonymous` for a public form). When several Run task actions run on create, give them the same agent role; different ones are refused as a configuration error.
5. **Share the secret:** set the UAG's `JWT_SECRET` to the Form.io server's. It is then equivalent to administrator access to Form.io; keep it in the same secret store.

How the UAG creates a submission then: when one of the user's roles may create, it forwards with the user's token; when none may, the agent role has Create All and the user holds a submitter role, it creates it as the agent role, owned by the user; otherwise `403` "You may not submit this form.".

## Letting a task research

A task that must look something up lists read-only tools on its criteria (`"uagTools": "find_submissions"`). When Run task answers the whole task, an agent engine may call them before answering the value fields, as the user who submitted. It still cannot write. List only what a task needs, only on forms whose submissions are trusted.

## Seeing what a run did

- **Provenance** in the submission's `metadata.uag`: which engine decided or generated each field, with what confidence, and when.
- **The UAG's log.** Failures are logged with task, submission and error; `DEBUG=formio:uag:runner` logs every run with the number of fields it saved, or `nothing changed`.
- **Action Logs**, with the UAG's database, in a classic-portal stage connected to the UAG: one entry per run beside Form.io's own.
- **The stateless Agent API**: post the submission's data to `{form}/agent/decide` or `{form}/agent/generate` with the task and `overwrite: true` to see each field's `status` and `reason`, saving nothing.

## Taking a workflow to production

- Hide the criteria and agent panels (`hidden: true`).
- Fix the permissions: a user resource with login, submission access scoped to owners, and on self-hosted Enterprise an agent role.
- Send every submission to the UAG; give users no create or update at Form.io when the agent's fields must be trusted.
- Add the UAG's database for run records, Action Logs, durable runs and several instances. It needs a license that includes the UAG, even on a hosted project, whose endpoint must then be on that license's allowlist.
- Raise `PROJECT_TTL` from development values; pin images and engine models; measure thresholds with `uag-eval`.
