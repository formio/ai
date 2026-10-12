import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../../..');

const read = (document: string) => fs.readFileSync(path.join(REPO, document), 'utf8');
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

const SERVER_READMES = ['README.md', 'packages/mcp-server/README.md'];

// `project logout` and FORMIO_REQUEST_TIMEOUT are user-facing levers: each server
// README is an install route a reader follows without the other, so each names both.
describe('the server READMEs document sign-out and the request timeout', () => {
  it.each(SERVER_READMES)('%s documents project logout and what it takes', (document) => {
    const text = read(document);
    const describing = sentences(text).filter((sentence) => sentence.includes('project logout'));

    expect(describing.length, `${document} never mentions project logout`).toBeGreaterThan(0);
    expect(describing.join(' ')).toContain('--base-url');
    expect(describing.join(' ')).toContain('mcp-tokens.json');
  });

  it.each(SERVER_READMES)(
    '%s lists FORMIO_REQUEST_TIMEOUT in its environment table',
    (document) => {
      const row = read(document)
        .split('\n')
        .find((line) => line.startsWith('| `FORMIO_REQUEST_TIMEOUT`'));

      expect(row, `${document} has no FORMIO_REQUEST_TIMEOUT row`).toBeDefined();
      expect(row).toContain('`60`');
      expect(row).toMatch(/300/);
    }
  );

  it('the CLI reference table has a row for project logout', () => {
    const rows = read('packages/mcp-server/README.md')
      .split('\n')
      .filter((line) => line.startsWith('|') && line.includes('project logout'));

    expect(rows.length).toBeGreaterThan(0);
  });
});

// A record holds its project and its deployment as a pair, and halves are never
// combined across records, so no document may say a mapping borrows the
// environment's value for a half it leaves out.
describe('plugin/README.md follows the pair rule', () => {
  it('does not say a mapping falls back to environment values for an omitted half', () => {
    const offending = sentences(read('plugin/README.md')).filter(
      (sentence) => /fall(s|ing)? back/i.test(sentence) && /environment/i.test(sentence)
    );

    expect(offending).toEqual([]);
  });
});

describe('server.json lists FORMIO_REQUEST_TIMEOUT', () => {
  it('as an optional, non-secret variable', () => {
    const manifest = JSON.parse(read('server.json')) as {
      packages: Array<{
        environmentVariables?: Array<{ name: string; isRequired?: boolean; isSecret?: boolean }>;
      }>;
    };
    const variable = manifest.packages
      .flatMap((entry) => entry.environmentVariables ?? [])
      .find((entry) => entry.name === 'FORMIO_REQUEST_TIMEOUT');

    expect(variable).toBeDefined();
    expect(variable?.isRequired).toBe(false);
    expect(variable?.isSecret).toBe(false);
  });
});
