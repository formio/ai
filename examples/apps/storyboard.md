# Storyboard

A Trello-style kanban board. Exercises three-level nesting (Board → Swimlane → Story), an ordering field that drag-and-drop writes back, and team-based collaborative access — the planner's group/`submissionAccess` machinery rather than simple ownership.

## Prompt

```
/formio-application Build me a Trello-style kanban app called Storyboard. Users can create boards (a name, a description, and a color). Inside a board they create swim lanes (a title and the order they appear left to right), and inside a lane they create stories (a title, a description, a priority of low/medium/high, an assignee, a due date, and the position of the story within its lane). Stories can be dragged and dropped between lanes and reordered within a lane, and the move has to stick. I also want teams: I create a team, add members to it, and assign the team to a board. When a member of that team logs in they can read and write every board their team is assigned to, and they can't see boards belonging to teams they're not on. Put the app in examples/storyboard-app.
```

## What to look for

- Three-level hierarchy: Story → Swimlane → Board references; the ER diagram should show the chain, and the Angular plan should mount lanes and stories under the board route.
- Drag-and-drop should land as an explicit ordering field on both Swimlane and Story (a numeric order/position), with the drop handler patching that field — not as an invented reordering endpoint.
- "assign the team to a board" should push the planner toward a Team resource with a group join and group-scoped `submissionAccess` on Board, plus the transitive hidden-mirror pattern for lanes and stories (grandchildren of the board).
- "can't see boards belonging to teams they're not on" should surface as group-scoped submission access, not a front-end filter.
