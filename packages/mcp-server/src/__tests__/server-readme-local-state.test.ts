// What the server READMEs say about the per-directory mapping and about
// FORMIO_INSECURE_TLS, both of which changed behaviour.
//
// A mapping used to answer only for the exact directory it was recorded for; it
// now answers for every directory beneath it, with the nearest mapped folder
// winning. FORMIO_INSECURE_TLS used to switch certificate verification off for the
// whole process (it set NODE_TLS_REJECT_UNAUTHORIZED=0); it now relaxes only
// requests to the configured deployment, and every other host is verified.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_READMES = ['README.md', 'packages/mcp-server/README.md'];
// The Docker Hub overview documents the variable too, so it is held to the same rule.
const INSECURE_TLS_DOCUMENTS = [...SERVER_READMES, 'packages/mcp-server/DOCKERHUB.md'];

const read = (document: string) => fs.readFileSync(path.join(REPO_ROOT, document), 'utf8');

// Sentences, split on a full stop followed by whitespace, so a claim is matched
// within the sentence that makes it rather than across a paragraph.
const sentences = (text: string) => text.split(/(?<=\.)\s+/);

describe('the per-directory mapping, as the server READMEs describe it', () => {
  it.each(SERVER_READMES)('%s says a mapping applies to its subdirectories', (document) => {
    const claim = sentences(read(document)).find((sentence) =>
      /\bmapping\b[^.]*\bsubdirector(y|ies)\b/i.test(sentence)
    );
    expect(claim, `${document} never says a mapping covers its subdirectories`).toBeDefined();
  });

  it.each(SERVER_READMES)('%s says the nearest mapped folder wins', (document) => {
    expect(read(document)).toMatch(/\bnearest mapped (folder|directory)\b[^.]*\bwins\b/i);
  });
});

describe('FORMIO_INSECURE_TLS, as the server documents describe it', () => {
  it.each(INSECURE_TLS_DOCUMENTS)(
    '%s confines it to the configured deployment wherever it says what it skips',
    (document) => {
      const describing = read(document)
        .split('\n')
        .filter((line) => line.includes('FORMIO_INSECURE_TLS') && /skip|verif/i.test(line));
      expect(describing.length, `no line in ${document} describes it`).toBeGreaterThan(0);
      for (const line of describing) {
        expect(line, `${document}: ${line}`).toMatch(
          /\bonly\b[^.|]{0,40}\bconfigured deployment\b/i
        );
      }
    }
  );

  it.each(INSECURE_TLS_DOCUMENTS)(
    '%s no longer says it turns verification off process-wide',
    (document) => {
      const text = read(document);
      expect(text).not.toContain('NODE_TLS_REJECT_UNAUTHORIZED');
      expect(text).not.toMatch(/skips verification entirely/i);
    }
  );
});
