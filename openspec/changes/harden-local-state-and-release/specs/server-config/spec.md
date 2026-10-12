## ADDED Requirements

### Requirement: FORMIO_INSECURE_TLS applies only to the resolved deployment

When `FORMIO_INSECURE_TLS` is true, certificate verification SHALL be skipped only for requests whose host is the resolved project URL's host or the resolved Base URL's host. The server SHALL NOT change `NODE_TLS_REJECT_UNAUTHORIZED`, and requests to any other host SHALL verify certificates as usual.

#### Scenario: The configured deployment

- **WHEN** `FORMIO_INSECURE_TLS` is true and the deployment at `https://forms.internal` presents a self-signed certificate
- **THEN** requests to `https://forms.internal` succeed

#### Scenario: Any other host

- **WHEN** `FORMIO_INSECURE_TLS` is true and the process makes a request to a host other than the resolved project and deployment hosts
- **THEN** that request verifies the certificate

#### Scenario: The process setting is untouched

- **WHEN** the server starts with `FORMIO_INSECURE_TLS` true
- **THEN** `NODE_TLS_REJECT_UNAUTHORIZED` is unchanged
