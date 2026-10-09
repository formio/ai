# tool-output-schemas Specification

## Purpose

Defines that every tool's output schema stays open at every level, so a valid Form.io response is never rejected by a client that validates output.

## Requirements

### Requirement: Output schemas never reject a valid Form.io response

Every tool's `outputSchema` SHALL allow properties beyond the ones it documents at every level, including the top level, and every documented property of a Form.io document SHALL accept the types Form.io stores for it, including `null` where Form.io stores `null`. A response from Form.io that a tool returns SHALL never fail output validation in the server or in a client that validates against the published schema.

#### Scenario: A form with fields the schema does not list

- **WHEN** `form_get` returns a form carrying `_vid`, `pdfComponents`, `controller` and `esign`
- **THEN** the result validates against `form_get`'s published output schema
- **AND** those fields are present in `structuredContent`

#### Scenario: Null settings

- **WHEN** Form.io returns a form whose `settings` is `null`
- **THEN** `form_get` succeeds and returns it

#### Scenario: Every published schema is open

- **WHEN** the tool list is read
- **THEN** no tool's `outputSchema` sets `additionalProperties: false` at any level

