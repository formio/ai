# Two agents that review every application

An agentic workflow with chained tasks. Exercises the `formio-uag` skill: two tasks on one form, "Agent: Run task" after the save on create and on update, the condition that stops the chain, owned fields, and an agent role on self-hosted Form.io Enterprise.

See it running at https://ai.form.io/examples/workflow (source: https://github.com/formio/uag/tree/main/demo). The live demo's actions name no agent role; this prompt asks for the stricter setup, with an agent role on self-hosted Form.io Enterprise.

## Prompt

```
/formio-uag Every college application submitted to our self-hosted Form.io Enterprise project should be scored by an admissions agent that decides accept, decline or scholarship evaluation, and for scholarship candidates a second finance agent should pick the award level. Applicants must never be able to set the scores, the decision or the award themselves. We only have Claude, no decision engine.
```

## What to look for

- Two tasks (`admissions`, `finance`), each with a criteria, and every agent field marked `uagAuthoritative: "true"`; the closed-set fields also `uagAgentDecides: "true"`, because only an agent engine is enabled.
- The finance action runs on update with a condition on a field the admissions task sets and on `awardLevel` being empty, so the chain stops.
- An agent role (Admin off, assigned to no user), form permissions that keep applicants from creating or updating at Form.io, submitter roles on the actions, and `JWT_SECRET` shared with the Enterprise server — the role and access work handed to `formio-auth`.
- Applications are sent to the UAG; the deployment uses `UAG_ENGINES=claude` and a `LICENSE_KEY` that includes the UAG.
