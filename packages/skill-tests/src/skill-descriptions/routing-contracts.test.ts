// Routing and handoff contracts between the orchestrator and the skills it hands
// work to. Each check here names a way the library sent a request in a circle,
// handed two skills contradictory contracts, or pointed at a file an installed
// skill cannot reach.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkills } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skills = join(repoRoot, 'plugin/skills');
const read = (path: string): string => readFileSync(join(skills, path), 'utf8');
const description = (path: string): string => {
  const skill = allSkills().find((entry) => entry.path === `plugin/skills/${path}`);
  if (!skill) throw new Error(`no skill at ${path}`);
  return skill.description;
};

// The section a `## ` heading opens, to the next `## `.
const section = (text: string, heading: string): string => {
  const start = text.indexOf(`\n${heading}\n`);
  if (start === -1) throw new Error(`no "${heading}" heading`);
  const next = text.indexOf('\n## ', start + heading.length + 1);
  return text.slice(start, next === -1 ? text.length : next);
};

const NESTED = [
  'formio-angular-resources',
  'formio-react-resources',
  'formio-angular-form',
  'formio-react-form',
];

describe('framework-named builds split on whether a plan exists', () => {
  // "build me a CRM in React" needs planning; the orchestrator carries React to
  // Step 4 rather than sending the request to a skill that sends it back.
  it('formio-application claims a framework-named build that needs planning', () => {
    expect(description('formio-application/SKILL.md')).toContain('build me a CRM in React');
  });

  it('formio-application has no "do not activate" row for framework naming', () => {
    expect(read('formio-application/SKILL.md')).not.toMatch(
      /Do not activate\. The user has chosen the framework/
    );
  });

  it('FRAMEWORK.md treats a framework a skill routed here with as answered', () => {
    const text = read('formio-application/FRAMEWORK.md');
    expect(text).toContain('has already answered');
    expect(text).toMatch(/framework skill routed the request here/);
  });

  // Reached with no plan, the framework skill hands the request on itself; it does
  // not ask the user to invoke another skill by name.
  it.each(['formio-angular/SKILL.md', 'formio-react/SKILL.md'])(
    '%s hands a request with no plan to formio-application',
    (path) => {
      const text = read(path);
      expect(text).not.toMatch(/ask the user to invoke `formio-application`/i);
      expect(text).not.toMatch(/Shall I route you there\?/);
      expect(text).toMatch(/hand (the request|it) to `formio-application`/);
    }
  );

  it.each(['formio-angular/SKILL.md', 'formio-react/SKILL.md'])(
    '%s description sends an unplanned app to formio-application',
    (path) => {
      expect(description(path)).toMatch(/a new app whose data model is not yet planned/);
    }
  );
});

describe('descriptions name only registered skills', () => {
  it('formio-application names no nested sub-skill', () => {
    const text = description('formio-application/SKILL.md');
    expect(NESTED.filter((name) => text.includes(name))).toEqual([]);
    expect(text).toContain('`formio-angular`');
    expect(text).toContain('`formio-react`');
  });

  it('formio-application routes to no nested sub-skill by name in its Inputs table', () => {
    const inputs = section(read('formio-application/SKILL.md'), '## Inputs you expect');
    expect(inputs).not.toMatch(/`formio-(angular|react)-resources`/);
  });

  it.each([
    ['formio-angular/formio-angular-form/SKILL.md', '`formio-angular`'],
    ['formio-react/formio-react-form/SKILL.md', '`formio-react`'],
  ])('%s routes CRUD screens through its registered parent', (path, parent) => {
    expect(description(path)).toMatch(new RegExp(`CRUD screens \\(see ${parent}`));
  });
});

