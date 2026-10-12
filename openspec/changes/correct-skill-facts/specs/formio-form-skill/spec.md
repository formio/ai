## ADDED Requirements

### Requirement: javascript-api.md MUST give the submit sequence the renderer runs

`references/javascript-api.md` SHALL state the order a submission runs in: `submitButton`, each component's `beforeSubmit`, `options.hooks.beforeSubmit`, validation, `options.hooks.customValidation`, the server save for a URL-backed form, then `submit` carrying the saved submission, then `submitDone`. Code that must run before the save SHALL be directed to `options.hooks.beforeSubmit`, not the `submit` event.

#### Scenario: submit is documented after the save

- **WHEN** the event table in `references/javascript-api.md` is read
- **THEN** the `submit` row states that, for a URL-backed form, it fires after the server save
- **AND** the document names `hooks.beforeSubmit` for work that precedes the save

### Requirement: options.md's combined example MUST keep the default sanitizer

The combined renderer-options example in `references/options.md` SHALL NOT set `sanitizeConfig`. Allowing embedded iframes SHALL be a separate snippet, labelled as an opt-in for forms whose content embeds iframes.

#### Scenario: Combined example leaves sanitizeConfig unset

- **WHEN** the combined example in `references/options.md` is read
- **THEN** it does not contain `sanitizeConfig`
- **AND** a separately labelled opt-in snippet shows `addTags: ['iframe']`

### Requirement: setup.md MUST agree with formio-sdk on @formio/core

`references/setup.md` SHALL state that rendering needs only `@formio/js`, and that an application using one of the helpers `@formio/js` does not re-export adds `@formio/core` as a direct dependency within the range `@formio/js` declares, as `formio-sdk` documents. Every CDN URL in the document SHALL carry the version the page pins, or a `<version>` slot.

#### Scenario: No blanket ban on @formio/core

- **WHEN** `references/setup.md` is read
- **THEN** it does not say "never import `@formio/core`"

#### Scenario: CDN versions agree

- **WHEN** every `@formio/js@<n>` CDN URL in `references/setup.md` is collected
- **THEN** each carries the same pinned version or the `<version>` slot
