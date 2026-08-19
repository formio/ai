// The second half of the preflight contract: having the tools is not the same as
// having a configured project.
//
// The server owns the URL wording now — the three shapes, the example values, the
// validation, the derivation — because it is the one component always present and
// its errors reach an agent that never read any skill. So each skill states only
// what it needs to talk to the user (what the two URLs ARE, and the two commands)
// and relays the rest.
//
// The sweep that keeps that honest has to distinguish BUILD-TIME project mapping
// from RUNTIME SDK configuration. `Formio.setBaseUrl` / `setProjectUrl` in the
// SDK, embed, and Angular docs configure the app being built, not this session's
// project, and they legitimately carry example URLs.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

// The handoff target carries no probe (it IS the fallback), and the planner calls
// no MCP tool by design — it writes template.md / template.json locally and says
// so, and `formio-application` has already probed before invoking it.
const EXEMPT = ['formio-mcp-setup', 'formio-resource-planner'];

function walk(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, name);
    return entry.isFile() && entry.name === name ? [full] : [];
  });
}

function allSkillMd(): string[] {
  return walk(skillsRoot, 'SKILL.md');
}

function probingSkillMd(): string[] {
  return allSkillMd().filter((path) => !EXEMPT.some((skill) => path.includes(`/${skill}/`)));
}

function allMarkdown(): string[] {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    });
  return collect(skillsRoot);
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function offenders(paths: string[], predicate: (text: string) => boolean): string[] {
  return paths.filter((path) => predicate(read(path))).map((path) => relative(repoRoot, path));
}

describe('every tool-calling skill probes the project configuration', () => {
  it('covers ten skills — the twelve SKILL.md files minus the two exemptions', () => {
    expect(allSkillMd()).toHaveLength(12);
    expect(probingSkillMd()).toHaveLength(10);
  });

  it('instructs running project get with the working directory', () => {
    expect(
      offenders(probingSkillMd(), (text) => !/project get/.test(text) || !/--cwd/.test(text))
    ).toEqual([]);
  });

  it('pins the server version on every project get invocation', () => {
    const unpinned = offenders(allMarkdown(), (text) =>
      [...text.matchAll(/npx[^\n]*?project (get|set)/g)].some(
        (match) => !/@formio\/mcp@\d/.test(match[0])
      )
    );

    expect(unpinned).toEqual([]);
  });

  it('relays the error rather than composing its own interview', () => {
    expect(
      offenders(probingSkillMd(), (text) => !/project set/.test(text) || !/relay/i.test(text))
    ).toEqual([]);
  });

  it('forbids guessing a base URL or hand-editing the project map', () => {
    expect(
      offenders(
        probingSkillMd(),
        (text) => !/~\/\.formio\/projects\.json/.test(text) || !/never/i.test(text)
      )
    ).toEqual([]);
  });

  it('defines both URLs in the skill so the agent can name what it asks for', () => {
    expect(
      offenders(probingSkillMd(), (text) => !/Project URL/.test(text) || !/Base URL/.test(text))
    ).toEqual([]);
  });

  it('names the resolved target before the first write', () => {
    expect(offenders(probingSkillMd(), (text) => !/form_create|project_import/.test(text))).toEqual(
      []
    );
  });

  // Three exit codes exist so a caller can tell "nothing is recorded here yet"
  // (interview) from "this command could not answer" (do not interview — an
  // unreadable map, a broken formio.json, a malformed URL). Every gate branched on
  // "non-zero" alone, which collapses them and sends the agent into the interview
  // whose `project set` then fails for the same unreported reason.
  it('distinguishes exit 1 from exit 2 rather than branching on non-zero alone', () => {
    expect(
      offenders(probingSkillMd(), (text) => !/exit(s)? `?2`?|exit code 2/i.test(text))
    ).toEqual([]);
  });

  it('leaves the planner with the tools preflight but no probe', () => {
    const planner = read(join(skillsRoot, 'formio-resource-planner/SKILL.md'));

    expect(planner).toContain('project_set');
    expect(planner).toMatch(/HTTP/);
    expect(planner).not.toMatch(/project get/);
  });

  // The planner's exemption rests on one claim: it calls no MCP tool. Its own
  // emission reference used to read as a set of calls to make — project_import,
  // form_create per resource, action_create per action — which would make the
  // highest-consequence write in the library the one write with no target
  // confirmation. The reference documents what the USER can do next, and it has
  // to say whose gate covers each option.
  it('frames the planner emission next-steps as the caller’s options, not its own calls', () => {
    const emission = read(
      join(skillsRoot, 'formio-resource-planner/references/phase-b-emission.md')
    );

    expect(emission).toMatch(/does not (run|make|call)|hand(s|ed)? (it|them|the pair) (back|to)/i);
    expect(emission).toMatch(/project get/);
  });

  it('keeps the planner from reading an environment variable to build a URL', () => {
    const plannerDocs = allMarkdown().filter((path) => path.includes('/formio-resource-planner/'));

    expect(offenders(plannerDocs, (text) => /\$FORMIO_PROJECT_URL/.test(text))).toEqual([]);
  });
});