describe('formio-mcp-setup routes Form.io login correctly', () => {
  it('does not send logging in to Form.io to formio-auth', () => {
    const text = description('formio-mcp-setup/SKILL.md');
    expect(text).not.toContain('authenticating to Form.io (see `formio-auth`)');
    expect(text).toMatch(/logging in to Form\.io[^;]*first tool call/);
    expect(text).toMatch(/end-user auth \(see `formio-auth`\)/);
  });
});

describe('one handoff contract, carrying no URL', () => {
  const URL_FIELDS = /`(projectUrl|baseUrl|formioProjectUrl|formioBaseUrl)`/;

  it("FRAMEWORK.md's handoff reference carries no URL field", () => {
    const reference = section(
      read('formio-application/FRAMEWORK.md'),
      '## Handoff context reference'
    );
    expect(reference).not.toMatch(/formioProjectUrl|formioBaseUrl/);
    expect(reference).not.toMatch(/^\s*(projectUrl|baseUrl):/m);
    expect(reference).toMatch(/No payload carries a URL/);
  });

  it("SKILL.md's handoff contracts carry no URL and link to FRAMEWORK.md", () => {
    const contracts = section(read('formio-application/SKILL.md'), '## Handoff contracts');
    expect(contracts).not.toMatch(URL_FIELDS);
    expect(contracts).toContain('FRAMEWORK.md');
    expect(contracts).toContain('quoted as a requirements block');
  });

  it.each([
    'formio-application/INTENT.md',
    'formio-application/IMPORT.md',
    'formio-angular/SKILL.md',
    'formio-react/SKILL.md',
    'formio-react/formio-react-resources/SKILL.md',
    'formio-angular/formio-angular-resources/SKILL.md',
  ])('%s links to the handoff reference', (path) => {
    expect(read(path)).toMatch(/Handoff context reference/);
  });

  it('INTENT.md passes no URLs to the extend sub-skill', () => {
    expect(read('formio-application/INTENT.md')).not.toMatch(/Pass the workspace root, URLs/);
  });

  it('IMPORT.md hands Step 4 no URL', () => {
    const handoff = section(read('formio-application/IMPORT.md'), '## What Step 3 hands to Step 4');
    expect(handoff).not.toMatch(URL_FIELDS);
  });

  it("formio-angular's build-new input row passes no URL", () => {
    const row = read('formio-angular/SKILL.md')
      .split('\n')
      .find((line) => line.startsWith('| **Handoff from `formio-application` (build-new)**'));
    expect(row).toBeDefined();
    expect(row).not.toMatch(URL_FIELDS);
  });

  it('formio-application passes formio-auth the workspace, not a URL', () => {
    const step = section(read('formio-application/SKILL.md'), '## The four steps');
    const auth = step.slice(step.indexOf('### Step 3.5'), step.indexOf('### Step 4'));
    expect(auth).not.toMatch(URL_FIELDS);
    expect(auth).toMatch(/workspace path/);
  });
});

