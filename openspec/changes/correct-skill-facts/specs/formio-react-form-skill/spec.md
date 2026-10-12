## ADDED Requirements

### Requirement: Provider and wizard examples match @formio/react's types

`references/provider.md` SHALL state that `FormioProvider`'s `Formio` prop takes the static `Formio` class, whose static setters write global state, so a second provider does not isolate a second deployment, and neither does a full URL: the SDK sends its one token with every request whatever the host. The document SHALL keep an application to one deployment and SHALL NOT direct the reader to reach a second through full URLs. The wizard example in `references/mounting.md` SHALL type-check under `strict` TypeScript against `@formio/react`'s published declarations, reading the page from the wizard instance rather than destructuring the handler's argument.

#### Scenario: Provider takes the class

- **WHEN** `references/provider.md` is read
- **THEN** it states that the `Formio` prop is the static class, not an instance

#### Scenario: Wizard handlers do not destructure their argument

- **WHEN** the `onNextPage` and `onPrevPage` examples in `references/mounting.md` are read
- **THEN** neither destructures `{ page }` from its argument
