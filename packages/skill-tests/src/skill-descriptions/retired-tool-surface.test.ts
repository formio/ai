// No document an agent or a person reads describes the tool surface 1.0 retired.
//
// The rules run against synthetic lines first, so a failure names the rule, and then
// over the shipped library and the READMEs, so a regression names the file and line.

import { describe, expect, it } from 'vitest';
import { allSkillDocuments, skillDocument } from './helpers.js';
import { retiredSurfaceIssues, retiredSurfaceReport } from './retired-tool-surface.js';

const rulesFor = (body: string) =>
  retiredSurfaceIssues([{ path: 'synthetic.md', body }]).map((issue) => issue.rule);

// The documents that describe the server's tools to a person installing it.
const READMES = [
  'README.md',
  'packages/mcp-server/README.md',
  'packages/mcp-server/DOCKERHUB.md',
  'plugin/README.md',
  'llms-install.md',
];

describe('the retired-surface rules', () => {
  it.each([
    ['Call `action_types_list` for the catalog.', 'renamed.action_types_list'],
    ['List revisions with `form_revisions_list`.', 'renamed.form_revisions_list'],
    ['Call the `hello` tool to check the wiring.', 'renamed.hello'],
    ['Tools tab listing hello, form_create, form_get', 'renamed.hello'],
    ['Use `form_update` with `publish: true`.', 'form_update.publish_or_revert'],
    ['`draft`, `publish`, and `revert` are exclusive.', 'form_update.publish_or_revert'],
    ['- `role_create` — add a role (`title`, `admin: false`).', 'role_create.flat_fields'],
    ['`form_list` returns `forms` and `count`.', 'list.count'],
    ['The result carries "count": 10.', 'list.count'],
    ['`role_list` returns the count of roles on the page.', 'list.count'],
    [
      'Consent is cached in `~/.formio/revisions-license-consent.json`.',
      'revisions.consent_prompt',
    ],
    ['The tool prompts (elicitation, with a browser fallback).', 'revisions.consent_prompt'],
    ['It asks for consent to save without revision tracking.', 'revisions.consent_prompt'],
  ])('rejects %s', (body, rule) => {
    expect(rulesFor(body)).toContain(rule);
  });

  it.each([
    ['The SDK translation example', "  en: { hello: 'Hello' },"],
    ['The SDK translation lookup', 'console.log(i18n.t(\'hello\')); // "Bonjour"'],
    ['server_status', 'Call `server_status` first when other tools fail.'],
    ['The current list tools', 'Call `action_type_list`, then `form_revision_list`.'],
    ['Publish and revert as tools', 'Use `form_publish`, or `form_revert` with `version`.'],
    ['A nested role', '- `role_create` — pass `role: { title, description }`.'],
    ['The list contract', '`role_list` returns `roles`, `total` and `hasMore`.'],
    ['A component word count', '| `validate.maxWords` | `number` | Maximum word count. |'],
    ['acceptNoHistory', 'Retry with `acceptNoHistory: true` once the user agrees.'],
  ])('accepts %s', (_label, body) => {
    expect(rulesFor(body)).toEqual([]);
  });
});

describe('the shipped documents describe the 1.0 tool surface', () => {
  it('no skill document names a retired tool, argument, field or prompt', () => {
    const issues = retiredSurfaceIssues(allSkillDocuments());

    expect(issues, retiredSurfaceReport(issues)).toEqual([]);
  });

  it.each(READMES)('%s names no retired tool, argument, field or prompt', (path) => {
    const issues = retiredSurfaceIssues([skillDocument(path)]);

    expect(issues, retiredSurfaceReport(issues)).toEqual([]);
  });
});