describe('formio-auth runs once, after import', () => {
  it.each([
    'formio-resource-planner/SKILL.md',
    'formio-resource-planner/references/interview-guide.md',
    'formio-resource-planner/references/template-md.md',
  ])('%s does not hand off at map approval', (path) => {
    expect(read(path)).not.toMatch(/after (this|the) Resource Map is approved/);
  });

  it('the planner lists auth as a post-import next step', () => {
    const emission = read('formio-resource-planner/references/phase-b-emission.md');
    expect(emission).toMatch(/\*\*Configure auth\*\*[^\n]*after the import[^\n]*`formio-auth`/);
    expect(emission).not.toContain('future `formio-react`');
  });

  it('Step 3.5 names RBAC tuning among its triggers', () => {
    const skill = read('formio-application/SKILL.md');
    const auth = skill.slice(skill.indexOf('### Step 3.5'), skill.indexOf('### Step 4'));
    expect(auth).toMatch(/RBAC tuning/);
  });

  it('CLAUDE.md places the handoff after import', () => {
    const claude = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
    expect(claude).not.toContain('immediately after the Resource Map is approved');
    expect(claude).toMatch(/formio-auth` after the template is imported/);
  });
});

// "Also track X" in an existing Angular workspace names no framework, so it stays
// with the orchestrator. Only framework-named work belongs to the framework skill;
// the routing eval caught an unqualified clause handing it over.
describe('framework-neutral extension stays with formio-application', () => {
  it('the Not-for clause gives framework skills only framework-named work', () => {
    const notFor = description('formio-application/SKILL.md').split('Not for:')[1] ?? '';
    expect(notFor).toMatch(/Angular- or React-named work/);
    expect(notFor).not.toMatch(/Not for: Angular or React work/);
  });
});

// The server's directory-mapping lookup and the committed-file walk both stop at
// the first directory containing `.git`, so a workspace about to be scaffolded
// (and become its own repository) is recorded with its own pair before the
// scaffold: no later step can find a parent's record or the environment's
// instead. A Base URL that was recorded rather than derived is recorded too.
describe('a workspace about to be scaffolded is recorded first', () => {
  it.each(['formio-angular/SETUP.md', 'formio-react/SETUP.md'])('%s', (path) => {
    const text = read(path);
    expect(text).toMatch(/before (BOOTSTRAP|the scaffold)[^.]*`project_set`/);
    expect(text).toMatch(/`baseUrlSource`[^.]*`derived`/);
  });

  it('BOOTSTRAP no longer patches the cut-off after the scaffold', () => {
    expect(read('formio-angular/BOOTSTRAP.md')).not.toMatch(
      /confirm the workspace still resolves its project/
    );
  });
});

describe('formio-angular hands over only what needs a plan', () => {
  const skill = read('formio-angular/SKILL.md');

  it('a repair of existing wiring proceeds without a planner pair', () => {
    expect(skill).not.toMatch(
      /that is a `formio-application` case whether or not they named Angular/
    );
    expect(skill).toMatch(/repair[^.]*without a planner pair/i);
  });

  it('handoff mode receives no URLs', () => {
    expect(skill).not.toMatch(/passed both URLs/);
    expect(skill).not.toMatch(/that you gave me during the import step/);
  });
});

describe('workspacePath is defined once and honoured by every receiver', () => {
  it('FRAMEWORK.md defines it as the directory Step 3 imported for', () => {
    expect(read('formio-application/FRAMEWORK.md')).toMatch(
      /`workspacePath` is the `cwd` the Step 3 Preflight's `project_get` reported/
    );
  });

  it('formio-auth resolves the handed workspacePath', () => {
    expect(read('formio-auth/SKILL.md')).toMatch(
      /`project_get` with `cwd` set to that `workspacePath`/
    );
  });

  it("formio-application's Inputs table claims no Angular-named extension", () => {
    expect(read('formio-application/SKILL.md')).not.toMatch(
      /add an invoices module to my Angular app/
    );
  });
});

describe('formio-react-resources runs every EXISTING.md step through the backfill', () => {
  it('names steps 1–4', () => {
    const text = read('formio-react/formio-react-resources/SKILL.md');
    expect(text).not.toMatch(/EXISTING\.md\)? steps 1–3/);
    expect(text).toMatch(/EXISTING\.md\)? steps 1–4/);
  });
});

describe('the angular-resources plan matches the workspace it extends', () => {
  it('the plan template covers a workspace not yet wired', () => {
    const template = read(
      'formio-angular/formio-angular-resources/references/phase-a-plan-template.md'
    );
    expect(template).toMatch(/not yet wired/);
    expect(template).toMatch(/config\.ts\s+NEW or VERIFY/);
  });

  it('the worked example modifies the root modules of an existing workspace', () => {
    const example = read('formio-angular/formio-angular-resources/references/worked-example.md');
    expect(example).toMatch(/app-module\.ts\s+MODIFY/);
    expect(example).toMatch(/app-routing-module\.ts\s+MODIFY/);
  });
});
