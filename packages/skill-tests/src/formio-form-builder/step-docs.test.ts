// Content tests for the `formio-form-builder` step docs. These assert the
// authoring contract from the `formio-form-builder-skill` spec for
// FORM_TYPES.md (the form-type reference) and INTENT.md (the batched
// interview script).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-form-builder');

const ALL_SKILL_DOCS = ['SKILL.md', 'FORM_TYPES.md', 'INTENT.md', 'SAVE.md', 'EMBED.md'] as const;

function readStepDoc(doc: string): string {
  return readFileSync(join(skillDir, doc), 'utf8');
}

describe('FORM_TYPES.md — the form-type reference', () => {
  it('documents all three form types', () => {
    const formTypes = readStepDoc('FORM_TYPES.md');
    for (const type of [/webform/i, /wizard/i, /pdf form/i]) {
      expect(formTypes, `FORM_TYPES.md missing form type ${type}`).toMatch(type);
    }
  });

  it('gives when-to-choose guidance for each of the three types', () => {
    const formTypes = readStepDoc('FORM_TYPES.md');
    const whenToChoose = formTypes.match(/when to choose/gi) ?? [];
    expect(
      whenToChoose.length,
      'expected a "When to choose" section per form type'
    ).toBeGreaterThanOrEqual(3);
  });

  it('lists the phrasing signals INTENT uses to distinguish the types', () => {
    const formTypes = readStepDoc('FORM_TYPES.md');
    expect(formTypes).toContain('multi-page');
    expect(formTypes).toMatch(/signal/i);
  });

  it('covers nested/child wizard workflows in the wizard section', () => {
    const formTypes = readStepDoc('FORM_TYPES.md');
    expect(formTypes).toMatch(/nested wizard/i);
    expect(formTypes).toMatch(/child wizard/i);
  });

  it('states the PDF-document prerequisite instead of promising conversion', () => {
    const formTypes = readStepDoc('FORM_TYPES.md');
    expect(formTypes).toMatch(/PDF document/);
    expect(formTypes).toMatch(/upload/i);
  });
});

describe('SAVE.md — form_create with an approval gate', () => {
  it('scripts an approval gate before the form_create call', () => {
    const save = readStepDoc('SAVE.md');
    expect(save).toMatch(/approval gate/i);
    expect(save).toContain('form_create');
    expect(save).toMatch(/target project|project it will be saved/i);
  });

  // The URL is `{projectUrl}/{formPath}` — a substitution slot, not an
  // environment variable. Spelled FORMIO_PROJECT_URL it told the agent to read an
  // environment the shipped manifests deliberately leave empty.
  it('confirms the saved form path and full form URL under the project URL', () => {
    const save = readStepDoc('SAVE.md');
    expect(save).toContain('{projectUrl}');
    expect(save).toContain('formPath');
    expect(save).not.toContain('FORMIO_PROJECT_URL');
  });

  it('routes auth errors through the authenticate portal-login flow and retries', () => {
    const save = readStepDoc('SAVE.md');
    expect(save).toContain('authenticate');
    expect(save).toContain('x-jwt-token');
    expect(save).toMatch(/retry|retries/i);
  });

  it('never presents PKCE or API keys as an auth mechanism in any doc', () => {
    for (const doc of ALL_SKILL_DOCS) {
      const lines = readStepDoc(doc).split('\n');
      for (const line of lines) {
        if (/PKCE|API key/i.test(line)) {
          expect(line, `${doc} mentions PKCE/API keys without negation: "${line}"`).toMatch(
            /\b(not|never|no)\b/i
          );
        }
      }
    }
  });
});

describe('EMBED.md — the conditional embed handoff', () => {
  it('fires only on the explicit yes captured at INTENT', () => {
    const embed = readStepDoc('EMBED.md');
    expect(embed).toMatch(/explicit yes/i);
  });

  it('hands off to formio-form with the saved form URL', () => {
    const embed = readStepDoc('EMBED.md');
    expect(embed).toContain('`formio-form`');
    expect(embed).toMatch(/form URL/i);
  });

  it('routes Angular-explicit requests through formio-angular', () => {
    const embed = readStepDoc('EMBED.md');
    expect(embed).toContain('`formio-angular`');
    expect(embed).toMatch(/Angular/);
  });

  it('duplicates no schema shapes or embed mechanics in any doc', () => {
    for (const doc of ALL_SKILL_DOCS) {
      const content = readStepDoc(doc);
      expect(content, `${doc} duplicates embed mechanics`).not.toContain('Formio.createForm');
      expect(content, `${doc} duplicates component JSON shapes`).not.toContain('"components"');
    }
  });
});

describe('INTENT.md — the batched interview script', () => {
  it('scripts a single batched AskUserQuestion capturing form type AND embed intent', () => {
    const intent = readStepDoc('INTENT.md');
    expect(intent).toContain('AskUserQuestion');
    expect(intent).toMatch(/form type/i);
    expect(intent).toMatch(/embed/i);
    // One batched call — both questions in one interview, not two rounds.
    expect(intent).toMatch(/one|single/i);
  });

  it('instructs infer-and-confirm for unambiguous phrasing, asking only when ambiguous', () => {
    const intent = readStepDoc('INTENT.md');
    expect(intent).toMatch(/infer/i);
    expect(intent).toMatch(/confirm/i);
    expect(intent).toMatch(/ambiguous/i);
  });

  it('references FORM_TYPES.md by path for the distinguishing signals', () => {
    const intent = readStepDoc('INTENT.md');
    expect(intent).toContain('FORM_TYPES.md');
  });

  it('states the EMBED step fires only on an explicit yes', () => {
    const intent = readStepDoc('INTENT.md');
    expect(intent).toMatch(/explicit yes/i);
  });
});
