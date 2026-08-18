// Setting up the server and configuring a project are one errand for the user,
// so setup captures the project too — through the server's own command, never by
// editing its private state file and never by pinning an env var.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkillDocuments, skillDocument } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SETUP_MD = 'plugin/skills/formio-mcp-setup/SKILL.md';
const DEPLOYMENT_MD = 'plugin/skills/formio-application/DEPLOYMENT.md';

const setupBody = () => skillDocument(SETUP_MD).body;

describe('the setup skill captures the project configuration', () => {
  it('runs the step before the reload instruction', () => {
    const body = setupBody();
    const configIndex = body.indexOf('project set');
    const reloadIndex = body.indexOf('Reload');

    expect(configIndex).toBeGreaterThan(-1);
    expect(reloadIndex).toBeGreaterThan(-1);
    expect(configIndex).toBeLessThan(reloadIndex);
  });

  it('applies the configuration through the bin, not by hand', () => {
    const body = setupBody();

    expect(body).toMatch(/@formio\/mcp\S*\s+project set/);
    expect(body).toMatch(/--project-url/);
    expect(body).toMatch(/--base-url/);
    expect(body).toMatch(/--cwd/);
    expect(body).toMatch(/never edit .*projects\.json|not edit .*projects\.json/i);
  });

  it('refuses to pin the project through a client config env block', () => {
    const body = setupBody();

    expect(body).toMatch(/precedence/i);
    expect(body).toMatch(/FORMIO_PROJECT_URL/);
  });

  // The two variables resolve in opposite directions — the environment wins for
  // the project URL, the mapping wins for the base URL — and every shipped
  // manifest sets FORMIO_BASE_URL in its env block. Stating one rule for both
  // makes an agent "fix" a correct plugin install by stripping the variable.
  it('does not extend the project-URL precedence rule to the base URL', () => {
    const body = setupBody();
    const precedenceParagraph = body
      .split('\n')
      .filter((line) => /precedence/i.test(line))
      .join('\n');

    expect(precedenceParagraph).not.toMatch(/FORMIO_BASE_URL/);
  });

  it('says the mapping wins for the base URL', () => {
    const baseUrlParagraph = setupBody()
      .split('\n\n')
      .find((paragraph) => paragraph.includes('FORMIO_BASE_URL') && /wins/i.test(paragraph));

    expect(baseUrlParagraph, 'no paragraph explains that a mapped base URL wins').toBeDefined();
    expect(baseUrlParagraph).toMatch(/mapp(ed|ing)/i);
  });

  // `project get` runs in the agent's shell. A plugin-launched server has its own
  // env block, so the command cannot see what the server resolves, and reporting
  // it as the resolved truth is a claim the output does not support.
  it('scopes what project get can see to the shell it runs in', () => {
    expect(setupBody()).toMatch(/not visible|cannot see|this shell/i);
  });

  it('confirms with project get rather than asserting success', () => {
    expect(setupBody()).toMatch(/@formio\/mcp\S*\s+project get/);
  });

  it('asks for both URLs in one round and defers wording to DEPLOYMENT.md', () => {
    const body = setupBody();

    expect(body).toMatch(/one question round|ONE question round/);
    expect(body).toContain('DEPLOYMENT.md');
  });
});

describe('the configuration step never blocks setup', () => {
  it('states plainly that it can be skipped', () => {
    expect(setupBody()).toMatch(/skip/i);
  });

  it('names project_set as the first-tool-call fallback when skipped', () => {
    const body = setupBody();

    expect(body).toContain('project_set');
    expect(body).toMatch(/first .*tool call|first Form\.io tool call/i);
  });

  it('short-circuits when a mapping already exists', () => {
    expect(setupBody()).toMatch(/already/i);
  });

  // The escape hatch only ever covered a command that fails. This one does not:
  // an `@formio/mcp` older than 0.9.0 has no `project` command, so it ignores
  // the arguments, starts its stdio server, reads EOF and exits 0 with no
  // output. `project get` then "succeeds" silently and the agent reports a
  // mapping that was never written. The floor turns that into an npm resolution
  // failure the escape hatch already handles.
  it('says empty output means nothing is configured', () => {
    const body = setupBody();

    expect(body).toMatch(/prints nothing|no output|Empty output/i);
    expect(body).toMatch(/exits \*?\*?0|zero-exit/i);
  });

  it('treats a failed project set as a skipped step, not a failed setup', () => {
    const body = setupBody();

    expect(body).toMatch(/older|predates|unreachable|fails/i);
    expect(body).toMatch(/still|anyway/i);
  });

  it('no longer claims it collects no base URL', () => {
    const body = setupBody();

    expect(body).not.toMatch(/\*\*Not\*\* collecting an API key or a base URL/);
  });
});