describe('no skill restates the build-time URL guidance the server owns', () => {
  it('enumerates the three shapes nowhere', () => {
    expect(offenders(allMarkdown(), (text) => /three valid shapes/i.test(text))).toEqual([]);
  });

  // Matched on the deleted table's own rows rather than on "a table containing a
  // 2", which also describes formio-actions' action-priority table.
  it('carries no project get exit-code table', () => {
    expect(
      offenders(
        allMarkdown(),
        (text) =>
          /Nothing is mapped for this directory/i.test(text) ||
          /The command ran and failed/i.test(text) ||
          /Exit `1` and exit `2` are different answers/i.test(text)
      )
    ).toEqual([]);
  });

  it('carries no Base-URL derivation table', () => {
    expect(offenders(allMarkdown(), (text) => /not derivable/i.test(text))).toEqual([]);
  });

  it('carries no URL validation rules of its own', () => {
    expect(
      offenders(allMarkdown(), (text) => /Trailing slash\.|Strip trailing/i.test(text))
    ).toEqual([]);
  });

  it('deletes DEPLOYMENT.md and links to it nowhere', () => {
    expect(existsSync(join(skillsRoot, 'formio-application/DEPLOYMENT.md'))).toBe(false);
    expect(offenders(allMarkdown(), (text) => /DEPLOYMENT\.md/.test(text))).toEqual([]);
  });
});

// The companion that keeps the sweep from deleting correct documentation. These
// configure the generated application at runtime, not this session's mapping.
describe('runtime SDK URL documentation survives', () => {
  const runtimeDocs = [
    'formio-sdk/SKILL.md',
    'formio-sdk/references/setup.md',
    'formio-form/references/setup.md',
    'formio-auth/references/token-swap.md',
    'formio-angular/CONFIG.md',
  ];

  it('still documents setBaseUrl and setProjectUrl with example URLs', () => {
    for (const doc of runtimeDocs) {
      const text = read(join(skillsRoot, doc));

      expect(text, doc).toMatch(/setBaseUrl|setProjectUrl|apiUrl/);
    }
  });

  it('keeps at least one concrete example URL in the SDK setup reference', () => {
    const text = read(join(skillsRoot, 'formio-sdk/references/setup.md'));

    expect(text).toMatch(/https:\/\/[a-z-]+\.(form\.io|mysite\.com)/);
  });
});

// The gap this suite missed on its first pass: SETUP stopped interviewing, but
// the documents ABOUT setup still described an interview — and a parent SKILL.md
// is what an agent reads before it ever opens the phase doc it delegates to.
// Sweeping the descriptions of a flow, not just the flow itself.
describe('no document describes a URL interview that no longer exists', () => {
  const STALE_CLAIMS = [
    /runs? (its )?(full )?URL interview/i,
    /SETUP'?s? interview/i,
    /URLs are known/i,
    /URLs already captured/i,
  ];

  it.each(STALE_CLAIMS.map((pattern) => [String(pattern), pattern] as const))(
    'no skill document matches %s',
    (_label, pattern) => {
      expect(offenders(allMarkdown(), (text) => pattern.test(text))).toEqual([]);
    }
  );

  // Not a ban on the words: the corrected prose has to be able to SAY that SETUP
  // is not skipped. What is banned is asserting the skip.
  it('mentions skipping SETUP only to rule it out', () => {
    const claims = allMarkdown()
      .map((path) => [path, read(path)] as const)
      .flatMap(([path, text]) =>
        [...text.matchAll(/[^.]*skips? (its own )?SETUP[^.]*\./gi)].map(
          (match) => [relative(repoRoot, path), match[0].trim()] as const
        )
      );

    const affirmative = claims.filter(([, sentence]) => !/\bnot\b|\bnever\b/i.test(sentence));

    expect(affirmative).toEqual([]);
  });

  it('the angular parent points at SETUP as a resolver, not an interviewer', () => {
    const text = read(join(skillsRoot, 'formio-angular/SKILL.md'));

    expect(text).toContain('project get');
    expect(text).not.toMatch(/the URL interview/i);
  });
});

