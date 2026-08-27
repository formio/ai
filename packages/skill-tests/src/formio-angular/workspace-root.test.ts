// Every scaffolding command lands at one absolute path, established once.
//
// A real session lost an entire `ng new` tree: the agent had `cd`-ed into the
// skill's own directory earlier in the turn (`.claude/skills/formio-angular`,
// a symlink into `.agents/skills/`), and shell working directories persist
// between commands in every agent harness. `npx skills add`, `ng new --directory
// .`, `npm install`, and an `angular.json` edit all landed inside the skill.
// Nothing detected it: BOOTSTRAP's Step 4 checks `<workspace>/angular.json`, and
// a `<workspace>` read as "wherever the shell happens to be" passes that check in
// the wrong tree.
//
// No skill instruction told it to `cd` there. What the skill DID do is name the
// scaffolding target as "the cwd" and leave every command relative to it. These
// tests pin the fix: one absolute `workspaceRoot`, captured in SETUP, used by
// every command BOOTSTRAP runs, and verified after the scaffold.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (name: string) =>
  readFileSync(join(repoRoot, 'plugin/skills/formio-angular', name), 'utf8');

describe('the Angular workspace root is absolute and established once', () => {
  // Pre-flight runs BEFORE SETUP and already inspects the tree — angular.json,
  // src/app/config.ts, the template pair — so a root read there as "the
  // working-directory root" is read against whatever the shell drifted into. Its
  // own finding ("this working folder is empty — I'll scaffold") is what the rest
  // of the flow then acts on, so capturing the root in SETUP is capturing it one
  // phase too late: the wrong tree has already been declared empty.
  it('the pre-flight captures the root before it inspects anything', () => {
    const skill = read('SKILL.md');
    const preflight = skill.slice(
      skill.indexOf('## Pre-flight (workspace inspection)'),
      skill.indexOf('## The planner artifacts')
    );

    expect(preflight.length).toBeGreaterThan(0);
    expect(preflight).toContain('workspaceRoot');
    expect(preflight).toMatch(/absolute/i);
    // The wording that made the drifted shell authoritative.
    expect(preflight).not.toMatch(/at the working-directory root/);
  });

  it('SETUP reuses the captured root rather than re-deriving it', () => {
    expect(read('SETUP.md')).toMatch(/pre-flight/i);
  });

  it('SETUP captures it before it resolves anything else', () => {
    const setup = read('SETUP.md');

    expect(setup).toContain('workspaceRoot');
    expect(setup).toMatch(/absolute/i);
    // Handoff supplies it; standalone reads it from where the user invoked.
    expect(setup).toContain('workspacePath');
  });

  it('the parent skill warns that a shell working directory persists and drifts', () => {
    const skill = read('SKILL.md');

    expect(skill).toContain('workspaceRoot');
    expect(skill).toMatch(/persist/i);
    // The specific trap: reading a skill's own files by walking into them.
    expect(skill).toMatch(/skill's own directory|into a skill directory/i);
  });

  it('BOOTSTRAP targets the captured root rather than whatever the shell is in', () => {
    const bootstrap = read('BOOTSTRAP.md');

    expect(bootstrap).toContain('workspaceRoot');
    // The old wording made the drifted shell authoritative.
    expect(bootstrap).not.toMatch(/Usually the cwd/i);
  });

  it('BOOTSTRAP verifies the scaffold landed at the captured root', () => {
    const bootstrap = read('BOOTSTRAP.md');
    const step4 = bootstrap.slice(bootstrap.indexOf('## Step 4'), bootstrap.indexOf('## Step 5'));

    expect(step4.length).toBeGreaterThan(0);
    expect(step4).toContain('workspaceRoot');
  });
});

// BOOTSTRAP was the only phase the absolute-root fix reached. CONFIG, AUTH and
// the Resources sub-skill still named every file relatively — `src/app/config.ts`,
// `src/app/auth/auth.module.ts`, `src/app/app.html` — which is the same failure one
// phase later: BOOTSTRAP's own commands are `cd "<workspaceRoot>" && …`, a cd that
// does not persist, so an agent arriving at CONFIG with a drifted shell reads the
// wrong tree, finds no config.ts, and writes the whole Form.io wiring there.
describe('every file-writing phase roots its paths at the captured workspace root', () => {
  const phases = ['CONFIG.md', 'AUTH.md'];

  it.each(phases)('%s says which root its src/app paths hang off', (name) => {
    const phase = read(name);

    expect(phase).toContain('workspaceRoot');
    // Not merely mentioned in passing: the document has to say the paths below
    // are relative to it, because every one of them is written bare.
    expect(phase).toMatch(/relative to `?workspaceRoot/i);
  });

  it('the Resources sub-skill roots its paths the same way', () => {
    const subSkill = readFileSync(
      join(
        repoRoot,
        'plugin/skills/formio-angular/formio-angular-resources/references/app-integration.md'
      ),
      'utf8'
    );

    expect(subSkill).toContain('workspaceRoot');
    expect(subSkill).toMatch(/relative to `?workspaceRoot/i);
  });

  // Which phase OWNS the capture decides whether SETUP re-derives it. SKILL.md and
  // SETUP.md both say Pre-flight captures it and SETUP must not ask the shell
  // again; BOOTSTRAP said "the absolute path SETUP captured", which invites the
  // re-derivation SETUP.md spends a paragraph forbidding.
  it('BOOTSTRAP credits the capture to Pre-flight, not to SETUP', () => {
    const bootstrap = read('BOOTSTRAP.md');

    expect(bootstrap).not.toMatch(/absolute path SETUP captured/i);
    expect(bootstrap).toMatch(/Pre-flight captured/i);
  });
});
