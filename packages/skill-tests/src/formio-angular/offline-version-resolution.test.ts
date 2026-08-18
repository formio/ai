// Every version Step 3 requires has a way to be resolved without the registry.
//
// BOOTSTRAP.md's Step 1 resolves six versions through `npm view`, and keeps an
// offline path for hosts that cannot reach the registry. The path is only worth
// having if it answers for every variable a later step treats as required: one
// producible solely by a registry query leaves the offline branch dead-ending at
// Step 3, after the user has already been told Phase 2 can proceed.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const bootstrap = () =>
  readFileSync(join(repoRoot, 'plugin/skills/formio-angular/BOOTSTRAP.md'), 'utf8');

// The section runs from the registry-unreachable heading to the list of stashed
// results that follows it.
const offlineSection = () => {
  const body = bootstrap();
  const start = body.indexOf('**If the registry is unreachable.**');
  const end = body.indexOf('Stash the six results');

  expect(start, 'no registry-unreachable section in BOOTSTRAP.md').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return body.slice(start, end);
};

describe('the offline path resolves every required version', () => {
  it.each([
    'FORMIO_ANGULAR_VERSION',
    'FORMIO_ANGULAR_SUPPORTED_MAJOR',
    'FORMIO_ANGULAR_TARGET_VERSION',
  ])('names %s', (variable) => {
    expect(offlineSection()).toContain(variable);
  });

  // The target version is a full MAJOR.MINOR.PATCH resolved from a registry
  // range query, so offline it comes from an installed @angular/core or from the
  // user — and when the user names only a major, the major alone has to be
  // usable, since `ng new` and `@angular/cli@<major>` both accept one.
  it('says where the target version comes from with no registry', () => {
    const section = offlineSection();

    expect(section).toContain('node_modules/@angular/core/package.json');
    expect(section).toMatch(/only a major|just a major|major alone/i);
  });

  it('still refuses to guess a major', () => {
    expect(offlineSection()).toMatch(/do not guess a major|never guess/i);
  });
});

describe('Step 3 tolerates a major-only target version', () => {
  it('says what to pass when the target version is a bare major', () => {
    const body = bootstrap();
    const step3 = body.slice(body.indexOf('**Angular version (critical):**'));

    expect(step3.slice(0, 1200)).toMatch(/bare major|major on its own|only a major/i);
  });
});
