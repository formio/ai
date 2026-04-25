## Context

The Form.io API skill library was migrated in `formio-api/references/skills-activation` from `skills/formio-api/` to `.claude/skills/formio-api-*/SKILL.md`. Bodies were carried over verbatim from the original files, which were themselves derived from the Postman documentation at `https://documenter.getpostman.com/view/684631/2sBXiok9LB`. Postman's examples use a convention where identifier-like fields are suffixed with a random 2–4 digit integer (`"title": "Employee 775"`, `"name": "employee-510"`, `"path": "user/login-374"`, `"machineName": "example-906:example-771:save"`). That convention lets multiple users issue the same request against the same project without stepping on each other.

Skills, however, are instructional content consumed by Claude. The suffixes are noise at best and a source of bad generations at worst — Claude may carry the pattern into new values it invents for a user's real project. A repo-wide grep currently surfaces ~19 offending lines across seven skill files. We already enforce frontmatter, required headings, canonical auth, terminology, placeholder substitution, description triggers, and MCP-tool preference in `skills-validator.ts`; this is the next obvious authoring rule to lock down.

## Goals / Non-Goals

**Goals:**

- Purge collision-avoidance integer suffixes from example identifier values in every capability-group skill.
- Add a validator rule that fails `pnpm test` if the pattern reappears, so regeneration from Postman or manual authoring cannot reintroduce the noise.
- Keep the rule precise enough to leave semantically meaningful numeric tokens alone (PDF overlay keys like `f1010`, MongoDB ObjectIds, UUIDs, real resource IDs inside URL paths).

**Non-Goals:**

- No changes to endpoint paths, parameter names, response schemas, or anything documenting the API itself.
- No changes to frontmatter, required headings, auth paragraph, description rules, MCP tool preference sections, or scope map.
- No renaming of capability-group directories or the router.
- No changes to the four first-party MCP tools.

## Decisions

### Decision 1 — Restrict the rule to a closed set of identifier keys

The rule fires only when a suffix appears on one of these keys inside an example: `title`, `name`, `path`, `key`, `machineName`. These are the only keys where Postman's collision suffix convention shows up in the current library, and limiting the surface keeps the regex simple and the false-positive rate near zero.

**Alternatives considered:**
- *Scan every string value in every code block*: catches more but produces false positives on HTTP paths like `/form/64d7b40e81d6ad28758b767e/submission` (24-char hex) and on PDF overlay keys like `f1010`. Rejected.
- *Scan only JSON code fences*: the suffixes also appear in bare prose lines (e.g., "the alias `employee-510`"). A key-anchored scan over the full stripped body is simpler and catches both. Accepted.

### Decision 2 — Two complementary regex shapes

- **Slug form**: `"(title|name|path|key|machineName)"\s*:\s*"[^"\n]*-\d{2,}(?=["\s:/])` — matches a quoted key whose value contains a slug segment ending with `-` followed by 2+ digits at a word boundary.
- **Title form**: `"title"\s*:\s*"[^"\n]*\s\d{2,}"` — matches a `"title"` value that ends with a space + 2+ digits (Postman uses `"Employee 775"` in display titles).

Numbers fewer than 2 digits are left alone to protect legitimate labels like `"key": "email2"` (rare but real). The 2+ digit threshold is pragmatic; empirically all collision suffixes are 3+ digits, so this gives us headroom without hair-trigger false positives.

**Alternatives considered:**
- *Enforce a single unified regex*: the slug and title forms have different separator semantics (`-` vs space), so one regex is less readable than two. Rejected.
- *Use 3+ digit threshold*: cleaner but risks missing a hypothetical `-12`-style suffix. Accepted as a tie — 2+ is conservative and still leaves `v12` tokens alone because we require the value to *contain* the pattern at a word boundary, and `v12` as a full slug wouldn't hit the key-anchored capture group.

### Decision 3 — Preserve PDF overlay keys and resource IDs inside URL paths

Two shapes MUST NOT be flagged:

- **PDF overlay field keys**: `"key": "f1010"`, `"key": "f1_01[0]"` — these are positional fields in a fillable PDF, not collision suffixes. The regex above requires a `-` or space separator before the digits, so `f1010` naturally falls through.
- **MongoDB ObjectIds embedded in URL paths**: `/form/64d7b40e81d6ad28758b767e/submission/507f1f77bcf86cd799439011`. Keys like `path` may appear alongside ObjectIds in prose. The slug-form regex requires a `-\d{2,}` terminal segment, not a full hex ID, so ObjectIds fall through. We document this as an explicit non-match in tests.

### Decision 4 — Transformation approach: strip the suffix, keep the base

Replacements:

- `"title": "Employee 775"` → `"title": "Employee"` (strip ` \d+` at end of value).
- `"name": "employee-510"` → `"name": "employee"` (strip `-\d+` at end of each `-`-delimited slug segment).
- `"path": "user/login-374"` → `"path": "user/login"` (strip `-\d+` at end of each path segment; iterates across `/`).
- `"machineName": "example-906:example-771:save"` → `"machineName": "example:example:save"` (iterate across `:`).

Multi-segment suffix removal is implemented as a per-segment regex pass over `/`, `:`, and `-` delimiters. Done as a one-shot content rewrite across the affected files; after the rewrite, the validator keeps the state clean.

**Alternatives considered:**
- *Replace with a descriptive placeholder like `example-name-1`*: still carries a numeric suffix (defeats the goal) and the `1` would be flagged by the slug regex. Rejected.
- *Use angle-bracket placeholders `<your-name>`*: inconsistent with the rest of the library, which uses real-looking identifiers. Rejected.

**Decision**: strip suffixes cleanly; leave the unmodified base token in place.

### Decision 5 — Validator rule location and wiring

Add a new exported function `validateNoRandomIdSuffixes(file, body)` in `packages/mcp-server/src/skills-validator.ts` that runs the two regexes against the stripped body and emits a `content.random_id_suffix` issue for every match. Router skills and the server-status skill are not exempt — the rule is orthogonal to scope.

Compose the rule into `validateSkillContent`.

**Alternatives considered:**
- *Fold the check into an existing function*: increases the responsibility of e.g. `validateTerminology` without a good reason. Rejected — single-responsibility wins.

## Risks / Trade-offs

- **Risk**: the slug regex fires on a legitimate value like `"name": "version-123"` where `123` is meaningful. → **Mitigation**: document the rule in `api-skills-authoring` spec. Authors who really need a `-\d{2,}` suffix can escape it into prose (`the value "version-123"`) or split the value across tokens. This has not come up in any existing skill, so the trade-off is theoretical.
- **Risk**: MongoDB ObjectIds in sample URLs may contain incidental `-\d{2,}` substrings when we introduce query-string examples. → **Mitigation**: the regex anchors on the end of the value (or `-` segment), not on an interior match. ObjectIds are pure hex without `-`; UUIDs have `-` but no digit-only segments beyond four characters. Existing tests cover both shapes.
- **Risk**: the one-shot content rewrite misses a suffix hiding in an unusual location. → **Mitigation**: the validator rule is the safety net — once wired, `pnpm test` fails until every real instance is cleaned.
- **Trade-off**: a slightly stricter authoring rule in exchange for cleaner examples. Acceptable — the library's value is uniformity and teaching-by-example, both of which the rule directly serves.
