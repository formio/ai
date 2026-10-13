## ADDED Requirements

### Requirement: Angular majors and peers are not restated as facts

`formio-angular`'s documents SHALL refer to the Angular major and the zone.js peer as the values its bootstrap resolves with `npm view` (the highest major `@formio/angular` declares, and the peer ranges both packages declare), and SHALL NOT state the current Angular major, a zone.js range, or a stylesheet size as a fixed fact. A release named only as a boundary that stays true as releases move ("from Angular 21 on") is allowed.

#### Scenario: No hardcoded major

- **WHEN** `formio-angular` documents are searched for `Angular 21` and a zone.js range
- **THEN** each occurrence is a boundary ("from Angular 21 on") or names the resolved value, never the current major as a fact
- **AND** no zone.js range or stylesheet size is stated
