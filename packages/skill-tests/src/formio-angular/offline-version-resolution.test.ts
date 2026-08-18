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

// Naming a variable somewhere in the section is not resolving it. Step 1's
// offline path is two ordered branches, and the second — asking the user — is the
// one that runs when nothing is installed. A variable only the `node_modules`
// branch answers is unset on that path, and the later step that interpolates it
// emits the placeholder literally or invents a value the skill forbids guessing.
describe('the ask-the-user branch answers every required version', () => {
  // The branch ends where the section's closing prose begins — the paragraph
  // about the target version's lack of an offline source names two of the
  // variables, so slicing to the end of the section would let it answer for a
  // branch that never sets them.
  const askBranch = () => {
    const section = offlineSection();
    const start = section.indexOf('2. **Ask the user');
    const end = section.indexOf('`FORMIO_ANGULAR_TARGET_VERSION` has no other offline source');

    expect(start, 'no ask-the-user branch in the offline section').toBeGreaterThan(-1);
    expect(end, 'no closing prose after the offline branches').toBeGreaterThan(start);
    return section.slice(start, end);
  };

  it.each([
    'FORMIO_ANGULAR_VERSION',
    'FORMIO_JS_VERSION',
    'FORMIO_ANGULAR_SUPPORTED_MAJOR',
    'FORMIO_ANGULAR_TARGET_VERSION',
    'BOOTSTRAP_VERSION',
    'BOOTSTRAP_ICONS_VERSION',
  ])('resolves %s with nothing installed', (variable) => {
    expect(askBranch()).toContain(variable);
  });

  // The supported major is the one variable the user is not asked for directly:
  // offline there is no peer range to read it out of, so it comes from the major
  // of the target version they named. That is the user's own choice rather than a
  // guess — and the derivation only runs in that direction.
  it('derives the supported major from the target version the user named', () => {
    expect(askBranch()).toMatch(/major of the `?FORMIO_ANGULAR_TARGET_VERSION/i);
  });

  it('never carries an unresolved placeholder into a command', () => {
    expect(askBranch()).toMatch(/@angular\/cli@<FORMIO_ANGULAR_SUPPORTED_MAJOR>/);
    expect(askBranch()).toMatch(/never carry|do not carry|installs nothing/i);
  });
});

// Bootstrap has no offline fallback version, so the honest outcome is the state
// Step 5 already understands — null, skip the install, and say why.
describe('Bootstrap degrades to the documented skip when it cannot be resolved', () => {
  it('sets both Bootstrap variables to null rather than inventing them', () => {
    const branch = offlineSection().slice(offlineSection().indexOf('2. **Ask the user'));

    expect(branch).toMatch(/`?BOOTSTRAP_VERSION`? and `?BOOTSTRAP_ICONS_VERSION`? are `?null/i);
  });

  it('lets Step 5 skip for the offline reason, not only the opt-out', () => {
    const body = bootstrap();
    const step5 = body.slice(body.indexOf('## Step 5 — add Bootstrap 5'));

    expect(step5.slice(0, 600)).toMatch(/registry was unreachable|registry unreachable/i);
  });

  it('reports the skip reason in the approval summary', () => {
    expect(bootstrap()).toContain('skipped — registry unreachable');
  });
});

describe('Step 3 tolerates a major-only target version', () => {
  it('says what to pass when the target version is a bare major', () => {
    const body = bootstrap();
    const step3 = body.slice(body.indexOf('**Angular version (critical):**'));

    expect(step3.slice(0, 1200)).toMatch(/bare major|major on its own|only a major/i);
  });
});
