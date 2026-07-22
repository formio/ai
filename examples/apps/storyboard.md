# Storyboard

A creative-production storyboard tool. Exercises deep nesting (Project → Scene → Shot), ordered children, status workflows, and collaborative group access — the planner's group/`submissionAccess` machinery rather than simple ownership.

## Prompt

```
/formio-application Build me a storyboarding app for my video production team. We organize work into productions (title, client, due date, status: in planning / shooting / editing / delivered). Each production has scenes (scene number, heading, location, time of day, a synopsis), and each scene is broken into shots (shot number, shot type like wide/medium/close-up, camera movement, a description of the action, and a sketch or reference image upload). The whole team collaborates: anyone on a production's crew can edit its scenes and shots, but only producers can create or delete productions. Put the app in examples/storyboard-app.
```

## What to look for

- Three-level hierarchy: Shot → Scene → Production references; the ER diagram should show the chain, and the Angular plan should mount scenes and shots as nested child routes.
- "anyone on a production's crew" should push the planner toward a crew/group join (group-scoped `submissionAccess`), potentially with the transitive hidden-mirror pattern for shots (grandchildren of the production).
- The image upload should become a file component, not an invented storage integration.
- "only producers can create or delete" should land as role-scoped create/delete access on the Production resource.
