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
import { runCleanup } from './cleanup.js';
import { checkLiveTarget, coverageGaps, runPrefix } from './guards.js';
import { deploymentRequest, REPO_ROOT, startLiveSession, type LiveSession } from './harness.js';

const prefix = runPrefix(new Date());
const scratchDir = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
const state: Record<string, unknown> = {};

// What setup established. One const holder rather than reassigned module bindings:
// clean-up takes the target out of it once, so a second call (afterAll after Ctrl-C)
// has nothing left to do.
const run: {
  session?: LiveSession;
  target?: { projectUrl: string; baseUrl: string; originalTag: string | undefined };
} = {};

// Ctrl-C waits for clean-up before exiting; a deployment that stops answering must
// not hold the exit forever. Each request also times out on its own.
const SIGNAL_CLEANUP_LIMIT_MS = 2 * 60 * 1000;

async function cleanup(): Promise<void> {
  const active = run.target;
  delete run.target;
  removeProjectEntry({ cwd: scratchDir });
  rmSync(scratchDir, { recursive: true, force: true });
  if (!active) {
    return;
  }
  const report = await runCleanup({
    prefix,
    originalTag: active.originalTag,
    request: (request) =>
      deploymentRequest({
        cwd: REPO_ROOT,
        projectUrl: active.projectUrl,
        baseUrl: active.baseUrl,
        ...request,
      }),
  });
  console.log(
    `[live] clean-up for ${prefix}: ${report.deleted.forms} form(s), ${report.deleted.roles} role(s), ${report.deleted.tags} tag(s) deleted` +
      (report.restoredTag ? `; version restored to ${report.restoredTag}` : '')
  );
  if (report.problems.length > 0) {
    throw new Error(
      `Clean-up left work behind on ${active.projectUrl}:\n${report.problems.join('\n')}`
    );
  }
}

const onSignal = (signal: NodeJS.Signals) => {
  const limit = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`gave up after ${SIGNAL_CLEANUP_LIMIT_MS / 1000}s`)),
      SIGNAL_CLEANUP_LIMIT_MS
    ).unref()
  );
  void Promise.race([cleanup(), limit])
    .catch((error) => console.error(`[live] clean-up after ${signal} failed: ${String(error)}`))
    .finally(() => process.exit(130));
};

describe('live tools', () => {
  beforeAll(
    async () => {
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
      run.session = await startLiveSession({ cwd: REPO_ROOT });
      const session = run.session;

      // Decide the target before anything reaches the deployment: project_get resolves
      // locally and makes no request.
      const resolved = await session.call('project_get', { cwd: REPO_ROOT });
      const check = checkLiveTarget({
        resolvedProjectUrl: resolved.isError
          ? undefined
          : (resolved.structured?.projectUrl as string | undefined),
        resolveError: resolved.isError ? resolved.text : undefined,
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
      run.target = {
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
        await run.session?.close();
      }
    },
    5 * 60 * 1000
  );

  it('has a case for every tool the built server registers', async () => {
    const registered = await run.session!.toolNames();
    expect(coverageGaps({ registered, covered: LIVE_CASES.map((c) => c.tool) })).toEqual([]);
  });

  for (const liveCase of LIVE_CASES) {
    it(
      `${liveCase.tool}: ${liveCase.name}`,
      async () => {
        const { target, session: active } = run;
        if (!target || !active) {
          throw new Error('The live target was not established; see the setup error above.');
        }
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
