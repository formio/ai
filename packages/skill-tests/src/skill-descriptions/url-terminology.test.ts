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
import { allSkillDocuments, skillDocument } from './helpers.js';
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

  // A fenced block that names the variable IS an environment block by construction —
  // a client `env` map, an `export` line, a Docker `-e` flag — and it has no
  // surrounding prose to state a subject. Judged as prose it read as a handoff value
  // and flagged every install document's own configuration snippet.
  it('accepts the name inside a fenced configuration block', () => {
    expect(
      urlTerminologyIssues(
        doc(
          'Write this into the client config:\n\n```json\n{ "env": { "FORMIO_PROJECT_URL": "https://examples.form.io" } }\n```'
        )
      )
    ).toEqual([]);
  });

  // The slot rules still reach inside code, because a slot in a template or a shell
  // line is the case that does real damage.
  it('still rejects a slot inside a fenced block', () => {
    const issues = urlTerminologyIssues(doc('```ts\nconst appUrl = "${FORMIO_PROJECT_URL}";\n```'));

    expect(issues.map((issue) => issue.rule)).toEqual(['slot.environment_variable_name']);
  });

  it('accepts a paragraph whose subject is the environment in its own words', () => {
    expect(
      urlTerminologyIssues(
        doc(
          'A project can come from a committed formio.json, from a mapping, or from `FORMIO_PROJECT_URL` in the environment — in that order, narrowest scope first.'
        )
      )
    ).toEqual([]);
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
  const report = (issues: ReturnType<typeof urlTerminologyIssues>) =>
    issues.map((issue) => `${issue.path}:${issue.line} [${issue.rule}] ${issue.message}`);

  it('has no environment-variable name standing in for a slot or a handoff value', () => {
    expect(report(urlTerminologyIssues(allSkillDocuments()))).toEqual([]);
  });

  // The rule binds every document that instructs somebody, and the skills are not
  // the only ones: an install document is what an agent reads while configuring a
  // host on a user's behalf, and a README is what a human reads. A slot spelled with
  // an environment-variable name tells either one to read a variable in order to
  // build a URL — the same wrong action, in the documents the validator never saw.
  it('binds the install documents too', () => {
    const docs = [
      'README.md',
      'plugin/README.md',
      'packages/mcp-server/README.md',
      'llms-install.md',
      'CONTRIBUTING.md',
    ].map(skillDocument);

    expect(report(urlTerminologyIssues(docs))).toEqual([]);
  });
});

// The subject test is meant to be narrow: the bare word "environment" is not enough,
// and neither is the bare word "shell". Widening it to accept any paragraph that
// merely MENTIONS a shell exempted most of these documents from the rule — a
// handoff-value misuse in a paragraph about running a command would pass, which is
// the case the rule exists to catch.
describe('what does not count as an environment subject', () => {
  it('rejects a bare mention of a shell', () => {
    const issues = urlTerminologyIssues(
      doc('Run the command in your shell, then pass `FORMIO_PROJECT_URL` to the next phase.')
    );

    expect(issues.map((issue) => issue.rule)).toEqual(['name.not_about_the_environment']);
  });

  it("still accepts the shell's own environment", () => {
    expect(
      urlTerminologyIssues(
        doc("The `Source:` line names `FORMIO_PROJECT_URL` in this shell's environment.")
      )
    ).toEqual([]);
  });
});
