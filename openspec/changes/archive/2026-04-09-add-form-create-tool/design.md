## Context

The MCP server has a `formioFetch` function that currently only supports GET requests. The Form.io Create Form API is `POST /form` with a JSON body containing the form definition and the `x-token` header for authentication. The response is the created form JSON with server-assigned fields (`_id`, `created`, `modified`, `owner`, `access`, etc.).

The `form_create` tool receives a complete form JSON object. The LLM (Claude) is expected to construct this JSON using the `formio-form` skill (`.claude/skills/formio-form/SKILL.md`) which documents the full Form.io form schema — form structure, component types, required properties, validation, layout patterns, and conditional logic. The tool's MCP description SHALL explicitly instruct the LLM to invoke the `formio-form` skill first to build a properly structured form JSON before calling `form_create`. The tool itself is a thin pass-through — it validates the input has the required fields, POSTs it to the API, and returns the result.

## Goals / Non-Goals

**Goals:**

- Extend `formioFetch` to support POST with JSON body
- Register a `form_create` MCP tool that accepts a form definition and creates it via the API
- Accept the form definition as a structured JSON parameter with required fields (`title`, `name`, `path`, `components`) and optional fields (`type`, `display`, `tags`, etc.)

**Non-Goals:**

- Form validation beyond what the Form.io API enforces
- Form update or delete (future tools)
- Component-level builder UI or wizard

## Decisions

### 1. Extend `formioFetch` with optional `method` and `body` parameters

Add optional `method` (defaults to `"GET"`) and `body` (JSON-serializable object) parameters to `formioFetch`. When `body` is provided, set `Content-Type: application/json` and serialize the body. This keeps the HTTP client generic for future POST/PUT/DELETE tools.

**Alternative considered:** Create a separate `formioPost` function. Rejected — would duplicate URL construction, auth header, and error handling logic.

### 2. Accept form definition as a single `form` JSON parameter

The tool accepts one `form` parameter containing the full form JSON object. This matches the API's request body directly and gives the LLM maximum flexibility to construct any valid form definition.

**Alternative considered:** Individual parameters for each form property (title, name, components, etc.). Rejected — too many parameters, doesn't scale, and the LLM already knows the schema.

### 3. Require `title`, `name`, `path`, and `components` in the Zod schema

These four fields are the minimum for a valid form. The Form.io API will reject requests missing them. Validating upfront gives clearer error messages than passing through an API 400 error. All other fields (`type`, `display`, `tags`, `settings`, etc.) are optional.

## Risks / Trade-offs

- **[Large input]** → Form definitions with many components can be large JSON objects. Acceptable since the LLM is constructing them and the API handles them fine.
- **[API validation]** → The tool does minimal client-side validation (required fields only). The Form.io API provides detailed validation errors which are passed through to the user.
