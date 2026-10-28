// Structural tests for the `formio-uag` skill (plugin/skills/formio-uag/).
// These assert the authoring contract from the `formio-uag-skill` spec: the
// reference layout, the three-clause description, the facts an agent must not
// get wrong when it makes forms agent-ready (every custom property the UAG
// reads, the license split, the routes), and the build-time rules that keep
// it inside the library's guardrails (who writes forms, how the Run task
// action is added, where keys may live).

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-uag');
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

function descriptionOf(markdown: string): string {
  return frontmatterOf(markdown)
    .replace(/^name:.*$/m, '')
    .replace(/^description:\s*>-?\s*/m, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  const description = descriptionOf(read(skillMdPath));

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

  it('treats the UAG URL as a value the user supplies, never one project_get reports', () => {
    expect(skill).toMatch(/\*\*UAG URL\*\*/);
    expect(skill).toMatch(/never[^.]*`project_set`/i);
  });

  it('keeps project and admin keys out of browser code', () => {
    for (const path of allSkillDocs()) {
      const html = [...read(path).matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
      const leaking = html.filter((block) =>
        /x-admin-key|x-token|ADMIN_KEY|PROJECT_KEY/.test(block)
      );
      expect(leaking, path).toEqual([]);
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
