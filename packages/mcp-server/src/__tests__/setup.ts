import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterAll } from 'vitest';

// Redirect ~/.formio to a per-worker tmp dir by overriding HOME before any
// test module loads project-map.ts / token-cache.ts (which compute their
// DEFAULT_CACHE_DIR from os.homedir() at import time). This lets tests
// exercise tool registrations without threading a cacheDir option through
// production code paths.
const tmpHome = fs.mkdtempSync(
  path.join(os.tmpdir(), `formio-test-home-${process.env.VITEST_WORKER_ID ?? '0'}-`)
);
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

// And no project from the shell that started vitest. FORMIO_PROJECT_URL is a
// project configured for EVERY directory, which inverts every "nothing is
// configured here" assertion in the suite — silently, and only on the machines
// where it happens to be exported. A case that wants one sets it itself.
delete process.env.FORMIO_PROJECT_URL;
delete process.env.FORMIO_BASE_URL;

beforeEach(() => {
  fs.rmSync(path.join(tmpHome, '.formio'), { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});
