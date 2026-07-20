# FHIR-compliant patient form

A schema-constrained form build. Exercises `formio-form-builder`'s ability to shape a form so its submission data conforms to an externally defined standard — here the FHIR Patient resource — by mapping component keys and nesting to the target schema.

## Prompt

```
/formio-form-builder I am building a new patient onboarding application that must adhere to the FHIR Patient resource definitions described at https://build.fhir.org/patient.html. Can you create a form that will onboard a new patient and the data that it produces generate FHIR compliant data for Patients?
```

## What to look for

- Component keys and container nesting should mirror FHIR Patient element paths (e.g., `name` with `given`/`family`, `telecom`, `gender`, `birthDate`, `address`) so the raw submission `data` is FHIR-shaped — not a flat form with FHIR-ish labels.
- Enumerated FHIR fields (e.g., `gender`) should become selects constrained to the FHIR value set.
- The agent should consult the linked FHIR page rather than inventing element names from memory.
