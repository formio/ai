// Two different actors call the Form.io REST API, and the library must not
// confuse them.
//
// The agent runs at build time. It configures a project through the MCP tools
// and stops; no skill may have it hand-roll HTTP against a deployment, and
// nothing an end user types can reach it.
//
// The application the agent builds runs afterwards, and calling the REST API is
// its job — logging users in, listing and saving submissions. `formio-api`'s
// runtime-scope references exist for that code.
//
// Collapsing the two produces the contradiction this suite guards: a preflight
// reading "do not write code that makes HTTP requests" forbids the very apps
// `formio-angular` and `formio-form` are for, and a reference reading "use the
// HTTP endpoint directly" reads as an invitation for the agent to pull
// submission records into its own context.

import { describe, expect, it } from 'vitest';
import { allSkillDocuments, skillDocument, topLevelSkills } from './helpers.js';

const RUNTIME_REFERENCES = [
  'plugin/skills/formio-api/references/runtime-submissions.md',
  'plugin/skills/formio-api/references/runtime-auth.md',
  'plugin/skills/formio-api/references/runtime-reports.md',
  'plugin/skills/formio-api/references/runtime-access-control.md',
  'plugin/skills/formio-api/references/runtime-custom-users.md',
];

const skillBodies = () =>
  topLevelSkills().map((skill) => skillDocument(`plugin/skills/${skill}/SKILL.md`));

describe('the preflight bans build-time HTTP without banning the app', () => {
  // "do not write code that does" swept up the application's own runtime calls.
  // The ban is on the agent standing in for the tools, and on scripts it writes
  // to do the same — not on what the shipped app does.
  it('does not forbid writing code that calls the API', () => {
    const offenders = allSkillDocuments().filter(({ body }) =>
      /do not write code that does/i.test(body)
    );

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });

  it('still forbids the agent hand-rolling requests, in every skill', () => {
    const missing = skillBodies().filter(
      ({ body }) => !/direct HTTP requests against a Form\.io deployment/i.test(body)
    );

    expect(missing.map(({ path }) => path)).toEqual([]);
  });

  // Without this, narrowing the ban reads as loosening it.
  it('says the ban is build-time only and that the app may call the API', () => {
    for (const doc of skillBodies()) {
      expect(doc.body, doc.path).toMatch(/build[- ]time/i);
      expect(doc.body, doc.path).toMatch(/at runtime|runtime/i);
    }
  });
});

describe('the runtime-scope API references address the application, not the agent', () => {
  it('does not tell the reader to call the endpoint directly with no actor named', () => {
    const offenders = RUNTIME_REFERENCES.filter((path) =>
      /^No MCP tool covers this operation — use the HTTP endpoint directly\.$/m.test(
        skillDocument(path).body
      )
    );

    expect(offenders).toEqual([]);
  });

  it('names the application as the caller and rules out the agent', () => {
    for (const path of RUNTIME_REFERENCES) {
      const { body } = skillDocument(path);
      const preference = body.slice(
        body.indexOf('## MCP Tool Preference'),
        body.indexOf('## Endpoints')
      );

      expect(preference, path).toMatch(/build[- ]time/i);
      expect(preference, path).toMatch(/runtime/i);
    }
  });

  // The specific case that started this: no build-time reason exists to read
  // submission records, so the reference has to say so rather than leave it to
  // inference.
  it('states that submissions are not read into the session at build time', () => {
    const { body } = skillDocument('plugin/skills/formio-api/references/runtime-submissions.md');

    expect(body).toMatch(/(do not|never) (call|read|fetch|pull)/i);
    expect(body).toMatch(/end users|submitter|people who fill/i);
  });
});