// Every documented launch of the server pins the exact published version. An
// unpinned `npx -y @formio/mcp` resolves whatever the registry serves at run
// time, which is the "runtime URL that controls the agent" pattern skill
// scanners rate Medium, and it makes a shipped document describe a server the
// reader may not be running. `pnpm sync:pins` stamps the pin from
// packages/mcp-server/package.json, so a release cannot leave one behind —
// `pnpm sync:versions` is a different script and writes the plugin manifests'
// own `version` field.
describe('every documented invocation pins the server version', () => {
  // packages/mcp-server/README.md is the widest-travelling copy of all: it is
  // packed into the npm tarball (so it renders on npmjs.com) and copied into the
  // .mcpb desktop bundle.
  const REPO_DOCS = [
    'README.md',
    'plugin/README.md',
    'packages/mcp-server/README.md',
    'llms-install.md',
    'CONTRIBUTING.md',
  ];

  const serverVersion = () =>
    (
      JSON.parse(readFileSync(join(repoRoot, 'packages/mcp-server/package.json'), 'utf8')) as {
        version: string;
      }
    ).version;

  const allLines = () =>
    [...allSkillDocuments(), ...REPO_DOCS.map(skillDocument)].flatMap((doc) =>
      doc.body.split('\n').map((line) => ({ path: doc.path, line }))
    );

  it('finds the project invocations at all', () => {
    const invocations = allLines().filter(({ line }) =>
      /@formio\/mcp\S*\s+project\s+(get|set)\b/.test(line)
    );

    expect(invocations.length).toBeGreaterThan(0);
  });

  // A launch is a command that resolves the package at run time — `npx`,
  // `npm exec` or `pnpm dlx`, with or without a yes flag — a global install, or
  // the package string inside a config block's args array. The spellings mirror
  // scripts/sync-server-pin.ts on purpose, in both directions: a runner this
  // pattern misses is a launch the stamper also leaves floating, and a quoted
  // package name matched outside an args array is a `"dependencies"` entry or a
  // quoted `pnpm --filter` argument, neither of which is a launch. A prose
  // mention of the package name — "the `@formio/mcp` server", "an `@formio/mcp`
  // older than 0.9.0" — is not a launch either and carries no version, including
  // when it shares a line with one.
  const LAUNCH_PREFIX =
    '(?:(?:npx|npm\\s+exec|npm\\s+x|pnpm\\s+dlx|yarn\\s+dlx|bunx)\\s+(?:(?:-y|--yes)\\s+)?(?:--\\s+)?' +
    '|(?:npm\\s+(?:install|i)|pnpm\\s+add|yarn\\s+global\\s+add)\\s+(?:(?:-g|--global)\\s+)?' +
    '|["\']-{1,2}y(?:es)?["\'],\\s*["\']' +
    '|(?:"args"|\'args\'|args)\\s*[:=]\\s*\\[\\s*["\'])';

  const UNPINNED_LAUNCH = new RegExp(`${LAUNCH_PREFIX}@formio/mcp(?![@\\w-])`);

  // The same prefixes with a version attached. A line may carry a literal pin
  // only where one of these puts it, because `pnpm sync:pins` restamps exactly
  // what these match — a pin anywhere else keeps the version it was typed with
  // and fails the next release's version check with no command allowed to fix it.
  const PINNED_LAUNCH = new RegExp(`${LAUNCH_PREFIX}@formio/mcp@`, 'g');
  const LITERAL_PIN = /@formio\/mcp@[\w.^~>=-]+/g;

  // Asserting an empty result proves nothing about a spelling the pattern cannot
  // see: a document could launch the server unpinned and this suite would stay
  // green. So the pattern is exercised against each spelling directly, and
  // against the quoted forms that are not launches.
  it.each([
    'npx @formio/mcp',
    'npx -y @formio/mcp',
    'npx --yes @formio/mcp',
    'npm exec @formio/mcp',
    'npm exec -- @formio/mcp',
    'pnpm dlx @formio/mcp',
    'npm x @formio/mcp',
    'yarn dlx @formio/mcp',
    'bunx @formio/mcp',
    'npm install -g @formio/mcp',
    'npm i --global @formio/mcp',
    '"args": ["-y", "@formio/mcp"]',
    'args = ["@formio/mcp"]',
    "args = ['-y', '@formio/mcp']",
    "args = ['@formio/mcp']",
  ])('sees %s as an unpinned launch', (line) => {
    expect(UNPINNED_LAUNCH.test(line)).toBe(true);
  });

  it.each([
    'The `@formio/mcp` server exposes form_* tools.',
    '"dependencies": { "@formio/mcp": "^0.9.0" }',
    'pnpm --filter "@formio/mcp" test',
    '"identifier": "@formio/mcp"',
    'npx -y @formio/mcp@0.9.0',
    'npx -y @formio/mcp-utils',
    "args = ['-y', '@formio/mcp@0.9.0']",
  ])('does not see %s as an unpinned launch', (line) => {
    expect(UNPINNED_LAUNCH.test(line)).toBe(false);
  });

  it('pins the published version everywhere the package is launched', () => {
    const version = serverVersion();
    const unpinned = allLines().filter(({ line }) => UNPINNED_LAUNCH.test(line));

    expect(unpinned.map(({ path, line }) => `${path}: ${line.trim()}`)).toEqual([]);

    const wrongVersion = allLines()
      .flatMap(({ path, line }) =>
        [...line.matchAll(/@formio\/mcp@([\w.^~>=-]+)/g)].map((match) => ({
          path,
          spec: match[1],
        }))
      )
      .filter(({ spec }) => spec !== version);

    expect(wrongVersion.map(({ path, spec }) => `${path}: @formio/mcp@${spec}`)).toEqual([]);
  });

  // A pin `pnpm sync:pins` cannot see is a pin nothing maintains. The check above
  // requires every literal `@formio/mcp@<spec>` to equal the published version;
  // the stamper only rewrites launches. A version written into prose therefore
  // passes today and fails on the next server bump — in the Version Packages PR
  // and every PR after it — with CONTRIBUTING.md forbidding the only fix by hand.
  it('writes a literal pin only where the stamper can restamp it', () => {
    const unstampable = allLines().flatMap(({ path, line }) => {
      const pins = line.match(LITERAL_PIN)?.length ?? 0;
      const launches = line.match(PINNED_LAUNCH)?.length ?? 0;
      return pins > launches ? [`${path}: ${line.trim()}`] : [];
    });

    expect(unstampable).toEqual([]);
  });

  // The rule that replaced the version floor. Both documents that run
  // `project get` have to state it, or a zero-exit run printing nothing reads as
  // a real answer.
  it('tells the reader that empty output is not an answer', () => {
    for (const doc of [SETUP_MD, DEPLOYMENT_MD]) {
      expect(skillDocument(doc).body, doc).toMatch(/empty output is not|prints nothing/i);
    }
  });
});

