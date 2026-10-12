# form-revert Specification

## Purpose

Defines the `form_revert` MCP tool: restoring a prior revision's allowlisted fields onto the live form, with a note, and refusing any version that resolves to the unpublished draft.

## Requirements

### Requirement: form_revert restores a prior revision

The server SHALL register a `form_revert` tool taking `cwd`, `formId` (a 24-character ObjectId), `version` (a revision `_vid` or revision `_id`, checked by the shared path-argument rule), and a required `note`. It SHALL read that revision and the live form, and PUT the live form overlaid with the revision's allowlisted fields (`components`, `tags`, `properties`, `display`), recording `note` as the revision note. It SHALL return the updated form. It SHALL take no form body. On a deployment without the revisions licence it SHALL refuse with code `LICENSE_REQUIRED`. It SHALL NOT restore the form's draft: a `version` of `draft`, and any `version` whose fetched revision has `_vid` `"draft"` (Form.io resolves `latest` by sorting on `-_vid`, where the draft sorts first, and resolves a 24-character `version` as a revision id, the draft's included), SHALL be refused with code `INVALID_ARGUMENT` naming `form_publish`, and no PUT SHALL be sent.

#### Scenario: Reverting to a revision

- **WHEN** `form_revert` is called with `formId`, `version: "3"` and `note: "Reverted to version 3"`
- **THEN** the live form is updated with revision 3's allowlisted fields and the note

#### Scenario: An unknown revision is reported

- **WHEN** `form_revert` is called with a `version` the form does not have
- **THEN** the tool returns `isError: true` with `_meta["io.form/error"].code` `NOT_FOUND`
- **AND** no PUT is sent

#### Scenario: A version that resolves to the draft is refused

- **WHEN** `form_revert` is called with `version: "latest"` on a form that has a draft, or with the draft revision's own `_id`
- **THEN** the tool returns `isError: true` with `_meta["io.form/error"].code` `INVALID_ARGUMENT` and a message naming `form_publish`
- **AND** no PUT is sent