// Writing `Formio.setBaseUrl(...)` / `setProjectUrl(...)` into a user's
// application is BUILD-TIME work, even though the calls run at runtime — and the
// two values it writes have to be the ones the mapping reports. A hardcoded
// example host points the shipped app at a deployment the tooling never manages,
// which is the same split-brain the generated Angular `config.ts` is gated
// against, arrived at through the SDK instead.
//
// The predicate separates the two cases precisely: a call with an opening quote
// is a value being authored, while prose that merely names the methods (Angular's
// `FormioModule` calls them internally) has no parenthesis and needs no gate.
describe('authoring the SDK URL calls is gated on project get', () => {
  const AUTHORS_A_VALUE = /set(Base|Project)Url\('/;

  const authoringDocs = () => allMarkdown().filter((path) => AUTHORS_A_VALUE.test(read(path)));

  it('finds the authoring documents at all', () => {
    expect(authoringDocs().length).toBeGreaterThan(0);
  });

  it('every document that writes a URL value names project get', () => {
    expect(offenders(authoringDocs(), (text) => !/project get/.test(text))).toEqual([]);
  });

  it('every one of them says not to hardcode the example', () => {
    expect(
      offenders(authoringDocs(), (text) => !/do not hardcode|never hardcode/i.test(text))
    ).toEqual([]);
  });

  it('leaves prose that only names the methods ungated', () => {
    const proseOnly = [
      'formio-angular/AUTH.md',
      'formio-angular/formio-angular-resources/references/app-integration.md',
    ];

    for (const doc of proseOnly) {
      const text = read(join(skillsRoot, doc));

      expect(text, doc).toMatch(/setBaseUrl/);
      expect(AUTHORS_A_VALUE.test(text), `${doc} should not author a value`).toBe(false);
    }
  });
});

// The earlier shape sweep matched the literal phrase "three valid shapes", so a
// paraphrase walked straight through it — the embed setup guide enumerated the
// same routings in its own words.
describe('no document paraphrases the deployment routing shapes', () => {
  it('does not explain sub-directory versus sub-domain project routing', () => {
    expect(
      offenders(
        allMarkdown(),
        (text) =>
          /sub-?director(y|ies)[ ,-]+projects?/i.test(text) &&
          /sub-?domain[ ,-]+projects?/i.test(text)
      )
    ).toEqual([]);
  });
});

// `FormioAppConfig` renames both URLs, and not intuitively: `appUrl` is the
// PROJECT URL and `apiUrl` is the BASE URL — so a reader who assumes `apiUrl`
// means "the project's API root" wires the pair backwards. Every document that
// uses the property names has to say what they alias, and every document that
// supplies values for them is authoring build-time configuration and takes them
// from `project get` like everything else.
describe('the FormioAppConfig aliases are documented and gated', () => {
  // `{{ config.appUrl }}` in formio-actions is a DIFFERENT appUrl — a key in the
  // Form.io project's own public configuration, read by Email action templates.
  // Conflating the two is the mistake this exclusion prevents.
  const UNRELATED_APP_URL = [
    'formio-actions/SKILL.md',
    'formio-actions/references/action-types.md',
  ];

  const formioAppConfigDocs = () =>
    allMarkdown().filter((path) => {
      const rel = relative(join(repoRoot, 'plugin/skills'), path);
      if (UNRELATED_APP_URL.includes(rel)) return false;
      return /appUrl|apiUrl/.test(read(path));
    });

  it('finds the FormioAppConfig documents', () => {
    expect(formioAppConfigDocs().length).toBeGreaterThan(0);
  });

  // Bidirectional on purpose: prose reads "appUrl is the Project URL", while a
  // table row puts the canonical name first — `| Project URL | ... | appUrl |`.
  // Both state the alias, so requiring one order would force redundant prose into
  // the document that already says it most clearly.
  const statesAlias = (text: string, property: string, canonical: RegExp) =>
    new RegExp(`${property}[^\\n]{0,80}${canonical.source}`, 'i').test(text) ||
    new RegExp(`${canonical.source}[^\\n]{0,80}${property}`, 'i').test(text);

  it('every one states that appUrl is the Project URL', () => {
    expect(
      offenders(
        formioAppConfigDocs(),
        (text) => !statesAlias(text, 'appUrl', /Project URL|FORMIO_PROJECT_URL/)
      )
    ).toEqual([]);
  });

  it('every one states that apiUrl is the Base URL', () => {
    expect(
      offenders(
        formioAppConfigDocs(),
        (text) => !statesAlias(text, 'apiUrl', /Base URL|FORMIO_BASE_URL/)
      )
    ).toEqual([]);
  });

  it('every document that supplies values for them names project get', () => {
    const SUPPLIES_A_VALUE = /(appUrl|apiUrl):\s*['"`]|YOUR_FORMIO_(PROJECT|BASE)_URL/;

    expect(
      offenders(
        formioAppConfigDocs().filter((path) => SUPPLIES_A_VALUE.test(read(path))),
        (text) => !/project get/.test(text)
      )
    ).toEqual([]);
  });

  it('keeps the unrelated project-configuration appUrl disambiguated', () => {
    const text = read(join(skillsRoot, 'formio-actions/references/action-types.md'));

    expect(text).toMatch(/not[^.]{0,80}FormioAppConfig/i);
  });
});

// The sub-skill can be invoked directly, and it read its URLs out of the
// workspace's own config.ts. That file is a record, not the authority: a clone on
// a fresh machine, a re-pointed project, or a hand edit leaves it disagreeing with
// the mapping every build-time tool call resolves.
describe('the Angular sub-skill treats project get as the authority', () => {
  const subSkill = () => read(join(skillsRoot, 'formio-angular/formio-angular-resources/SKILL.md'));
  const interviewGuide = () =>
    read(join(skillsRoot, 'formio-angular/formio-angular-resources/references/interview-guide.md'));

  it('names project get in both the flow and its interview guide', () => {
    expect(subSkill()).toContain('project get');
    expect(interviewGuide()).toContain('project get');
  });

  it('does not present config.ts as the source to read URLs from first', () => {
    for (const [label, text] of [
      ['SKILL.md', subSkill()],
      ['interview-guide.md', interviewGuide()],
    ] as const) {
      expect(text, label).not.toMatch(/read (it|them) from `?src\/app\/config\.ts`? first/i);
    }
  });

  it('reconciles a disagreeing config.ts instead of trusting it', () => {
    expect(subSkill()).toMatch(/disagree|mismatch|differ/i);
  });
});

// A committed `formio.json` is now a third source of the resolved values, above
// the machine-local mapping. The skills need the vocabulary to say where a value
// came from — but not the precedence rule itself, which the server reports.
describe('the skills know about the committed configuration', () => {
  const EXEMPT_FROM_PROBE = ['formio-mcp-setup', 'formio-resource-planner'];

  const probing = () =>
    allSkillMd().filter((path) => !EXEMPT_FROM_PROBE.some((skill) => path.includes(`/${skill}/`)));

  it('every tool-calling skill names formio.json as a possible source', () => {
    expect(offenders(probing(), (text) => !/formio\.json/.test(text))).toEqual([]);
  });

  it('no skill document restates the precedence order or the .git boundary', () => {
    expect(
      offenders(
        allMarkdown(),
        (text) =>
          /outranks the (working-directory )?mapping/i.test(text) ||
          /walk(s|ing)? up (from|toward)/i.test(text) ||
          /\.git boundary/i.test(text)
      )
    ).toEqual([]);
  });

  it('formio-mcp-setup offers the repo scope only inside a git repository', () => {
    const text = read(join(skillsRoot, 'formio-mcp-setup/SKILL.md'));

    expect(text).toContain('--scope repo');
    expect(text).toMatch(/git repositor/i);
    expect(text).toMatch(/shared with everyone who clones|everyone who clones/i);
  });
});

// `committed-project-config` puts the file in the workspace of the application it
// configures, written by the skills that scaffold that application. Nothing did:
// the only skill offering `--scope repo` was formio-mcp-setup, which runs before a
// workspace exists and writes at `$(pwd)` — an ancestor of the app, which is the
// placement that spec calls a misconfiguration rather than a shortcut.
describe('the scaffolding skills record the target with the application', () => {
  it('CONFIG writes formio.json into the workspace it just configured', () => {
    const config = read(join(skillsRoot, 'formio-angular/CONFIG.md'));

    expect(config).toContain('formio.json');
    expect(config).toContain('--scope repo');
    expect(config).toMatch(/workspace root|workspace directory/i);
  });

  it('says the file belongs in the workspace, never an ancestor', () => {
    const config = read(join(skillsRoot, 'formio-angular/CONFIG.md'));

    expect(config).toMatch(/never (an|its) ancestor|not an ancestor|above the workspace/i);
  });
});

// The upward walk that makes per-folder targeting work is the same mechanism that
// makes a misplaced file broad. The sharpest instance is this repository: a file
// committed at its root would be found by every `project get` in the tree — every
// skill invocation, every eval run, every test that resolves a project.
describe('this repository carries no committed project configuration', () => {
  it('has no formio.json at its root', () => {
    expect(existsSync(join(repoRoot, 'formio.json'))).toBe(false);
  });

  it('has no formio.json in any tracked directory', () => {
    const tracked = execFileSync('git', ['ls-files', '--', '*formio.json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);

    expect(tracked).toEqual([]);
  });
});

// One configuration to think about: the Project URL. The Base URL is derived from
// it in every deployment shape but one — a path-less project URL on a customer
// domain — so presenting the two as co-equal values to configure asks every reader
// to reason about a value they will almost never supply.
describe('the Project URL is the single configuration', () => {
  const EXEMPT = ['formio-mcp-setup', 'formio-resource-planner'];
  const probing = () =>
    allSkillMd().filter((path) => !EXEMPT.some((skill) => path.includes(`/${skill}/`)));

  it('no skill presents the Base URL as a value the user routinely supplies', () => {
    expect(
      offenders(
        allMarkdown(),
        (text) =>
          /ask (for|the user for) both URLs/i.test(text) ||
          /capture both URLs/i.test(text) ||
          /supply both URLs/i.test(text)
      )
    ).toEqual([]);
  });

  it('the shared preflight says the Base URL is derived unless it cannot be', () => {
    expect(offenders(probing(), (text) => !/deriv/i.test(text))).toEqual([]);
  });

  it('no skill or README names the removed offering variable', () => {
    expect(offenders(allMarkdown(), (text) => /FORMIO_DEFAULT_PROJECT_URL/.test(text))).toEqual([]);
  });
});

// The guard that distinguishes a RENAME from a DELETION. The endpoint roots in the
// formio-api references say where an endpoint lives; they are renamed to a
// non-environment spelling, never removed. A sweep that deleted them would satisfy
// a "no FORMIO_* as a slot" assertion just as well as a rename does — so the count
// is asserted, not just the absence of the old form.
describe('endpoint roots are renamed, not removed', () => {
  const REFERENCE_DIR = join(skillsRoot, 'formio-api/references');

  const rootCount = () =>
    readdirSync(REFERENCE_DIR)
      .filter((name) => name.endsWith('.md'))
      .reduce(
        (total, name) =>
          total + [...read(join(REFERENCE_DIR, name)).matchAll(/\{(projectUrl|baseUrl)\}/g)].length,
        0
      );

  it('keeps a substantial number of endpoint roots in the new spelling', () => {
    // 171 project-URL slots plus 68 base-URL slots were measured before the rename;
    // a deletion would collapse this toward zero.
    expect(rootCount()).toBeGreaterThan(200);
  });

  it('uses no environment-variable name as an endpoint root', () => {
    const offending = readdirSync(REFERENCE_DIR)
      .filter((name) => name.endsWith('.md'))
      .filter((name) => /\$\{FORMIO_(PROJECT|BASE)_URL\}/.test(read(join(REFERENCE_DIR, name))));

    expect(offending).toEqual([]);
  });

  // Code spans and fences are stripped first, mirroring the documented rule: a
  // reference may legitimately NAME Postman's placeholder while explaining what it
  // maps to ("equivalent to bare `{{baseUrl}}/` in Postman"). What is banned is an
  // unresolved placeholder used as prose.
  it('leaves no unresolved Postman placeholder in prose', () => {
    const stripCode = (text: string) =>
      text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    const offending = readdirSync(REFERENCE_DIR)
      .filter((name) => name.endsWith('.md'))
      .filter((name) => /\{\{baseUrl\}\}/.test(stripCode(read(join(REFERENCE_DIR, name)))));

    expect(offending).toEqual([]);
  });
});
