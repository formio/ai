// Regression locks for the four trigger collisions resolved by the
// compress-skill-descriptions change. Each guard maps to a spec scenario in
// the owning capability. Name matching is backtick-delimited wherever
// `formio-form` / `formio-form-builder` could be confused.

import { describe, expect, it } from 'vitest';
import { descriptionOf } from './helpers.js';

function notForClauseOf(description: string): string {
  const index = description.indexOf('Not for');
  expect(index, 'description has no Not for clause').toBeGreaterThanOrEqual(0);
  return description.slice(index);
}

function triggerClauseOf(description: string): string {
  // Everything before the Not for clause — the capability + trigger surface.
  return description.slice(0, description.indexOf('Not for'));
}

describe('planner ↔ application boundary', () => {
  it('formio-resource-planner claims no build-an-app triggers', () => {
    const triggers = triggerClauseOf(descriptionOf('formio-resource-planner'));
    expect(triggers).not.toMatch(/\bbuild (me|a|an)\b/i);
    expect(triggers).not.toMatch(/I want to build/i);
  });

  it('formio-resource-planner Not for: names `formio-application`', () => {
    const notFor = notForClauseOf(descriptionOf('formio-resource-planner'));
    expect(notFor).toContain('`formio-application`');
  });
});

describe('form ↔ form-builder boundary', () => {
  it('formio-form trigger clause pairs no build/create verb with new-form nouns', () => {
    const triggers = triggerClauseOf(descriptionOf('formio-form'));
    expect(triggers).not.toMatch(/\b(build|create) an? \w*\s*(form|wizard|survey)/i);
  });

  it('formio-form still claims conditional wizard (embed phrasing)', () => {
    expect(triggerClauseOf(descriptionOf('formio-form'))).toContain('conditional wizard');
  });
});

describe('edit-existing-form ownership', () => {
  // "Add a phone field to my registration form" must have an owner:
  // formio-form is embed-only, formio-schema is JSON-context-only, so the
  // form-builder orchestrator (which owns the schema-delegation + form_update
  // save path) claims plain-language field edits on an existing form.
  it('formio-form-builder trigger clause claims field edits on an existing form', () => {
    const triggers = triggerClauseOf(descriptionOf('formio-form-builder'));
    expect(triggers).toMatch(/edit an existing form/i);
    expect(triggers).toMatch(/add [^.;]*field/i);
  });
});

describe('schema bare-noun boundary', () => {
  it('formio-schema makes no blanket trigger-without-Form.io claim', () => {
    expect(descriptionOf('formio-schema')).not.toMatch(
      /even (when|if) the user does not (explicitly )?say/i
    );
  });
});

describe('actions ↔ auth boundary', () => {
  it('formio-actions Not for: names `formio-auth`', () => {
    expect(notForClauseOf(descriptionOf('formio-actions'))).toContain('`formio-auth`');
  });

  it('formio-auth Not for: names `formio-actions`', () => {
    expect(notForClauseOf(descriptionOf('formio-auth'))).toContain('`formio-actions`');
  });
});
