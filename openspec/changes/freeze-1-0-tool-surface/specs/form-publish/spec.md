## ADDED Requirements

### Requirement: form_publish publishes a form's draft

The server SHALL register a `form_publish` tool taking `cwd`, `formId` (a 24-character ObjectId), and a required `note`. It SHALL read the form's current draft, refuse with code `NO_DRAFT` when none exists, and otherwise PUT the live form overlaid with the draft's allowlisted fields (`components`, `settings`, `tags`, `properties`, `controller`, `esign`, `display`), recording `note` as the revision note. It SHALL return the published form. It SHALL take no form body. On a deployment without the revisions licence it SHALL refuse with code `LICENSE_REQUIRED`.

#### Scenario: Publishing a draft

- **WHEN** `form_publish` is called with a `formId` whose form has a draft and `note: "Add phone field"`
- **THEN** the live form is updated with the draft's allowlisted fields and the note
- **AND** the tool returns the published form

#### Scenario: No draft to publish

- **WHEN** `form_publish` is called for a form with no draft
- **THEN** the tool returns `isError: true` with `structuredContent.code` `NO_DRAFT`
- **AND** no PUT is sent

#### Scenario: No form body is accepted

- **WHEN** `form_publish` is listed
- **THEN** its input schema has `cwd`, `formId` and `note`, and no `form` argument
