// The channels the release workflow publishes to.
//
// Smithery shut down its connection services on October 31, 2026
// (https://smithery.ai/future): its API refuses updates ("Updating servers has
// been removed"), so a publish step fails every release and takes the steps
// after it down. The workflow publishes nothing there.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');

// The workflow's commands and settings, without its comments: a comment may
// still say why Smithery is gone.
const code = workflow
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('the release workflow', () => {
  it('publishes nothing to Smithery', () => {
    expect(code).not.toMatch(/smithery/i);
  });

  it('reads no Smithery credential', () => {
    expect(workflow).not.toContain('SMITHERY_API_KEY');
  });
});
