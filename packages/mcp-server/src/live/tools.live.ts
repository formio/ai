/**
 * `pnpm test:live` — every registered tool, called over stdio against a real Form.io
 * project. Opt-in: the default `vitest run` never matches `*.live.ts`.
 *
 * The target is the project the repository folder resolves to, read with project_get
 * through the server, and the run refuses unless it equals FORMIO_LIVE_TEST_PROJECT.
 * Everything the run creates carries a per-run prefix and is removed in afterAll — and
 * on Ctrl-C — and the project's version is put back to what it was.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { removeProjectEntry } from '../project-map.js';
import { LIVE_CASES, type LiveContext } from './cases.js';
import { checkLiveTarget, cleanupPlan, coverageGaps, runPrefix } from './guards.js';
import { deploymentRequest, REPO_ROOT, startLiveSession, type LiveSession } from './harness.js';

const prefix = runPrefix(new Date());
const scratchDir = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
const state: Record<string, unknown> = {};

let session: LiveSession | undefined;
let target: { projectUrl: string; baseUrl: string; originalTag: string | undefined } | undefined;

const asList = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

async function cleanup(): Promise<void> {
  const active = target;
  target = undefined;
  removeProjectEntry({ cwd: scratchDir });
  rmSync(scratchDir, { recursive: true, force: true });
  if (!active) {
    return;
  }
  const request = (method: 'GET' | 'PUT' | 'DELETE', requestPath: string, body?: unknown) =>
    deploymentRequest({ ...active, method, path: requestPath, body });
  const [forms, roles, tags, current] = await Promise.all([
    request('GET', '/form?limit=10000&select=_id,name,path'),
    request('GET', '/role?limit=10000'),
    request('GET', '/tag?limit=10000'),
    request('GET', '/tag/current'),
  ]);
  const plan = cleanupPlan({
    prefix,
    forms: asList(forms) as Array<{ _id: string; name?: string; path?: string }>,
    roles: asList(roles) as Array<{ _id: string; title?: string }>,
    tags: asList(tags) as Array<{ _id: string; tag?: string; chunk?: boolean }>,
    originalTag: active.originalTag,
    currentTag: (current as { tag?: string } | undefined)?.tag,
  });
  const failures: string[] = [];
  const attempt = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      failures.push(`${label}: ${String(error)}`);
    }
  };
  for (const id of plan.deleteForms)
    await attempt(`form ${id}`, () => request('DELETE', `/form/${id}`));
  for (const id of plan.deleteRoles)
    await attempt(`role ${id}`, () => request('DELETE', `/role/${id}`));
  for (const id of plan.deleteTags)
    await attempt(`tag ${id}`, () => request('DELETE', `/tag/${id}`));
  if (plan.restoreTag !== undefined) {
    const tag = plan.restoreTag;
    await attempt(`restore version ${tag}`, () => request('PUT', '', { tag }));
  }
  console.log(
    `[live] clean-up for ${prefix}: ${plan.deleteForms.length} form(s), ${plan.deleteRoles.length} role(s), ${plan.deleteTags.length} tag(s) deleted` +
      (plan.restoreTag ? `; version restored to ${plan.restoreTag}` : '')
  );
  if (failures.length > 0) {
    throw new Error(`Clean-up left work behind on ${active.projectUrl}:\n${failures.join('\n')}`);
  }
}

const onSignal = (signal: NodeJS.Signals) => {
  void cleanup()
    .catch((error) => console.error(`[live] clean-up after ${signal} failed: ${String(error)}`))
    .finally(() => process.exit(130));
};

describe('live tools', () => {
  beforeAll(
    async () => {
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
      session = await startLiveSession({ cwd: REPO_ROOT });

      // Decide the target before anything reaches the deployment: project_get resolves
      // locally and makes no request.
      const resolved = await session.call('project_get', { cwd: REPO_ROOT });
      const check = checkLiveTarget({
        resolvedProjectUrl: resolved.structured?.projectUrl as string | undefined,
        allowedProjectUrl: process.env.FORMIO_LIVE_TEST_PROJECT,
      });
      if (!check.ok) {
        throw new Error(check.message);
      }
      const baseUrl = resolved.structured?.baseUrl;
      if (typeof baseUrl !== 'string') {
        throw new Error(
          `project_get reported no Base URL for ${check.projectUrl}: ${resolved.text}`
        );
      }

      // The first deployment call may open the portal login; its URL is on stderr.
      const listing = await session.call('project_tag_list', { cwd: REPO_ROOT });
      if (listing.isError) {
        throw new Error(`project_tag_list failed before the run: ${listing.text}`);
      }
      target = {
        projectUrl: check.projectUrl,
        baseUrl,
        originalTag: (listing.structured?.current as string | undefined) ?? '0.0.0',
      };
      console.log(
        `[live] running ${LIVE_CASES.length} cases against ${check.projectUrl} as ${prefix}`
      );
    },
    20 * 60 * 1000
  );

  afterAll(
    async () => {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      try {
        await cleanup();
      } finally {
        await session?.close();
      }
    },
    5 * 60 * 1000
  );

  it('has a case for every tool the built server registers', async () => {
    const registered = await session!.toolNames();
    expect(coverageGaps({ registered, covered: LIVE_CASES.map((c) => c.tool) })).toEqual([]);
  });

  for (const liveCase of LIVE_CASES) {
    it(
      `${liveCase.tool}: ${liveCase.name}`,
      async () => {
        if (!target || !session) {
          throw new Error('The live target was not established; see the setup error above.');
        }
        const active = session;
        const ctx: LiveContext = {
          // Every call targets the repository folder, the directory the guard checked.
          call: (tool, args = {}) => active.call(tool, { cwd: REPO_ROOT, ...args }),
          expect,
          prefix,
          projectUrl: target.projectUrl,
          scratchDir,
          state,
        };
        await liveCase.run(ctx);
      },
      10 * 60 * 1000
    );
  }
});
