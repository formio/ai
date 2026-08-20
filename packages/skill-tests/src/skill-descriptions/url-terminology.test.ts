// The rule this suite enforces had no enforcement at all: `api-skills-validation`
// mandated a `validateLibrary` suite that no longer existed, so every terminology
// requirement written into it — including "an FORMIO_* name means the environment
// variable and nothing else" — was unchecked prose. 234 endpoint roots in
// formio-api were renamed by hand; the skill bodies were not, and nothing noticed.
//
// Two halves, deliberately: the rules are exercised against synthetic inputs so a
// failure names the rule, and then run over the shipped library so a regression
// names the file.

import { describe, expect, it } from 'vitest';
import { allSkillDocuments } from './helpers.js';
import { urlTerminologyIssues } from './url-terminology.js';

const doc = (body: string) => [{ path: 'synthetic.md', body }];

describe('the one-name-per-job rule', () => {
  it.each([
    ['${FORMIO_PROJECT_URL}/form', 'a shell expansion'],
    ['$FORMIO_PROJECT_URL/import', 'a bare shell read'],
    ['appUrl: {{FORMIO_PROJECT_URL}}', 'a double-brace template slot'],
    ['`{FORMIO_PROJECT_URL}/{formPath}`', 'a single-brace slot'],
    ['app.appUrl: <FORMIO_BASE_URL>', 'an angle-bracket slot'],
    ["apiUrl: 'YOUR_FORMIO_BASE_URL'", 'a fill-me-in placeholder'],
  ])('rejects %s as a substitution slot (%s)', (body) => {
    const issues = urlTerminologyIssues(doc(body));

    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe('slot.environment_variable_name');
  });

  it('accepts the substitution slots the rule prescribes', () => {
    expect(urlTerminologyIssues(doc('`{projectUrl}/form` and `{baseUrl}/current`'))).toEqual([]);
  });

  it('rejects an environment-variable name used for a handoff value', () => {
    const issues = urlTerminologyIssues(
      doc('Pass the handoff context: workspace path, `FORMIO_PROJECT_URL`, `FORMIO_BASE_URL`.')
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe('name.not_about_the_environment');
  });

  it('accepts the same value named in prose or as a field', () => {
    expect(
      urlTerminologyIssues(
        doc('Pass the handoff context: workspace path, `projectUrl`, `baseUrl`.')
      )
    ).toEqual([]);
  });

  // Use 3: the environment variable itself. Allowed, and needed — the READMEs and
  // the setup skill have to name what a client `env` block holds.
  it('accepts the name where the subject is the environment', () => {
    expect(
      urlTerminologyIssues(
        doc(
          'Never put `FORMIO_PROJECT_URL` into a client configuration `env` block: an environment value is the weakest source.'
        )
      )
    ).toEqual([]);
  });

  it('judges the subject per paragraph, not per document', () => {
    const issues = urlTerminologyIssues(
      doc(
        'A paragraph about the environment naming `FORMIO_BASE_URL` as the weakest source.\n\nA later paragraph passing `FORMIO_PROJECT_URL` to the next phase.'
      )
    );

    expect(issues.map((issue) => issue.rule)).toEqual(['name.not_about_the_environment']);
  });

  it('rejects an unresolved Postman placeholder in prose but allows one in code', () => {
    expect(urlTerminologyIssues(doc('rooted at {{baseUrl}}/{{projectName}}/form'))[0].rule).toBe(
      'placeholder.unresolved_postman'
    );
    expect(
      urlTerminologyIssues(doc('equivalent to `{{baseUrl}}/{{projectName}}` in Postman'))
    ).toEqual([]);
  });
});

describe('the shipped skills library obeys it', () => {
  it('has no environment-variable name standing in for a slot or a handoff value', () => {
    const issues = urlTerminologyIssues(allSkillDocuments());

    expect(
      issues.map((issue) => `${issue.path}:${issue.line} [${issue.rule}] ${issue.message}`)
    ).toEqual([]);
  });
});
