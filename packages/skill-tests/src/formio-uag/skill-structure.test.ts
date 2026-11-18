// Structural tests for the `formio-uag` skill (plugin/skills/formio-uag/).
// These assert the authoring contract from the `formio-uag-skill` spec: the
// reference layout, the three-clause description, the facts an agent must not
// get wrong when it makes forms agent-ready (every custom property the UAG
// reads, the license split, the routes), and the build-time rules that keep
// it inside the library's guardrails (who writes forms, how the Run task
// action is added, where keys may live).

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { skillsRoot } from '../source-facts/skill-text.js';
import { descriptionOf } from '../skill-descriptions/helpers.js';

const skillDir = join(skillsRoot, 'formio-uag');
const skillMdPath = join(skillDir, 'SKILL.md');
const referencesDir = join(skillDir, 'references');

const REFERENCES = [
  'patterns-and-licensing.md',
  'tasks.md',
  'form-properties.md',
  'workflows.md',
  'agent-api.md',
  'uag-js.md',
  'chat-widget.md',
  'mcp-clients.md',
  'ai-document.md',
  'deployment.md',
  'troubleshooting.md',
] as const;

// Every form-level setting and custom component property UAG 2.0 reads
// (demo/content/developers/form-properties.md in formio/uag).
const UAG_PROPERTIES = [
  'uagAnonymous',
  'uagChat',
  'uagChatInstructions',
  'uagField',
  'uagContext',
  'uagTools',
  'uagEngine',
  'uagThreshold',
  'uagUncertainBand',
  'uagOptionDescriptions',
  'uagScale',
  'uagOrderCheck',
  'uagConfidenceField',
  'uagAuthoritative',
  'uagAgentDecides',
] as const;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function reference(name: string): string {
  return read(join(referencesDir, name));
}

function frontmatterOf(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('SKILL.md has no YAML frontmatter block');
  }
  return match[1];
}

function allSkillDocs(): string[] {
  return [skillMdPath, ...readdirSync(referencesDir).map((name) => join(referencesDir, name))];
}

