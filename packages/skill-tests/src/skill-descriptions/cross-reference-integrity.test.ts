// Cross-references between skill documents must survive editing.
//
// The fragile pattern this suite kills: citing a location by LINE NUMBER
// ("see template-json.md lines 555–590"). Every insertion above line 555
// silently redirects the citation somewhere else, and the rot is invisible —
// the reader follows the pointer, lands on unrelated prose, and either gives up
// or trusts what they find. The auth skill's citations had drifted ~70 lines
// before anyone noticed.
//
// Three rules, each closing one way a pointer can rot:
//   1. No line-number citations at all. Cite a heading; headings move with
//      their content.
//   2. Every `→ "Heading"` citation resolves to a real heading in a file the
//      same line actually names (or in the citing file itself). A citation that
//      names no file makes the reader guess which of eleven skills owns it.
//   3. Every relative markdown link resolves to a file that exists.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSkillDocuments } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

// "lines 555–590", "line 162" — en dash, em dash, or hyphen.
const LINE_CITATION = /\blines?\s+\d+(?:\s*[–—-]\s*\d+)?\b/i;

// `→ "X"`, `see "X"`, `under "X"` — the citation forms the library uses.
const CITATION = /(?:→|->|\bsee\b|\bunder\b)\s+"([^"]{3,140})"/g;

// Markdown paths named on the same line, left of the citation.
const NAMED_PATH =
  /\[[^\]]*\]\(([^)#\s]+)[^)]*\)|`([^`\s]+\.md)`|(?<![\w/])([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.md)/g;

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

type Doc = { path: string; rel: string; lines: string[]; anchors: string[] };

function normalizeHeading(text: string): string {
  return text
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/[*_]/g, '')
    .replace(/^\d+[.)]\s+/, '') // numbered headings: "9. Designing the ViewComponent…"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A citable anchor is a heading, a bold run (`**Label.**` sub-sections), or a
// bullet key (`- Admin operations: …` in a template's output block). The
// library cites all three, so all three count as resolved.
function anchorsIn(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const heading = /^#{1,6}\s+(\S.*?)\s*$/.exec(line);
    if (heading) {
      return [normalizeHeading(heading[1])];
    }
    const bullet = /^\s*[-*]\s+`?\*{0,2}([^`*:—]{3,80})\*{0,2}`?\s*[:—]/.exec(line);
    const bolds = [...line.matchAll(/\*\*([^*]{3,120})\*\*/g)].map((match) =>
      normalizeHeading(match[1])
    );
    return [...(bullet ? [normalizeHeading(bullet[1])] : []), ...bolds];
  });
}

const docs: Doc[] = allSkillDocuments().map((doc) => {
  const lines = doc.body.split('\n');
  return {
    path: join(repoRoot, doc.path),
    rel: doc.path,
    lines,
    anchors: anchorsIn(lines),
  };
});

const byPath = new Map(docs.map((doc) => [doc.path, doc]));

function hasHeading(path: string, wanted: string): boolean {
  const doc = byPath.get(path);
  if (!doc) {
    return false;
  }
  // Prefix match: a citation may name the stable head of a heading whose tail
  // is a clarifying dash clause ("Group Assignment (Group Permissions)" for
  // "… — has three parts").
  return doc.anchors.some((anchor) => anchor === wanted || anchor.startsWith(wanted));
}

// The skill directory owning a document — the parent of `references/`, so a bare
// `SKILL.md` cited from inside `references/` resolves to its own skill.
function skillRootOf(path: string): string {
  const rel = path.slice(skillsRoot.length + 1);
  const [top] = rel.split('/');
  const nested = join(skillsRoot, top, rel.split('/')[1] ?? '');
  return existsSync(join(nested, 'SKILL.md')) ? nested : join(skillsRoot, top);
}

// `template.md` / `template.json` name the artifact the planner EMITS, not a
// checked-in file. A citation into one is a citation into the spec that defines
// it, which is where drift between instruction and spec shows up.
const ARTIFACT_SPECS: Record<string, string> = {
  'template.md': 'plugin/skills/formio-resource-planner/references/template-md.md',
  'template.json': 'plugin/skills/formio-resource-planner/references/template-json.md',
};

function candidatesFor(named: string, from: string): string[] {
  const bare = named.replace(/^\.\//, '');
  const spec = ARTIFACT_SPECS[bare];
  if (spec) {
    return [join(repoRoot, spec)];
  }
  const rel = from.slice(skillsRoot.length + 1);
  const direct = [
    normalize(join(dirname(from), bare)),
    normalize(join(skillRootOf(from), bare)),
    normalize(join(skillsRoot, rel.split('/')[0], bare)), // the top-level skill, for a nested sub-skill
    normalize(join(repoRoot, bare)),
    normalize(join(skillsRoot, bare)),
  ];
  // A multi-segment path may be written relative to any skill root.
  const suffixed = bare.includes('/')
    ? docs.filter((doc) => doc.path.endsWith(`/${bare}`)).map((doc) => doc.path)
    : [];
  return [...direct, ...suffixed];
}

describe('skill cross-references', () => {
  it('cites no location by line number', () => {
    const offenders = docs.flatMap((doc) =>
      doc.lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => LINE_CITATION.test(line))
        .map(({ line, number }) => `${doc.rel}:${number} — ${line.trim().slice(0, 160)}`)
    );
    expect(
      offenders,
      'Line numbers rot on the next edit above them. Cite the heading instead: `file.md` → "Heading".'
    ).toEqual([]);
  });

  it('resolves every heading citation to a heading in a file the line names', () => {
    const offenders = docs.flatMap((doc) =>
      doc.lines.flatMap((line, index) => {
        const found: string[] = [];
        for (const match of line.matchAll(CITATION)) {
          const wanted = normalizeHeading(match[1]);
          if (hasHeading(doc.path, wanted)) {
            continue; // a section of the citing document
          }
          const named = [...line.slice(0, match.index).matchAll(NAMED_PATH)]
            .flatMap((pathMatch) => [pathMatch[1], pathMatch[2], pathMatch[3]])
            .filter((value): value is string => Boolean(value));
          const resolved = named.flatMap((name) => candidatesFor(name, doc.path));
          if (resolved.some((candidate) => hasHeading(candidate, wanted))) {
            continue;
          }
          const elsewhere = docs.filter((other) => hasHeading(other.path, wanted));
          const hint =
            elsewhere.length > 0
              ? `heading lives in ${elsewhere.map((other) => other.rel).join(', ')} — name that file on this line`
              : 'no such heading anywhere — the section was renamed or never existed';
          found.push(`${doc.rel}:${index + 1} — "${match[1]}": ${hint}`);
        }
        return found;
      })
    );
    expect(offenders).toEqual([]);
  });

  it('resolves every relative markdown link', () => {
    const offenders = docs.flatMap((doc) =>
      doc.lines.flatMap((line, index) =>
        [...line.matchAll(LINK)]
          .map((match) => match[1].split('#')[0])
          .filter((target) => target && !/^(https?:|mailto:)/.test(target))
          .filter((target) => {
            const bare = target.replace(/^\.\//, '');
            return ![
              normalize(join(dirname(doc.path), bare)),
              normalize(join(repoRoot, bare)),
            ].some((candidate) => existsSync(candidate));
          })
          .map((target) => `${doc.rel}:${index + 1} — ${target}`)
      )
    );
    expect(offenders).toEqual([]);
  });
});
