import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../../..');

// FORMIO_API_KEY applies only to the project on FORMIO_PROJECT_URL's origin. Every
// document that describes the key says so, so a setup with the key and only a
// mapping or a committed file is not surprised by the portal login.
const READMES = ['packages/mcp-server/README.md', 'README.md', 'plugin/README.md'];

describe('FORMIO_API_KEY documentation', () => {
  it.each(READMES)('%s ties the key to FORMIO_PROJECT_URL', (document) => {
    const text = fs.readFileSync(path.join(REPO, document), 'utf8');
    // The lines that describe what the key does: it skips the browser, or attaches x-token.
    const describing = text
      .split('\n')
      .filter((line) => line.includes('FORMIO_API_KEY') && /skip|x-token/.test(line));
    expect(describing.length, `no line in ${document} describes FORMIO_API_KEY`).toBeGreaterThan(0);
    for (const line of describing) {
      expect(line, `${document}: ${line}`).toContain('FORMIO_PROJECT_URL');
    }
  });

  it('server.json ties the key to FORMIO_PROJECT_URL', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'server.json'), 'utf8')) as {
      packages: Array<{ environmentVariables?: Array<{ name: string; description: string }> }>;
    };
    const descriptions = manifest.packages
      .flatMap((entry) => entry.environmentVariables ?? [])
      .filter((variable) => variable.name === 'FORMIO_API_KEY')
      .map((variable) => variable.description);
    expect(descriptions.length).toBeGreaterThan(0);
    for (const description of descriptions) {
      expect(description).toContain('FORMIO_PROJECT_URL');
    }
  });
});
