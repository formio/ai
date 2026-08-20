import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  EXIT_BASE_URL_UNRESOLVED,
  EXIT_FAILED,
  EXIT_NOT_CONFIGURED,
  EXIT_OK,
} from '../cli/project-command.js';

// `project get` is the preflight every skill runs, and its exit code is the whole
// interface: skills branch on it. Both READMEs enumerate those codes for a human
// or an agent reading the install route, so a code added in the CLI and not added
// here leaves the documentation describing a narrower contract than the command
// has — a reader branching on it treats the new code as unknown.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(packageRoot, '../..');

const READMES = [path.join(repoRoot, 'README.md'), path.join(packageRoot, 'README.md')];

describe('the documented `project get` exit codes', () => {
  const codes = [EXIT_OK, EXIT_NOT_CONFIGURED, EXIT_FAILED, EXIT_BASE_URL_UNRESOLVED];

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
