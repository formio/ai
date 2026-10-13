import { describe, expect, it } from 'vitest';
import { runCleanup, type CleanupRequest } from './cleanup.js';

const PREFIX = 'mcplive20261013000000';

// One listing failing must not stop the rest of clean-up: each part of the plan runs
// on whatever could be listed, and the report names what could not be listed or
// removed.
describe('runCleanup', () => {
  const deployment = (failing: string[]) => {
    const sent: string[] = [];
    const request = async ({ method, path }: CleanupRequest): Promise<unknown> => {
      sent.push(`${method} ${path}`);
      if (failing.some((prefix) => path.startsWith(prefix)) && method === 'GET') {
        throw new Error(`GET ${path} answered 500`);
      }
      if (path.startsWith('/form?')) return [{ _id: 'f1', name: `${PREFIX}probe` }];
      if (path.startsWith('/role?')) return [{ _id: 'r1', title: `${PREFIX} role` }];
      if (path.startsWith('/tag?')) return [{ _id: 't1', tag: `0.0.1-${PREFIX}` }];
      if (path === '/tag/current') return { tag: `0.0.1-${PREFIX}` };
      return {};
    };
    return { sent, request };
  };

  it('still deletes forms and roles and restores the version when the tag listing fails', async () => {
    const { sent, request } = deployment(['/tag?']);
    const report = await runCleanup({ prefix: PREFIX, originalTag: '1.0.0', request });
    expect(sent).toContain('DELETE /form/f1');
    expect(sent).toContain('DELETE /role/r1');
    expect(sent).toContain('PUT ');
    expect(report.unlisted).toEqual(['tags']);
    expect(report.problems.join('\n')).toMatch(/tags could not be listed/);
  });

  it('restores the version even when the current version cannot be read', async () => {
    const { sent, request } = deployment(['/tag/current']);
    const report = await runCleanup({ prefix: PREFIX, originalTag: '1.0.0', request });
    expect(sent).toContain('PUT ');
    expect(report.unlisted).toEqual(['current version']);
  });

  it('reports nothing left when everything succeeds', async () => {
    const { request } = deployment([]);
    const report = await runCleanup({ prefix: PREFIX, originalTag: '1.0.0', request });
    expect(report.problems).toEqual([]);
    expect(report.deleted).toEqual({ forms: 1, roles: 1, tags: 1 });
    expect(report.restoredTag).toBe('1.0.0');
  });
});
