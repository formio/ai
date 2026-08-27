import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyPair } from '../pair-rule.js';
import { resolveProject, resolveProjectConfig } from '../project-resolver.js';

/**
 * The invariants asserted on the VALUE the tools receive, not on the label the report
 * prints beside it.
 *
 * Every existing test for the pairing rule checks `sources.baseUrl` — the enum naming
 * where a value came from. That enum is a description of the answer, and a description
 * can stay right while the answer goes wrong: making the resolver fall back to a
 * LOSING record's deployment (`winner.baseUrl ?? winner.derived ?? mappedEnv?.FORMIO_BASE_URL`)
 * — a direct violation of the rule this whole design is built on, and one that sends
 * the portal login and the token-cache key to a deployment the user does not use —
 * left the source label reading `unresolved` and passed the entire suite.
 *
 * So these assert the two things a tool actually consumes: `config.baseUrl` and
 * `config.projectUrl`, straight off `resolveProjectConfig`, which is the function
 * every project-scoped handler calls.
 */
describe('what resolveProjectConfig hands a tool', () => {
  let cacheDir: string;
  let repo: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-resolved-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-resolved-repo-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const seed = (env: Record<string, string>) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'projects.json'), JSON.stringify({ [repo]: { env } }));
  };
  const commit = (config: Record<string, string>) =>
    fs.writeFileSync(path.join(repo, 'formio.json'), JSON.stringify(config));
  const resolve = (env: NodeJS.ProcessEnv = {}) =>
    resolveProjectConfig(
      repo,
      { projectUrl: env.FORMIO_PROJECT_URL, baseUrl: env.FORMIO_BASE_URL },
      { cacheDir, onNote: () => {} }
    );

  describe('a deployment from a losing record never reaches it', () => {
    it('a committed project does not borrow the mapping’s deployment', () => {
      commit({ projectUrl: 'https://myproject.mysite.com' });
      seed({ FORMIO_BASE_URL: 'https://mapped.mysite.com' });

      const config = resolve();

      expect(config.projectUrl).toBe('https://myproject.mysite.com');
      // Nothing derives for this shape, so the ONLY way a value appears here is by
      // crossing records.
      expect(config.baseUrl).toBeUndefined();
    });

    it('a committed project does not borrow the environment’s deployment', () => {
      commit({ projectUrl: 'https://myproject.mysite.com' });

      const config = resolve({ FORMIO_BASE_URL: 'https://env.mysite.com' });

      expect(config.baseUrl).toBeUndefined();
    });

    it('a mapped project does not borrow the environment’s deployment', () => {
      seed({ FORMIO_PROJECT_URL: 'https://myproject.mysite.com' });

      const config = resolve({ FORMIO_BASE_URL: 'https://env.mysite.com' });

      expect(config.baseUrl).toBeUndefined();
    });

    it('the winning record’s own deployment IS handed over', () => {
      commit({ projectUrl: 'https://myproject.mysite.com', baseUrl: 'https://api.mysite.com' });
      seed({ FORMIO_BASE_URL: 'https://mapped.mysite.com' });

      expect(resolve().baseUrl).toBe('https://api.mysite.com');
    });
  });

  /**
   * Whatever a tool is handed must be a pair the chokepoint accepts. This is the
   * property the writers enforce at their end; asserted here on the read end, it holds
   * for records no writer produced — a hand-authored file, a hand-edited entry, an
   * environment variable — which is where every silent wrong pair has come from.
   */
  describe('the pair it hands over always passes the chokepoint', () => {
    const RECORDS = ['committed', 'mapping', 'environment'] as const;
    const PROJECTS = [
      'https://examples.form.io',
      'https://myproject.mysite.com',
      'https://forms.mysite.com/one/two',
    ];
    const DEPLOYMENTS = [
      undefined,
      'https://api.form.io',
      'https://forms.mysite.com',
      'https://forms.oldcorp.com',
    ];

    for (const record of RECORDS) {
      for (const projectUrl of PROJECTS) {
        for (const baseUrl of DEPLOYMENTS) {
          it(`${record}: ${projectUrl} + ${baseUrl ?? 'nothing'}`, () => {
            const env: NodeJS.ProcessEnv = {};
            if (record === 'committed') {
              commit({ projectUrl, ...(baseUrl ? { baseUrl } : {}) });
            } else if (record === 'mapping') {
              seed({
                FORMIO_PROJECT_URL: projectUrl,
                ...(baseUrl ? { FORMIO_BASE_URL: baseUrl } : {}),
              });
            } else {
              env.FORMIO_PROJECT_URL = projectUrl;
              if (baseUrl) {
                env.FORMIO_BASE_URL = baseUrl;
              }
            }

            let config;
            try {
              config = resolve(env);
            } catch {
              // Refusing outright is a valid answer for a record that cannot be used;
              // what must never happen is handing a tool a bad pair.
              return;
            }
            if (!config.baseUrl) {
              return;
            }
            expect(
              classifyPair(config.projectUrl, config.baseUrl),
              `handed a tool ${config.projectUrl} on ${config.baseUrl}`
            ).toBe('ok');
          });
        }
      }
    }
  });

  // The source label and the value have to agree: `unresolved` must mean there is no
  // value, or a caller branching on the label acts on a deployment the label denies.
  it('reports unresolved only when it hands over nothing', () => {
    commit({ projectUrl: 'https://myproject.mysite.com' });
    seed({ FORMIO_BASE_URL: 'https://mapped.mysite.com' });

    const { config, sources } = resolveProject(
      repo,
      { baseUrl: 'https://env.mysite.com' },
      { cacheDir, onNote: () => {} }
    );

    expect(sources.baseUrl).toBe('unresolved');
    expect(config.baseUrl).toBeUndefined();
  });
});
