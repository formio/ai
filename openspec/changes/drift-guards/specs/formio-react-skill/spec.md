## ADDED Requirements

### Requirement: Versions are read at run time

`formio-react`'s documents SHALL NOT state a package version, peer range, or engine requirement as a fact to rely on; where a step depends on one — React Router's engines and React peer, `@vitejs/plugin-react`'s Vite peer — the step SHALL read it with `npm view <package> <field>` at run time and act on the result.

#### Scenario: Peers come from the registry

- **WHEN** `BOOTSTRAP.md`, `EXISTING.md`, and `formio-react-form/references/environments.md` are read
- **THEN** each version-dependent step names the `npm view` read it relies on rather than a hardcoded range
