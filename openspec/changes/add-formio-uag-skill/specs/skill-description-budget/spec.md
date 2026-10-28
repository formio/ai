## ADDED Requirements

### Requirement: The top-level descriptions fit a combined budget

The combined whitespace-normalized length of every top-level `plugin/skills/*/SKILL.md` `description` SHALL be at most `LIBRARY_LISTING_BUDGET` (9,600 characters). Rationale: Claude Code lists every installed skill's description within one budget of 1% of the context window (about 8,000 characters on a 200k-token model) and drops the least-used skills' descriptions beyond it.

#### Scenario: A new skill grows the total past the budget

- **WHEN** a skill is added or a description lengthened so the top-level total exceeds the budget
- **THEN** the description-budget suite fails, naming the total and the budget