describe('Deployment resolves before it asks', () => {
  it('checks for an existing mapping first', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const resolveIndex = body.search(/resolve before you ask/i);
    const interviewIndex = body.search(/Run the interview/i);

    expect(resolveIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeLessThan(interviewIndex);
  });

  it('confirms in one line instead of interviewing when one resolves', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);

    expect(body).toMatch(/confirm/i);
    expect(body).toMatch(/one line/i);
  });

  it('passes baseUrl to project_set and says why', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);

    expect(body).toMatch(/project_set\(\{[^}]*baseUrl/);
    expect(body).toMatch(/login/i);
  });

  // "Check whether the directory is mapped" is not actionable on its own: no MCP
  // tool reads the map, and this document forbids reading the file. Without the
  // command named here, the step is skipped or the JSON is read by hand.
  it('names the command that reads the mapping', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const resolveSection = body.slice(
      body.search(/resolve before you ask/i),
      body.search(/## Plain-language descriptions/i)
    );

    expect(resolveSection).toContain('project get');
  });

  // On the hosted SaaS the Base URL is always https://api.form.io and the project
  // is a *.form.io sub-domain. Deriving the base URL from the project's own origin
  // contradicts that, and project_set persists the result — keying the token cache
  // per project and pointing the login URL at the project sub-domain.
  it('derives the hosted cloud base URL for a project subdomain', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const derivationSection = body.slice(
      body.search(/### If only the Project URL is known/i),
      body.search(/## Validation/i)
    );
    const derivationRow = derivationSection
      .split('\n')
      .find((line) => line.startsWith('|') && /https:\/\/\w+\.form\.io`?\s*\|/.test(line));

    expect(derivationRow, 'no derivation row for a *.form.io project URL').toBeDefined();
    expect(derivationRow).toContain('https://api.form.io');
  });

  // Three shapes, and only three. The failures this guards are a doc that offers
  // a *.form.io host as a Base URL, api.form.io/<project> as a hosted Project
  // URL, or — the one added last — a customer deployment whose projects live on
  // sibling sub-domains rather than sub-directories.
  it('states all three valid URL shapes and rules out the wrong ones', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);

    expect(body).toMatch(/always\s+\*?\*?`?https:\/\/api\.form\.io/i);
    expect(body).toMatch(/three valid shapes/i);
    expect(body).toMatch(/sub-?domain project routing/i);
    expect(body).toMatch(/sub-?director(y|ies) project routing/i);
    expect(body).toMatch(/is \*\*never\*\* a Base URL|is never a Base URL/i);
  });

  // A project on a sibling sub-domain shares nothing with the deployment host but
  // the parent domain, so an origin-derived Base URL is wrong there in exactly the
  // way it is wrong on SaaS. The doc has to say so and send the agent to ask.
  it('refuses to derive a base URL for a customer sub-domain project', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const derivationSection = body.slice(
      body.search(/### If only the Project URL is known/i),
      body.search(/## Validation/i)
    );

    expect(derivationSection).toContain('https://myproject.mysite.com');
    expect(derivationSection).toMatch(/not derivable|cannot be derived/i);
    expect(derivationSection).toMatch(/ask for the Base URL/i);
  });

  // The check that came with the two-shape version rejected the sub-domain shape
  // outright: it required a non-SaaS project URL to be a path under the base URL.
  it('does not treat differing hosts as an error in the sub-domain shape', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const validationSection = body.slice(body.search(/## Validation/i));

    expect(validationSection).toMatch(/SUPPOSED to differ|differ by design/i);
    expect(validationSection).toMatch(/parent domain/i);
  });
});

// Step 3 is the only place the working directory gets mapped to a project.
// Skipping it wholesale on modify-existing left the server with no project at
// all, and Step 4's project_import threw after the user had already approved it.
describe('the modify-existing branch still maps the directory', () => {
  const orchestrator = () => skillDocument('plugin/skills/formio-application/SKILL.md').body;

  it('calls project_set from the FormioAppConfig values rather than only stashing them', () => {
    const body = orchestrator();
    const skipSentence = body
      .split('\n')
      .filter((line) => line.includes('FormioAppConfig'))
      .join('\n');

    expect(skipSentence).toContain('project_set');
  });

  it('says what is skipped is the interview, not the mapping', () => {
    const { body } = skillDocument(DEPLOYMENT_MD);
    const skipSection = body.slice(body.search(/## Skip conditions/i));

    expect(skipSection).toContain('project_set');
  });
});
