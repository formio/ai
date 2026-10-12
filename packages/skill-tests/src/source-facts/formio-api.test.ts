// Statements in `formio-api` that an agent acts on, checked against what the
// Form.io server does (nirvana `apps/formio`, `apps/formio-server`,
// `packages/resourcejs`) and against the tools the MCP server registers. Each test
// fails if the wrong statement comes back or the right one is deleted.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, skillReader, skillsRoot } from './skill-text.js';

const skillDir = join(skillsRoot, 'formio-api');
const toolsDir = join(repoRoot, 'packages/mcp-server/src/tools');

const read = skillReader('formio-api');
const reference = (name: string): string => read(`references/${name}`);

function section(body: string, heading: string): string {
  const start = body.indexOf(heading);
  if (start === -1) return '';
  const next = body.indexOf('\n## ', start + heading.length);
  return body.slice(start, next === -1 ? body.length : next);
}

function endpoint(body: string, heading: string): string {
  const start = body.indexOf(heading);
  if (start === -1) return '';
  const next = body.slice(start + heading.length).search(/\n#{2,3} /);
  return body.slice(start, next === -1 ? body.length : start + heading.length + next);
}

function registeredTools(): string[] {
  return readdirSync(toolsDir)
    .filter((name) => name.endsWith('.ts'))
    .flatMap((name) => {
      const match = /registerTool\(\s*'([a-z_]+)'/.exec(readFileSync(join(toolsDir, name), 'utf8'));
      return match ? [match[1]] : [];
    });
}

describe('runtime authentication', () => {
  const runtimeAuth = reference('runtime-auth.md');

  // The default project grants Anonymous create on `user/register`, whose Save and
  // Login actions create the user and return the JWT; it grants no create on the
  // `user` resource, which carries no Login action.
  it('registers through the register form', () => {
    expect(runtimeAuth).toContain('### POST {projectUrl}/user/register/submission');
    expect(runtimeAuth).not.toContain('### POST {projectUrl}/user/submission');
  });

  // tokenHandler answers 440 with text that varies by cause.
  it('recognises an expired token by its 440 status, not its text', () => {
    expect(runtimeAuth).toMatch(/Key on the `440` status, not the text/);
    expect(runtimeAuth).not.toMatch(
      /responds with a plain-text body:\s*```\s*Session no longer valid/
    );
  });

  it('describes a locked login as 401', () => {
    for (const name of ['runtime-custom-users.md', 'project-auth.md']) {
      expect(reference(name), name).not.toMatch(/429/);
    }
  });
});

describe('runtime submissions', () => {
  it('names the dry-run parameter', () => {
    expect(reference('runtime-submissions.md')).toContain('?dryrun=1');
  });
});

describe('action conditions', () => {
  // action_create / action_update accept `conjunction` of `all` or `any` only.
  it('never sends an empty conjunction', () => {
    const offenders = readdirSync(join(skillDir, 'references')).filter((name) =>
      /"conjunction":\s*""/.test(reference(name))
    );

    expect(offenders).toEqual([]);
  });
});

describe('runtime references name the tools that cover their build-time endpoints', () => {
  it.each([
    ['runtime-custom-users.md', ['form_create', 'role_create', 'action_create']],
    ['runtime-access-control.md', ['form_create', 'action_create']],
  ])('%s', (name, tools) => {
    const preference = section(reference(name), '## MCP Tool Preference');

    for (const tool of tools) {
      expect(preference, tool).toContain(`\`${tool}\``);
    }
  });
});

describe('PUT keeps omitted fields', () => {
  // resourcejs PUT loads the record and sets only what was sent.
  it.each(['platform-tenants.md', 'platform-projects.md'])('%s', (name) => {
    const body = reference(name);

    expect(body).not.toMatch(/omitted fields are reset/i);
    expect(body).toMatch(/top-level fields left out keep their stored value/);
  });

  it('states the project PUT rules', () => {
    const put = endpoint(reference('platform-projects.md'), '### PUT {projectUrl}');

    expect(put).toContain('`settings.licenseKey`');
    expect(put).toContain('`billing`');
    expect(put).toContain('`template`');
    expect(put).toMatch(/PATCH .*405/);
  });
});

describe('import bodies', () => {
  // The importer reads `forms` and `resources` as objects keyed by machine name.
  function importBodies(body: string): Record<string, unknown>[] {
    return [...body.matchAll(/```json\n([\s\S]*?)```/g)]
      .map((match) => {
        try {
          return JSON.parse(match[1]) as unknown;
        } catch {
          return undefined;
        }
      })
      .flatMap((parsed) =>
        parsed && typeof parsed === 'object' && 'template' in parsed
          ? [(parsed as { template: Record<string, unknown> }).template]
          : []
      );
  }

  it.each(['platform-projects.md', 'platform-staging.md'])('%s uses objects', (name) => {
    const body = reference(name);
    const templates = importBodies(body);

    expect(body).not.toMatch(/"forms":\s*\[\]/);
    expect(body).not.toMatch(/"resources":\s*\[\]/);
    for (const template of templates) {
      for (const key of ['forms', 'resources']) {
        expect(Array.isArray(template[key]), key).toBe(false);
        expect(template[key], key).toBeTypeOf('object');
      }
    }
  });
});

describe('the router names every tool', () => {
  // server_status makes no Form.io request, so it covers no endpoint here.
  it('lists every registered tool except server_status', () => {
    const router = section(read('SKILL.md'), '## MCP Tool Preference');
    const missing = registeredTools()
      .filter((tool) => tool !== 'server_status')
      .filter((tool) => !router.includes(`\`${tool}\``));

    expect(registeredTools().length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});

describe('the revision tools as they behave', () => {
  const revisions = reference('project-form-revisions.md');

  it('says a changed non-draft field is refused on a draft save', () => {
    expect(revisions).toMatch(/is refused with `INVALID_ARGUMENT`/);
    expect(revisions).not.toMatch(/Every other field, including the server-owned ones/);
  });

  it('says the draft cannot be reverted to', () => {
    expect(revisions).toMatch(/resolves to the draft is refused/);
  });

  it("says form_create's note is optional", () => {
    expect(revisions).toMatch(/`form_create` accepts an optional `note`/);
  });

  it('form-builder makes no schema-validation claim for form_create', () => {
    const save = readFileSync(join(repoRoot, 'plugin/skills/formio-form-builder/SAVE.md'), 'utf8');

    expect(save).not.toMatch(/validates against the `formio-schema` conventions/);
    expect(save).toMatch(/checks only the top-level shape/);
  });
});