describe('formio-uag directory layout', () => {
  it('SKILL.md exists with name: formio-uag and a non-empty description', () => {
    expect(existsSync(skillMdPath)).toBe(true);
    const frontmatter = frontmatterOf(read(skillMdPath));
    expect(frontmatter).toMatch(/^name: formio-uag$/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it.each(REFERENCES)('references/%s exists, is non-empty, and has no frontmatter', (name) => {
    const path = join(referencesDir, name);
    expect(existsSync(path), `${name} missing`).toBe(true);
    const content = read(path);
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content.startsWith('---'), `${name} must not have frontmatter`).toBe(false);
  });

  it('links every reference from SKILL.md', () => {
    const skill = read(skillMdPath);
    const unlinked = REFERENCES.filter((name) => !skill.includes(`](./references/${name})`));
    expect(unlinked).toEqual([]);
  });

  it('ships no reference SKILL.md does not list', () => {
    const extra = readdirSync(referencesDir).filter(
      (name) => !(REFERENCES as readonly string[]).includes(name)
    );
    expect(extra).toEqual([]);
  });
});

describe('formio-uag description', () => {
  const description = descriptionOf('formio-uag');

  it('states the capability, then a trigger clause, then a Not for clause', () => {
    const triggers = description.indexOf('Use when the user asks to');
    const notFor = description.indexOf('Not for:');
    expect(triggers).toBeGreaterThan(0);
    expect(notFor).toBeGreaterThan(triggers);
  });

  it('claims the agentic-form intents', () => {
    for (const phrase of [
      'Universal Agent Gateway',
      'agent',
      'chat',
      'Run task',
      'MCP',
      '@formio/uag-js',
    ]) {
      expect(description, phrase).toContain(phrase);
    }
  });

  it('hands plain form, app, action and auth work to the skills that own it', () => {
    const notFor = description.slice(description.indexOf('Not for:'));
    for (const skill of [
      'formio-form-builder',
      'formio-form',
      'formio-application',
      'formio-actions',
      'formio-auth',
      'formio-mcp-setup',
    ]) {
      expect(notFor, skill).toContain(`\`${skill}\``);
    }
  });
});

describe('formio-uag facts', () => {
  it.each(UAG_PROPERTIES)('form-properties.md documents %s', (property) => {
    expect(reference('form-properties.md')).toContain(`\`${property}\``);
  });

  it('documents the uag tag as the switch that makes a form visible', () => {
    expect(reference('form-properties.md')).toMatch(/"tags": \["uag"\]/);
    expect(reference('tasks.md')).toMatch(/tagged `uag`/);
  });

  it('separates the license-free surfaces from Agentic Formflow', () => {
    const licensing = reference('patterns-and-licensing.md');
    expect(licensing).toMatch(/Agentic Formflow/);
    expect(licensing).toMatch(/`LICENSE_KEY`/);
    expect(licensing).toMatch(/hosted/);
    expect(licensing).toMatch(/stub-decision,stub-agent/);
    expect(licensing).toMatch(/license_required/);
  });

  it('puts a form’s agent operations under the form, and capabilities at the root', () => {
    const api = reference('agent-api.md');
    for (const route of [
      '{form}/agent/extract',
      '{form}/agent/decide',
      '{form}/agent/generate',
      '{form}/agent/chat',
      'GET /agent/capabilities',
    ]) {
      expect(api, route).toContain(route);
    }
  });

  it('names the Run task action by its machine name and its three settings', () => {
    const workflows = reference('workflows.md');
    expect(workflows).toContain('"name": "agentRunTask"');
    expect(workflows).toContain('"handler": ["before", "after"]');
    for (const setting of ['"task"', '"answer"', '"when"']) {
      expect(workflows, setting).toContain(setting);
    }
  });

  it('documents both token routes for MCP clients', () => {
    const mcp = reference('mcp-clients.md');
    expect(mcp).toContain('client_credentials');
    expect(mcp).toContain('formio-oss-x-admin-key');
    expect(mcp).toContain('MCP_OAUTH');
  });

  it('documents the uag-js registration and the chat entry point', () => {
    expect(reference('uag-js.md')).toContain("Formio.use(UAG('https://uag.example.com'))");
    expect(reference('chat-widget.md')).toContain('Formio.createChat(');
  });
});

describe('formio-uag build-time rules', () => {
  const skill = read(skillMdPath);

  it('carries a Security section', () => {
    expect(skill).toMatch(/^## Security/m);
  });

  it('writes form changes through formio-form-builder, not form_update', () => {
    expect(skill).toMatch(/`formio-form-builder`'s edit lane/);
    expect(skill).not.toMatch(/call `form_update`/);
  });

  it('never sends the Run task action to action_create', () => {
    expect(skill).toMatch(/`action_create`[^.]*refuse/);
    expect(reference('workflows.md')).toMatch(/`action_create`[^.]*refuse/);
  });

  // A first build gets its Run task actions from this skill, which edits the planner's
  // template before import; the orchestrator and planner stay unaware of the UAG.
  it('adds Run task to a first build template itself, leaving the orchestrator unaware', () => {
    const firstBuild = skill.match(/^### First build\n([\s\S]*?)(?=^#)/m)?.[1] ?? '';
    expect(firstBuild).toMatch(/`formio-resource-planner`/);
    expect(firstBuild).toMatch(/`agentRunTask`[^.]*`template\.json`/);
    expect(firstBuild).toMatch(/`template\.md`/);
    expect(firstBuild).toMatch(/hand the pair to `formio-application`/);
    for (const owner of ['formio-application', 'formio-resource-planner']) {
      const text = read(join(skillsRoot, owner, 'SKILL.md'));
      expect(text, owner).not.toMatch(/agentRunTask|formio-uag/);
    }
  });

  it('treats the UAG URL as a value the user supplies, never one project_get reports', () => {
    expect(skill).toMatch(/\*\*UAG URL\*\*/);
    expect(skill).toMatch(/never[^.]*`project_set`/i);
  });

  // HTML samples anywhere, and every sample in the two references whose code runs only
  // in the browser (the server-side relay that legitimately holds a key is in agent-api.md).
  it('keeps project and admin keys out of browser code', () => {
    const browserOnly = ['uag-js.md', 'chat-widget.md'].map((name) => join(referencesDir, name));
    for (const path of allSkillDocs()) {
      const fence = browserOnly.includes(path)
        ? /```\w*\n([\s\S]*?)```/g
        : /```html\n([\s\S]*?)```/g;
      const samples = [...read(path).matchAll(fence)].map((m) => m[1]);
      const leaking = samples.filter((block) =>
        /x-admin-key|x-token|ADMIN_KEY|PROJECT_KEY/.test(block)
      );
      expect(leaking, path).toEqual([]);
    }
  });

  // UAG 2.0.0 is released: `latest` names the newest 2.x on every package and on the
  // formio/uag and formio/uag-engines images, so the release-candidate channel is gone.
  it('resolves each package version from latest, checking it is 2.x', () => {
    const versions =
      reference('patterns-and-licensing.md').match(/^## Versions\n([\s\S]*?)(?=^## )/m)?.[1] ?? '';
    expect(versions).toMatch(/npm view [^`]*dist-tags/);
    expect(versions).toMatch(/`latest`[^.]*2\.x/);
    expect(skill).toMatch(/patterns-and-licensing\.md#versions/);
  });

  it('never points at the 2.0 release-candidate channel', () => {
    for (const path of allSkillDocs()) {
      const text = read(path);
      expect(text.match(/@formio\/uag[a-z-]*@rc\b|formio\/uag[a-z-]*:rc\b/g) ?? [], path).toEqual(
        []
      );
      expect(
        text.match(/2\.0\.0-rc\.\d+ or later|until 2\.0\.0 is released/gi) ?? [],
        path
      ).toEqual([]);
    }
  });

  // UAG 2.0.0 needs @formio/appserver-core 2.26.4 (src/index.ts in formio/uag).
  it('names the appserver minimum UAG 2.0.0 checks for', () => {
    for (const path of allSkillDocs()) {
      expect(read(path).match(/2\.26\.[0-3]\b/g) ?? [], path).toEqual([]);
    }
    expect(reference('deployment.md')).toContain('2.26.4');
  });

  // @formio/uag-extras 2.x takes the UAG's major; formio/uag-documents:1 is the
  // release candidates' 1.0.0 (CHANGELOG 2.0.1 in formio/uag).
  it('runs AI Document from formio/uag-documents 2.x, never the rc-era :1', () => {
    for (const path of allSkillDocs()) {
      expect(read(path).match(/formio\/uag-documents:1\b/g) ?? [], path).toEqual([]);
    }
    expect(reference('patterns-and-licensing.md')).toMatch(/formio\/uag-documents:2/);
  });

  // ai.form.io is the demo's UAG, not a documentation site (CHANGELOG 2.0.1).
  it('links the UAG documentation where it is published', () => {
    for (const path of allSkillDocs()) {
      expect(read(path).match(/ai\.form\.io\/(developers|examples)/g) ?? [], path).toEqual([]);
    }
    expect(skill).toContain(
      'https://github.com/formio/uag/blob/main/demo/content/developers/index.md'
    );
  });

  it('runs a chained Run task after the save', () => {
    const chaining =
      reference('workflows.md').match(/^## Chaining tasks\n([\s\S]*?)(?=^## )/m)?.[1] ?? '';
    expect(chaining).toMatch(/must run \*\*after the save\*\*/i);
  });

  // Only `uag` applies to what is inside a container; the other settings go on each field.
  it('sets every property but uag on each field, not on a container', () => {
    expect(reference('form-properties.md')).toMatch(
      /Only `uag` applies to what is inside a container/
    );
  });

  it('pins every UAG package and image it writes', () => {
    for (const path of allSkillDocs()) {
      const text = read(path);
      expect(text.match(/image:\s*formio\/uag(-engines)?\s*(#.*)?$/gm) ?? [], path).toEqual([]);
      expect(text.match(/@formio\/uag[a-z-]*@\d+\//g) ?? [], path).toEqual([]);
      expect(
        text.match(/npm install[^`\n]*@formio\/uag[a-z-]*(?![a-z-]*@)(?=[\s`])/g) ?? [],
        path
      ).toEqual([]);
    }
  });

  it('never recommends the deprecated UAG_LICENSE variable', () => {
    for (const path of allSkillDocs()) {
      const text = read(path);
      const mentions = text.match(/UAG_LICENSE/g) ?? [];
      const deprecations = text.match(/`UAG_LICENSE`[^.\n]*deprecated/gi) ?? [];
      expect(mentions.length, path).toBe(deprecations.length);
    }
  });

  it('uses the task vocabulary, not the pre-2.0 persona name, in request bodies', () => {
    for (const path of allSkillDocs()) {
      expect(read(path), path).not.toMatch(/"persona":/);
    }
  });
});
