# SETUP — workspace and project configuration

The first phase of the greenfield chain, and the first step of the existing-application chain. It establishes two things and writes nothing.

## 1. Capture the workspace root once

Capture ONE absolute path for the workspace before reading or writing anything, and use it for every later path. Do not rely on the shell's working directory: a `cd` inside one command does not persist to the next, and a relative path resolved against the wrong directory writes a React application into someone else's project.

State the captured path back to the user in one line before proceeding.

## 2. Resolve the project configuration

Call the `project_get` MCP tool with `cwd` set to the captured workspace root, and branch on the `status` it returns, exactly as the preflight section of `SKILL.md` describes. What it reports IS the configuration — do not ask the user to confirm or re-supply values it already named.

**A workspace about to be scaffolded gets its own record first.** When the workspace root holds no application yet, the scaffold creates the directory a repository usually grows from, and both the server's directory-mapping lookup and the committed `formio.json` walk stop at the first directory containing `.git` — so a project resolved from a parent directory's mapping, a parent's committed file, or the environment stops being found for this workspace once it gets one, and the environment might then name a different project. So on `ok`, unless the report names the workspace root's own mapping, then before the scaffold record the pair for the workspace root with `project_set`: the reported Project URL, and the reported Base URL as well whenever its `baseUrlSource` is anything but `derived`. Tell the user in one line that you recorded it, and continue with the values the report gave.

There is one value to think about: the **Project URL**, the full URL of the Form.io project this application reads and writes. The **Base URL** is normally derived from it rather than supplied. The shapes each takes are in [`project-urls.md`](../formio-mcp-setup/references/project-urls.md) — one canonical copy, so this document does not restate them.

Do NOT interview for URLs, do NOT enumerate valid URL shapes here, and do NOT derive a Base URL yourself. The server's message says what is missing and how to fix it; relay it.

## 3. Confirm the branch

Confirm the branch chosen at dispatch still matches what the workspace shows:

- **Greenfield** — the directory is empty, or holds no React application.
- **Existing** — `package.json` lists `react`.

A mismatch is surfaced and confirmed, never silently resolved.

## Gate

End with the approval gate: state the workspace root, the resolved Project URL and Base URL, and the branch. Proceed only on approval.
