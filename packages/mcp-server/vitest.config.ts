import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Vitest 4 dropped `dist` from the default excludes, and `build:dev` emits
    // the compiled tests there; without this they run a second time from JS.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
