## ADDED Requirements

### Requirement: Every request stays under the Project URL

`formioFetch` SHALL build the request URL from the resolved Project URL and the given path, and SHALL refuse to send it unless the built URL has the same origin as the Project URL and its pathname begins with the Project URL's pathname followed by `/` (or equals it). A refusal SHALL throw an error naming the path it was given and the Project URL it must stay under, and no request SHALL be made. The check SHALL run after query parameters are applied and before any auth header is built, so it holds for every caller, including any caller that does not pass through the tool-argument rule.

#### Scenario: A path under a hosted project is sent

- **WHEN** `formioFetch` is called with path `user/login` and Project URL `https://examples.form.io`
- **THEN** the request is sent to `https://examples.form.io/user/login`

#### Scenario: A path under a sub-directory project is sent

- **WHEN** `formioFetch` is called with path `form/65a1b2c3d4e5f60718293a4b` and Project URL `https://forms.mysite.com/myproject`
- **THEN** the request is sent to `https://forms.mysite.com/myproject/form/65a1b2c3d4e5f60718293a4b`

#### Scenario: A path that resolves to another origin is refused

- **WHEN** `formioFetch` is called with path `https://example.com/x` and Project URL `https://examples.form.io`
- **THEN** it throws naming the path and `https://examples.form.io`
- **AND** no request is sent

#### Scenario: A path that resolves outside a sub-directory project is refused

- **WHEN** `formioFetch` is called with path `../otherproject/form` and Project URL `https://forms.mysite.com/myproject`
- **THEN** it throws naming the path and `https://forms.mysite.com/myproject`
- **AND** no request is sent

#### Scenario: A sibling path that shares the project's prefix is refused

- **WHEN** the built URL is `https://forms.mysite.com/myproject2/form` and the Project URL is `https://forms.mysite.com/myproject`
- **THEN** it throws and no request is sent
