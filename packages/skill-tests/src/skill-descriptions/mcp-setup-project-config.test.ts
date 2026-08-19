// Setting up the server and configuring a project are one errand for the user,
// so setup captures the project too — through the server's own command, never by
// editing its private state file and never by pinning an env var.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkillDocuments, liveSkillDocuments, skillDocument } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SETUP_MD = 'plugin/skills/formio-mcp-setup/SKILL.md';

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

  // Keeping FORMIO_PROJECT_URL out of a client env block is still right, but the
  // REASON changed with the resolution order: it is the wrong scope for the value
  // — one global answer for every directory the client opens — not a pin. The
  // environment is the weakest source, so a value there is overridden by a
  // committed formio.json and by any project_set mapping.
  it('keeps the project URL out of a client config env block on scope grounds', () => {
    const body = setupBody();

    expect(body).toMatch(/FORMIO_PROJECT_URL/);
    expect(body).toMatch(/env.*block/i);
    expect(body).toMatch(/scope|one project for every directory|wrong place/i);
  });

  // The inverted claim is the one that does real damage: an agent reading it
  // abandons the project_set repair that now works, and tells the user their
  // directory cannot be redirected.
  it('never claims the environment outranks the mapping or defeats project_set', () => {
    const body = setupBody();

    expect(body).not.toMatch(/takes? \*\*precedence\*\* over the mapping/i);
    expect(body).not.toMatch(/takes? precedence over the mapping/i);
    expect(body).not.toMatch(/pins the server to one project/i);
    expect(body).not.toMatch(/silently do nothing/i);
    expect(body).not.toMatch(/that pin is real/i);
  });

  // Both URLs resolve in the SAME order now — committed file, mapping,
  // environment. The skill used to call FORMIO_BASE_URL "the opposite", which was
  // true only under the old split order.
  it('states one resolution order for both URLs', () => {
    const body = setupBody();

    expect(body).not.toMatch(/resolves the other way round/i);
    expect(body).not.toMatch(/is the opposite/i);
    expect(body).toMatch(/weakest/i);
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

  it("relays the server's message instead of carrying its own URL wording", () => {
    const body = setupBody();

    // The server owns this guidance now: its instructions and its errors carry the
    // shapes and the remedy, and they reach an agent that never read this skill.
    // A second copy here is the drift that removing the copies was meant to end.
    expect(body).toMatch(/relay/i);
    expect(body).not.toMatch(/three valid shapes/i);
    expect(body).not.toContain('DEPLOYMENT.md');
  });

  it('probes with project get before interviewing', () => {
    const body = setupBody();
    const probeIndex = body.indexOf('project get');
    const askIndex = body.search(/ask for the \*\*single value it names\*\*|relay that message/i);

    expect(probeIndex).toBeGreaterThan(-1);
    expect(askIndex).toBeGreaterThan(probeIndex);
  });

  it('asks for one value at a time, with either flag alone a valid update', () => {
    const body = setupBody();

    expect(body).toMatch(/single value it names/i);
    expect(body).toContain('--base-url');
    expect(body).toMatch(/[Ee]ither flag alone/);
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
    for (const doc of [SETUP_MD]) {
      expect(skillDocument(doc).body, doc).toMatch(/empty output is not|prints nothing/i);
    }
  });
});

// The URL interview is gone. What replaces it is a probe every tool-calling skill
// runs, and a server whose errors are answerable on their own — so the assertions
// move from "does the document explain the shapes" to "does the document delegate".
describe('the skills delegate project resolution to the server', () => {
  const probing = () =>
    liveSkillDocuments().filter(
      (doc) =>
        doc.path.endsWith('/SKILL.md') &&
        !doc.path.includes('formio-mcp-setup') &&
        !doc.path.includes('formio-resource-planner')
    );

  it('every tool-calling skill names the read surface', () => {
    const offenders = probing()
      .filter((doc) => !doc.body.includes('project get'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('no skill document explains the URL shapes itself', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => /three valid shapes/i.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('no skill document derives a base URL itself', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => /not derivable/i.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('DEPLOYMENT.md is gone and nothing links to it', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('DEPLOYMENT.md'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

// Both branches resolve the configuration in the Preflight. Skipping it on
// modify-existing left the server with no project at all, and the import threw
// after the user had already approved it — a workspace's own FormioAppConfig is
// not the mapping project_import resolves against.
describe('both orchestrator branches resolve the mapping', () => {
  const orchestrator = () => skillDocument('plugin/skills/formio-application/SKILL.md').body;

  it('resolves the configuration in the preflight rather than in a step', () => {
    const body = orchestrator();

    expect(body).toMatch(/## Preflight/);
    expect(body).toContain('project get');
    expect(body).not.toMatch(/### Step \d[\w.]* — Deployment/);
  });

  it('states that modify-existing resolves it too', () => {
    const body = orchestrator();
    const modifyLines = body
      .split('\n')
      .filter((line) => line.includes('FormioAppConfig'))
      .join('\n');

    expect(modifyLines).toMatch(/project get|mapping/i);
  });
});
