// Vitest setup. Runs before every test file.
//
// `@formio/js` pulls in DOM-dependent modules (dragula, DOMPurify, etc.) at
// import time, so `vitest.config.ts` picks `happy-dom` as the test
// environment. Nothing else needs configuring here — the file exists so we
// have a stable place to hang future cross-cutting setup (e.g. fetch mocks,
// localStorage resets).

export {};
