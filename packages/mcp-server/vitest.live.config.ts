import { defineConfig } from 'vitest/config';
import { systemCaArgs } from './src/live/guards.js';

// `pnpm test:live` only. The default config never matches `*.live.ts`, so a live run —
// which creates and deletes entities in a real Form.io project — is always opt-in.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/live/**/*.live.ts'],
    // The cases build on one another against one project, so they run in order in a
    // single file and worker.
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: ['verbose'],
    // The clean-up requests run in the test worker; it trusts the OS certificate store
    // the same way the server it starts does.
    execArgv: systemCaArgs(process.allowedNodeEnvironmentFlags),
  },
});
