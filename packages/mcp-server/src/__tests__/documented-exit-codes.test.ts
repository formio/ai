import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import * as projectCommand from '../cli/project-command.js';

/**
 * Every exit code the CLI actually exports, read off the module rather than listed
 * here.
 *
 * Listed by hand, this guarded the documentation against LOSING a code and not the
 * command against GAINING one — which is the direction the comment below leads with,
 * and the direction that has actually happened: `project set` grew an exit `3` while
 * both READMEs went on describing three codes.
 */
const CODES = Object.entries(projectCommand)
  .filter(([name, value]) => name.startsWith('EXIT_') && typeof value === 'number')
  .map(([, value]) => value as number)
  .sort((a, b) => a - b);

// `project get` is the preflight every skill runs, and its exit code is the whole
// interface: skills branch on it. Both READMEs enumerate those codes for a human
// or an agent reading the install route, so a code added in the CLI and not added
// here leaves the documentation describing a narrower contract than the command
// has — a reader branching on it treats the new code as unknown.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(packageRoot, '../..');

const READMES = [path.join(repoRoot, 'README.md'), path.join(packageRoot, 'README.md')];

// The SAME guarantee for `project set`, which reached exit `3` when a write was
// allowed to land on a directory a committed formio.json leaves without a deployment.
// Guarding only the reader let that happen silently: the command grew a code, the
// install route both READMEs print kept describing three, and a caller branching on
// the documented set treats the new one as an unknown failure — which is the reading
// that abandons the interview `3` exists to continue.
describe('the documented `project set` exit codes', () => {
  const codes = CODES;

  it.each(READMES)('%s enumerates every code the write can return', (readme) => {
    const text = fs.readFileSync(readme, 'utf8');
    // Split by SENTENCE, not by line: both READMEs describe the two subcommands in one
    // long footnote, so a per-line filter matched the paragraph that documents `project
    // get` and passed on its codes — a check that could not fail for the command it
    // names.
    const sentences = text.split(/(?<=[.!?])\s+/).filter((part) => /project set/.test(part));
    const documented = sentences.find((part) =>
      codes.every((code) => new RegExp(`\`${code}\``).test(part))
    );

    expect(
      documented,
      `${readme} has no sentence enumerating project set's exit codes; it names: ${sentences
        .filter((part) => /exit/.test(part))
        .join(' | ')}`
    ).toBeDefined();
  });
});

describe('the documented `project get` exit codes', () => {
  const codes = CODES;

  it.each(READMES)('%s enumerates every code the CLI can return', (readme) => {
    const text = fs.readFileSync(readme, 'utf8');
    const sentence = text
      .split('\n')
      .filter((line) => /exit(s|ing)? /.test(line) && /project get/.test(line))
      .join('\n');

    expect(sentence, `${readme} has no sentence enumerating project get exit codes`).not.toBe('');
    for (const code of codes) {
      expect(sentence, `${readme} does not document exit code ${code}`).toMatch(
        new RegExp(`\`${code}\``)
      );
    }
  });

  // The same footnote prescribes the command that maps a directory. Supplying a
  // base URL up front contradicts the resolution design — it is derived wherever
  // it can be, and asked for only when it cannot — so an install route that
  // always passes `--base-url` teaches the one habit the server exists to avoid.
  it.each(READMES)('%s does not prescribe --base-url alongside --project-url', (readme) => {
    const text = fs.readFileSync(readme, 'utf8');

    expect(text).not.toMatch(/project set --project-url <url> --base-url <url>/);
  });
});
