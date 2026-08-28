// The Base URL is DERIVED from the Project URL, and where it cannot be derived it
// is asked for. It has no default: `config.ts` leaves it undefined, and
// `https://api.form.io` is derived from a `form.io` host rather than filled in for
// everyone else — a customer project that took that value would send the portal
// login and the token-cache key to a deployment the user does not use.
//
// `server.json` already says "There is no default"; `llms-install.md` said the
// opposite, in the one document an agent reads while installing on a user's
// behalf. Two shipped install documents cannot disagree about which values a host
// should set.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkillDocuments, skillDocument } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

// Every document that tells somebody what to put in an environment block.
const INSTALL_DOCS = [
  'README.md',
  'plugin/README.md',
  'packages/mcp-server/README.md',
  'llms-install.md',
];

const documents = () => [...allSkillDocuments(), ...INSTALL_DOCS.map(skillDocument)];

describe('what the shipped documents say about the Base URL', () => {
  // The claim, in the shapes it is actually written in: a default, or a fallback
  // to api.form.io for anything other than a form.io host.
  it('never claims it defaults to anything', () => {
    const offenders = documents().flatMap(({ path, body }) =>
      body
        .split('\n')
        .map((line, index) => ({ path, line, number: index + 1 }))
        .filter(
          ({ line }) =>
            /base[ _-]?url/i.test(line) &&
            /\bdefaults? to\b/i.test(line) &&
            !/no default/i.test(line)
        )
    );

    expect(offenders.map(({ path, number, line }) => `${path}:${number} ${line.trim()}`)).toEqual(
      []
    );
  });

  it('tells an installing agent it is derived rather than supplied', () => {
    const { body } = skillDocument('llms-install.md');

    expect(body).toMatch(/derived/i);
    expect(body).toMatch(/no default|cannot be derived/i);
  });

  // server.json is the registry manifest; its own description is the value a host
  // renders beside its prompt, so it is held to the same rule.
  it('agrees with the registry manifest', () => {
    const manifest = readFileSync(join(repoRoot, 'server.json'), 'utf8');

    expect(manifest).toContain('There is no default');
  });
});

// The same rule from the other end: the environment is the WEAKEST project source,
// so "a tool says no project is configured" does not mean a variable is unset. It
// means nothing is recorded for that directory — and the fix is the record the
// error itself names, not an env block that any mapping overrides.
describe('what an install document says a missing project means', () => {
  it('sends the reader to the record rather than to the variable', () => {
    const { body } = skillDocument('llms-install.md');
    const [missing] = body.split('\n').filter((line) => /missing-configuration/.test(line));

    expect(missing).toBeDefined();
    expect(missing).toMatch(/project_set|project set/);
    expect(missing).not.toMatch(/`FORMIO_PROJECT_URL` is unset or wrong/);
  });
});

// The canonical copy is what an agent with NO server reads in order to derive the
// Base URL by the same rule the resolver applies. That rule is the project URL's
// PARENT PATH, not its origin: a deployment mounted at https://forms.mysite.com/one
// serves a project at https://forms.mysite.com/one/two, and flattening it to the
// origin builds the portal login against a host root that serves neither. The table
// showed only a single-segment example, where parent and origin coincide — so the
// one shape that distinguishes them was never stated on the path that needs it.
describe('the canonical derivation rule', () => {
  const canonical = () =>
    skillDocument('plugin/skills/formio-mcp-setup/references/project-urls.md');

  it('states the parent-path rule, and names the origin only to rule it out', () => {
    const { body } = canonical();

    expect(body).toMatch(/parent path|final path segment/i);

    // Not a ban on the word: the corrected prose has to be able to say that the
    // origin is NOT the rule. What is banned is a sentence asserting it.
    const affirmative = body
      .split('\n')
      .flatMap((line) => line.split(/(?<=\.)\s+/))
      .filter((sentence) => /origin/i.test(sentence) && !/\bnever\b|\bnot\b/i.test(sentence));

    expect(affirmative).toEqual([]);
  });

  it('shows a multi-segment project URL, where parent and origin differ', () => {
    const { body } = canonical();

    expect(body).toMatch(/https:\/\/forms\.mysite\.com\/one\/two/);
    expect(body).toMatch(/https:\/\/forms\.mysite\.com\/one\b/);
  });
});
