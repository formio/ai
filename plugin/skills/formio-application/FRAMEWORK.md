# FRAMEWORK — Registry and routing

This document is loaded by the parent `formio-application` skill during Step 6. It is **not** a standalone skill — no frontmatter.

## The registry

Routing is driven by this table. Rows are data; adding a framework is a table edit, not a code change.

| Framework | Entry skill      | Extend sub-skill (nested file path under Entry skill)      | Detection signal                                                                          |
| --------- | ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Angular   | `formio-angular` | `formio-angular-resources` — nested at `formio-angular/resources/SKILL.md` | `angular.json` in workspace root OR `@angular/core` listed in `package.json` dependencies |

**Important:** the "Extend sub-skill" column names a **nested file inside the Entry skill's directory**, not a separately-registered top-level skill. Claude may not resolve the name by itself — the Step 6 modify-existing logic below loads the file by path (e.g., `plugin/skills/formio-angular/resources/SKILL.md`) and follows its instructions inline, the same way the Entry skill loads its own `SETUP.md` / `CONFIG.md` / `AUTH.md` companions. The name is preserved for documentation, eval tooling, and backward compatibility.

When a future change adds a framework skill (React, Vue, etc.), it adds a row to this table with the framework's entry skill, extend sub-skill, and detection signal. No edit to `SKILL.md` or to the routing logic below is required.

## Step 6 logic

### Build-new branch

1. Count the active rows in the registry.
2. **If exactly one row:** route silently to that row's Entry skill. Pass the handoff context (workspace path, `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`, `template.md` path, `template.json` path, import-succeeded flag). The user is NOT asked which framework — when only one is installed, the choice is obvious.
3. **If multiple rows:** ask the user to pick via one `AskUserQuestion`:

```
AskUserQuestion({
  questions: [
    {
      question: "Which UI framework should I build this in?",
      header: "Framework",
      multiSelect: false,
      options: [
        { label: "Angular", description: "Generate an Angular workspace using @formio/angular." },
        { label: "<Future>", description: "<Future framework description.>" }
      ]
    }
  ]
})
```

Route based on the answer.

### Modify-existing branch

Detection path — inspect the workspace to find out which framework is already installed:

1. For each row in the registry, check whether the Detection signal matches the workspace (file exists, dependency present, etc.).
2. **Exactly one match:** load the file at that row's "Extend sub-skill" path (e.g., `plugin/skills/formio-angular/resources/SKILL.md` for Angular) and follow its instructions inline — do NOT attempt to invoke it by its frontmatter name as if it were a separate top-level skill. Pass the handoff context (workspace path, the user's plain-language request, delta `template.md` path, delta `template.json` path, list of newly-imported resource names from Step 2's stash). The Extend sub-skill reads URLs from the workspace's `FormioAppConfig`, so URLs are NOT in the handoff. The delta template pair IS — the sub-skill needs `template.md` for intent and `template.json` for structured field shapes when scaffolding the new resources.
3. **Multiple matches** (unusual — workspace has both `angular.json` AND React deps): ask the user to pick via `AskUserQuestion`, same shape as the build-new multi-framework case.
4. **Zero matches:** the workspace does not have a recognized framework installed. Two sub-cases:
   - Workspace is empty — the user probably meant build-new. Bounce back to Step 1: "I don't see an existing app in this directory — did you mean to build a new one?"
   - Workspace has non-framework code — tell the user we couldn't detect a supported framework, list the ones in the registry, and ask them to pick. Accept their pick but warn that the extend sub-skill may fail if the workspace does not meet its expectations.

## How to add a new framework

When a future change adds a new framework skill (e.g., `formio-react`):

1. The new framework skill's PR authors its own `skills/formio-react/SKILL.md` + sub-skills + sibling docs, independent of this registry.
2. In the same PR, add one row to the table above:
   ```
   | React | formio-react | formio-react-resources | vite.config.* with react deps OR next.config.* |
   ```
3. Verify that the new row's Entry skill and Extend sub-skill accept the same handoff context shape as Angular does (workspace path, URLs, `template.md` path, `template.json` path, import flag for Entry; workspace path, plain-language request, delta `template.md` path, delta `template.json` path, newly-imported resource names for Extend). If they don't, update the new framework skill — the orchestrator does not adapt.
4. Run `npm test` — the framework-registry tests should now cover the new row.

That is the entire integration point. No edit to `SKILL.md`, no edit to `INTENT.md` / `DEPLOYMENT.md` / `IMPORT.md`, no new routing logic. Adding a framework is a row.

## Handoff context reference

What each row's target skill receives when called by Step 6:

### Build-new → Entry skill

```
{
  workspacePath: string,               // absolute
  formioProjectUrl: string,            // no trailing slash
  formioBaseUrl: string,               // no trailing slash
  templateMdPath: string,              // absolute, planner's template.md (architectural-intent seed)
  templateJsonPath: string,            // absolute, planner's template.json (structured companion)
  importStatus: 'succeeded' | 'skipped' | 'failed-user-chose-continue',
  frontendDesignStatus: 'available' | 'declined'  // from Step 6a's frontend-design pre-check
}
```

The Entry skill uses this to skip its own SETUP (URLs are known), load the template pair (both files on disk — `template.md` for intent, `template.json` for shape), and jump straight to CONFIG / AUTH / Resources.

### Modify-existing → Extend sub-skill

```
{
  workspacePath: string,               // absolute
  userRequest: string,                 // verbatim plain-language request
  templateMdPath: string,              // absolute, planner's delta template.md
  templateJsonPath: string,            // absolute, planner's delta template.json
  newResourceNames: string[],          // machine names of the resources added by this delta
  frontendDesignStatus: 'available' | 'declined'  // from Step 6a's frontend-design pre-check
}
```

The Extend sub-skill reads URLs from `workspacePath/src/app/config.ts` (or equivalent for other frameworks) and interprets the user's request in framework-native terms, using the delta template pair to scaffold exactly the newly-added resources.
