// Shared helpers for the skill-description and conformance suites.
//
// Two enumeration scopes, deliberately distinct:
//   - topLevelSkills() — the routing surface. Trigger wording and collision
//     guards only make sense between skills the agent chooses among.
//   - allSkills() — every SKILL.md in the library, nested sub-skills included.
//     Clients other than Claude Code discover skills by recursive scan, so the
//     Agent Skills specification applies to all of them.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillUnderTest } from './conformance.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

export const DESCRIPTION_BUDGET = 1024;

export function topLevelSkills(): string[] {
  return readdirSync(skillsRoot).filter((entry) => statSync(join(skillsRoot, entry)).isDirectory());
}

function skillMdPathsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return skillMdPathsUnder(full);
    }
    return entry.isFile() && entry.name === 'SKILL.md' ? [full] : [];
  });
}

// Both separators, not the platform's: the enumerated paths come from path.join,
// so on Windows they are backslash-separated and a POSIX-only split would return
// the whole path as the directory name — failing name/directory agreement for
// every skill in the library. path.dirname is no help either; on POSIX it reads a
// backslash as an ordinary character.
export function directoryNameOf(skillMdPath: string): string {
  const segments = skillMdPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 2] ?? '';
}

// Every path this module reports is POSIX-separated, whatever the platform.
// They are compared against literals written POSIX-style — the exemption list
// below, and `startsWith('plugin/skills/...')` filters in the suites — and
// path.relative returns the platform's separator, so on Windows those
// comparisons silently stopped matching and the rules ran over documents they
// were meant to exempt.
export function toPosixPath(filePath: string): string {
  return filePath.split(/[/\\]/).join('/');
}

function frontmatterBlock(markdown: string, label: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`${label} has no YAML frontmatter block`);
  }
  return match[1];
}

// Frontmatter here is flat: top-level keys, values either inline or a folded
// block (`key: >-`). Nested mappings (metadata) are captured as their raw text,
// which is enough for key-level and length-level assertions.
function parseFrontmatter(block: string): Record<string, string> {
  const entries: Record<string, string> = {};
  let currentKey: string | undefined;
  for (const line of block.split('\n')) {
    const keyMatch = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      entries[currentKey] = keyMatch[2].trim();
      continue;
    }
    if (currentKey && line.trim()) {
      entries[currentKey] = `${entries[currentKey]} ${line.trim()}`.trim();
    }
  }
  return entries;
}

function normalize(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

function descriptionFrom(block: string, label: string): string {
  const folded = block.match(/^description: >-\n([\s\S]*?)(?=^\S|\s*$(?![\s\S]))/m);
  if (folded) {
    return normalize(folded[1]);
  }
  const inline = block.match(/^description:[ \t]+(.+)$/m);
  if (inline) {
    return normalize(inline[1]);
  }
  throw new Error(`${label} frontmatter has no description`);
}

export function allSkills(): SkillUnderTest[] {
  return skillMdPathsUnder(skillsRoot).map((skillMdPath) => {
    const relativePath = toPosixPath(relative(repoRoot, skillMdPath));
    const markdown = readFileSync(skillMdPath, 'utf8');
    const block = frontmatterBlock(markdown, relativePath);
    return {
      path: relativePath,
      directoryName: directoryNameOf(skillMdPath),
      frontmatter: parseFrontmatter(block),
      description: descriptionFrom(block, relativePath),
    };
  });
}

// Live instructions are not confined to SKILL.md — most of the orchestration
// prose lives in sibling reference documents, so portability rules have to be
// enforced over every markdown file in the library.
export interface SkillDocument {
  path: string;
  body: string;
}

// Exempt by explicit path, never by heuristic: formio-mcp-setup owns the
// per-client configuration table and reload list, so client-specific paths are
// its subject rather than a leak.
//
// Eval runbooks used to need an exemption too. They no longer live under
// plugin/ — see packages/skill-tests/evals/<skill>/ and the shipped-surface boundary suite — so the
// exemption was removed rather than kept as dead code.
export const CLIENT_SPECIFIC_DOC_EXEMPTIONS = ['plugin/skills/formio-mcp-setup/SKILL.md'] as const;

function markdownPathsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownPathsUnder(full);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

export function allSkillDocuments(): SkillDocument[] {
  return markdownPathsUnder(skillsRoot).map((docPath) => ({
    path: toPosixPath(relative(repoRoot, docPath)),
    body: readFileSync(docPath, 'utf8'),
  }));
}

export function liveSkillDocuments(): SkillDocument[] {
  const exempt = new Set<string>(CLIENT_SPECIFIC_DOC_EXEMPTIONS);
  return allSkillDocuments().filter((doc) => !exempt.has(doc.path));
}

export function skillDocument(path: string): SkillDocument {
  return { path, body: readFileSync(join(repoRoot, path), 'utf8') };
}

export function skillDocumentExists(path: string): boolean {
  return existsSync(join(repoRoot, path));
}

export function descriptionOf(skill: string): string {
  const label = `${skill}/SKILL.md`;
  const markdown = readFileSync(join(skillsRoot, skill, 'SKILL.md'), 'utf8');
  return descriptionFrom(frontmatterBlock(markdown, label), label);
}
